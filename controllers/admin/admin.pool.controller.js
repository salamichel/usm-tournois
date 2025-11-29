const { adminDb } = require('../../services/firebase');
const { writeBatch } = require('firebase/firestore');
const { getDocById, getTeamNameById } = require('../../services/admin.firestore.utils');
const { sendFlashAndRedirect } = require('../../services/response.utils');
const { calculatePoolRanking, updateMatchScoresAndStatus, propagateEliminationMatchResults } = require('../../services/match.service');
const { generateEliminationBracket } = require('../../services/elimination.service');

// Fonction pour afficher la page de gestion des poules d'un tournoi
exports.showPoolsManagement = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = await getDocById('events', tournamentId);

        if (!tournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }

        const minPlayersPerTeam = tournament.minPlayersPerTeam || 0;

        // 1. Récupérer toutes les équipes inscrites au tournoi
        const allTeamsSnapshot = await adminDb.collection('events').doc(tournamentId).collection('teams').get();
        let allTeams = allTeamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Récupérer les poules existantes pour ce tournoi et les équipes déjà assignées
        const poolsSnapshot = await adminDb.collection('events').doc(tournamentId).collection('pools').get();
        const pools = await Promise.all(poolsSnapshot.docs.map(async (poolDoc) => {
            const pool = { id: poolDoc.id, ...poolDoc.data() };
            // Récupérer les matchs pour chaque poule
            const matchesSnapshot = await adminDb.collection('events').doc(tournamentId).collection('pools').doc(pool.id).collection('matches').orderBy('matchNumber').get();
            pool.matches = matchesSnapshot.docs.map(matchDoc => {
                const matchData = { id: matchDoc.id, ...matchDoc.data() };
                // Assurer que 'sets' est toujours un tableau, même pour les anciens matchs
                if (!matchData.sets || !Array.isArray(matchData.sets)) {
                    // Si l'ancien format (score1, score2) est présent, le convertir en un tableau de sets
                    if (matchData.score1 !== undefined && matchData.score2 !== undefined) {
                        matchData.sets = [{ score1: matchData.score1, score2: matchData.score2 }];
                    } else {
                        // Sinon, initialiser avec un tableau vide ou basé sur setsToWin si disponible
                        matchData.sets = Array.from({ length: matchData.setsToWin || 1 }, () => ({ score1: null, score2: null }));
                    }
                    // Supprimer les anciennes propriétés pour éviter la confusion
                    delete matchData.score1;
                    delete matchData.score2;
                }
                return matchData;
            });
            
            // Calculer le classement pour cette poule
            pool.ranking = await calculatePoolRanking(tournamentId, pool.id, pool.teams || [], pool.matches);
            
            return pool;
        }));

        // 3. Enrichir les équipes avec le statut d'affectation et filtrer pour les équipes complètes
        const teamsForView = allTeams.filter(team => {
            const isComplete = team.members && team.members.length >= minPlayersPerTeam;
            return isComplete;
        }).map(team => {
            let isAssigned = false;
            let assignedToPoolName = null;
            for (const pool of pools) {
                if (pool.teams && pool.teams.some(pTeam => pTeam.id === team.id)) {
                    isAssigned = true;
                    assignedToPoolName = pool.name;
                    break;
                }
            }
            return { ...team, isAssigned, assignedToPoolName };
        });

        // Récupérer les matchs d'élimination s'ils existent
        let eliminationMatches = [];
        let preliminaryMatches = [];
        let qfMatches = [];
        let dfMatches = [];
        let m3pMatch = null;
        let finalMatch = null;

        if (tournament.eliminationPhaseEnabled) {
            const eliminationMatchesSnapshot = await adminDb.collection('events').doc(tournamentId).collection('eliminationMatches').orderBy('matchNumber').get();
            eliminationMatches = eliminationMatchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Extraire et trier les matchs par round
            if (eliminationMatches.length > 0) {
                preliminaryMatches = eliminationMatches.filter(m => m.round === 'Tour Préliminaire').sort((a, b) => a.matchNumber - b.matchNumber);
                qfMatches = eliminationMatches.filter(m => m.round === 'Quart de finale').sort((a, b) => a.matchNumber - b.matchNumber);
                dfMatches = eliminationMatches.filter(m => m.round === 'Demi-finale').sort((a, b) => a.matchNumber - b.matchNumber);
                m3pMatch = eliminationMatches.find(m => m.round === 'Match 3ème place');
                finalMatch = eliminationMatches.find(m => m.round === 'Finale');
            }
        }

        // Ajouter une propriété pour indiquer si des matchs d'élimination ont été générés
        tournament.eliminationMatchesGenerated = eliminationMatches.length > 0;

        res.render('admin/tournaments/pools', {
            pageTitle: `Gestion des Poules - ${tournament.name}`,
            tournament,
            teams: teamsForView,
            pools,
            eliminationMatches,
            preliminaryMatches,
            qfMatches,
            dfMatches,
            m3pMatch,
            finalMatch,
            title: `Gestion des Poules - ${tournament.name}`
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des poules et matchs:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération des poules et matchs.', '/admin/tournaments');
    }
};

