const { adminDb, db } = require('./firebase'); // Importez adminDb et db
const { doc, getDoc, writeBatch } = require('firebase/firestore'); // Importez les fonctions Firestore nécessaires
const { updateDoc: clientUpdateDoc } = require('firebase/firestore'); // Renommer pour éviter les conflits
const { getTeamNameById } = require('./admin.firestore.utils'); // Importez getTeamNameById

/**
 * Détermine le vainqueur d'un set basé sur les scores et les points par set.
 * @param {number} score1 Score de l'équipe 1.
 * @param {number} score2 Score de l'équipe 2.
 * @param {number} pointsPerSet Points nécessaires pour gagner un set.
 * @returns {number|null} 1 si l'équipe 1 gagne, 2 si l'équipe 2 gagne, null si le set n'est pas terminé.
 */
function calculateSetOutcome(score1, score2, pointsPerSet) {
    if (score1 >= pointsPerSet && score1 - score2 >= 2) {
        return 1;
    } else if (score2 >= pointsPerSet && score2 - score1 >= 2) {
        return 2;
    }
    return null; // Set non terminé
}

/**
 * Détermine le vainqueur d'un match basé sur les sets gagnés.
 * @param {Array<object>} sets Tableau des scores de chaque set ({ score1, score2 }).
 * @param {number} setsToWin Nombre de sets à gagner pour remporter le match.
 * @param {number} pointsPerSet Points nécessaires pour gagner un set.
 * @param {boolean} tieBreakEnabled Indique si le tie-break est activé.
 * @returns {object} Un objet contenant setsWonTeam1, setsWonTeam2, matchStatus.
 */
function calculateMatchOutcome(sets, setsToWin, pointsPerSet, tieBreakEnabled) {
    let setsWonTeam1 = 0;
    let setsWonTeam2 = 0;
    let matchStatus = 'in_progress';

    sets.forEach(set => {
        const outcome = calculateSetOutcome(set.score1, set.score2, pointsPerSet);
        if (outcome === 1) {
            setsWonTeam1++;
        } else if (outcome === 2) {
            setsWonTeam2++;
        }
    });

    if (setsWonTeam1 >= setsToWin) {
        matchStatus = 'completed';
    } else if (setsWonTeam2 >= setsToWin) {
        matchStatus = 'completed';
    } else if (sets.length === (setsToWin * 2 - 1) && setsWonTeam1 !== setsWonTeam2) {
        // Tous les sets possibles ont été joués et il y a un vainqueur
        matchStatus = 'completed';
    }

    return { setsWonTeam1, setsWonTeam2, matchStatus };
}

/**
 * Calcule le classement pour une poule donnée.
 * @param {string} tournamentId L'ID du tournoi.
 * @param {string} poolId L'ID de la poule.
 * @param {Array<object>} teamsInPool Les équipes de la poule.
 * @param {Array<object>} matches Les matchs de la poule.
 * @returns {Array} Un tableau d'équipes classées.
 */
