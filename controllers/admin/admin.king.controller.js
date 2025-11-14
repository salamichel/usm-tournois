/**
 * @fileoverview Contrôleur pour la gestion des tournois en mode "King".
 */

const { adminDb } = require('../../services/firebase');
const { writeBatch } = require('firebase/firestore');
const { getDocById } = require('../../services/admin.firestore.utils');
const { sendFlashAndRedirect } = require('../../services/response.utils');
const kingService = require('../../services/king.service');

/**
 * Recalcule le classement global et met à jour le statut de complétion de la phase du tournoi.
 * @param {object} batch - L'objet batch Firestore.
 * @param {object} tournamentRef - La référence du document du tournoi.
 * @param {object} kingDocRef - La référence du document principal King.
 * @param {boolean} isPhaseCompleted - Indique si la phase actuelle est terminée.
 * @param {number} [currentKingPhase] - Le numéro de la phase actuelle (optionnel, utilisé pour les réinitialisations).
 * @param {number} [phaseNumberToUpdateRanking] - Le numéro de la phase dont le classement doit être mis à jour spécifiquement.
 */
async function _recalculateRankingAndUpdateTournament(batch, tournamentRef, kingDocRef, isPhaseCompleted, currentKingPhase = null, phaseNumberToUpdateRanking = null) {
    const allMatchesSnapshots = await kingDocRef.collection('phases').get();
    let allCompletedMatchesGlobal = [];
    let allMatchesCurrentPhase = [];

    for (const phaseDoc of allMatchesSnapshots.docs) {
        const phaseNumber = parseInt(phaseDoc.id.replace('phase-', ''));
        const phasePoolsSnapshot = await phaseDoc.ref.collection('pools').get();
        for (const poolDoc of phasePoolsSnapshot.docs) {
            const poolMatchesSnapshot = await poolDoc.ref.collection('matches').get();
            const matchesInPool = poolMatchesSnapshot.docs.map(doc => ({
                ...doc.data(),
                setsWonTeam1: doc.data().setsWonTeam1 || 0, // Assurer que setsWonTeam1 est défini
                setsWonTeam2: doc.data().setsWonTeam2 || 0  // Assurer que setsWonTeam2 est défini
            }));
            allCompletedMatchesGlobal.push(...matchesInPool);

            if (phaseNumberToUpdateRanking !== null && phaseNumber === phaseNumberToUpdateRanking) {
                allMatchesCurrentPhase.push(...matchesInPool);
            }
        }
    }

    // Calculer et mettre à jour le classement global
    const newGlobalRanking = kingService.calculateKingRanking(allCompletedMatchesGlobal);
    batch.update(kingDocRef, { ranking: newGlobalRanking, updatedAt: new Date() });

    // Si un numéro de phase est spécifié, calculer et mettre à jour le classement de cette phase
    if (phaseNumberToUpdateRanking !== null) {
        const newPhaseRanking = kingService.calculateKingRanking(allMatchesCurrentPhase);
        const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${phaseNumberToUpdateRanking}`);
        batch.update(phaseDocRef, { ranking: newPhaseRanking, updatedAt: new Date() });
    }

    const updateData = {
        isKingPhaseCompleted: isPhaseCompleted,
        updatedAt: new Date()
    };
    if (currentKingPhase !== null) {
        updateData.currentKingPhase = currentKingPhase;
    }
    batch.update(tournamentRef, updateData);
}

// Enregistre le résultat d'un match du mode King
exports.recordKingMatchResult = async (req, res) => {
    try {
        const { tournamentId, matchId } = req.params;
        const { setsWonTeam1, setsWonTeam2 } = req.body;

        console.log(`[recordKingMatchResult] Reçu pour tournamentId: ${tournamentId}, matchId: ${matchId}`);

        const tournament = req.tournament;
        if (!tournament) {
            return res.status(404).json({ success: false, message: 'Tournoi non trouvé dans la requête.' });
        }

        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
        const kingDoc = await kingDocRef.get();

        if (!kingDoc.exists) {
            return res.status(404).json({ success: false, message: 'Données King du tournoi non trouvées.' });
        }

        const currentPhaseNumber = tournament.currentKingPhase;
        const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${currentPhaseNumber}`);
        const phaseDoc = await phaseDocRef.get();

        if (!phaseDoc.exists) {
            return res.status(404).json({ success: false, message: 'Phase actuelle du tournoi King non trouvée.' });
        }

        const batch = adminDb.batch();

        // 1. Récupérer le match
        let matchToUpdate = null;
        let matchRef = null;
        let poolId = null;

        const poolsSnapshot = await phaseDocRef.collection('pools').get();
        for (const poolDoc of poolsSnapshot.docs) {
            const poolMatchesSnapshot = await poolDoc.ref.collection('matches').where('id', '==', matchId).get();
            if (!poolMatchesSnapshot.empty) {
                matchRef = poolMatchesSnapshot.docs[0].ref;
                matchToUpdate = { id: poolMatchesSnapshot.docs[0].id, ...poolMatchesSnapshot.docs[0].data() };
                poolId = poolDoc.id;
                console.log(`[recordKingMatchResult] Match trouvé dans la poule ${poolDoc.id}: ID du match trouvé = ${matchToUpdate.id}`);
                break;
            }
        }

        if (!matchToUpdate) {
            return res.status(404).json({ success: false, message: 'Match non trouvé dans la phase actuelle.' });
        }

        // 2. Récupérer setsWonTeam1 et setsWonTeam2 du body (déjà fait)
        const parsedSetsWonTeam1 = parseInt(setsWonTeam1);
        const parsedSetsWonTeam2 = parseInt(setsWonTeam2);

        // 3. Déterminer l'équipe gagnante
        let winnerTeam = null;
        if (parsedSetsWonTeam1 > parsedSetsWonTeam2) {
            winnerTeam = matchToUpdate.team1;
        } else if (parsedSetsWonTeam2 > parsedSetsWonTeam1) {
            winnerTeam = matchToUpdate.team2;
        }

        // 4. Mettre à jour le match
        const updatedMatchData = {
            setsWonTeam1: parsedSetsWonTeam1,
            setsWonTeam2: parsedSetsWonTeam2,
            status: 'completed',
            winnerTeam: winnerTeam,
            winnerName: winnerTeam ? winnerTeam.name : null,
            winnerPlayerIds: winnerTeam ? winnerTeam.members.map(m => m.id) : [],
            updatedAt: new Date()
        };

        batch.update(matchRef, updatedMatchData);

        // 5. Mettre à jour allMatches dans le document phase-{phaseNumber}
        // Récupérer tous les matchs de la phase, mettre à jour le match spécifique, puis réécrire la liste
        const allPhaseMatches = [];
        for (const poolDoc of poolsSnapshot.docs) {
            const matchesSnapshot = await poolDoc.ref.collection('matches').get();
            matchesSnapshot.docs.forEach(doc => {
                const currentMatchData = { id: doc.id, ...doc.data() };
                if (currentMatchData.id === matchId) {
                    allPhaseMatches.push({ ...currentMatchData, ...updatedMatchData }); // Ajouter le match mis à jour
                } else {
                    allPhaseMatches.push(currentMatchData);
                }
            });
        }

        // Mettre à jour le document de phase avec la nouvelle liste de matchs
        batch.update(phaseDocRef, {
            allMatches: allPhaseMatches,
            updatedAt: new Date()
        });

        await batch.commit();

        // 6. Recalculer le classement global et le classement de la phase actuelle
        const allMatchesInCurrentPhaseCompleted = await isPhaseCompleted(kingDocRef, currentPhaseNumber);
        const finalBatch = adminDb.batch();
        await _recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, allMatchesInCurrentPhaseCompleted, currentPhaseNumber, currentPhaseNumber);
        await finalBatch.commit();

        res.json({ success: true, message: 'Résultat du match enregistré et classement mis à jour.' });

    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du résultat du match King:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'enregistrement du résultat du match.' });
    }
};