// Fonction pour générer les matchs d'élimination
exports.generateEliminationMatches = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { qualifiedTeamIds } = req.body; // Nouvelle option : liste manuelle des équipes qualifiées

        const tournament = await getDocById('events', tournamentId);
        if (!tournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }

        if (!tournament.eliminationPhaseEnabled) {
            return sendFlashAndRedirect(req, res, 'error', 'La phase d\'élimination n\'est pas activée pour ce tournoi.', `/admin/tournaments/${tournamentId}/pools`);
        }

        const poolsSnapshot = await adminDb.collection('events').doc(tournamentId).collection('pools').get();
        let allQualifiedTeams = [];

        if (qualifiedTeamIds && Array.isArray(qualifiedTeamIds) && qualifiedTeamIds.length > 0) {
            // Mode manuel : utiliser les équipes sélectionnées par l'admin
            console.log(`Mode manuel : ${qualifiedTeamIds.length} équipes sélectionnées`);

            // Récupérer toutes les équipes de toutes les poules avec leur classement
            for (const poolDoc of poolsSnapshot.docs) {
                const poolId = poolDoc.id;
                const poolName = poolDoc.data().name;
                const poolTeams = poolDoc.data().teams || [];
                const poolMatchesSnapshot = await adminDb.collection('events').doc(tournamentId).collection('pools').doc(poolId).collection('matches').get();
                const poolMatches = poolMatchesSnapshot.docs.map(doc => doc.data());
                const ranking = await calculatePoolRanking(tournamentId, poolId, poolTeams, poolMatches);

                // Récupérer seulement les équipes qui sont dans la liste qualifiedTeamIds
                const selectedTeamsFromPool = ranking.filter(team => qualifiedTeamIds.includes(team.id))
                    .map(team => ({ ...team, poolName: poolName }));

                allQualifiedTeams.push(...selectedTeamsFromPool);
            }
        } else {
            // Mode automatique (rétro-compatibilité) : utiliser teamsQualifiedPerPool
            console.log('Mode automatique : utilisation de teamsQualifiedPerPool');
            const teamsQualifiedPerPool = tournament.teamsQualifiedPerPool || 2;

            for (const poolDoc of poolsSnapshot.docs) {
                const poolId = poolDoc.id;
                const poolName = poolDoc.data().name;
                const poolTeams = poolDoc.data().teams || [];
                const poolMatchesSnapshot = await adminDb.collection('events').doc(tournamentId).collection('pools').doc(poolId).collection('matches').get();
                const poolMatches = poolMatchesSnapshot.docs.map(doc => doc.data());
                const ranking = await calculatePoolRanking(tournamentId, poolId, poolTeams, poolMatches);
                const topTeams = ranking.slice(0, teamsQualifiedPerPool).map(team => ({ ...team, poolName: poolName }));
                allQualifiedTeams.push(...topTeams);
            }
        }

        // Vérifier le nombre d'équipes qualifiées
        if (allQualifiedTeams.length < 2) {
            return sendFlashAndRedirect(req, res, 'error', 'Au moins 2 équipes qualifiées sont nécessaires pour générer une phase d\'élimination.', `/admin/tournaments/${tournamentId}/pools`);
        }

        // Trier les équipes qualifiées par leur classement
        allQualifiedTeams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
            return a.setsLost - b.setsLost;
        });

        const tournamentConfig = {
            setsPerMatchElimination: tournament.setsPerMatchElimination || 3,
            pointsPerSetElimination: tournament.pointsPerSetElimination || 21,
            tieBreakEnabledElimination: tournament.tieBreakEnabledElimination || false,
        };

        // Générer la structure des matchs avec des IDs temporaires
        const generatedMatches = generateEliminationBracket(allQualifiedTeams, tournamentConfig);

        const batch = adminDb.batch();
        const eliminationMatchesCollectionRef = adminDb.collection('events').doc(tournamentId).collection('eliminationMatches');

        // Supprimer les anciens matchs d'élimination avant de générer de nouveaux
        const oldEliminationMatchesSnapshot = await eliminationMatchesCollectionRef.get();
        oldEliminationMatchesSnapshot.docs.forEach(matchDoc => {
            batch.delete(matchDoc.ref);
        });

        // Mapper les IDs temporaires aux IDs Firestore réels
        const tempIdToFirestoreIdMap = new Map();
        generatedMatches.forEach(match => {
            tempIdToFirestoreIdMap.set(match.id, eliminationMatchesCollectionRef.doc().id);
        });

        // Ajouter les matchs au batch avec les IDs Firestore réels et les références mises à jour
        generatedMatches.forEach(match => {
            const firestoreMatchId = tempIdToFirestoreIdMap.get(match.id);
            const matchData = { ...match, id: firestoreMatchId };

            // Mettre à jour les références sourceMatchId, nextMatchId, nextMatchWinnerId, nextMatchLoserId
            if (matchData.team1 && matchData.team1.sourceMatchId) {
                matchData.team1.sourceMatchId = tempIdToFirestoreIdMap.get(matchData.team1.sourceMatchId);
            }
            if (matchData.team2 && matchData.team2.sourceMatchId) {
                matchData.team2.sourceMatchId = tempIdToFirestoreIdMap.get(matchData.team2.sourceMatchId);
            }
            if (matchData.nextMatchId) {
                matchData.nextMatchId = tempIdToFirestoreIdMap.get(matchData.nextMatchId);
            }
            if (matchData.nextMatchWinnerId) {
                matchData.nextMatchWinnerId = tempIdToFirestoreIdMap.get(matchData.nextMatchWinnerId);
            }
            if (matchData.nextMatchLoserId) {
                matchData.nextMatchLoserId = tempIdToFirestoreIdMap.get(matchData.nextMatchLoserId);
            }

            batch.set(eliminationMatchesCollectionRef.doc(firestoreMatchId), matchData);
        });

        await batch.commit();

        sendFlashAndRedirect(req, res, 'success', 'Matchs d\'élimination générés avec succès.', `/admin/tournaments/${tournamentId}/pools`);

    } catch (error) {
        console.error('Erreur lors de la génération des matchs d\'élimination:', error);
        req.session.flashMessage = { type: 'error', message: 'Erreur lors de la génération des matchs d\'élimination.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);
    }
};

