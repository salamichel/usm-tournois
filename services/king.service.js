/**
 * @fileoverview Service for handling the logic of "King" mode tournaments.
 * Format: 4v4 (Phase 1) → 3v3 (Phase 2) → 2v2 (Phase 3)
 * 
 * Structure:
 * - Phase 1 (4v4): 36 joueurs → 12 qualifiés (3 poules de 12, 3 tournées par poule)
 * - Phase 2 (3v3): 12 joueurs → 8 qualifiés (2 poules de 6, KOB 5 tours)
 * - Phase 3 (2v2): 8 joueurs → 1 KING (1 poule, KOB 7 tours)
 */

// ========================================
// CONSTANTES DE CONFIGURATION
// ========================================

// Phase 1 (4v4)
const PHASE1_TEAMS_PER_POOL = 3;        // 3 équipes de 4 par poule
const PHASE1_TEAM_SIZE = 4;             // 4v4
const PHASE1_NUM_ROUNDS_PER_POOL = 3;   // 3 tournées (pas 1!)
const PHASE1_PLAYERS_PER_POOL = 12;     // 12 joueurs par poule
const PHASE1_QUALIFIERS_PER_POOL = 4;   // Top 4 se qualifient

// Phase 2 (3v3)
const PHASE2_NUM_POOLS = 2;             // 2 poules de 6
const PHASE2_TEAM_SIZE = 3;             // 3v3
const PHASE2_NUM_ROUNDS = 5;            // 5 tours KOB
const PHASE2_QUALIFIERS_PER_POOL = 4;   // Top 4 de chaque poule = 8

// Phase 3 (2v2)
const PHASE3_TEAM_SIZE = 2;             // 2v2
const PHASE3_NUM_ROUNDS = 7;            // 7 tours KOB

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

/**
 * Mélange un tableau de manière aléatoire (algorithme de Fisher-Yates).
 * @param {Array} array - Le tableau à mélanger.
 * @returns {Array} Le tableau mélangé.
 */
function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/**
 * Génère des équipes aléatoires à partir d'une liste de joueurs.
 * @param {Array<object>} playersInPool - Les joueurs disponibles.
 * @param {number} teamSize - La taille de chaque équipe.
 * @param {number} numberOfTeams - Le nombre d'équipes à former.
 * @returns {Array<object>} Un tableau d'objets équipe.
 */
function formRandomTeams(playersInPool, teamSize, numberOfTeams) {
    const shuffledPlayers = shuffleArray([...playersInPool]);
    const teams = [];
    
    for (let i = 0; i < numberOfTeams; i++) {
        teams.push({
            name: `Équipe ${i + 1}`,
            members: shuffledPlayers.slice(i * teamSize, (i + 1) * teamSize)
        });
    }
    
    return teams;
}

/**
 * Crée une grille KOB 2v2 pour 8 joueurs (7 tours, 2 matchs par tour).
 * Chaque joueur joue avec chaque autre joueur exactement 1 fois.
 * @returns {Array<Array>} La grille KOB 2v2.
 */
function generateKOB2v2Grid() {
    // Chaque tour: [[[joueur1, joueur2], [joueur3, joueur4]], [[joueur5, joueur6], [joueur7, joueur8]]]
    return [
        [[[0, 1], [2, 3]], [[4, 5], [6, 7]]],  // Tour 1
        [[[0, 4], [1, 5]], [[2, 6], [3, 7]]],  // Tour 2
        [[[0, 5], [2, 7]], [[1, 6], [3, 4]]],  // Tour 3
        [[[0, 6], [1, 7]], [[2, 4], [3, 5]]],  // Tour 4
        [[[0, 7], [3, 6]], [[1, 2], [4, 5]]],  // Tour 5
        [[[0, 3], [4, 6]], [[1, 5], [2, 7]]],  // Tour 6
        [[[0, 2], [5, 4]], [[1, 3], [6, 7]]]   // Tour 7
    ];
}

/**
 * Crée une grille KOB 3v3 pour 6 joueurs (5 tours, 1 match par tour).
 * @returns {Array<Array>} La grille KOB 3v3.
 */