async function calculatePoolRanking(tournamentId, poolId, teamsInPool, matches) {
    const ranking = {};

    teamsInPool.forEach(team => {
        ranking[team.id] = {
            id: team.id,
            name: team.name,
            poolId: poolId,
            wins: 0,
            losses: 0,
            setsWon: 0,
            setsLost: 0,
            pointsWon: 0,
            pointsLost: 0,
            matchesPlayed: 0
        };
    });

    matches.forEach(match => {
        if (match.status === 'completed' && match.sets && match.sets.length > 0) {
            const team1Id = match.team1.id;
            const team2Id = match.team2.id;

            if (!ranking[team1Id] || !ranking[team2Id]) {
                return;
            }

            ranking[team1Id].matchesPlayed++;
            ranking[team2Id].matchesPlayed++;

            let team1SetsWon = 0;
            let team2SetsWon = 0;
            let team1PointsWonMatch = 0;
            let team2PointsWonMatch = 0;

            const setsToWin = match.setsToWin || 1;
            const pointsPerSet = match.pointsPerSet || 21;
            const tieBreakEnabled = match.tieBreakEnabled || false;

            match.sets.forEach((set) => {
                const outcome = calculateSetOutcome(set.score1, set.score2, pointsPerSet);
                if (outcome === 1) {
                    team1SetsWon++;
                } else if (outcome === 2) {
                    team2SetsWon++;
                }
                team1PointsWonMatch += set.score1 || 0;
                team2PointsWonMatch += set.score2 || 0;
            });

            ranking[team1Id].setsWon += team1SetsWon;
            ranking[team1Id].setsLost += team2SetsWon;
            ranking[team2Id].setsWon += team2SetsWon;
            ranking[team2Id].setsLost += team1SetsWon;

            ranking[team1Id].pointsWon += team1PointsWonMatch;
            ranking[team1Id].pointsLost += team2PointsWonMatch;
            ranking[team2Id].pointsWon += team2PointsWonMatch;
            ranking[team2Id].pointsLost += team1PointsWonMatch;

            if (team1SetsWon > team2SetsWon) {
                ranking[team1Id].wins++;
                ranking[team2Id].losses++;
            } else if (team2SetsWon > team1SetsWon) {
                ranking[team2Id].wins++;
                ranking[team1Id].losses++;
            }
        }
    });

    const sortedRanking = Object.values(ranking).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const diffSetsA = a.setsWon - a.setsLost;
        const diffSetsB = b.setsWon - b.setsLost;
        if (diffSetsB !== diffSetsA) return diffSetsB - diffSetsA;
        const diffPointsA = a.pointsWon - a.pointsLost;
        const diffPointsB = b.pointsWon - b.pointsLost;
        if (diffPointsB !== diffPointsA) return diffPointsB - diffPointsA;
        return b.pointsWon - a.pointsWon;
    });

    return sortedRanking;
}

/**
 * Calcule le classement final des équipes pour la phase d'élimination.
 * @param {Array<object>} eliminationMatches Les matchs d'élimination.
 * @returns {Array<object>} Un tableau d'équipes classées avec leurs statistiques.
 */
function calculateEliminationRanking(eliminationMatches) {
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

    let firstPlaceTeam = null;
    let secondPlaceTeam = null;
    let thirdPlaceTeam = null;

    const finalMatch = eliminationMatches.find(m => m.round === 'Finale' && m.status === 'completed');
    if (finalMatch) {
        if (finalMatch.setsWonTeam1 > finalMatch.setsWonTeam2) {
            firstPlaceTeam = finalMatch.team1.name;
            secondPlaceTeam = finalMatch.team2.name;
        } else if (finalMatch.setsWonTeam2 > finalMatch.setsWonTeam1) {
            firstPlaceTeam = finalMatch.team2.name;
            secondPlaceTeam = finalMatch.team1.name;
        }
    }

    const m3pMatch = eliminationMatches.find(m => m.round === 'Match 3ème place' && m.status === 'completed');
    if (m3pMatch) {
        if (m3pMatch.setsWonTeam1 > m3pMatch.setsWonTeam2) {
            thirdPlaceTeam = m3pMatch.team1.name;
        } else if (m3pMatch.setsWonTeam2 > m3pMatch.setsWonTeam1) {
            thirdPlaceTeam = m3pMatch.team2.name;
        }
    }

    Object.values(teamStats).forEach(stats => {
        if (stats.matchesPlayed > 0) {
            stats.bonusPoints += 1;
        }
    });

    if (firstPlaceTeam && teamStats[firstPlaceTeam]) {
        teamStats[firstPlaceTeam].bonusPoints += 15;
    }
    if (secondPlaceTeam && teamStats[secondPlaceTeam]) {
        teamStats[secondPlaceTeam].bonusPoints += 9;
    }
    if (thirdPlaceTeam && teamStats[thirdPlaceTeam]) {
        teamStats[thirdPlaceTeam].bonusPoints += 4;
    }

    Object.values(teamStats).forEach(stats => {
        stats.points += stats.bonusPoints;
    });

    const sortedTeams = Object.entries(teamStats).sort(([, a], [, b]) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
        return a.setsLost - b.setsLost;
    });

    return sortedTeams;
}