// Réinitialise la Phase 2 du tournoi King
exports.resetKingPhase2 = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, message: 'Tournoi non trouvé.' });
        }
        const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

        if (tournament.tournamentFormat !== 'king' || !tournament.king) {
            return res.status(400).json({ success: false, message: 'Ce tournoi n\'est pas un tournoi King valide.' });
        }
        if (tournament.currentKingPhase < 2) {
            return res.status(400).json({ success: false, message: 'La Phase 2 n\'a pas encore été lancée.' });
        }

        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
        const kingDoc = await kingDocRef.get();
        if (!kingDoc.exists) {
            return res.status(404).json({ success: false, message: 'Données King du tournoi non trouvées.' });
        }

        const batch = adminDb.batch();
        const phase2DocRef = kingDocRef.collection('phases').doc('phase-2');
        await kingService.deleteKingPhaseData(batch, phase2DocRef); // Supprime les données de la phase 2

        // Mettre à jour le classement de la phase 2 à vide
        batch.update(phase2DocRef, { ranking: [], updatedAt: new Date() });

        // Recalculer le classement global et le classement de la phase 1 (la phase précédente)
        await _recalculateRankingAndUpdateTournament(batch, tournamentRef, kingDocRef, true, 1, 1);

        await batch.commit();

        res.json({ success: true, message: 'Phase 2 réinitialisée avec succès.' });

    } catch (error) {
        console.error('Erreur lors de la réinitialisation de la Phase 2 du mode King:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la réinitialisation de la Phase 2.' });
    }
};