function generateKOB3v3Grid() {
    return [
        [[0, 1, 2], [3, 4, 5]],  // Tour 1: (1-2-3) vs (4-5-6)
        [[0, 3, 4], [1, 2, 5]],  // Tour 2: (1-4-5) vs (2-3-6)
        [[0, 1, 5], [2, 3, 4]],  // Tour 3: (1-2-6) vs (3-4-5)
        [[0, 2, 3], [1, 4, 5]],  // Tour 4: (1-3-4) vs (2-5-6)
        [[0, 4, 5], [1, 2, 3]]   // Tour 5: (1-5-6) vs (2-3-4)
    ];
}

// ========================================
// PHASE 1 (4v4) - FILTRAGE
// ========================================

/**
 * Génère les matchs et la structure pour la Phase 1 (4v4).
 * Format: 36 joueurs → 3 poules de 12 → 3 tournées (RR de 3 équipes de 4) → 12 qualifiés
 * 
 * Chaque tournée:
 * - Les 12 joueurs sont mélangés et divisés en 3 équipes de 4
 * - Round Robin: 3 matchs (T1 vs T2, T1 vs T3, T2 vs T3)
 * 
 * Au total: 3 matchs/tournée × 3 tournées/poule × 3 poules = 27 matchs
 * @param {Array<object>} players - La liste de tous les joueurs.
 * @param {object} tournament - L'objet de configuration du tournoi.
 * @returns {object} La structure complète de la Phase 1.
 */
function generatePhase1(players, tournament) {
    console.log('🎮 [Phase 1] Generating 4v4 phase (36→12)...');

    const numPlayers = players.length;
    const numPools = tournament.fields || 3;
    const playersPerPool = Math.floor(numPlayers / numPools);

    const teamsPerPool = tournament.phase1TeamsPerPool || PHASE1_TEAMS_PER_POOL;
    const teamSize = tournament.phase1TeamSize || PHASE1_TEAM_SIZE;
    const numRoundsPerPool = tournament.phase1NumRoundsPerPool || PHASE1_NUM_ROUNDS_PER_POOL;

    const phase1Pools = [];
    const allMatches = [];
    let playerIndex = 0;

    // Créer les poules (généralement 3)
    for (let poolIdx = 0; poolIdx < numPools; poolIdx++) {
        const poolPlayers = players.slice(playerIndex, playerIndex + playersPerPool);
        playerIndex += playersPerPool;

        const poolMatches = [];
        const pool = {
            id: `pool-${String.fromCharCode(65 + poolIdx)}`,
            name: `Poule ${String.fromCharCode(65 + poolIdx)}`,
            players: poolPlayers,
            matches: []
        };

        let matchNumberInPool = 1;

        // Générer les tournées
        for (let roundNum = 1; roundNum <= numRoundsPerPool; roundNum++) {
            const roundId = `round-${pool.id}-${roundNum}`; // ID unique pour le round
            const roundName = `Phase 1 - Tournée ${roundNum}`;

            const shuffledPoolPlayers = shuffleArray([...poolPlayers]);
            const teams = formRandomTeams(shuffledPoolPlayers, teamSize, teamsPerPool);

            // Round Robin: T1 vs T2, T1 vs T3, T2 vs T3
            for (let i = 0; i < teams.length; i++) {
                for (let j = i + 1; j < teams.length; j++) {
                    poolMatches.push({
                        id: `match-${pool.id}-${matchNumberInPool}`,
                        matchNumber: matchNumberInPool,
                        team1: teams[i],
                        team2: teams[j],
                        format: '4v4',
                        status: 'pending',
                        roundId: roundId, // Utilisation du nouveau champ roundId
                        roundName: roundName, // Ajout du nom du round pour faciliter l'affichage
                        poolId: pool.id,
                        createdAt: new Date()
                    });
                    matchNumberInPool++;
                }
            }
        }

        pool.matches = poolMatches;
        phase1Pools.push(pool);
        allMatches.push(...poolMatches);
    }

    console.log(`✅ Phase 1: ${allMatches.length} matchs générés (${phase1Pools.length} poules)`);

    return {
        phaseNumber: 1,
        pools: phase1Pools,
        allMatches: allMatches,
        description: 'Filtre 4v4: 36 joueurs divisés en 3 poules de 12, 3 tournées par poule'
    };
}

