/**
 * @fileoverview Service for handling flexible King Mode tournaments
 * Supports customizable phase configurations with variable:
 * - Pool counts and distributions
 * - Team sizes
 * - Qualified player counts
 * - Phase formats (Round Robin or KOB)
 */

import type {
  FlexiblePhaseConfig,
  FlexibleKingPhase,
  FlexibleKingTournamentData,
  FlexiblePhaseStatus,
  KingPlayer,
  KingTeam,
  KingMatch,
  KingPool,
  PhaseFormat,
} from '@shared/types';
import { shuffleArray, formRandomTeams } from './king.service';

// ========================================
// CONFIGURATION HELPERS
// ========================================

/**
 * Distributes teams evenly across pools
 * Example: 10 teams into 3 pools → [4, 3, 3]
 */
export function distributeTeamsInPools(totalTeams: number, numberOfPools: number): number[] {
  const baseTeamsPerPool = Math.floor(totalTeams / numberOfPools);
  const remainder = totalTeams % numberOfPools;
  const distribution: number[] = [];

  for (let i = 0; i < numberOfPools; i++) {
    distribution.push(i < remainder ? baseTeamsPerPool + 1 : baseTeamsPerPool);
  }
  return distribution;
}

/**
 * Distributes qualified players evenly across pools
 * Example: 12 qualified players into 3 pools → [4, 4, 4]
 */
export function distributeQualifiedInPools(
  totalQualified: number,
  numberOfPools: number
): number[] {
  const baseQualifiedPerPool = Math.floor(totalQualified / numberOfPools);
  const remainder = totalQualified % numberOfPools;
  const qualifiedDistribution: number[] = [];

  for (let i = 0; i < numberOfPools; i++) {
    qualifiedDistribution.push(i < remainder ? baseQualifiedPerPool + 1 : baseQualifiedPerPool);
  }
  return qualifiedDistribution;
}

/**
 * Calculates number of KOB rounds needed for N teams
 * Formula: 2N - 3 (ensures each player plays with each other once)
 */
export function calculateKOBRounds(teamsPerPool: number): number {
  if (teamsPerPool <= 2) return 1;
  if (teamsPerPool === 3) return 3;
  if (teamsPerPool === 4) return 5;
  if (teamsPerPool === 5) return 7;
  if (teamsPerPool === 6) return 9;
  if (teamsPerPool === 7) return 11;
  if (teamsPerPool === 8) return 13;
  return teamsPerPool * 2 - 3;
}

/**
 * Calculates total matches for a phase
 */
export function calculateTotalMatches(
  phaseFormat: PhaseFormat,
  teamsPerPool: number,
  numberOfPools: number,
  estimatedRounds: number,
  poolDistribution?: number[]
): number {
  if (poolDistribution && poolDistribution.length > 0) {
    let totalMatches = 0;
    for (const teamsInPool of poolDistribution) {
      if (phaseFormat === 'round-robin') {
        const matchesPerRound = (teamsInPool * (teamsInPool - 1)) / 2;
        totalMatches += matchesPerRound * estimatedRounds;
      } else {
        const matchesPerRound = Math.floor(teamsInPool / 2);
        totalMatches += matchesPerRound * estimatedRounds;
      }
    }
    return totalMatches;
  }

  // Legacy calculation (balanced pools)
  if (phaseFormat === 'round-robin') {
    const matchesPerRoundPerPool = (teamsPerPool * (teamsPerPool - 1)) / 2;
    return matchesPerRoundPerPool * estimatedRounds * numberOfPools;
  } else {
    const matchesPerRoundPerPool = Math.floor(teamsPerPool / 2);
    return matchesPerRoundPerPool * estimatedRounds * numberOfPools;
  }
}

// ========================================
// PHASE GENERATION
// ========================================

/**
 * Generates pools and matches for a Round Robin phase
 */