// Fonction pour mettre à jour le score d'un match d'élimination et propager les résultats
exports.updateEliminationMatchScore = async (req, res) => {
    console.log('updateEliminationMatchScore called');
    console.log('req.params:', req.params);
    console.log('req.body:', req.body);
    try {
        const { tournamentId, matchId } = req.params;
        const { sets } = req.body;

        const matchRef = adminDb.collection('events').doc(tournamentId).collection('eliminationMatches').doc(matchId);
        const matchDoc = await matchRef.get();

        if (!matchDoc.exists) {
            return res.status(404).json({ success: false, message: 'Match d\'élimination non trouvé.' });
        }

        const currentMatch = matchDoc.data();
        console.log('DEBUG: currentMatch data:', JSON.stringify(currentMatch, null, 2));

        // Récupérer les règles du tournoi pour le calcul du match
        const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, message: 'Tournoi non trouvé.' });
        }
        const tournamentData = tournamentDoc.data();

        const batch = adminDb.batch();

        const { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId, winnerName, loserName } = await updateMatchScoresAndStatus(
            matchRef,
            currentMatch,
            sets,
            tournamentData,
            'elimination',
            adminDb,
            batch
        );

        console.log('DEBUG: winnerId (current match):', winnerId, 'winnerName (current match):', winnerName);
        console.log('DEBUG: loserId (current match):', loserId, 'loserName (current match):', loserName);

        // Si le match est terminé, propager le vainqueur et le perdant au match suivant
        if (matchStatus === 'completed') {
            await propagateEliminationMatchResults(tournamentId, currentMatch, winnerId, winnerName, loserId, loserName, batch, adminDb);
        }

        await batch.commit();
        console.log('DEBUG: Batch commit completed for match:', matchId);

        req.session.flashMessage = { type: 'success', message: 'Score du match d\'élimination mis à jour avec succès.' };
        res.json({ success: true, message: 'Score du match d\'élimination mis à jour avec succès.' });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du score du match d\'élimination:', error);
        req.session.flashMessage = { type: 'error', message: 'Erreur lors de la mise à jour du score du match d\'élimination.' };
        res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du score du match d\'élimination.', error: error.message });
    }
};

