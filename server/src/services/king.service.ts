/**
 * @fileoverview Service for handling the logic of "King" mode tournaments.
 * Format: 4v4 (Phase 1) → 3v3 (Phase 2) → 2v2 (Phase 3)
 *
 * Structure:
 * - Phase 1 (4v4): 36 joueurs → 12 qualifiés (3 poules de 12, 3 tournées par poule)
 * - Phase 2 (3v3): 12 joueurs → 8 qualifiés (2 poules de 6, KOB 5 tours)
 * - Phase 3 (2v2): 8 joueurs → 1 KING (1 poule, KOB 7 tours)
 */

import type {
  KingPlayer,
  KingTeam,
  KingMatch,
  KingPool,
  KingPhase,
  KingPlayerRanking,
  KingTournamentConfig,
} from '@shared/types';

// ========================================
// CONSTANTES DE CONFIGURATION
// ========================================

// Phase 1 (4v4)
export const PHASE1_TEAMS_PER_POOL = 3; // 3 équipes de 4 par poule
export const PHASE1_TEAM_SIZE = 4; // 4v4
export const PHASE1_NUM_ROUNDS_PER_POOL = 3; // 3 tournées (pas 1!)
export const PHASE1_PLAYERS_PER_POOL = 12; // 12 joueurs par poule
export const PHASE1_QUALIFIERS_PER_POOL = 4; // Top 4 se qualifient

// Phase 2 (3v3)
export const PHASE2_NUM_POOLS = 2; // 2 poules de 6
export const PHASE2_TEAM_SIZE = 3; // 3v3
export const PHASE2_NUM_ROUNDS = 5; // 5 tours KOB
export const PHASE2_QUALIFIERS_PER_POOL = 4; // Top 4 de chaque poule = 8

// Phase 3 (2v2)
export const PHASE3_TEAM_SIZE = 2; // 2v2
export const PHASE3_NUM_ROUNDS = 7; // 7 tours KOB

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

/**
 * Recursively removes all undefined values from an object or array.
 * This ensures that data saved to Firestore doesn't contain undefined values.
 */
export function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedValues(item)) as T;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
        cleaned[key] = removeUndefinedValues(obj[key]);
      }
    }
    return cleaned as T;
  }

  return obj;
}

/**
 * Mélange un tableau de manière aléatoire (algorithme de Fisher-Yates).
 */
export function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Génère des équipes aléatoires à partir d'une liste de joueurs.
 */
export function formRandomTeams(
  playersInPool: KingPlayer[],
  teamSize: number,
  numberOfTeams: number
): KingTeam[] {
  const shuffledPlayers = shuffleArray([...playersInPool]);
  const teams: KingTeam[] = [];

  for (let i = 0; i < numberOfTeams; i++) {
    teams.push({
      name: `Équipe ${i + 1}`,
      members: shuffledPlayers.slice(i * teamSize, (i + 1) * teamSize),
    });
  }

  return teams;
}

/**
 * Crée une grille KOB 2v2 pour 8 joueurs (7 tours, 2 matchs par tour).
 * Chaque joueur joue avec chaque autre joueur exactement 1 fois.
 */
export function generateKOB2v2Grid(): number[][][][] {
  // Chaque tour: [[[joueur1, joueur2], [joueur3, joueur4]], [[joueur5, joueur6], [joueur7, joueur8]]]
  return [
    [
      [
        [0, 1],
        [2, 3],
      ],
      [
        [4, 5],
        [6, 7],
      ],
    ], // Tour 1
    [
      [
        [0, 4],
        [1, 5],
      ],
      [
        [2, 6],
        [3, 7],
      ],
    ], // Tour 2
    [
      [
        [0, 5],
        [2, 7],
      ],
      [
        [1, 6],
        [3, 4],
      ],
    ], // Tour 3
    [
      [
        [0, 6],
        [1, 7],
      ],
      [
        [2, 4],
        [3, 5],
      ],
    ], // Tour 4
    [
      [
        [0, 7],
        [3, 6],
      ],
      [
        [1, 2],
        [4, 5],
      ],
    ], // Tour 5
    [
      [
        [0, 3],
        [4, 6],
      ],
      [
        [1, 5],
        [2, 7],
      ],
    ], // Tour 6
    [
      [
        [0, 2],
        [5, 4],
      ],
      [
        [1, 3],
        [6, 7],
      ],
    ], // Tour 7
  ];
}