function generateRoundRobinMatches(
  poolPlayers: KingPlayer[],
  poolId: string,
  _poolName: string,
  teamSize: number,
  teamsPerPool: number,
  numRounds: number,
  phaseNumber: number
): KingMatch[] {
  const matches: KingMatch[] = [];
  let matchNumberInPool = 1;

  for (let roundNum = 1; roundNum <= numRounds; roundNum++) {
    const roundId = `round-${poolId}-${roundNum}`;
    const roundName = `Phase ${phaseNumber} - Tournée ${roundNum}`;

    const shuffledPoolPlayers = shuffleArray([...poolPlayers]);
    const teams = formRandomTeams(shuffledPoolPlayers, teamSize, teamsPerPool);

    // Round Robin: all combinations (C(N,2))
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `match-${poolId}-${matchNumberInPool}`,
          matchNumber: matchNumberInPool,
          team1: teams[i],
          team2: teams[j],
          format: `${teamSize}v${teamSize}` as any,
          status: 'pending',
          roundId: roundId,
          roundName: roundName,
          poolId: poolId,
          createdAt: new Date(),
        });
        matchNumberInPool++;
      }
    }
  }

  return matches;
}

/**
 * Generates KOB matches with proper player rotation
 * In KOB mode, players should have different teammates each round
 */
function generateKOBMatches(
  poolPlayers: KingPlayer[],
  poolId: string,
  poolName: string,
  teamSize: number,
  numRounds: number,
  phaseNumber: number
): KingMatch[] {
  const matches: KingMatch[] = [];
  const numPlayers = poolPlayers.length;
  const playersPerMatch = teamSize * 2;
  const numMatchesPerRound = Math.floor(numPlayers / playersPerMatch);

  let matchNumber = 1;

  // Use circle method for rotation: fix first player, rotate others
  for (let roundNum = 0; roundNum < numRounds; roundNum++) {
    const roundId = `round-${poolId}-${roundNum + 1}`;
    const roundName = `Phase ${phaseNumber} - Tour ${roundNum + 1}`;

    // Create rotated player indices for this round
    const rotatedIndices: number[] = [0]; // Player 0 stays fixed
    for (let i = 1; i < numPlayers; i++) {
      // Rotate players 1 to n-1
      const rotatedPos = ((i - 1 + roundNum) % (numPlayers - 1)) + 1;
      rotatedIndices.push(rotatedPos);
    }

    // Form teams from rotated indices
    for (let matchIdx = 0; matchIdx < numMatchesPerRound; matchIdx++) {
      const team1Members: KingPlayer[] = [];
      const team2Members: KingPlayer[] = [];

      // Assign players to teams using the rotated indices
      for (let i = 0; i < teamSize; i++) {
        const team1PlayerIdx = rotatedIndices[matchIdx * playersPerMatch + i];
        const team2PlayerIdx = rotatedIndices[matchIdx * playersPerMatch + teamSize + i];
        team1Members.push(poolPlayers[team1PlayerIdx]);
        team2Members.push(poolPlayers[team2PlayerIdx]);
      }

      const team1: KingTeam = {
        name: `${poolName} - Tour ${roundNum + 1}A`,
        members: team1Members,
      };

      const team2: KingTeam = {
        name: `${poolName} - Tour ${roundNum + 1}B`,
        members: team2Members,
      };

      matches.push({
        id: `match-${poolId}-${matchNumber}`,
        matchNumber: matchNumber,
        team1,
        team2,
        format: `${teamSize}v${teamSize}` as any,
        status: 'pending',
        roundId,
        roundName,
        poolId,
        createdAt: new Date(),
      });

      matchNumber++;
    }
  }

  return matches;
}

/**
 * Generates pools and matches for a flexible King phase
 */