/**
 * Détermine le résultat complet d'un match (sets gagnés, statut, vainqueur/perdant).
 * @param {Array<object>} submittedSets Tableau des scores de chaque set soumis ({ score1, score2 }).
 * @param {number} setsToWin Nombre de sets à gagner pour remporter le match.
 * @param {number} pointsPerSet Points nécessaires pour gagner un set.
 * @param {boolean} tieBreakEnabled Indique si le tie-break est activé.
 * @param {string} team1Id ID de l'équipe 1.
 * @param {string} team2Id ID de l'équipe 2.
 * @returns {object} Un objet contenant setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId.
 */
function determineMatchResult(submittedSets, setsToWin, pointsPerSet, tieBreakEnabled, team1Id, team2Id) {
    let setsWonTeam1 = 0;
    let setsWonTeam2 = 0;
    let matchStatus = 'in_progress';
    let winnerId = null;
    let loserId = null;

    submittedSets.forEach(set => {
        const outcome = calculateSetOutcome(set.score1, set.score2, pointsPerSet);
        if (outcome === 1) {
            setsWonTeam1++;
        } else if (outcome === 2) {
            setsWonTeam2++;
        }
    });

    // Déterminer le statut du match et le vainqueur/perdant
    if (setsWonTeam1 >= setsToWin) {
        matchStatus = 'completed';
        winnerId = team1Id;
        loserId = team2Id;
    } else if (setsWonTeam2 >= setsToWin) {
        matchStatus = 'completed';
        winnerId = team2Id;
        loserId = team1Id;
    } else if (submittedSets.length === (setsToWin * 2 - 1) && setsWonTeam1 !== setsWonTeam2) {
        // Tous les sets possibles ont été joués et il y a un vainqueur (sans tie-break si non activé ou déjà compté)
        if (setsWonTeam1 > setsWonTeam2) {
            winnerId = team1Id;
            loserId = team2Id;
        } else {
            winnerId = team2Id;
            loserId = team1Id;
        }
        matchStatus = 'completed';
    }
    // Note: La logique de tie-break est gérée par l'ajout d'un set supplémentaire dans le tableau `sets`
    // si `tieBreakEnabled` est vrai et que les conditions sont remplies.
    // `setsToWin` doit être ajusté en conséquence si le tie-break est considéré comme un set à part entière.
    // Pour l'instant, `setsToWin` est le nombre de sets "normaux" à gagner.
    // Si le tie-break est le dernier set, `submittedSets.length` inclura ce set.

    return { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId };
}


/**
 * Met à jour les scores d'un match et son statut dans Firestore.
 * @param {object} matchRef Référence Firestore du document du match.
 * @param {object} currentMatch Les données actuelles du match.
 * @param {Array<object>} submittedSets Tableau des scores de chaque set soumis ({ score1, score2 } ou { scoreTeam1, scoreTeam2 }).
 * @param {object} tournamentData Les données du tournoi pour les règles de match.
 * @param {string} matchType Le type de match ('pool' ou 'elimination').
 * @param {object} [batch] Un batch Firestore optionnel pour les opérations groupées.
 * @returns {Promise<object>} Un objet contenant setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId, winnerName, loserName.
 */