// Fonction pour créer une nouvelle poule
exports.createPool = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { name } = req.body;

        if (!name) {
            req.session.flashMessage = { type: 'error', message: 'Le nom de la poule est requis.' };
            return res.redirect(`/admin/tournaments/${tournamentId}/pools`);
        }

        await adminDb.collection('events').doc(tournamentId).collection('pools').add({
            name,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        req.session.flashMessage = { type: 'success', message: 'Poule créée avec succès.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);

    } catch (error) {
        console.error('Erreur lors de la création de la poule:', error);
        req.session.flashMessage = { type: 'error', message: 'Erreur lors de la création de la poule.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);
    }
};

// Fonction pour mettre à jour le nom d'une poule
exports.updatePoolName = async (req, res) => {
    try {
        const { tournamentId, poolId } = req.params;
        const { name } = req.body;

        if (!name) {
            req.session.flashMessage = { type: 'error', message: 'Le nom de la poule est requis.' };
            return res.redirect(`/admin/tournaments/${tournamentId}/pools`);
        }

        const poolRef = adminDb.collection('events').doc(tournamentId).collection('pools').doc(poolId);
        await poolRef.update({
            name,
            updatedAt: new Date()
        });

        req.session.flashMessage = { type: 'success', message: 'Nom de la poule mis à jour avec succès.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);

    } catch (error) {
        console.error('Erreur lors de la mise à jour du nom de la poule:', error);
        req.session.flashMessage = { type: 'error', message: 'Erreur lors de la mise à jour du nom de la poule.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);
    }
};

// Fonction pour assigner des équipes à une poule
exports.assignTeamsToPool = async (req, res) => {
    try {
        const { tournamentId, poolId } = req.params;
        const { teamIds } = req.body; // teamIds est un tableau des IDs des équipes sélectionnées

        const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
        if (!tournamentDoc.exists) {
            req.session.flashMessage = { type: 'error', message: 'Tournoi non trouvé.' };
            return res.redirect('/admin/tournaments');
        }
        const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };
        const maxTeamsPerPool = tournament.maxTeamsPerPool || 4;

        const poolRef = adminDb.collection('events').doc(tournamentId).collection('pools').doc(poolId);
        const poolDoc = await poolRef.get();

        if (!poolDoc.exists) {
            req.session.flashMessage = { type: 'error', message: 'Poule non trouvée.' };
            return res.redirect(`/admin/tournaments/${tournamentId}/pools`);
        }

        const selectedTeamIds = Array.isArray(teamIds) ? teamIds : (teamIds ? [teamIds] : []);

        // Récupérer les détails des équipes sélectionnées
        const updatedTeams = [];
        if (selectedTeamIds.length > 0) {
            for (const teamId of selectedTeamIds) {
                const teamDoc = await adminDb.collection('events').doc(tournamentId).collection('teams').doc(teamId).get();
                if (teamDoc.exists) {
                    updatedTeams.push({ id: teamDoc.id, name: teamDoc.data().name });
                }
            }
        }

        // Vérifier si le nombre d'équipes sélectionnées dépasse la limite
        if (updatedTeams.length > maxTeamsPerPool) {
            req.session.flashMessage = { type: 'error', message: `Impossible d'assigner plus de ${maxTeamsPerPool} équipes à cette poule.` };
            return res.redirect(`/admin/tournaments/${tournamentId}/pools`);
        }

        await poolRef.update({
            teams: updatedTeams,
            updatedAt: new Date()
        });

        req.session.flashMessage = { type: 'success', message: 'Équipes de la poule mises à jour avec succès.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);

    } catch (error) {
        console.error('Erreur lors de l\'assignation des équipes à la poule:', error);
        req.session.flashMessage = { type: 'error', message: 'Erreur lors de l\'assignation des équipes à la poule.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);
    }
};

// Fonction pour générer les matchs d'une poule
exports.generatePoolMatches = async (req, res) => {
    try {
        const { tournamentId, poolId } = req.params;

        const poolRef = adminDb.collection('events').doc(tournamentId).collection('pools').doc(poolId);
        const poolDoc = await poolRef.get();

        if (!poolDoc.exists) {
            req.session.flashMessage = { type: 'error', message: 'Poule non trouvée.' };
            return res.redirect(`/admin/tournaments/${tournamentId}/pools`);
        }

        const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, message: 'Tournoi non trouvé.' });
        }
        const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };
        const setsPerMatchPool = tournament.setsPerMatchPool || 1;
        const pointsPerSetPool = tournament.pointsPerSetPool || 21;
        const matchFormat = tournament.matchFormat || 'aller';

        const poolData = poolDoc.data();
        const teamsInPool = poolData.teams || [];

        if (teamsInPool.length < 2) {
            req.session.flashMessage = { type: 'error', message: 'Au moins deux équipes sont nécessaires pour générer des matchs.' };
            return res.redirect(`/admin/tournaments/${tournamentId}/pools`);
        }

        const batch = adminDb.batch();
        const matchesCollectionRef = poolRef.collection('matches');

        // Supprimer les anciens matchs de la poule avant de générer de nouveaux
        const oldMatchesSnapshot = await matchesCollectionRef.get();
        oldMatchesSnapshot.docs.forEach(matchDoc => {
            batch.delete(matchDoc.ref);
        });

        let matchNumber = 1;
        for (let i = 0; i < teamsInPool.length; i++) {
            for (let j = i + 1; j < teamsInPool.length; j++) {
                const team1 = teamsInPool[i];
                const team2 = teamsInPool[j];

                // Initialiser les scores pour chaque set
                const initialSets = Array.from({ length: setsPerMatchPool }, () => ({ score1: null, score2: null }));

                // Match aller
                batch.set(matchesCollectionRef.doc(), {
                    matchNumber: matchNumber++,
                    team1: { id: team1.id, name: team1.name },
                    team2: { id: team2.id, name: team2.name },
                    sets: initialSets,
                    status: 'scheduled',
                    type: 'pool',
                    setsToWin: setsPerMatchPool,
                    pointsPerSet: pointsPerSetPool,
                    tieBreakEnabled: tournament.tieBreakEnabledPools || false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                // Match retour (si format aller-retour)
                if (matchFormat === 'aller_retour') {
                    batch.set(matchesCollectionRef.doc(), {
                        matchNumber: matchNumber++,
                        team1: { id: team2.id, name: team2.name },
                        team2: { id: team1.id, name: team1.name },
                        sets: initialSets,
                        status: 'scheduled',
                        type: 'pool',
                        setsToWin: setsPerMatchPool,
                        pointsPerSet: pointsPerSetPool,
                        tieBreakEnabled: tournament.tieBreakEnabledPools || false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
            }
        }

        await batch.commit();

        req.session.flashMessage = { type: 'success', message: 'Matchs de poule générés avec succès.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);

    } catch (error) {
        console.error('Erreur lors de la génération des matchs de poule:', error);
        req.session.flashMessage = { type: 'error', message: 'Erreur lors de la génération des matchs de poule.' };
        res.redirect(`/admin/tournaments/${tournamentId}/pools`);
    }
};

exports.updateMatchScore = async (req, res) => {
     try {
         const { tournamentId, poolId, matchId } = req.params;
         const { sets } = req.body; // sets sera un tableau d'objets { score1, score2 }
 
         const matchRef = adminDb.collection('events').doc(tournamentId).collection('pools').doc(poolId).collection('matches').doc(matchId);
         const matchDoc = await matchRef.get();
 
         if (!matchDoc.exists) {
             return res.status(404).json({ success: false, message: 'Match non trouvé.' });
         }
 
         const currentMatch = matchDoc.data();

         // Récupérer les règles du tournoi pour le calcul du match
         const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
         if (!tournamentDoc.exists) {
             return res.status(404).json({ success: false, message: 'Tournoi non trouvé.' });
         }
         const tournamentData = tournamentDoc.data();

         const { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId, winnerName, loserName } = await updateMatchScoresAndStatus(
             matchRef,
             currentMatch,
             sets, // Utiliser les sets bruts du req.body, la fonction mutualisée les parse
             tournamentData,
             'pool', // Type de match est 'pool'
             adminDb // Passer l'instance adminDb ici
         );
 
         // La mise à jour du match est déjà effectuée par updateMatchScoresAndStatus
         // Pas de propagation pour les matchs de poule
 
         res.json({ success: true, message: 'Score du match mis à jour avec succès.' });
 
     } catch (error) {
         console.error('Erreur lors de la mise à jour du score du match:', error);
         res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du score du match.', error: error.message });
     }
 };
 
 // Fonction pour supprimer une poule
 exports.deletePool = async (req, res) => {
     try {
         const { tournamentId, poolId } = req.params;
 
         const poolRef = adminDb.collection('events').doc(tournamentId).collection('pools').doc(poolId);
 
         // Supprimer d'abord tous les matchs de la poule
         const matchesSnapshot = await poolRef.collection('matches').get();
         const batch = adminDb.batch();
         matchesSnapshot.docs.forEach(matchDoc => {
             batch.delete(matchDoc.ref);
         });
         await batch.commit();
 
         // Ensuite, supprimer la poule elle-même
         await poolRef.delete();
 
         req.session.flashMessage = { type: 'success', message: 'Poule supprimée avec succès.' };
         res.redirect(`/admin/tournaments/${tournamentId}/pools`);
 
     } catch (error) {
         console.error('Erreur lors de la suppression de la poule:', error);
         req.session.flashMessage = { type: 'error', message: 'Erreur lors de la suppression de la poule.' };
         res.redirect(`/admin/tournaments/${tournamentId}/pools`);
     }
 };