export function generatePhasePoolsAndMatches(
  phase: FlexibleKingPhase,
  registeredPlayers: KingPlayer[]
): { pools: KingPool[]; matches: KingMatch[] } {
  const config = phase.config;
  const participantIds = phase.participantIds;

  // Filter players by participant IDs
  const participants = registeredPlayers.filter((p) => participantIds.includes(p.id));

  if (participants.length !== participantIds.length) {
    throw new Error(
      `Player count mismatch: expected ${participantIds.length}, got ${participants.length}`
    );
  }

  // Shuffle participants for randomization
  const shuffledParticipants = shuffleArray(participants);

  // Determine pool distribution
  const poolDistribution = config.poolDistribution ||
    distributeTeamsInPools(config.totalTeams, config.numberOfPools);

  // Ensure estimatedRounds has a valid value (default to 3 for round-robin, 5 for KOB)
  const estimatedRounds = config.estimatedRounds || (config.phaseFormat === 'round-robin' ? 3 : 5);

  console.log(`[generatePhasePoolsAndMatches] Phase ${config.phaseNumber}:`);
  console.log(`  - config.estimatedRounds: ${config.estimatedRounds}`);
  console.log(`  - using estimatedRounds: ${estimatedRounds}`);
  console.log(`  - phaseFormat: ${config.phaseFormat}`);
  console.log(`  - numberOfPools: ${config.numberOfPools}`);
  console.log(`  - teamsPerPool: ${config.teamsPerPool}`);

  const pools: KingPool[] = [];
  const allMatches: KingMatch[] = [];
  let playerIndex = 0;

  for (let poolIdx = 0; poolIdx < config.numberOfPools; poolIdx++) {
    const teamsInThisPool = poolDistribution[poolIdx];
    const playersInThisPool = teamsInThisPool * config.playersPerTeam;

    const poolPlayers = shuffledParticipants.slice(playerIndex, playerIndex + playersInThisPool);
    playerIndex += playersInThisPool;

    const poolId = `pool-${String.fromCharCode(65 + poolIdx)}`;
    const poolName = `Poule ${String.fromCharCode(65 + poolIdx)}`;

    let poolMatches: KingMatch[] = [];

    if (config.phaseFormat === 'round-robin') {
      poolMatches = generateRoundRobinMatches(
        poolPlayers,
        poolId,
        poolName,
        config.playersPerTeam,
        teamsInThisPool,
        estimatedRounds,
        config.phaseNumber
      );
    } else {
      poolMatches = generateKOBMatches(
        poolPlayers,
        poolId,
        poolName,
        config.playersPerTeam,
        estimatedRounds,
        config.phaseNumber
      );
    }

    const pool: KingPool = {
      id: poolId,
      name: poolName,
      players: poolPlayers,
      matches: poolMatches,
      playerCount: poolPlayers.length,
      createdAt: new Date(),
    };

    pools.push(pool);
    allMatches.push(...poolMatches);
  }

  console.log(`✅ Phase ${config.phaseNumber}: ${allMatches.length} matches generated (${pools.length} pools)`);

  return { pools, matches: allMatches };
}

// ========================================
// QUALIFICATION & RANKING
// ========================================

/**
 * Calculate qualified players from a completed phase
 */
export function calculatePhaseQualifiers(
  pools: KingPool[],
  matches: KingMatch[],
  qualifiedPerPoolDistribution: number[]
): KingPlayer[] {
  console.log('📊 Calculating qualifiers from phase...');

  const qualifiers: KingPlayer[] = [];

  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const pool = pools[poolIdx];
    const qualifiersFromThisPool = qualifiedPerPoolDistribution[poolIdx];

    const poolPlayerScores: Record<string, any> = {};

    // Initialize scores
    pool.players.forEach((player) => {
      poolPlayerScores[player.id] = {
        ...player,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
      };
    });

    // Count wins from completed matches
    const poolMatches = matches.filter(
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

      // Count matches played
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

    // Sort and take top N
    const ranking = Object.values(poolPlayerScores).sort(
      (a: any, b: any) => b.wins - a.wins
    );

    const poolQualifiers = ranking.slice(0, qualifiersFromThisPool);
    qualifiers.push(...poolQualifiers);

    console.log(`  📍 ${pool.name}: Top ${qualifiersFromThisPool} qualifiés`);
  }

  console.log(`✅ Total qualifiés: ${qualifiers.length}`);
  return qualifiers;
}

/**
 * Calculate repechage candidates (non-qualified players ranked by performance)
 */