// Réinitialise la Phase 3 (Finale) du tournoi King
exports.resetKingPhase3 = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, message: 'Tournoi non trouvé.' });
        }
        const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

        if (tournament.tournamentFormat !== 'king' || !tournament.king) {
            return res.status(400).json({ success: false, message: 'Ce tournoi n\'est pas un tournoi King valide.' });
        }
        if (tournament.currentKingPhase < 3) {
            return res.status(400).json({ success: false, message: 'La Phase Finale n\'a pas encore été lancée.' });
        }

        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
        const kingDoc = await kingDocRef.get();
        if (!kingDoc.exists) {
            return res.status(404).json({ success: false, message: 'Données King du tournoi non trouvées.' });
        }

        const batch = adminDb.batch();
        const phase3DocRef = kingDocRef.collection('phases').doc('phase-3');
        await kingService.deleteKingPhaseData(batch, phase3DocRef); // Supprime les données de la phase 3

        // Mettre à jour le classement de la phase 3 à vide
        batch.update(phase3DocRef, { ranking: [], updatedAt: new Date() });

        // Recalculer le classement global et le classement de la phase 2 (la phase précédente)
        await _recalculateRankingAndUpdateTournament(batch, tournamentRef, kingDocRef, true, 2, 2);

        await batch.commit();

        res.json({ success: true, message: 'Phase Finale réinitialisée avec succès.' });

    } catch (error) {
        console.error('Erreur lors de la réinitialisation de la Phase Finale du mode King:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la réinitialisation de la Phase Finale.' });
    }
};

// Réinitialise la Phase 1 du tournoi King
exports.resetKingPhase1 = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

        const batch = adminDb.batch();

        const phasesSnapshot = await kingDocRef.collection('phases').get();
        for (const phaseDoc of phasesSnapshot.docs) {
            await kingService.deleteKingPhaseData(batch, phaseDoc.ref);
        }
        batch.delete(kingDocRef);

        batch.update(tournamentRef, {
            currentKingPhase: 0,
            isKingPhaseCompleted: false,
            updatedAt: new Date()
        });

        await batch.commit();

        res.json({ success: true, message: 'Phase 1 réinitialisée avec succès.' });

    } catch (error) {
        console.error('Erreur lors de la réinitialisation de la Phase 1 du mode King:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la réinitialisation de la Phase 1.' });
    }
};


exports.startKingPhase1 = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = req.tournament;

        const unassignedPlayersSnapshot = await adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers').get();
        const players = unassignedPlayersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (!tournament || players.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Aucun joueur inscrit au tournoi'
            });
        }

        // Préparer les joueurs (trier pour déterminisme)
        players.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

        console.log(`📋 Phase 1: ${players.length} joueurs`);

        // Générer la Phase 1 avec 3 tournées ✅ CRITIQUE!
        const phase1 = kingService.generatePhase1(players, tournament);

        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

        const batch = adminDb.batch();

        // Créer le document King
        batch.set(kingDocRef, {
            currentPhase: 1,
            totalMatches: phase1.allMatches.length,
            ranking: [], // Initialisé vide, sera mis à jour par _recalculateRankingAndUpdateTournament
            createdAt: new Date(),
            updatedAt: new Date()
        }, { merge: true });

        // Sauvegarder la Phase 1
        const phaseDocRef = kingDocRef.collection('phases').doc('phase-1');
        batch.set(phaseDocRef, {
            phaseNumber: 1,
            description: phase1.description,
            status: 'in-progress',
            ranking: [], // Initialisé vide, sera mis à jour par _recalculateRankingAndUpdateTournament
            createdAt: new Date()
        });

        // Sauvegarder les poules et matchs
        for (const pool of phase1.pools) {
            const poolDocRef = phaseDocRef.collection('pools').doc(pool.id);
            batch.set(poolDocRef, {
                id: pool.id,
                name: pool.name,
                playerCount: pool.players.length,
                createdAt: new Date()
            });

            // Sauvegarder chaque round et ses matchs
            const roundsInPool = new Map();
            pool.matches.forEach(match => {
                if (!roundsInPool.has(match.roundId)) {
                    roundsInPool.set(match.roundId, {
                        id: match.roundId,
                        name: match.roundName,
                        phaseNumber: 1, // Phase 1
                        roundNumber: parseInt(match.roundId.split('-').pop()), // Extrait le numéro du round
                        poolId: pool.id,
                        createdAt: new Date()
                    });
                }
            });

            for (const roundData of roundsInPool.values()) {
                const roundDocRef = poolDocRef.collection('rounds').doc(roundData.id);
                batch.set(roundDocRef, roundData);
            }

            for (const match of pool.matches) {
                const matchDocRef = poolDocRef.collection('matches').doc(match.id);
                batch.set(matchDocRef, {
                    ...match,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }

        // Mettre à jour le tournoi
        batch.update(tournamentRef, {
            currentKingPhase: 1,
            kingStatus: 'phase1-in-progress',
            isKingPhaseCompleted: false,
            updatedAt: new Date()
        });

        await batch.commit();

        // Recalculer le classement global et le classement de la phase 1
        const finalBatch = adminDb.batch();
        await _recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, false, 1, 1);
        await finalBatch.commit();

        console.log(`✅ Phase 1 lancée: ${phase1.allMatches.length} matchs`);
        
        res.json({
            success: true,
            message: `Phase 1 lancée! ${phase1.allMatches.length} matchs à jouer.`,
            phase: phase1
        });

    } catch (error) {
        console.error('❌ Erreur startKingPhase1:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du démarrage de la Phase 1'
        });
    }
};

