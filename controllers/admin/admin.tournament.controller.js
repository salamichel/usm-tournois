const { adminDb } = require('../../services/firebase');
const { writeBatch } = require('firebase/firestore'); // Garder writeBatch si utilisé
const { getDocById, getTeamById, getTeamNameById, getAllUsers, getUserPseudo } = require('../../services/admin.firestore.utils');
const { sendFlashAndRedirect } = require('../../services/response.utils');
const { buildTournamentObject, calculateGuaranteedMatches } = require('../../services/tournament.service');
const { calculateEliminationRanking } = require('../../services/match.service');
const kingService = require('../../services/king.service');

// Liste tous les tournois
exports.listTournaments = async (req, res) => {
    try {
        const tournamentsSnapshot = await adminDb.collection('events').get();
        const tournaments = tournamentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Tournois récupérés pour l\'admin:', tournaments); // Ajout d'un log
        res.render('admin/tournaments/list', { pageTitle: 'Gestion des Tournois', tournaments, title: 'Gestion des Tournois' });
    } catch (error) {
        console.error('Erreur lors de la récupération des tournois:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération des tournois.', '/admin/dashboard');
    }
};




// Affiche la vue des matchs à élimination directe pour un tournoi
exports.showEliminationMatches = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = await getDocById('events', tournamentId);
        if (!tournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }

        const eliminationMatchesSnapshot = await adminDb.collection('events').doc(tournamentId).collection('eliminationMatches').orderBy('round').orderBy('matchNumber').get();
        let eliminationMatches = eliminationMatchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log('DEBUG: eliminationMatches after initial fetch:', JSON.stringify(eliminationMatches, null, 2));

        // Enrichir les informations complètes des équipes pour chaque match
        eliminationMatches = await Promise.all(eliminationMatches.map(async (match) => {
            // Logique pour team1
            if (match.team1 && match.team1.id) {
                const team1Data = await getTeamById(tournamentId, match.team1.id);
                match.team1 = team1Data || { id: match.team1.id, name: 'Équipe introuvable', members: [] };
            } else if (match.team1 && match.team1.sourceMatchId) {
                match.team1.name = `Vainqueur ${match.team1.sourceMatchId.substring(0, 4)}...`;
                match.team1.members = []; // Assurez-vous que les membres sont un tableau vide si l'équipe est un placeholder
            } else {
                match.team1 = { name: 'Équipe à déterminer', members: [] }; // Cas où team1 est complètement absent
            }

            // Logique pour team2
            if (match.team2 && match.team2.id) {
                const team2Data = await getTeamById(tournamentId, match.team2.id);
                match.team2 = team2Data || { id: match.team2.id, name: 'Équipe introuvable', members: [] };
            } else if (match.team2 && match.team2.sourceMatchId) {
                match.team2.name = `Vainqueur ${match.team2.sourceMatchId.substring(0, 4)}...`;
                match.team2.members = []; // Assurez-vous que les membres sont un tableau vide si l'équipe est un placeholder
            } else {
                match.team2 = { name: 'Équipe à déterminer', members: [] }; // Cas où team2 est complètement absent
            }
            return match;
        }));

        console.log('DEBUG: eliminationMatches after enrichment:', JSON.stringify(eliminationMatches, null, 2));
        // Ajout de logs pour vérifier les noms des équipes après enrichissement
        eliminationMatches.forEach(match => {
            console.log(`Match ${match.id}: Team1 Name: ${match.team1 ? match.team1.name : 'N/A'}, Team2 Name: ${match.team2 ? match.team2.name : 'N/A'}`);
        });

        // Calculer les statistiques des équipes pour le classement général
        const teamStats = {};

        eliminationMatches.forEach(match => {
            if (match.status === 'completed') {
                const team1Name = match.team1.name;
                const team2Name = match.team2.name;
                const setsWonTeam1 = match.setsWonTeam1 || 0;
                const setsWonTeam2 = match.setsWonTeam2 || 0;
                let pointsScoredTeam1Match = 0;
                let pointsConcededTeam1Match = 0;
                let pointsScoredTeam2Match = 0;
                let pointsConcededTeam2Match = 0;

                if (match.sets && Array.isArray(match.sets)) {
                    match.sets.forEach(set => {
                        pointsScoredTeam1Match += set.score1 || 0;
                        pointsConcededTeam1Match += set.score2 || 0;
                        pointsScoredTeam2Match += set.score2 || 0;
                        pointsConcededTeam2Match += set.score1 || 0;
                    });
                }

                if (!teamStats[team1Name]) {
                    teamStats[team1Name] = { team: match.team1, matchesPlayed: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsScored: 0, pointsConceded: 0, points: 0, bonusPoints: 0 };
                }
                if (!teamStats[team2Name]) {
                    teamStats[team2Name] = { team: match.team2, matchesPlayed: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsScored: 0, pointsConceded: 0, points: 0, bonusPoints: 0 };
                }

                teamStats[team1Name].matchesPlayed++;
                teamStats[team2Name].matchesPlayed++;

                teamStats[team1Name].setsWon += setsWonTeam1;
                teamStats[team1Name].setsLost += setsWonTeam2;
                teamStats[team2Name].setsWon += setsWonTeam2;
                teamStats[team2Name].setsLost += setsWonTeam1;

                teamStats[team1Name].pointsScored += pointsScoredTeam1Match;
                teamStats[team1Name].pointsConceded += pointsConcededTeam1Match;
                teamStats[team2Name].pointsScored += pointsScoredTeam2Match;
                teamStats[team2Name].pointsConceded += pointsConcededTeam2Match;

                if (setsWonTeam1 > setsWonTeam2) {
                    teamStats[team1Name].wins++;
                    teamStats[team1Name].points += 3;
                    teamStats[team2Name].losses++;
                } else if (setsWonTeam2 > setsWonTeam1) {
                    teamStats[team2Name].wins++;
                    teamStats[team2Name].points += 3;
                    teamStats[team1Name].losses++;
                }
            }
        });

        const preliminaryMatches = eliminationMatches.filter(m => m.round === 'Tour Préliminaire').sort((a, b) => a.matchNumber - b.matchNumber);
        const qfMatches = eliminationMatches.filter(m => m.round === 'Quart de finale').sort((a, b) => a.matchNumber - b.matchNumber);
        const dfMatches = eliminationMatches.filter(m => m.round === 'Demi-finale').sort((a, b) => a.matchNumber - b.matchNumber);
        const m3pMatch = eliminationMatches.find(m => m.round === 'Match 3ème place');
        const finalMatch = eliminationMatches.find(m => m.round === 'Finale');

        let firstPlaceTeam = null;
        let secondPlaceTeam = null;
        let thirdPlaceTeam = null;

        if (finalMatch && finalMatch.status === 'completed') {
            if (finalMatch.setsWonTeam1 > finalMatch.setsWonTeam2) {
                firstPlaceTeam = finalMatch.team1.name;
                secondPlaceTeam = finalMatch.team2.name;
            } else if (finalMatch.setsWonTeam2 > finalMatch.setsWonTeam1) {
                firstPlaceTeam = finalMatch.team2.name;
                secondPlaceTeam = finalMatch.team1.name;
            }
        }

        if (m3pMatch && m3pMatch.status === 'completed') {
            if (m3pMatch.setsWonTeam1 > m3pMatch.setsWonTeam2) {
                thirdPlaceTeam = m3pMatch.team1.name;
            } else if (m3pMatch.setsWonTeam2 > m3pMatch.setsWonTeam1) {
                thirdPlaceTeam = m3pMatch.team2.name;
            }
        }

        // Calculer le classement final en utilisant le service
        Object.values(teamStats).forEach(stats => {
            if (stats.matchesPlayed > 0) {
                stats.bonusPoints += 1;
            }
        });

        /*if (firstPlaceTeam && teamStats[firstPlaceTeam]) {
            teamStats[firstPlaceTeam].bonusPoints += 15;
        }
        if (secondPlaceTeam && teamStats[secondPlaceTeam]) {
            teamStats[secondPlaceTeam].bonusPoints += 9;
        }
        if (thirdPlaceTeam && teamStats[thirdPlaceTeam]) {
            teamStats[thirdPlaceTeam].bonusPoints += 4;
        }*/

        Object.values(teamStats).forEach(stats => {
            stats.points += stats.bonusPoints;
        });

        const sortedTeams = calculateEliminationRanking(eliminationMatches);
        res.render('admin/tournaments/elimination', { 
            pageTitle: 'Matchs à Élimination Directe', 
            tournamentId,
            tournament,
            eliminationMatches,
            preliminaryMatches, // Passer les tours préliminaires
            qfMatches, // Passer les quarts de finale
            dfMatches, // Passer les demi-finales
            m3pMatch,  // Passer le match 3ème place
            finalMatch, // Passer la finale
            sortedTeams, // Passer les équipes triées
            teamStats: Object.fromEntries(sortedTeams), // Passer teamStats pour le script client
            title: 'Matchs à Élimination Directe'
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage des matchs à élimination:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de l\'affichage des matchs à élimination.', '/admin/tournaments');
    }
};