export function calculateRepechageCandidates(
  pools: KingPool[],
  matches: KingMatch[],
  qualifiedIds: string[]
): any[] {
  const allPlayerScores: Record<string, any> = {};

  // Initialize all players
  pools.forEach((pool) => {
    pool.players.forEach((player) => {
      if (!qualifiedIds.includes(player.id)) {
        allPlayerScores[player.id] = {
          playerId: player.id,
          playerPseudo: player.pseudo,
          wins: 0,
          losses: 0,
          matchesPlayed: 0,
        };
      }
    });
  });

  // Count wins/losses for non-qualified players
  matches.forEach((match) => {
    if (match.status === 'completed' && match.winnerTeam) {
      const winnerIds = match.winnerTeam.members.map((m) => m.id);
      const loserTeam = match.team1.name === match.winnerTeam.name ? match.team2 : match.team1;
      const loserIds = loserTeam.members.map((m) => m.id);

      winnerIds.forEach((id) => {
        if (allPlayerScores[id]) {
          allPlayerScores[id].wins++;
          allPlayerScores[id].matchesPlayed++;
        }
      });

      loserIds.forEach((id) => {
        if (allPlayerScores[id]) {
          allPlayerScores[id].losses++;
          allPlayerScores[id].matchesPlayed++;
        }
      });
    }
  });

  // Sort by wins descending
  const candidates = Object.values(allPlayerScores)
    .sort((a: any, b: any) => b.wins - a.wins)
    .map((player: any, index: number) => ({
      ...player,
      rank: index + 1,
    }));

  return candidates;
}

// ========================================
// PHASE MANAGEMENT
// ========================================

/**
 * Create initial flexible King tournament data structure
 */