// ========================================
// QUALIFICATIONS PHASE 1 → PHASE 2
// ========================================

/**
 * Calcule les joueurs qualifiés de la Phase 1 basé sur leurs scores individuels.
 * Le top N de chaque poule se qualifie (généralement top 4).
 * @param {Array<object>} phase1Pools - Les poules de la Phase 1.
 * @param {Array<object>} phase1Matches - Tous les matchs de la Phase 1.
 * @param {number} qualifiersPerPool - Nombre de qualifiés par poule (par défaut 4).
 * @returns {Array<object>} Les joueurs qualifiés pour la Phase 2.
 */
function getPhase1Qualifiers(phase1Pools, phase1Matches, qualifiersPerPool = 4) {
    console.log('📊 [Phase 1→2] Calculating qualifiers from Phase 1...');

    const qualifiers = [];

    // Pour chaque poule, calculer le classement et prendre les top N
    for (const pool of phase1Pools) {
        const poolPlayerScores = {};

        // Initialiser les scores
        pool.players.forEach(player => {
            poolPlayerScores[player.id] = {
                ...player,
                wins: 0,
                losses: 0,
                matchesPlayed: 0
            };
        });

        // Compter les victoires
        const poolMatches = phase1Matches.filter(m => m.poolId === pool.id && m.status === 'completed');
        poolMatches.forEach(match => {
            if (match.winnerTeam && match.winnerTeam.members) {
                match.winnerTeam.members.forEach(player => {
                    if (poolPlayerScores[player.id]) {
                        poolPlayerScores[player.id].wins++;
                    }
                });
            }
            // Compter les matchs joués
            if (match.team1 && match.team1.members) {
                match.team1.members.forEach(player => {
                    if (poolPlayerScores[player.id]) {
                        poolPlayerScores[player.id].matchesPlayed++;
                    }
                });
            }
            if (match.team2 && match.team2.members) {
                match.team2.members.forEach(player => {
                    if (poolPlayerScores[player.id]) {
                        poolPlayerScores[player.id].matchesPlayed++;
                    }
                });
            }
        });

        // Trier et prendre les top N
        const ranking = Object.values(poolPlayerScores).sort((a, b) => b.wins - a.wins);
        const poolQualifiers = ranking.slice(0, qualifiersPerPool);
        qualifiers.push(...poolQualifiers);

        console.log(`  📍 ${pool.name}: Top ${qualifiersPerPool} qualifiés`);
    }

    console.log(`✅ Total qualifiés Phase 1→2: ${qualifiers.length}`);
    return qualifiers;
}

// ========================================
// PHASE 2 (3v3) - SÉLECTION
// ========================================

/**
 * Génère les matchs et la structure pour la Phase 2 (3v3).
 * Format: 12 joueurs → 2 poules de 6 → KOB 5 tours → 8 qualifiés
 * @param {Array<object>} qualifiedPlayers - Les 12 joueurs qualifiés de la Phase 1.
 * @param {object} tournament - L'objet de configuration du tournoi.
 * @returns {object} La structure complète de la Phase 2.
 */