async function updateMatchScoresAndStatus(matchRef, currentMatch, submittedSets, tournamentData, matchType, dbInstance, batch = null) {
    // Valider les scores des sets
    if (!Array.isArray(submittedSets) || submittedSets.some(s => typeof s.score1 !== 'number' && typeof s.scoreTeam1 !== 'number')) {
        throw new Error('Format de scores de sets invalide.');
    }

    const parsedSets = submittedSets.map(set => ({
        score1: parseInt(set.score1 !== undefined ? set.score1 : set.scoreTeam1) || 0,
        score2: parseInt(set.score2 !== undefined ? set.score2 : set.scoreTeam2) || 0
    }));

    // Récupérer les règles du tournoi pour le calcul du match
    const setsToWin = matchType === 'pool' ? tournamentData.setsPerMatchPool : tournamentData.setsPerMatchElimination;
    const pointsPerSet = matchType === 'pool' ? tournamentData.pointsPerSetPool : tournamentData.pointsPerSetElimination;
    const tieBreakEnabled = matchType === 'pool' ? tournamentData.tieBreakEnabledPools : tournamentData.tieBreakEnabledElimination;

    const { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId } = determineMatchResult(
        parsedSets,
        setsToWin,
        pointsPerSet,
        tieBreakEnabled,
        currentMatch.team1.id,
        currentMatch.team2.id
    );

    // Récupérer les noms des équipes pour les stocker avec le vainqueur/perdant
    // Utiliser les noms déjà présents dans le match si les IDs correspondent
    const winnerName = winnerId ? (winnerId === currentMatch.team1.id ? currentMatch.team1.name : currentMatch.team2.name) : null;
    const loserName = loserId ? (loserId === currentMatch.team1.id ? currentMatch.team1.name : currentMatch.team2.name) : null;

    const updateData = {
        sets: parsedSets,
        setsWonTeam1: setsWonTeam1,
        setsWonTeam2: setsWonTeam2,
        winnerId: winnerId || null, // S'assurer que c'est null et non undefined
        winnerName: winnerName || null,
        loserId: loserId || null,   // S'assurer que c'est null et non undefined
        loserName: loserName || null,
        status: matchStatus,
        updatedAt: new Date()
    };

    if (batch) {
        batch.update(matchRef, updateData);
    } else {
        // Utiliser la méthode update appropriée en fonction de dbInstance
        if (dbInstance === db) { // Si c'est l'instance client
            await clientUpdateDoc(matchRef, updateData);
        } else if (dbInstance === adminDb) { // Si c'est l'instance admin
            await matchRef.update(updateData); // Utiliser la méthode update de la référence Admin
        } else {
            throw new Error("Instance de base de données inconnue.");
        }
    }

    return { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId, winnerName, loserName };
}

/**
 * Propage les résultats d'un match d'élimination aux matchs suivants.
 * @param {string} tournamentId L'ID du tournoi.
 * @param {object} currentMatch Les données du match d'élimination qui vient d'être complété.
 * @param {string} winnerId L'ID de l'équipe gagnante.
 * @param {string} winnerName Le nom de l'équipe gagnante.
 * @param {string} loserId L'ID de l'équipe perdante.
 * @param {string} loserName Le nom de l'équipe perdante.
 * @param {object} batch Le batch Firestore pour les opérations groupées.
 * @param {object} dbInstance L'instance de Firestore à utiliser (adminDb ou db client).
 * @returns {Promise<void>}
 */