// ========================================
// À REMPLACER: startKingPhase2
// ========================================

exports.startKingPhase2 = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = req.tournament;

        // Vérifications
        if (tournament.currentKingPhase !== 1) {
            return res.status(400).json({
                success: false,
                message: 'La Phase 1 doit être la phase actuelle'
            });
        }

        if (!tournament.isKingPhaseCompleted) {
            return res.status(400).json({
                success: false,
                message: 'La Phase 1 doit être entièrement complétée'
            });
        }

        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

        // 1. Récupérer les données de Phase 1
        console.log('📊 Récupération des données Phase 1...');
        const phase1DocRef = kingDocRef.collection('phases').doc('phase-1');
        const phase1PoolsSnapshot = await phase1DocRef.collection('pools').get();

        const phase1Pools = [];
        const phase1Matches = [];

        for (const poolDoc of phase1PoolsSnapshot.docs) {
            const pool = {
                id: poolDoc.id,
                name: poolDoc.data().name,
                players: [],
                matches: []
            };

            // Récupérer les matches
            const matchesSnapshot = await poolDoc.ref.collection('matches').get();
            pool.matches = matchesSnapshot.docs.map(m => ({ id: m.id, ...m.data() }));

            // Récupérer les joueurs (de la configuration du tournoi ou des matchs)
            for (const match of pool.matches) {
                if (match.team1 && match.team1.members) {
                    pool.players.push(...match.team1.members);
                }
                if (match.team2 && match.team2.members) {
                    pool.players.push(...match.team2.members);
                }
            }
            // Dédupliquer les joueurs
            pool.players = Array.from(new Map(pool.players.map(p => [p.id, p])).values());

            phase1Pools.push(pool);
            phase1Matches.push(...pool.matches);
        }

        console.log(`📋 Phase 1 trouvée: ${phase1Pools.length} poules, ${phase1Matches.length} matchs`);

        // 2. Calculer les qualifiés (top 4 de chaque poule)
        const qualifiedPlayers = kingService.getPhase1Qualifiers(phase1Pools, phase1Matches, 4);

        console.log(`✅ Qualifiés Phase 1: ${qualifiedPlayers.length} joueurs`);

        if (qualifiedPlayers.length < 8) {
            return res.status(400).json({
                success: false,
                message: `Pas assez de qualifiés: ${qualifiedPlayers.length} au lieu de 8`
            });
        }

        // 3. Générer la Phase 2
        console.log('🎮 Génération Phase 2 (3v3)...');
        const phase2 = kingService.generatePhase2(qualifiedPlayers, tournament);

        // 4. Sauvegarder la Phase 2
        const batch = adminDb.batch();

        const phase2DocRef = kingDocRef.collection('phases').doc('phase-2');
        batch.set(phase2DocRef, {
            phaseNumber: 2,
            description: phase2.description,
            qualifiedCount: qualifiedPlayers.length,
            status: 'in-progress',
            ranking: [], // Initialisé vide, sera mis à jour par _recalculateRankingAndUpdateTournament
            createdAt: new Date()
        });

        for (const pool of phase2.pools) {
            const poolDocRef = phase2DocRef.collection('pools').doc(pool.id);
            batch.set(poolDocRef, {
                id: pool.id,
                name: pool.name,
                playerCount: pool.players.length,
                createdAt: new Date()
            });

            // Sauvegarder chaque round et ses matchs
            const roundsInPool = new Map();
            pool.matches.forEach(match => {
                if (!roundsInPool.has(match.roundId)) {
                    roundsInPool.set(match.roundId, {
                        id: match.roundId,
                        name: match.roundName,
                        phaseNumber: 2, // Phase 2
                        roundNumber: parseInt(match.roundId.split('-').pop()), // Extrait le numéro du round
                        poolId: pool.id,
                        createdAt: new Date()
                    });
                }
            });

            for (const roundData of roundsInPool.values()) {
                const roundDocRef = poolDocRef.collection('rounds').doc(roundData.id);
                batch.set(roundDocRef, roundData);
            }

            for (const match of pool.matches) {
                const matchDocRef = poolDocRef.collection('matches').doc(match.id);
                batch.set(matchDocRef, {
                    ...match,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }

        // Récupérer les données King existantes pour le cumul
        const existingKingDoc = await kingDocRef.get();
        let currentTotalMatches = 0;
        if (existingKingDoc.exists) {
            currentTotalMatches = existingKingDoc.data().totalMatches || 0;
        }

        // Mettre à jour mainKingData avec le total cumulatif
        batch.update(kingDocRef, {
            currentPhase: 2,
            totalMatches: currentTotalMatches + phase2.allMatches.length, // Cumulatif
            ranking: [], // Le classement sera recalculé après la complétion des matchs
            updatedAt: new Date()
        });

        batch.update(tournamentRef, {
            currentKingPhase: 2,
            kingStatus: 'phase2-in-progress',
            isKingPhaseCompleted: false,
            updatedAt: new Date()
        });

        await batch.commit();

        // Recalculer le classement global et le classement de la phase 2
        const finalBatch = adminDb.batch();
        await _recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, false, 2, 2);
        await finalBatch.commit();

        console.log(`✅ Phase 2 lancée: ${phase2.allMatches.length} matchs`);

        res.json({
            success: true,
            message: `Phase 2 lancée! ${qualifiedPlayers.length} joueurs qualifiés, ${phase2.allMatches.length} matchs.`,
            qualifiedCount: qualifiedPlayers.length,
            phase: phase2
        });

    } catch (error) {
        console.error('❌ Erreur startKingPhase2:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du démarrage de la Phase 2'
        });
    }
};