// Affiche la feuille de match pour un match d'élimination spécifique
exports.showMatchSheet = async (req, res) => {
    try {
        const { tournamentId, matchId } = req.params;
        const tournament = await getDocById('events', tournamentId);
        if (!tournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }

        // Récupérer le match spécifique
        const match = await getDocById('events', tournamentId, 'eliminationMatches', matchId);
        if (!match) {
            return sendFlashAndRedirect(req, res, 'error', 'Match non trouvé.', `/admin/tournaments/${tournamentId}/elimination`);
        }

        res.render('admin/tournaments/match-sheet', {
            pageTitle: 'Feuille de Match',
            tournamentId,
            tournament,
            match,
            title: 'Feuille de Match'
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage de la feuille de match:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de l\'affichage de la feuille de match.', `/admin/tournaments/${req.params.tournamentId}/elimination`);
    }
};

// Affiche le formulaire de création de tournoi
exports.showCreateTournamentForm = (req, res) => {
    res.render('admin/tournaments/form', { pageTitle: 'Créer un Tournoi', tournament: null, title: 'Créer un Tournoi' });
};

// Crée un nouveau tournoi
exports.createTournament = async (req, res) => {
    try {
        const newTournament = buildTournamentObject(req.body, req.file, true);

        await adminDb.collection('events').add(newTournament);
        sendFlashAndRedirect(req, res, 'success', 'Tournoi créé avec succès.', '/admin/tournaments');
    } catch (error) {
        console.error('Erreur lors de la création du tournoi:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la création du tournoi.', '/admin/tournaments/new');
    }
};

// Affiche le formulaire d'édition de tournoi
exports.showEditTournamentForm = async (req, res) => {
    try {
        const { id } = req.params;
        const tournament = await getDocById('events', id);
        if (!tournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }


        // Formater la date et l'heure pour les champs input type="date" et type="time"
        if (tournament.date && tournament.date.toDate) {
            const fullDate = tournament.date.toDate();
            tournament.date = fullDate.toISOString().split('T')[0]; // YYYY-MM-DD
            tournament.time = fullDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        }
        // Formater la date et l'heure de début des inscriptions
        if (tournament.registrationStartDateTime && tournament.registrationStartDateTime.toDate) {
            const fullRegistrationDate = tournament.registrationStartDateTime.toDate();
            tournament.registrationStartDate = fullRegistrationDate.toISOString().split('T')[0]; // YYYY-MM-DD
            tournament.registrationStartTime = fullRegistrationDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        }
        // Formater la date et l'heure de fin des inscriptions
        if (tournament.registrationEndDateTime && tournament.registrationEndDateTime.toDate) {
            const fullRegistrationEndDate = tournament.registrationEndDateTime.toDate();
            tournament.registrationEndDate = fullRegistrationEndDate.toISOString().split('T')[0]; // YYYY-MM-DD
            tournament.registrationEndTime = fullRegistrationEndDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
        }
        res.render('admin/tournaments/form', { pageTitle: 'Modifier le Tournoi', tournament, title: 'Modifier le Tournoi' });
    } catch (error) {
        console.error('Erreur lors de la récupération du tournoi pour édition:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération du tournoi.', '/admin/tournaments');
    }
};

// Clone un tournoi
exports.cloneTournament = async (req, res) => {
    try {
        const { id } = req.params;
        const originalTournament = await getDocById('events', id);
        if (!originalTournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi original non trouvé.', '/admin/tournaments');
        }
        
        // Créer une nouvelle copie avec un nom modifié et une nouvelle date de création
        const clonedTournament = {
            ...originalTournament,
            name: `${originalTournament.name} (Copie)`,
            createdAt: new Date(),
            updatedAt: new Date(),
            // Optionnel : Réinitialiser la date du tournoi pour la reprogrammer
            date: new Date() 
        };

        // Supprimer les informations spécifiques à l'instance précédente si nécessaire
        delete clonedTournament.teams; // Ne pas cloner les équipes inscrites
        delete clonedTournament.unassignedPlayers; // Ne pas cloner les joueurs libres

        await adminDb.collection('events').add(clonedTournament);
        sendFlashAndRedirect(req, res, 'success', 'Tournoi cloné avec succès.', '/admin/tournaments');
    } catch (error) {
        console.error('Erreur lors du clonage du tournoi:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors du clonage du tournoi.', '/admin/tournaments');
    }
};

// Met à jour un tournoi existant
exports.updateTournament = async (req, res) => {
    try {
        const { 
            id } = req.params;
        const updatedTournament = buildTournamentObject(req.body, req.file, false);

        await adminDb.collection('events').doc(id).update(updatedTournament);
        sendFlashAndRedirect(req, res, 'success', 'Tournoi mis à jour avec succès.', '/admin/tournaments');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du tournoi:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la mise à jour du tournoi.', `/admin/tournaments/${id}/edit`);
    }
};

// Met à jour le statut d'un tournoi (actif/inactif, phase d'élimination activée/désactivée)
exports.toggleTournamentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { field } = req.body;

        // Valider que le champ est bien l'un des champs autorisés
        if (!['isActive', 'eliminationPhaseEnabled'].includes(field)) {
            return sendFlashAndRedirect(req, res, 'error', 'Champ de mise à jour invalide.', '/admin/tournaments');
        }

        const tournamentRef = adminDb.collection('events').doc(id);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }

        const currentValue = tournamentDoc.data()[field];
        const newValue = !currentValue;

        await tournamentRef.update({ [field]: newValue });

        sendFlashAndRedirect(req, res, 'success', `Statut du tournoi mis à jour avec succès.`, '/admin/tournaments');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut du tournoi:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la mise à jour du statut du tournoi.', '/admin/tournaments');
    }
};