async function propagateEliminationMatchResults(tournamentId, currentMatch, winnerId, winnerName, loserId, loserName, batch, dbInstance) {
    // Logique de propagation pour les quarts de finale (vers les demi-finales)
    if (currentMatch.nextMatchId && currentMatch.nextMatchTeamSlot) {
        let nextMatchRef;
        if (dbInstance === db) { // Si c'est l'instance client
            nextMatchRef = doc(dbInstance, `events/${tournamentId}/eliminationMatches`, currentMatch.nextMatchId);
        } else if (dbInstance === adminDb) { // Si c'est l'instance admin
            nextMatchRef = dbInstance.collection('events').doc(tournamentId).collection('eliminationMatches').doc(currentMatch.nextMatchId);
        } else {
            throw new Error("Instance de base de données inconnue pour la propagation.");
        }
        let nextMatchDoc;
        if (dbInstance === db) {
            nextMatchDoc = await getDoc(nextMatchRef);
        } else if (dbInstance === adminDb) {
            nextMatchDoc = await nextMatchRef.get();
        }
        if (nextMatchDoc.exists) {
            const teamSlot = currentMatch.nextMatchTeamSlot;
            const updateObject = {};
            updateObject[`${teamSlot}.id`] = winnerId;
            updateObject[`${teamSlot}.name`] = winnerName;
            console.log('DEBUG: Propagating winner (QF) to next match:', currentMatch.nextMatchId, 'slot:', teamSlot, 'update object:', updateObject);
            batch.update(nextMatchRef, updateObject);
        }
    }

    // Logique de propagation pour les demi-finales (vers la finale et le match 3ème place)
    if (currentMatch.nextMatchWinnerId && currentMatch.nextMatchWinnerTeamSlot) {
        let nextMatchRef;
        if (dbInstance === db) { // Si c'est l'instance client
            nextMatchRef = doc(dbInstance, `events/${tournamentId}/eliminationMatches`, currentMatch.nextMatchWinnerId);
        } else if (dbInstance === adminDb) { // Si c'est l'instance admin
            nextMatchRef = dbInstance.collection('events').doc(tournamentId).collection('eliminationMatches').doc(currentMatch.nextMatchWinnerId);
        } else {
            throw new Error("Instance de base de données inconnue pour la propagation.");
        }
        let nextMatchDoc;
        if (dbInstance === db) {
            nextMatchDoc = await getDoc(nextMatchRef);
        } else if (dbInstance === adminDb) {
            nextMatchDoc = await nextMatchRef.get();
        }
        if (nextMatchDoc.exists) {
            const teamSlot = currentMatch.nextMatchWinnerTeamSlot;
            const updateWinnerObject = {};
            updateWinnerObject[`${teamSlot}.id`] = winnerId;
            updateWinnerObject[`${teamSlot}.name`] = winnerName;
            console.log('DEBUG: Propagating winner (DF/Final) to next match:', currentMatch.nextMatchWinnerId, 'slot:', teamSlot, 'update object:', updateWinnerObject);
            batch.update(nextMatchRef, updateWinnerObject);
        }
    }
    // Propager le perdant (pour le match de la 3ème place)
    if (currentMatch.nextMatchLoserId && currentMatch.nextMatchLoserTeamSlot) {
        let nextMatchRef;
        if (dbInstance === db) { // Si c'est l'instance client
            nextMatchRef = doc(dbInstance, `events/${tournamentId}/eliminationMatches`, currentMatch.nextMatchLoserId);
        } else if (dbInstance === adminDb) { // Si c'est l'instance admin
            nextMatchRef = dbInstance.collection('events').doc(tournamentId).collection('eliminationMatches').doc(currentMatch.nextMatchLoserId);
        } else {
            throw new Error("Instance de base de données inconnue pour la propagation.");
        }
        let nextMatchDoc;
        if (dbInstance === db) {
            nextMatchDoc = await getDoc(nextMatchRef);
        } else if (dbInstance === adminDb) {
            nextMatchDoc = await nextMatchRef.get();
        }
        if (nextMatchDoc.exists) {
            const teamSlot = currentMatch.nextMatchLoserTeamSlot;
            const updateLoserObject = {};
            updateLoserObject[`${teamSlot}.id`] = loserId;
            updateLoserObject[`${teamSlot}.name`] = loserName;
            console.log('DEBUG: Propagating loser to next match:', currentMatch.nextMatchLoserId, 'slot:', teamSlot, 'update object:', updateLoserObject);
            batch.update(nextMatchRef, updateLoserObject);
        }
    }
}

module.exports = {
    calculateSetOutcome,
    calculateMatchOutcome,
    calculatePoolRanking,
    calculateEliminationRanking,
    determineMatchResult,
    updateMatchScoresAndStatus,
    propagateEliminationMatchResults // Exporter la nouvelle fonction
};