function generatePhase2(qualifiedPlayers, tournament) {
    console.log('🎮 [Phase 2] Generating 3v3 phase (12→8)...');

    const numQualifiedPlayers = qualifiedPlayers.length;
    const numPools = PHASE2_NUM_POOLS;
    const playersPerPool = Math.floor(numQualifiedPlayers / numPools);
    const teamSize = PHASE2_TEAM_SIZE;
    const numRounds = PHASE2_NUM_ROUNDS;

    const phase2Pools = [];
    const allMatches = [];
    let playerIndex = 0;

    const kob3v3Grid = generateKOB3v3Grid();
    const shuffledQualifiedPlayers = shuffleArray([...qualifiedPlayers]);

    // Créer les poules
    for (let poolIdx = 0; poolIdx < numPools; poolIdx++) {
        const poolPlayers = shuffledQualifiedPlayers.slice(playerIndex, playerIndex + playersPerPool);
        playerIndex += playersPerPool;

        const poolMatches = [];
        const pool = {
            id: `pool-${String.fromCharCode(68 + poolIdx)}`, // Poule D, E
            name: `Poule ${String.fromCharCode(68 + poolIdx)}`,
            players: poolPlayers,
            matches: []
        };

        // Générer les 5 tours KOB 3v3
        for (let roundNum = 0; roundNum < numRounds; roundNum++) {
            const roundId = `round-${pool.id}-${roundNum + 1}`; // ID unique pour le round
            const roundName = `Phase 2 - Tour ${roundNum + 1}`;

            const [team1Indices, team2Indices] = kob3v3Grid[roundNum];
            const team1Members = team1Indices.map(idx => poolPlayers[idx]);
            const team2Members = team2Indices.map(idx => poolPlayers[idx]);

            const team1 = {
                name: `${pool.name} - Tour ${roundNum + 1}A`,
                members: team1Members
            };
            const team2 = {
                name: `${pool.name} - Tour ${roundNum + 1}B`,
                members: team2Members
            };

            poolMatches.push({
                id: `match-${pool.id}-${roundNum + 1}`,
                matchNumber: roundNum + 1,
                team1: team1,
                team2: team2,
                format: '3v3',
                status: 'pending',
                roundId: roundId, // Utilisation du nouveau champ roundId
                roundName: roundName, // Ajout du nom du round pour faciliter l'affichage
                poolId: pool.id,
                createdAt: new Date()
            });
        }

        pool.matches = poolMatches;
        phase2Pools.push(pool);
        allMatches.push(...poolMatches);
    }

    console.log(`✅ Phase 2: ${allMatches.length} matchs générés (${phase2Pools.length} poules)`);

    return {
        phaseNumber: 2,
        pools: phase2Pools,
        allMatches: allMatches,
        description: 'Sélection 3v3: 12 joueurs divisés en 2 poules de 6, KOB 5 tours par poule'
    };
}

// ========================================
// QUALIFICATIONS PHASE 2 → PHASE 3
// ========================================

/**
 * Calcule les joueurs qualifiés de la Phase 2 pour la finale.
 * Le top N de chaque poule se qualifie (généralement top 4).
 * @param {Array<object>} phase2Pools - Les poules de la Phase 2.
 * @param {Array<object>} phase2Matches - Tous les matchs de la Phase 2.
 * @param {number} qualifiersPerPool - Nombre de qualifiés par poule (par défaut 4).
 * @returns {Array<object>} Les joueurs qualifiés pour la Phase 3.
 */
function getPhase2Qualifiers(phase2Pools, phase2Matches, qualifiersPerPool = 4) {
    console.log('📊 [Phase 2→3] Calculating qualifiers from Phase 2...');

    const qualifiers = [];

    for (const pool of phase2Pools) {
        const poolPlayerScores = {};

        pool.players.forEach(player => {
            poolPlayerScores[player.id] = {
                ...player,
                wins: 0,
                matchesPlayed: 0
            };
        });

        const poolMatches = phase2Matches.filter(m => m.poolId === pool.id && m.status === 'completed');
        poolMatches.forEach(match => {
            if (match.winnerTeam && match.winnerTeam.members) {
                match.winnerTeam.members.forEach(player => {
                    if (poolPlayerScores[player.id]) {
                        poolPlayerScores[player.id].wins++;
                    }
                });
            }
            if (match.team1 && match.team1.members) {
                match.team1.members.forEach(player => {
                    if (poolPlayerScores[player.id]) {
                        poolPlayerScores[player.id].matchesPlayed++;
                    }
                });
            }
            if (match.team2 && match.team2.members) {
                match.team2.members.forEach(player => {
                    if (poolPlayerScores[player.id]) {
                        poolPlayerScores[player.id].matchesPlayed++;
                    }
                });
            }
        });

        const ranking = Object.values(poolPlayerScores).sort((a, b) => b.wins - a.wins);
        const poolQualifiers = ranking.slice(0, qualifiersPerPool);
        qualifiers.push(...poolQualifiers);

        console.log(`  📍 ${pool.name}: Top ${qualifiersPerPool} qualifiés`);
    }

    console.log(`✅ Total qualifiés Phase 2→3: ${qualifiers.length}`);
    return qualifiers;
}

// ========================================
// PHASE 3 (2v2) - FINALE KING
// ========================================