// Supprime un tournoi
exports.deleteTournament = async (req, res) => {
    try {
        const { id } = req.params;
        await adminDb.collection('events').doc(id).delete();
        sendFlashAndRedirect(req, res, 'success', 'Tournoi supprimé avec succès.', '/admin/tournaments');
    } catch (error) {
        console.error('Erreur lors de la suppression du tournoi:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la suppression du tournoi.', '/admin/tournaments');
    }
};

// Gère la soumission du formulaire pour configurer les équipes d'un tour d'élimination
exports.setupEliminationRound = async (req, res) => {
    try {
        const { tournamentId, roundName } = req.params;
        const { team1Id, team2Id, matchId } = req.body; // matchId sera présent si on met à jour un match existant
        const formattedRoundName = roundName.replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const tournament = await getDocById('events', tournamentId);
        if (!tournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }

        // Récupérer les noms des équipes
        const team1 = await getDocById('events', tournamentId, 'teams', team1Id);
        const team2 = await getDocById('events', tournamentId, 'teams', team2Id);

        if (!team1 || !team2) {
            return sendFlashAndRedirect(req, res, 'error', 'Une ou plusieurs équipes sélectionnées sont introuvables.', `/admin/tournaments/${tournamentId}/elimination/setup-round/${roundName}`);
        }

        const team1Name = team1.name;
        const team2Name = team2.name;

        const matchData = {
            tournamentId,
            round: formattedRoundName,
            team1Id,
            team1Name,
            team2Id,
            team2Name,
            setsWonTeam1: null,
            setsWonTeam2: null,
            winnerId: null,
            winnerName: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (matchId) {
            // Mettre à jour un match existant
            await adminDb.collection('events').doc(tournamentId).collection('eliminationMatches').doc(matchId).update(matchData);
            sendFlashAndRedirect(req, res, 'success', `Match de ${formattedRoundName} mis à jour avec succès.`, `/admin/tournaments/${tournamentId}/elimination`);
        } else {
            // Créer un nouveau match
            // Déterminer le numéro de match
            const existingMatchesSnapshot = await adminDb.collection('events').doc(tournamentId).collection('eliminationMatches')
                .where('round', '==', formattedRoundName)
                .orderBy('matchNumber', 'desc')
                .limit(1)
                .get();
            const lastMatchNumber = existingMatchesSnapshot.empty ? 0 : existingMatchesSnapshot.docs[0].data().matchNumber;
            matchData.matchNumber = lastMatchNumber + 1;

            await adminDb.collection('events').doc(tournamentId).collection('eliminationMatches').add(matchData);
            sendFlashAndRedirect(req, res, 'success', `Nouveau match de ${formattedRoundName} créé avec succès.`, `/admin/tournaments/${tournamentId}/elimination`);
        }

    } catch (error) {
        console.error(`Erreur lors de la configuration des équipes pour ${req.params.roundName}:`, error);
        sendFlashAndRedirect(req, res, 'error', `Erreur lors de la configuration des équipes pour ${req.params.roundName}.`, `/admin/tournaments/${req.params.tournamentId}/elimination/setup-round/${roundName}`);
    }
};

// Affiche le nombre garanti de matchs pour un tournoi
exports.showGuaranteedMatches = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = await getDocById('events', tournamentId);
        if (!tournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }

        const guaranteedMatches = calculateGuaranteedMatches(tournament);

        res.render('admin/tournaments/guaranteed-matches', {
            pageTitle: 'Matchs Garantis',
            tournament,
            guaranteedMatches,
            title: 'Matchs Garantis'
        });

    } catch (error) {
        console.error('Erreur lors de l\'affichage des matchs garantis:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de l\'affichage des matchs garantis.', '/admin/tournaments');
    }
};