// ========================================
// À REMPLACER: startKingPhase3
// ========================================

exports.startKingPhase3 = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = req.tournament;

        // Vérifications
        if (tournament.currentKingPhase !== 2) {
            return res.status(400).json({
                success: false,
                message: 'La Phase 2 doit être la phase actuelle'
            });
        }

        if (!tournament.isKingPhaseCompleted) {
            return res.status(400).json({
                success: false,
                message: 'La Phase 2 doit être entièrement complétée'
            });
        }

        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

        // 1. Récupérer les données de Phase 2
        console.log('📊 Récupération des données Phase 2...');
        const phase2DocRef = kingDocRef.collection('phases').doc('phase-2');
        const phase2PoolsSnapshot = await phase2DocRef.collection('pools').get();

        const phase2Pools = [];
        const phase2Matches = [];

        for (const poolDoc of phase2PoolsSnapshot.docs) {
            const pool = {
                id: poolDoc.id,
                name: poolDoc.data().name,
                players: [],
                matches: []
            };

            const matchesSnapshot = await poolDoc.ref.collection('matches').get();
            pool.matches = matchesSnapshot.docs.map(m => ({ id: m.id, ...m.data() }));

            for (const match of pool.matches) {
                if (match.team1 && match.team1.members) {
                    pool.players.push(...match.team1.members);
                }
                if (match.team2 && match.team2.members) {
                    pool.players.push(...match.team2.members);
                }
            }
            pool.players = Array.from(new Map(pool.players.map(p => [p.id, p])).values());

            phase2Pools.push(pool);
            phase2Matches.push(...pool.matches);
        }

        console.log(`📋 Phase 2 trouvée: ${phase2Pools.length} poules, ${phase2Matches.length} matchs`);

        // 2. Calculer les finalistes (top 4 de chaque poule = 8)
        const finalists = kingService.getPhase2Qualifiers(phase2Pools, phase2Matches, 4);

        console.log(`✅ Finalistes Phase 2: ${finalists.length} joueurs`);

        if (finalists.length !== 8) {
            return res.status(400).json({
                success: false,
                message: `Exactement 8 finalistes requis, actuellement: ${finalists.length}`
            });
        }

        // 3. Générer la Phase 3
        console.log('🎮 Génération Phase 3 (2v2 Finale)...');
        const phase3 = kingService.generatePhase3(finalists, tournament);

        // 4. Sauvegarder la Phase 3
        const batch = adminDb.batch();

        const phase3DocRef = kingDocRef.collection('phases').doc('phase-3');
        batch.set(phase3DocRef, {
            phaseNumber: 3,
            description: phase3.description,
            finalistCount: finalists.length,
            status: 'in-progress',
            ranking: [], // Initialisé vide, sera mis à jour par _recalculateRankingAndUpdateTournament
            createdAt: new Date()
        });

        for (const pool of phase3.pools) {
            const poolDocRef = phase3DocRef.collection('pools').doc(pool.id);
            batch.set(poolDocRef, {
                id: pool.id,
                name: pool.name,
                playerCount: pool.players.length,
                createdAt: new Date()
            });

            // Sauvegarder chaque round et ses matchs
            const roundsInPool = new Map();
            pool.matches.forEach(match => {
                if (!roundsInPool.has(match.roundId)) {
                    roundsInPool.set(match.roundId, {
                        id: match.roundId,
                        name: match.roundName,
                        phaseNumber: 3, // Phase 3
                        roundNumber: parseInt(match.roundId.split('-').pop()), // Extrait le numéro du round
                        poolId: pool.id,
                        createdAt: new Date()
                    });
                }
            });

            for (const roundData of roundsInPool.values()) {
                const roundDocRef = poolDocRef.collection('rounds').doc(roundData.id);
                batch.set(roundDocRef, roundData);
            }

            for (const match of pool.matches) {
                const matchDocRef = poolDocRef.collection('matches').doc(match.id);
                batch.set(matchDocRef, {
                    ...match,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }

        // Récupérer les données King existantes pour le cumul
        const existingKingDoc = await kingDocRef.get();
        let currentTotalMatches = 0;
        if (existingKingDoc.exists) {
            currentTotalMatches = existingKingDoc.data().totalMatches || 0;
        }

        // Mettre à jour mainKingData avec le total cumulatif
        batch.update(kingDocRef, {
            currentPhase: 3,
            totalMatches: currentTotalMatches + phase3.allMatches.length, // Cumulatif
            ranking: [], // Le classement sera recalculé après la complétion des matchs
            updatedAt: new Date()
        });

        batch.update(tournamentRef, {
            currentKingPhase: 3,
            kingStatus: 'phase3-in-progress',
            isKingPhaseCompleted: false,
            updatedAt: new Date()
        });

        await batch.commit();

        // Recalculer le classement global et le classement de la phase 3
        const finalBatch = adminDb.batch();
        await _recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, false, 3, 3);
        await finalBatch.commit();

        console.log(`✅ Phase 3 lancée: ${phase3.allMatches.length} matchs`);

        res.json({
            success: true,
            message: `Phase Finale lancée! 8 finalistes, ${phase3.allMatches.length} matchs.`,
            finalists: finalists.map(p => ({ id: p.id, name: p.name })),
            phase: phase3
        });

    } catch (error) {
        console.error('❌ Erreur startKingPhase3:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du démarrage de la Phase 3'
        });
    }
};