/**
 * Génère les matchs et la structure pour la Phase 3 (2v2).
 * Format: 8 joueurs → 1 poule → KOB 7 tours → 1 KING
 * @param {Array<object>} finalists - Les 8 joueurs qualifiés de la Phase 2.
 * @param {object} tournament - L'objet de configuration du tournoi.
 * @returns {object} La structure complète de la Phase 3.
 */
function generatePhase3(finalists, tournament) {
    console.log('🎮 [Phase 3] Generating 2v2 final phase (8→1)...');

    const teamSize = PHASE3_TEAM_SIZE;
    const numRounds = PHASE3_NUM_ROUNDS;

    const finalPoolMatches = [];
    const rotationPairs = generateKOB2v2Grid();

    const finalPool = {
        id: 'final-pool',
        name: 'Poule Finale (2v2)',
        players: finalists,
        matches: []
    };

    let matchNumber = 1;

    // 7 tours, 2 matchs par tour = 14 matchs
    for (let roundNum = 0; roundNum < numRounds; roundNum++) {
        const currentRoundMatches = rotationPairs[roundNum];

        for (let matchIdx = 0; matchIdx < currentRoundMatches.length; matchIdx++) {
            const [team1Indices, team2Indices] = currentRoundMatches[matchIdx];
            const team1Members = team1Indices.map(idx => finalists[idx]);
            const team2Members = team2Indices.map(idx => finalists[idx]);

            const team1 = {
                name: `Équipe Finale ${roundNum + 1}-${String.fromCharCode(65 + matchIdx)}`,
                members: team1Members
            };
            const team2 = {
                name: `Équipe Finale ${roundNum + 1}-${String.fromCharCode(66 + matchIdx)}`,
                members: team2Members
            };

            finalPoolMatches.push({
                id: `match-final-${matchNumber}`,
                matchNumber: matchNumber,
                team1: team1,
                team2: team2,
                format: '2v2',
                status: 'pending',
                roundId: `round-${finalPool.id}-${roundNum + 1}`, // ID unique pour le round
                roundName: `Phase Finale - Tour ${roundNum + 1}`, // Ajout du nom du round pour faciliter l'affichage
                poolId: finalPool.id,
                createdAt: new Date()
            });

            matchNumber++;
        }
    }

    finalPool.matches = finalPoolMatches;

    console.log(`✅ Phase 3: ${finalPoolMatches.length} matchs générés`);

    return {
        phaseNumber: 3,
        pools: [finalPool],
        allMatches: finalPoolMatches,
        description: 'Finale KING 2v2: 8 joueurs, KOB 7 tours, le joueur avec le plus de victoires est le KING'
    };
}

// ========================================
// CLASSEMENTS & RANKINGS
// ========================================

/**
 * Calcule le classement individuel des joueurs pour une phase complète.
 * @param {Array<object>} matches - Tous les matchs de la phase (ou plusieurs phases).
 * @returns {Array<object>} Liste triée de joueurs avec leurs scores.
 */