export function initializeFlexibleKingTournament(
  initialPhases: FlexiblePhaseConfig[]
): FlexibleKingTournamentData {
  const phases: FlexibleKingPhase[] = initialPhases.map((config, index) => ({
    id: `phase-${index + 1}`,
    tournamentId: '', // Will be set when saved
    phaseNumber: config.phaseNumber,
    status: 'configured' as FlexiblePhaseStatus, // Set to configured since config is provided
    config,
    participantIds: [],
    qualifiedIds: [],
    withdrawnIds: [],
    repechedIds: [],
    createdAt: new Date(),
    configuredAt: new Date(),
  }));

  return {
    phases,
    currentPhaseNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Update phase configuration
 */
export function updatePhaseConfiguration(
  kingData: FlexibleKingTournamentData,
  phaseNumber: number,
  newConfig: FlexiblePhaseConfig
): FlexibleKingTournamentData {
  const phaseIndex = kingData.phases.findIndex((p) => p.phaseNumber === phaseNumber);

  if (phaseIndex === -1) {
    throw new Error(`Phase ${phaseNumber} not found`);
  }

  kingData.phases[phaseIndex].config = newConfig;
  kingData.phases[phaseIndex].status = 'configured';
  kingData.phases[phaseIndex].configuredAt = new Date();
  kingData.updatedAt = new Date();

  return kingData;
}

/**
 * Validate phase can be started
 */
export function validatePhaseStart(
  phase: FlexibleKingPhase,
  _registeredPlayersCount: number
): { valid: boolean; error?: string } {
  if (phase.status !== 'configured' && phase.status !== 'not_configured') {
    return { valid: false, error: `Phase ${phase.phaseNumber} is already ${phase.status}` };
  }

  const expectedPlayers = phase.config.totalTeams * phase.config.playersPerTeam;

  if (phase.participantIds.length !== expectedPlayers) {
    return {
      valid: false,
      error: `Expected ${expectedPlayers} players, but got ${phase.participantIds.length}`,
    };
  }

  return { valid: true };
}

/**
 * Validate all phases configuration is coherent
 */
export function validatePhasesConfiguration(
  phases: FlexibleKingPhase[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < phases.length - 1; i++) {
    const currentPhase = phases[i];
    const nextPhase = phases[i + 1];

    const currentQualified = currentPhase.config.totalQualified;
    const nextParticipants = nextPhase.config.totalTeams * nextPhase.config.playersPerTeam;

    if (currentQualified !== nextParticipants) {
      errors.push(
        `Phase ${currentPhase.phaseNumber} qualifies ${currentQualified} players, ` +
        `but Phase ${nextPhase.phaseNumber} expects ${nextParticipants} players`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ========================================
// STATISTICS & PREVIEW
// ========================================

/**
 * Generate phase preview without saving
 */
export function generatePhasePreview(
  config: FlexiblePhaseConfig,
  registeredPlayersCount: number
): {
  valid: boolean;
  errors: string[];
  preview?: {
    totalMatches: number;
    matchesPerPool: number[];
    estimatedDuration: number;
    poolDistribution: number[];
  };
} {
  const errors: string[] = [];

  // Validate player count
  const expectedPlayers = config.totalTeams * config.playersPerTeam;
  if (expectedPlayers > registeredPlayersCount) {
    errors.push(
      `Not enough players: need ${expectedPlayers}, have ${registeredPlayersCount}`
    );
  }

  // Validate pools
  if (config.numberOfPools < 1) {
    errors.push('Must have at least 1 pool');
  }

  if (config.numberOfPools > config.totalTeams) {
    errors.push('Cannot have more pools than teams');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Generate pool distribution
  const poolDistribution =
    config.poolDistribution || distributeTeamsInPools(config.totalTeams, config.numberOfPools);

  // Calculate matches per pool
  const matchesPerPool = poolDistribution.map((teamsInPool) => {
    if (config.phaseFormat === 'round-robin') {
      return ((teamsInPool * (teamsInPool - 1)) / 2) * config.estimatedRounds;
    } else {
      return Math.floor(teamsInPool / 2) * config.estimatedRounds;
    }
  });

  const totalMatches = matchesPerPool.reduce((sum, matches) => sum + matches, 0);

  return {
    valid: true,
    errors: [],
    preview: {
      totalMatches,
      matchesPerPool,
      estimatedDuration: config.estimatedTime,
      poolDistribution,
    },
  };
}

/**
 * Calculate phase statistics
 */
export function calculatePhaseStatistics(matches: KingMatch[]): {
  totalMatches: number;
  completedMatches: number;
  pendingMatches: number;
  inProgressMatches: number;
  completionPercentage: number;
  averageSetsPerMatch: number;
} {
  const stats = {
    totalMatches: matches.length,
    completedMatches: 0,
    pendingMatches: 0,
    inProgressMatches: 0,
    completionPercentage: 0,
    averageSetsPerMatch: 0,
  };

  let totalSets = 0;
  let matchesWithSets = 0;

  matches.forEach((match) => {
    if (match.status === 'completed') {
      stats.completedMatches++;
      if (match.setsWonTeam1 !== undefined && match.setsWonTeam2 !== undefined) {
        totalSets += match.setsWonTeam1 + match.setsWonTeam2;
        matchesWithSets++;
      }
    } else if (match.status === 'in_progress') {
      stats.inProgressMatches++;
    } else {
      stats.pendingMatches++;
    }
  });

  stats.completionPercentage =
    stats.totalMatches > 0 ? (stats.completedMatches / stats.totalMatches) * 100 : 0;

  stats.averageSetsPerMatch = matchesWithSets > 0 ? totalSets / matchesWithSets : 0;

  return stats;
}

/**
 * Get player statistics for a phase
 */
export function getPlayerStatistics(
  matches: KingMatch[],
  playerId: string
): {
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  winRate: number;
} {
  const stats = {
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    winRate: 0,
  };

  matches
    .filter((m) => m.status === 'completed')
    .forEach((match) => {
      let playerInTeam1 = false;
      let playerInTeam2 = false;

      if (match.team1?.members) {
        playerInTeam1 = match.team1.members.some((p) => p.id === playerId);
      }

      if (match.team2?.members) {
        playerInTeam2 = match.team2.members.some((p) => p.id === playerId);
      }

      if (!playerInTeam1 && !playerInTeam2) {
        return; // Player not in this match
      }

      stats.matchesPlayed++;

      const setsWonTeam1 = match.setsWonTeam1 || 0;
      const setsWonTeam2 = match.setsWonTeam2 || 0;

      if (playerInTeam1) {
        stats.setsWon += setsWonTeam1;
        stats.setsLost += setsWonTeam2;
        if (setsWonTeam1 > setsWonTeam2) {
          stats.wins++;
        } else {
          stats.losses++;
        }
      } else {
        stats.setsWon += setsWonTeam2;
        stats.setsLost += setsWonTeam1;
        if (setsWonTeam2 > setsWonTeam1) {
          stats.wins++;
        } else {
          stats.losses++;
        }
      }
    });

  stats.winRate = stats.matchesPlayed > 0 ? (stats.wins / stats.matchesPlayed) * 100 : 0;

  return stats;
}

/**
 * Validate configuration before initialization
 */
export function validateInitialConfiguration(
  phases: FlexiblePhaseConfig[],
  registeredPlayersCount: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check we have at least one phase
  if (!phases || phases.length === 0) {
    errors.push('At least one phase configuration is required');
    return { valid: false, errors };
  }

  // Check phase numbers are sequential
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].phaseNumber !== i + 1) {
      errors.push(`Phase numbers must be sequential. Expected ${i + 1}, got ${phases[i].phaseNumber}`);
    }
  }

  // Validate first phase has enough players
  const firstPhase = phases[0];
  const firstPhaseExpectedPlayers = firstPhase.totalTeams * firstPhase.playersPerTeam;
  if (firstPhaseExpectedPlayers > registeredPlayersCount) {
    errors.push(
      `Phase 1 requires ${firstPhaseExpectedPlayers} players, but only ${registeredPlayersCount} are registered`
    );
  }

  // Validate each phase configuration
  phases.forEach((phase) => {
    // Validate pool configuration
    if (phase.numberOfPools < 1) {
      errors.push(`Phase ${phase.phaseNumber}: Must have at least 1 pool`);
    }

    if (phase.numberOfPools > phase.totalTeams) {
      errors.push(
        `Phase ${phase.phaseNumber}: Cannot have more pools (${phase.numberOfPools}) than teams (${phase.totalTeams})`
      );
    }

    // Validate qualified count
    const totalPlayersInPhase = phase.totalTeams * phase.playersPerTeam;
    if (phase.totalQualified < phase.playersPerTeam) {
      errors.push(
        `Phase ${phase.phaseNumber}: Must qualify at least ${phase.playersPerTeam} players (one full team)`
      );
    }

    if (phase.totalQualified >= totalPlayersInPhase) {
      errors.push(
        `Phase ${phase.phaseNumber}: Cannot qualify all players (${phase.totalQualified} >= ${totalPlayersInPhase})`
      );
    }

    // Validate pool distribution if provided
    if (phase.poolDistribution) {
      const sumTeams = phase.poolDistribution.reduce((sum, teams) => sum + teams, 0);
      if (sumTeams !== phase.totalTeams) {
        errors.push(
          `Phase ${phase.phaseNumber}: Pool distribution total (${sumTeams}) doesn't match total teams (${phase.totalTeams})`
        );
      }

      if (phase.poolDistribution.length !== phase.numberOfPools) {
        errors.push(
          `Phase ${phase.phaseNumber}: Pool distribution length (${phase.poolDistribution.length}) doesn't match number of pools (${phase.numberOfPools})`
        );
      }
    }
  });

  // Validate phase transitions
  for (let i = 0; i < phases.length - 1; i++) {
    const currentPhase = phases[i];
    const nextPhase = phases[i + 1];

    const currentQualified = currentPhase.totalQualified;
    const nextExpected = nextPhase.totalTeams * nextPhase.playersPerTeam;

    if (currentQualified !== nextExpected) {
      errors.push(
        `Phase ${currentPhase.phaseNumber} qualifies ${currentQualified} players, ` +
          `but Phase ${nextPhase.phaseNumber} expects ${nextExpected} players`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