// Affiche le tableau de bord pour un tournoi en mode "King"
exports.showKingDashboard = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournamentRef = adminDb.collection('events').doc(tournamentId); // Ajout de cette ligne
        const tournament = await getDocById('events', tournamentId);

        if (!tournament) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }

        if (tournament.tournamentFormat !== 'king') {
            return sendFlashAndRedirect(req, res, 'error', 'Ce tournoi n\'est pas un tournoi King.', '/admin/tournaments');
        }

        // Récupérer les joueurs non assignés (joueurs individuels)
        const unassignedPlayersSnapshot = await adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers').get();
        const unassignedPlayers = unassignedPlayersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Récupérer les données King depuis les sous-collections Firestore
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
        const kingDoc = await kingDocRef.get();
        let kingData = { phases: [], ranking: [] };
        let currentPhase = null;

        if (kingDoc.exists) {
            kingData.ranking = kingDoc.data().ranking || [];

            const phasesSnapshot = await kingDocRef.collection('phases').orderBy('phaseNumber').get();
            for (const phaseDoc of phasesSnapshot.docs) {
                const phaseData = { id: phaseDoc.id, ...phaseDoc.data(), pools: [] };
                const poolsSnapshot = await phaseDoc.ref.collection('pools').get();
                for (const poolDoc of poolsSnapshot.docs) {
                    const poolData = { id: poolDoc.id, ...poolDoc.data(), rounds: [] }; // Nouvelle structure pour les rounds
                    const matchesSnapshot = await poolDoc.ref.collection('matches').orderBy('matchNumber').get();
                    const allMatches = matchesSnapshot.docs.map(matchDoc => ({
                        id: matchDoc.id,
                        ...matchDoc.data(),
                        setsWonTeam1: matchDoc.data().setsWonTeam1 || 0, // Assurer que setsWonTeam1 est défini
                        setsWonTeam2: matchDoc.data().setsWonTeam2 || 0  // Assurer que setsWonTeam2 est défini
                    }));

                    // Extraire les joueurs de cette poule
                    const poolPlayersMap = new Map();
                    allMatches.forEach(match => {
                        if (match.team1 && match.team1.members) {
                            match.team1.members.forEach(member => poolPlayersMap.set(member.id, member));
                        }
                        if (match.team2 && match.team2.members) {
                            match.team2.members.forEach(member => poolPlayersMap.set(member.id, member));
                        }
                    });
                    poolData.players = Array.from(poolPlayersMap.values()); // Ajouter les joueurs à poolData

                    const roundsSnapshot = await poolDoc.ref.collection('rounds').orderBy('roundNumber').get();
                    const roundsMap = new Map(); // Map pour stocker les rounds et leurs matchs

                    for (const roundDoc of roundsSnapshot.docs) {
                        const roundData = { id: roundDoc.id, ...roundDoc.data(), matches: [] };
                        roundsMap.set(roundData.id, roundData);
                    }

                    // Assigner les matchs à leurs rounds respectifs
                    allMatches.forEach(match => {
                        if (match.roundId && roundsMap.has(match.roundId)) {
                            roundsMap.get(match.roundId).matches.push(match);
                        }
                    });

                    poolData.rounds = Array.from(roundsMap.values()); // Convertir le Map en tableau
                    phaseData.pools.push(poolData);
                }
                kingData.phases.push(phaseData);
            }
            currentPhase = kingData.phases.find(p => p.phaseNumber === tournament.currentKingPhase);

            // Extraire les équipes uniques de la phase actuelle pour l'affichage du tableau
            if (currentPhase) {
                const allTeamsInCurrentPhase = new Map();
                currentPhase.pools.forEach(pool => {
                    pool.rounds.forEach(round => { // Itérer sur les rounds
                        round.matches.forEach(match => { // Itérer sur les matchs de chaque round
                            if (match.team1 && match.team1.members) {
                                allTeamsInCurrentPhase.set(match.team1.name, match.team1);
                            }
                            if (match.team2 && match.team2.members) {
                                allTeamsInCurrentPhase.set(match.team2.name, match.team2);
                            }
                        });
                    });
                });
                kingData.currentPhaseTeams = Array.from(allTeamsInCurrentPhase.values());
            }
        }

        // Passer les données à la vue
        res.render('admin/tournaments/king-dashboard', {
            pageTitle: 'Tableau de Bord - Mode King',
            tournament,
            players: unassignedPlayers,
            kingData, // Passer l'objet king complet avec phases et ranking
            currentPhase, // Passer la phase actuelle pour un accès plus facile
            currentPhaseTeams: kingData.currentPhaseTeams || [], // Passer les équipes de la phase actuelle
            title: `King Mode: ${tournament.name}`
        });
    } catch (error) {
        console.error('Erreur lors de l\'affichage du tableau de bord King:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'affichage du tableau de bord King.' });
    }
};