function calculateKingRanking(matches) {
    const playerScores = {};

    matches.forEach(match => {
        if (match.status === 'completed') {
            const team1 = match.team1;
            const team2 = match.team2;
            const setsWonTeam1 = match.setsWonTeam1 || 0;
            const setsWonTeam2 = match.setsWonTeam2 || 0;

            // Initialiser les scores pour tous les joueurs impliqués
            [team1, team2].forEach(team => {
                if (team && team.members) {
                    team.members.forEach(player => {
                        if (!playerScores[player.id]) {
                            playerScores[player.id] = {
                                ...player,
                                wins: 0,
                                losses: 0,
                                matchesPlayed: 0,
                                setsWon: 0,
                                setsLost: 0,
                                winPercentage: 0
                            };
                        }
                    });
                }
            });

            // Mettre à jour les matchs joués et les sets
            if (team1 && team1.members) {
                team1.members.forEach(player => {
                    playerScores[player.id].matchesPlayed++;
                    playerScores[player.id].setsWon += setsWonTeam1;
                    playerScores[player.id].setsLost += setsWonTeam2;
                });
            }
            if (team2 && team2.members) {
                team2.members.forEach(player => {
                    playerScores[player.id].matchesPlayed++;
                    playerScores[player.id].setsWon += setsWonTeam2;
                    playerScores[player.id].setsLost += setsWonTeam1;
                });
            }

            // Mettre à jour les victoires/défaites
            if (match.winnerTeam) {
                const winnerTeam = match.winnerTeam;
                const losingTeam = (team1 && team1.name === winnerTeam.name) ? team2 : team1;

                if (winnerTeam && winnerTeam.members) {
                    winnerTeam.members.forEach(player => {
                        playerScores[player.id].wins++;
                    });
                }
                if (losingTeam && losingTeam.members) {
                    losingTeam.members.forEach(player => {
                        playerScores[player.id].losses++;
                    });
                }
            }
        }
    });

    const ranking = Object.values(playerScores)
        .map(player => {
            // Calculer le pourcentage de victoires
            player.winPercentage = player.matchesPlayed > 0 ? (player.wins / player.matchesPlayed) * 100 : 0;
            return player;
        })
        .sort((a, b) => {
            // Trier par victoires décroissantes, puis par pourcentage de victoires, puis par sets gagnés
            if (b.wins !== a.wins) {
                return b.wins - a.wins;
            }
            if (b.winPercentage !== a.winPercentage) {
                return b.winPercentage - a.winPercentage;
            }
            return b.setsWon - a.setsWon;
        });

    return ranking;
}

/**
 * Génère la structure complète d'un tournoi King avec toutes les phases.
 * @param {Array<object>} players - Tous les joueurs.
 * @param {object} tournamentConfig - Configuration du tournoi.
 * @returns {object} Structure King complète avec phases et classements.
 */
function generateKingTournament(players, tournamentConfig) {
    console.log('🏆 [KING] Generating complete King tournament structure...');

    const kingData = {
        phases: [],
        ranking: []
    };

    // Générer Phase 1
    const phase1Result = generatePhase1(players, tournamentConfig);
    kingData.phases.push(phase1Result);

    // Le classement initial sera basé uniquement sur la Phase 1 (une fois qu'elle sera complétée)
    kingData.ranking = calculateKingRanking(phase1Result.allMatches);

    console.log('✅ King tournament structure generated successfully');
    return kingData;
}

// ========================================
// OPÉRATIONS FIRESTORE
// ========================================

/**
 * Supprime récursivement toutes les données d'une phase (pools et matchs).
 * @param {object} batch - Batch Firestore.
 * @param {object} phaseDocRef - Référence du document de la phase.
 */
async function deleteKingPhaseData(batch, phaseDocRef) {
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    for (const poolDoc of poolsSnapshot.docs) {
        // Supprimer les matchs de la poule
        const matchesSnapshot = await poolDoc.ref.collection('matches').get();
        matchesSnapshot.docs.forEach(matchDoc => batch.delete(matchDoc.ref));

        // Supprimer les rounds de la poule
        const roundsSnapshot = await poolDoc.ref.collection('rounds').get();
        roundsSnapshot.docs.forEach(roundDoc => batch.delete(roundDoc.ref));
        
        batch.delete(poolDoc.ref);
    }
    batch.delete(phaseDocRef);
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
    // Utilitaires
    shuffleArray,
    formRandomTeams,
    generateKOB2v2Grid,
    generateKOB3v3Grid,

    // Phases
    generatePhase1,
    generatePhase2,
    generatePhase3,
    generateKingTournament,

    // Qualifications
    getPhase1Qualifiers,
    getPhase2Qualifiers,

    // Classements
    calculateKingRanking,

    // Firestore
    deleteKingPhaseData,

    // Constantes
    PHASE1_TEAMS_PER_POOL,
    PHASE1_TEAM_SIZE,
    PHASE1_NUM_ROUNDS_PER_POOL,
    PHASE1_PLAYERS_PER_POOL,
    PHASE1_QUALIFIERS_PER_POOL,
    PHASE2_NUM_POOLS,
    PHASE2_TEAM_SIZE,
    PHASE2_NUM_ROUNDS,
    PHASE2_QUALIFIERS_PER_POOL,
    PHASE3_TEAM_SIZE,
    PHASE3_NUM_ROUNDS
};