// Gère le figement du classement final
exports.freezeFinalRanking = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { finalRanking } = req.body; // finalRanking est un tableau d'objets { name, matchesPlayed, ... }

        if (!finalRanking || !Array.isArray(finalRanking)) {
            return res.status(400).json({ success: false, message: "Données de classement final invalides." });
        }

        const batch = adminDb.batch();
        const finalRankingCollectionRef = adminDb.collection('events').doc(tournamentId).collection('finalRanking');

        // Supprimer l'ancien classement s'il existe
        const existingRankingSnapshot = await finalRankingCollectionRef.get();
        existingRankingSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Ajouter le nouveau classement
        finalRanking.forEach((teamEntry, index) => { // teamEntry est [teamName, stats]
            const teamName = teamEntry[0];
            const stats = teamEntry[1];
            const teamRef = finalRankingCollectionRef.doc(); // Firestore générera un ID unique
            batch.set(teamRef, {
                rank: index + 1, // Ajouter le rang
                teamName: teamName, // Utiliser le nom d'équipe correctement extrait
                teamData: stats.team, // Stocker l'objet team complet avec les membres
                matchesPlayed: stats.matchesPlayed,
                wins: stats.wins,
                losses: stats.losses,
                setsWon: stats.setsWon,
                setsLost: stats.setsLost,
                pointsScored: stats.pointsScored,
                pointsConceded: stats.pointsConceded,
                pointsRatio: stats.pointsConceded > 0 ? (stats.pointsScored / stats.pointsConceded).toFixed(2) : (stats.pointsScored > 0 ? 'Inf.' : '0.00'),
                bonusPoints: stats.bonusPoints,
                points: stats.points,
                frozenAt: new Date()
            });
        });

        await batch.commit();

        // Renvoyer une réponse JSON pour les requêtes AJAX
        res.json({ success: true, message: 'Classement final figé avec succès.' });

    } catch (error) {
        console.error('Erreur lors du figement du classement final:', error);
        // En cas d'erreur, renvoyer une réponse JSON d'erreur
        res.status(500).json({ success: false, message: 'Erreur serveur lors du figement du classement final.' });
    }
};