exports.updateKingPhase1Config = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { teamsPerPool, teamSize, numRoundsPerPool } = req.body;

        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const tournamentDoc = await tournamentRef.get();

        if (!tournamentDoc.exists) {
            return res.status(404).json({ success: false, message: 'Tournoi non trouvé.' });
        }

        // Vérifier si la phase 1 a déjà été lancée
        if (tournamentDoc.data().currentKingPhase > 0) {
            return res.status(400).json({ success: false, message: 'La configuration de la Phase 1 ne peut pas être modifiée après son lancement.' });
        }

        await tournamentRef.update({
            phase1TeamsPerPool: parseInt(teamsPerPool),
            phase1TeamSize: parseInt(teamSize),
            phase1NumRoundsPerPool: parseInt(numRoundsPerPool),
            updatedAt: new Date()
        });

        res.json({ success: true, message: 'Configuration de la Phase 1 mise à jour avec succès.' });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de la configuration de la Phase 1 du mode King:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour de la configuration de la Phase 1.' });
    }
};

exports.updateKingTeamName = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { oldTeamName, newTeamName } = req.body;

        if (!oldTeamName || !newTeamName || oldTeamName.trim() === '' || newTeamName.trim() === '') {
            return res.status(400).json({ success: false, message: 'Les noms d\'équipe ne peuvent pas être vides.' });
        }

        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
        const kingDoc = await kingDocRef.get();

        if (!kingDoc.exists) {
            return res.status(404).json({ success: false, message: 'Données King du tournoi non trouvées.' });
        }

        const batch = adminDb.batch();
        let updatesMade = false;

        // Parcourir toutes les phases et leurs poules pour trouver les matchs
        const phasesSnapshot = await kingDocRef.collection('phases').get();
        for (const phaseDoc of phasesSnapshot.docs) {
            const poolsSnapshot = await phaseDoc.ref.collection('pools').get();
            for (const poolDoc of poolsSnapshot.docs) {
                const matchesSnapshot = await poolDoc.ref.collection('matches').get();
                for (const matchDoc of matchesSnapshot.docs) {
                    const matchData = matchDoc.data();
                    let updated = false;

                    if (matchData.team1 && matchData.team1.name === oldTeamName) {
                        matchData.team1.name = newTeamName;
                        updated = true;
                    }
                    if (matchData.team2 && matchData.team2.name === oldTeamName) {
                        matchData.team2.name = newTeamName;
                        updated = true;
                    }
                    // Si l'équipe gagnante avait l'ancien nom, mettre à jour aussi
                    if (matchData.winnerTeam && matchData.winnerTeam.name === oldTeamName) {
                        matchData.winnerTeam.name = newTeamName;
                        matchData.winnerName = newTeamName; // Mettre à jour le nom du vainqueur
                        updated = true;
                    }

                    if (updated) {
                        batch.update(matchDoc.ref, matchData);
                        updatesMade = true;
                    }
                }
            }
        }

        if (!updatesMade) {
            return res.status(404).json({ success: false, message: `Aucune équipe trouvée avec le nom "${oldTeamName}".` });
        }

        // Recalculer le classement après la mise à jour des noms d'équipe
        // Ne pas modifier le statut isKingPhaseCompleted lors d'une mise à jour de nom d'équipe
        const currentTournamentDoc = await tournamentRef.get();
        const currentIsKingPhaseCompleted = currentTournamentDoc.data().isKingPhaseCompleted;
        await _recalculateRankingAndUpdateTournament(batch, tournamentRef, kingDocRef, currentIsKingPhaseCompleted);
        await batch.commit();

        res.json({ success: true, message: `Nom d'équipe "${oldTeamName}" mis à jour en "${newTeamName}" avec succès.` });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du nom d\'équipe King:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la mise à jour du nom d\'équipe.' });
    }
};

// ========================================
// À AJOUTER: Fonction utilitaire pour vérifier la complétion
// ========================================

/**
 * Vérifie si tous les matchs d'une phase sont complétés.
 */