/**
 * Crée une grille KOB 3v3 pour 6 joueurs (5 tours, 1 match par tour).
 */
export function generateKOB3v3Grid(): number[][][] {
  return [
    [[0, 1, 2], [3, 4, 5]], // Tour 1: (1-2-3) vs (4-5-6)
    [[0, 3, 4], [1, 2, 5]], // Tour 2: (1-4-5) vs (2-3-6)
    [[0, 1, 5], [2, 3, 4]], // Tour 3: (1-2-6) vs (3-4-5)
    [[0, 2, 3], [1, 4, 5]], // Tour 4: (1-3-4) vs (2-5-6)
    [[0, 4, 5], [1, 2, 3]], // Tour 5: (1-5-6) vs (2-3-4)
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
 */
export function generatePhase1(players: KingPlayer[], tournament: any): KingPhase {
  console.log('🎮 [Phase 1] Generating 4v4 phase (36→12)...');

  const numPlayers = players.length;
  const numPools = tournament.fields || 3;
  const playersPerPool = Math.floor(numPlayers / numPools);

  const teamsPerPool = tournament.phase1TeamsPerPool || PHASE1_TEAMS_PER_POOL;
  const teamSize = tournament.phase1TeamSize || PHASE1_TEAM_SIZE;
  const numRoundsPerPool = tournament.phase1NumRoundsPerPool || PHASE1_NUM_ROUNDS_PER_POOL;

  const phase1Pools: KingPool[] = [];
  const allMatches: KingMatch[] = [];
  let playerIndex = 0;

  // Créer les poules (généralement 3)
  for (let poolIdx = 0; poolIdx < numPools; poolIdx++) {
    const poolPlayers = players.slice(playerIndex, playerIndex + playersPerPool);
    playerIndex += playersPerPool;

    const poolMatches: KingMatch[] = [];
    const pool: KingPool = {
      id: `pool-${String.fromCharCode(65 + poolIdx)}`,
      name: `Poule ${String.fromCharCode(65 + poolIdx)}`,
      players: poolPlayers,
      matches: [],
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
            roundId: roundId,
            roundName: roundName,
            poolId: pool.id,
            createdAt: new Date(),
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
    description: 'Filtre 4v4: 36 joueurs divisés en 3 poules de 12, 3 tournées par poule',
    status: 'in-progress',
    pools: phase1Pools,
    allMatches: allMatches,
    ranking: [],
    createdAt: new Date(),
  };
}

// ========================================
// QUALIFICATIONS PHASE 1 → PHASE 2
// ========================================

/**
 * Calcule les joueurs qualifiés de la Phase 1 basé sur leurs scores individuels.
 * Le top N de chaque poule se qualifie (généralement top 4).
 */
export function getPhase1Qualifiers(
  phase1Pools: KingPool[],
  phase1Matches: KingMatch[],
  qualifiersPerPool: number = 4
): KingPlayer[] {
  console.log('📊 [Phase 1→2] Calculating qualifiers from Phase 1...');

  const qualifiers: KingPlayer[] = [];

  // Pour chaque poule, calculer le classement et prendre les top N
  for (const pool of phase1Pools) {
    const poolPlayerScores: Record<string, any> = {};

    // Initialiser les scores
    pool.players.forEach((player) => {
      poolPlayerScores[player.id] = {
        ...player,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
      };
    });

    // Compter les victoires
    const poolMatches = phase1Matches.filter(
      (m) => m.poolId === pool.id && m.status === 'completed'
    );

    poolMatches.forEach((match) => {
      if (match.winnerTeam && match.winnerTeam.members) {
        match.winnerTeam.members.forEach((player) => {
          if (poolPlayerScores[player.id]) {
            poolPlayerScores[player.id].wins++;
          }
        });
      }
      // Compter les matchs joués
      if (match.team1 && match.team1.members) {
        match.team1.members.forEach((player) => {
          if (poolPlayerScores[player.id]) {
            poolPlayerScores[player.id].matchesPlayed++;
          }
        });
      }
      if (match.team2 && match.team2.members) {
        match.team2.members.forEach((player) => {
          if (poolPlayerScores[player.id]) {
            poolPlayerScores[player.id].matchesPlayed++;
          }
        });
      }
    });

    // Trier et prendre les top N
    const ranking = Object.values(poolPlayerScores).sort(
      (a: any, b: any) => b.wins - a.wins
    );
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
 */
export function generatePhase2(qualifiedPlayers: KingPlayer[], tournament: any): KingPhase {
  console.log('🎮 [Phase 2] Generating 3v3 phase (12→8)...');

  const numQualifiedPlayers = qualifiedPlayers.length;
  const numPools = PHASE2_NUM_POOLS;
  const playersPerPool = Math.floor(numQualifiedPlayers / numPools);
  const teamSize = PHASE2_TEAM_SIZE;
  const numRounds = PHASE2_NUM_ROUNDS;

  const phase2Pools: KingPool[] = [];
  const allMatches: KingMatch[] = [];
  let playerIndex = 0;

  const kob3v3Grid = generateKOB3v3Grid();
  const shuffledQualifiedPlayers = shuffleArray([...qualifiedPlayers]);

  // Créer les poules
  for (let poolIdx = 0; poolIdx < numPools; poolIdx++) {
    const poolPlayers = shuffledQualifiedPlayers.slice(playerIndex, playerIndex + playersPerPool);
    playerIndex += playersPerPool;

    const poolMatches: KingMatch[] = [];
    const pool: KingPool = {
      id: `pool-${String.fromCharCode(68 + poolIdx)}`, // Poule D, E
      name: `Poule ${String.fromCharCode(68 + poolIdx)}`,
      players: poolPlayers,
      matches: [],
    };

    // Générer les 5 tours KOB 3v3
    for (let roundNum = 0; roundNum < numRounds; roundNum++) {
      const roundId = `round-${pool.id}-${roundNum + 1}`;
      const roundName = `Phase 2 - Tour ${roundNum + 1}`;

      const [team1Indices, team2Indices] = kob3v3Grid[roundNum];
      const team1Members = team1Indices
        .map((idx) => poolPlayers[idx])
        .filter((player) => player !== undefined);
      const team2Members = team2Indices
        .map((idx) => poolPlayers[idx])
        .filter((player) => player !== undefined);

      const team1: KingTeam = {
        name: `${pool.name} - Tour ${roundNum + 1}A`,
        members: team1Members,
      };
      const team2: KingTeam = {
        name: `${pool.name} - Tour ${roundNum + 1}B`,
        members: team2Members,
      };

      poolMatches.push({
        id: `match-${pool.id}-${roundNum + 1}`,
        matchNumber: roundNum + 1,
        team1: team1,
        team2: team2,
        format: '3v3',
        status: 'pending',
        roundId: roundId,
        roundName: roundName,
        poolId: pool.id,
        createdAt: new Date(),
      });
    }

    pool.matches = poolMatches;
    phase2Pools.push(pool);
    allMatches.push(...poolMatches);
  }

  console.log(`✅ Phase 2: ${allMatches.length} matchs générés (${phase2Pools.length} poules)`);

  return {
    phaseNumber: 2,
    description: 'Sélection 3v3: 12 joueurs divisés en 2 poules de 6, KOB 5 tours par poule',
    status: 'in-progress',
    pools: phase2Pools,
    allMatches: allMatches,
    ranking: [],
    createdAt: new Date(),
  };
}

// ========================================
// QUALIFICATIONS PHASE 2 → PHASE 3
// ========================================

/**
 * Calcule les joueurs qualifiés de la Phase 2 pour la finale.
 * Le top N de chaque poule se qualifie (généralement top 4).
 */
export function getPhase2Qualifiers(
  phase2Pools: KingPool[],
  phase2Matches: KingMatch[],
  qualifiersPerPool: number = 4
): KingPlayer[] {
  console.log('📊 [Phase 2→3] Calculating qualifiers from Phase 2...');

  const qualifiers: KingPlayer[] = [];

  for (const pool of phase2Pools) {
    const poolPlayerScores: Record<string, any> = {};

    pool.players.forEach((player) => {
      poolPlayerScores[player.id] = {
        ...player,
        wins: 0,
        matchesPlayed: 0,
      };
    });

    const poolMatches = phase2Matches.filter(
      (m) => m.poolId === pool.id && m.status === 'completed'
    );

    poolMatches.forEach((match) => {
      if (match.winnerTeam && match.winnerTeam.members) {
        match.winnerTeam.members.forEach((player) => {
          if (poolPlayerScores[player.id]) {
            poolPlayerScores[player.id].wins++;
          }
        });
      }
      if (match.team1 && match.team1.members) {
        match.team1.members.forEach((player) => {
          if (poolPlayerScores[player.id]) {
            poolPlayerScores[player.id].matchesPlayed++;
          }
        });
      }
      if (match.team2 && match.team2.members) {
        match.team2.members.forEach((player) => {
          if (poolPlayerScores[player.id]) {
            poolPlayerScores[player.id].matchesPlayed++;
          }
        });
      }
    });

    const ranking = Object.values(poolPlayerScores).sort(
      (a: any, b: any) => b.wins - a.wins
    );
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
 */
export function generatePhase3(finalists: KingPlayer[], tournament: any): KingPhase {
  console.log('🎮 [Phase 3] Generating 2v2 final phase (8→1)...');

  const teamSize = PHASE3_TEAM_SIZE;
  const numRounds = PHASE3_NUM_ROUNDS;

  const finalPoolMatches: KingMatch[] = [];
  const rotationPairs = generateKOB2v2Grid();

  const finalPool: KingPool = {
    id: 'final-pool',
    name: 'Poule Finale (2v2)',
    players: finalists,
    matches: [],
  };

  let matchNumber = 1;

  // 7 tours, 2 matchs par tour = 14 matchs
  for (let roundNum = 0; roundNum < numRounds; roundNum++) {
    const currentRoundMatches = rotationPairs[roundNum];

    for (let matchIdx = 0; matchIdx < currentRoundMatches.length; matchIdx++) {
      const [team1Indices, team2Indices] = currentRoundMatches[matchIdx];
      const team1Members = team1Indices
        .map((idx) => finalists[idx])
        .filter((player) => player !== undefined);
      const team2Members = team2Indices
        .map((idx) => finalists[idx])
        .filter((player) => player !== undefined);

      const team1: KingTeam = {
        name: `Équipe Finale ${roundNum + 1}-${String.fromCharCode(65 + matchIdx)}`,
        members: team1Members,
      };
      const team2: KingTeam = {
        name: `Équipe Finale ${roundNum + 1}-${String.fromCharCode(66 + matchIdx)}`,
        members: team2Members,
      };

      finalPoolMatches.push({
        id: `match-final-${matchNumber}`,
        matchNumber: matchNumber,
        team1: team1,
        team2: team2,
        format: '2v2',
        status: 'pending',
        roundId: `round-${finalPool.id}-${roundNum + 1}`,
        roundName: `Phase Finale - Tour ${roundNum + 1}`,
        poolId: finalPool.id,
        createdAt: new Date(),
      });

      matchNumber++;
    }
  }

  finalPool.matches = finalPoolMatches;

  console.log(`✅ Phase 3: ${finalPoolMatches.length} matchs générés`);

  return {
    phaseNumber: 3,
    description:
      'Finale KING 2v2: 8 joueurs, KOB 7 tours, le joueur avec le plus de victoires est le KING',
    status: 'in-progress',
    pools: [finalPool],
    allMatches: finalPoolMatches,
    ranking: [],
    createdAt: new Date(),
  };
}

// ========================================
// CLASSEMENTS & RANKINGS
// ========================================

/**
 * Calcule le classement individuel des joueurs pour une phase complète.
 */
export function calculateKingRanking(matches: KingMatch[]): KingPlayerRanking[] {
  const playerScores: Record<string, any> = {};

  matches.forEach((match) => {
    if (match.status === 'completed') {
      const team1 = match.team1;
      const team2 = match.team2;
      const setsWonTeam1 = match.setsWonTeam1 || 0;
      const setsWonTeam2 = match.setsWonTeam2 || 0;

      // Initialiser les scores pour tous les joueurs impliqués
      [team1, team2].forEach((team) => {
        if (team && team.members) {
          team.members.forEach((player) => {
            if (!playerScores[player.id]) {
              playerScores[player.id] = {
                playerId: player.id,
                playerPseudo: player.pseudo,
                wins: 0,
                losses: 0,
                setsWon: 0,
                setsLost: 0,
                setsDiff: 0,
                pointsWon: 0,
                pointsLost: 0,
                pointsDiff: 0,
              };
            }
          });
        }
      });

      // Mettre à jour les sets
      if (team1 && team1.members) {
        team1.members.forEach((player) => {
          playerScores[player.id].setsWon += setsWonTeam1;
          playerScores[player.id].setsLost += setsWonTeam2;
        });
      }
      if (team2 && team2.members) {
        team2.members.forEach((player) => {
          playerScores[player.id].setsWon += setsWonTeam2;
          playerScores[player.id].setsLost += setsWonTeam1;
        });
      }

      // Mettre à jour les victoires/défaites
      if (match.winnerTeam) {
        const winnerTeam = match.winnerTeam;
        const losingTeam = team1 && team1.name === winnerTeam.name ? team2 : team1;

        if (winnerTeam && winnerTeam.members) {
          winnerTeam.members.forEach((player) => {
            playerScores[player.id].wins++;
          });
        }
        if (losingTeam && losingTeam.members) {
          losingTeam.members.forEach((player) => {
            playerScores[player.id].losses++;
          });
        }
      }
    }
  });

  const ranking: KingPlayerRanking[] = Object.values(playerScores)
    .map((player: any) => {
      player.setsDiff = player.setsWon - player.setsLost;
      player.pointsDiff = player.pointsWon - player.pointsLost;
      return player as KingPlayerRanking;
    })
    .sort((a, b) => {
      // Trier par victoires décroissantes, puis par diff sets, puis par sets gagnés
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (b.setsDiff !== a.setsDiff) {
        return b.setsDiff - a.setsDiff;
      }
      return b.setsWon - a.setsWon;
    });

  // Ajouter les rangs
  ranking.forEach((player, index) => {
    player.rank = index + 1;
  });

  return ranking;
}

// ========================================
// OPÉRATIONS FIRESTORE
// ========================================

/**
 * Supprime récursivement toutes les données d'une phase (pools et matchs).
 */
export async function deleteKingPhaseData(batch: any, phaseDocRef: any): Promise<void> {
  const poolsSnapshot = await phaseDocRef.collection('pools').get();
  for (const poolDoc of poolsSnapshot.docs) {
    // Supprimer les matchs de la poule
    const matchesSnapshot = await poolDoc.ref.collection('matches').get();
    matchesSnapshot.docs.forEach((matchDoc: any) => batch.delete(matchDoc.ref));

    // Supprimer les rounds de la poule
    const roundsSnapshot = await poolDoc.ref.collection('rounds').get();
    roundsSnapshot.docs.forEach((roundDoc: any) => batch.delete(roundDoc.ref));

    batch.delete(poolDoc.ref);
  }
  batch.delete(phaseDocRef);
}