async function isPhaseCompleted(kingDocRef, phaseNumber) {
    const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${phaseNumber}`);
    const poolsSnapshot = await phaseDocRef.collection('pools').get();

    for (const poolDoc of poolsSnapshot.docs) {
        const matchesSnapshot = await poolDoc.ref.collection('matches').get();
        for (const matchDoc of matchesSnapshot.docs) {
            if (matchDoc.data().status !== 'completed') {
                return false;
            }
        }
    }
    return true;
}


exports.getKingWinner = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = req.tournament;

        if (tournament.currentKingPhase !== 3) {
            return res.status(400).json({
                success: false,
                message: 'La Phase 3 doit être complétée'
            });
        }

        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

        // Récupérer tous les matchs de Phase 3
        const phase3DocRef = kingDocRef.collection('phases').doc('phase-3');
        const phase3PoolsSnapshot = await phase3DocRef.collection('pools').get();

        const allPhase3Matches = [];

        for (const poolDoc of phase3PoolsSnapshot.docs) {
            const matchesSnapshot = await poolDoc.ref.collection('matches').get();
            allPhase3Matches.push(...matchesSnapshot.docs.map(m => m.data()));
        }

        // Calculer le classement final
        const finalRanking = kingService.calculateKingRanking(allPhase3Matches);

        // Le KING est le premier du classement
        const king = finalRanking[0];

        res.json({
            success: true,
            king: king,
            finalRanking: finalRanking.slice(0, 8)
        });

    } catch (error) {
        console.error('❌ Erreur getKingWinner:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du KING'
        });
    }
};

/**
 * Définit des scores aléatoires pour tous les matchs non complétés de la phase actuelle.
 * Pour les tests uniquement.
 */
exports.setAllKingMatchesScores = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = req.tournament;

        if (!tournament) {
            return res.status(404).json({ success: false, message: 'Tournoi non trouvé dans la requête.' });
        }

        const tournamentRef = adminDb.collection('events').doc(tournamentId);
        const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
        const kingDoc = await kingDocRef.get();

        if (!kingDoc.exists) {
            return res.status(404).json({ success: false, message: 'Données King du tournoi non trouvées.' });
        }

        const currentPhaseNumber = tournament.currentKingPhase;
        const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${currentPhaseNumber}`);
        const phaseDoc = await phaseDocRef.get();

        if (!phaseDoc.exists) {
            return res.status(404).json({ success: false, message: 'Phase actuelle du tournoi King non trouvée.' });
        }

        const batch = adminDb.batch();
        let matchesUpdatedCount = 0;
        const allPhaseMatches = []; // Pour stocker tous les matchs de la phase, y compris les mis à jour

        const poolsSnapshot = await phaseDocRef.collection('pools').get();
        for (const poolDoc of poolsSnapshot.docs) {
            const matchesSnapshot = await poolDoc.ref.collection('matches').get();
            for (const matchDoc of matchesSnapshot.docs) {
                let matchData = { id: matchDoc.id, ...matchDoc.data() };

                if (matchData.status !== 'completed') {
                    // Générer des scores aléatoires (ex: 2-0, 2-1, 0-2, 1-2)
                    const scoreOptions = [
                        { s1: 2, s2: 0 }, { s1: 2, s2: 1 },
                        { s1: 0, s2: 2 }, { s1: 1, s2: 2 }
                    ];
                    const randomScore = scoreOptions[Math.floor(Math.random() * scoreOptions.length)];

                    matchData.setsWonTeam1 = randomScore.s1;
                    matchData.setsWonTeam2 = randomScore.s2;
                    matchData.status = 'completed';
                    matchData.updatedAt = new Date();

                    let winnerTeam = null;
                    if (matchData.setsWonTeam1 > matchData.setsWonTeam2) {
                        winnerTeam = matchData.team1;
                    } else if (matchData.setsWonTeam2 > matchData.setsWonTeam1) {
                        winnerTeam = matchData.team2;
                    }
                    matchData.winnerTeam = winnerTeam;
                    matchData.winnerName = winnerTeam ? winnerTeam.name : null;
                    matchData.winnerPlayerIds = winnerTeam ? winnerTeam.members.map(m => m.id) : [];

                    batch.update(matchDoc.ref, matchData);
                    matchesUpdatedCount++;
                }
                allPhaseMatches.push(matchData); // Ajouter le match (mis à jour ou non) à la liste
            }
        }

        if (matchesUpdatedCount === 0) {
            return res.json({ success: true, message: 'Tous les matchs de la phase actuelle sont déjà complétés.' });
        }

        // Mettre à jour le document de phase avec la nouvelle liste de matchs
        batch.update(phaseDocRef, {
            allMatches: allPhaseMatches,
            updatedAt: new Date()
        });

        await batch.commit();

        // Recalculer le classement global et le classement de la phase actuelle
        const allMatchesInCurrentPhaseCompleted = await isPhaseCompleted(kingDocRef, currentPhaseNumber);
        const finalBatch = adminDb.batch();
        await _recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, allMatchesInCurrentPhaseCompleted, currentPhaseNumber, currentPhaseNumber);
        await finalBatch.commit();

        res.json({ success: true, message: `${matchesUpdatedCount} matchs mis à jour avec des scores aléatoires.` });

    } catch (error) {
        console.error('Erreur lors de la définition des scores aléatoires pour les matchs King:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur lors de la définition des scores aléatoires.' });
    }
};
