/**
 * @fileoverview Service for handling Team King Mode tournaments
 * Team-based King tournament where teams remain fixed throughout all phases
 * - Fixed teams inscribed by captains
 * - Multi-phase configurable format (like Flexible King)
 * - KOB (King of the Beach) rotation system
 * - Team-based ranking and qualification
 */

import type {
  TeamKingGameMode,
  TeamKingPhaseConfig,
  TeamKingPhase,
  TeamKingTournamentData,
  TeamKingPhaseStatus,
  TeamKingTeam,
  TeamKingMatch,
  TeamKingPool,
  TeamKingRanking,
  TeamKingRound,
} from '@shared/types/team-king.types';
import type { Team } from '@shared/types/team.types';

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Shuffle array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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
 * Distributes qualified teams evenly across pools
 * Example: 12 qualified teams into 3 pools → [4, 4, 4]
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
 * Formula for round-robin (each team plays all others once):
 * - Even number of teams: n - 1 rounds
 * - Odd number of teams: n rounds
 */
export function calculateKOBRounds(teamsPerPool: number): number {
  if (teamsPerPool <= 1) return 0;
  if (teamsPerPool === 2) return 1;

  // Round-robin formula
  if (teamsPerPool % 2 === 0) {
    // Even number: n - 1 rounds
    return teamsPerPool - 1;
  } else {
    // Odd number: n rounds
    return teamsPerPool;
  }
}

/**
 * Calculates total matches for a phase
 */
export function calculateTotalMatches(
  teamsPerPool: number,
  numberOfPools: number,
  estimatedRounds: number,
  poolDistribution?: number[]
): number {
  if (poolDistribution && poolDistribution.length > 0) {
    let totalMatches = 0;
    for (const teamsInPool of poolDistribution) {
      const matchesPerRound = Math.floor(teamsInPool / 2);
      totalMatches += matchesPerRound * estimatedRounds;
    }
    return totalMatches;
  }

  // Legacy calculation (balanced pools)
  const matchesPerRoundPerPool = Math.floor(teamsPerPool / 2);
  return matchesPerRoundPerPool * estimatedRounds * numberOfPools;
}

// ========================================
// TEAM CONVERSION
// ========================================

/**
 * Convert full Team to simplified TeamKingTeam
 */
export function convertToTeamKingTeam(team: Team): TeamKingTeam {
  return {
    id: team.id,
    name: team.name,
    captainId: team.captainId,
    captainPseudo: team.captainPseudo,
    memberCount: team.members.length,
  };
}

// ========================================
// MATCH GENERATION
// ========================================

/**
 * Generates KOB matches with proper team rotation
 * In KOB mode, teams play against different opponents each round
 * Uses circle method: fix first team, rotate others
 */
function generateKOBMatches(
  poolTeams: TeamKingTeam[],
  poolId: string,
  poolName: string,
  numRounds: number,
  phaseNumber: number
): TeamKingMatch[] {
  const matches: TeamKingMatch[] = [];
  const numTeams = poolTeams.length;
  const numMatchesPerRound = Math.floor(numTeams / 2);

  let matchNumber = 1;

  // Use circle method for rotation: fix first team, rotate others
  for (let roundNum = 0; roundNum < numRounds; roundNum++) {
    const roundId = `round-${poolId}-${roundNum + 1}`;
    const roundName = `Tour ${roundNum + 1}`;

    // Create rotated team indices for this round
    const rotatedIndices: number[] = [0]; // Team 0 stays fixed
    for (let i = 1; i < numTeams; i++) {
      // Rotate teams 1 to n-1
      const rotatedPos = ((i - 1 + roundNum) % (numTeams - 1)) + 1;
      rotatedIndices.push(rotatedPos);
    }

    // Form matches from rotated indices
    for (let matchIdx = 0; matchIdx < numMatchesPerRound; matchIdx++) {
      const team1Idx = rotatedIndices[matchIdx * 2];
      const team2Idx = rotatedIndices[matchIdx * 2 + 1];

      matches.push({
        id: `match-${poolId}-${matchNumber}`,
        matchNumber: matchNumber,
        team1: poolTeams[team1Idx],
        team2: poolTeams[team2Idx],
        status: 'pending',
        roundId,
        roundName,
        poolId,
        poolName,
        createdAt: new Date(),
      });

      matchNumber++;
    }
  }

  return matches;
}

/**
 * Generates pools and matches for a Team King phase
 */
export function generatePhasePoolsAndMatches(
  phase: TeamKingPhase,
  registeredTeams: Team[]
): { pools: TeamKingPool[]; matches: TeamKingMatch[] } {
  const config = phase.config;
  const participantTeamIds = phase.participatingTeamIds;

  // Filter teams by participant IDs
  const participantTeams = registeredTeams.filter((t) => participantTeamIds.includes(t.id));

  if (participantTeams.length !== participantTeamIds.length) {
    throw new Error(
      `Team count mismatch: expected ${participantTeamIds.length}, got ${participantTeams.length}`
    );
  }

  // Convert to TeamKingTeam
  const teamKingTeams = participantTeams.map(convertToTeamKingTeam);

  // Shuffle teams for randomization
  const shuffledTeams = shuffleArray(teamKingTeams);

  // Determine pool distribution
  const poolDistribution =
    config.poolDistribution || distributeTeamsInPools(config.totalTeams, config.numberOfPools);

  // Ensure estimatedRounds has a valid value (default to 5 for KOB)
  const estimatedRounds = config.estimatedRounds || 5;

  console.log(`[generatePhasePoolsAndMatches] Team King Phase ${config.phaseNumber}:`);
  console.log(`  - estimatedRounds: ${estimatedRounds}`);
  console.log(`  - numberOfPools: ${config.numberOfPools}`);
  console.log(`  - teamsPerPool: ${config.teamsPerPool}`);

  const pools: TeamKingPool[] = [];
  const allMatches: TeamKingMatch[] = [];
  let teamIndex = 0;

  for (let poolIdx = 0; poolIdx < config.numberOfPools; poolIdx++) {
    const teamsInThisPool = poolDistribution[poolIdx];

    const poolTeams = shuffledTeams.slice(teamIndex, teamIndex + teamsInThisPool);
    teamIndex += teamsInThisPool;

    const poolId = `pool-${String.fromCharCode(65 + poolIdx)}`;
    const poolName = `Poule ${String.fromCharCode(65 + poolIdx)}`;

    // Generate KOB matches
    const poolMatches = generateKOBMatches(
      poolTeams,
      poolId,
      poolName,
      estimatedRounds,
      config.phaseNumber
    );

    const pool: TeamKingPool = {
      id: poolId,
      name: poolName,
      teams: poolTeams,
      matches: poolMatches,
      teamCount: poolTeams.length,
      createdAt: new Date(),
    };

    pools.push(pool);
    allMatches.push(...poolMatches);
  }

  console.log(
    `✅ Team King Phase ${config.phaseNumber}: ${allMatches.length} matches generated (${pools.length} pools)`
  );

  return { pools, matches: allMatches };
}

// ========================================
// RANKING & QUALIFICATION
// ========================================

/**
 * Calculate team rankings from completed matches
 */
export function calculateTeamRankings(
  pools: TeamKingPool[],
  matches: TeamKingMatch[]
): TeamKingRanking[] {
  console.log('📊 Calculating team rankings...');

  const teamScores: Record<string, TeamKingRanking> = {};

  // Initialize scores for all teams
  pools.forEach((pool) => {
    pool.teams.forEach((team) => {
      teamScores[team.id] = {
        teamId: team.id,
        teamName: team.name,
        captainId: team.captainId,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        setsDiff: 0,
        pointsWon: 0,
        pointsLost: 0,
        pointsDiff: 0,
        poolId: pool.id,
        poolName: pool.name,
      };
    });
  });

  // Count stats from completed matches
  matches
    .filter((m) => m.status === 'completed')
    .forEach((match) => {
      const team1Id = match.team1.id;
      const team2Id = match.team2.id;
      const setsTeam1 = match.setsWonTeam1 || 0;
      const setsTeam2 = match.setsWonTeam2 || 0;

      // Determine winner
      if (setsTeam1 > setsTeam2) {
        teamScores[team1Id].wins++;
        teamScores[team2Id].losses++;
      } else if (setsTeam2 > setsTeam1) {
        teamScores[team2Id].wins++;
        teamScores[team1Id].losses++;
      }

      // Sets
      teamScores[team1Id].setsWon += setsTeam1;
      teamScores[team1Id].setsLost += setsTeam2;
      teamScores[team2Id].setsWon += setsTeam2;
      teamScores[team2Id].setsLost += setsTeam1;

      // Points (if sets are detailed)
      if (match.sets && match.sets.length > 0) {
        match.sets.forEach((set) => {
          teamScores[team1Id].pointsWon += set.score1;
          teamScores[team1Id].pointsLost += set.score2;
          teamScores[team2Id].pointsWon += set.score2;
          teamScores[team2Id].pointsLost += set.score1;
        });
      }
    });

  // Calculate differentials
  Object.values(teamScores).forEach((team) => {
    team.setsDiff = team.setsWon - team.setsLost;
    team.pointsDiff = team.pointsWon - team.pointsLost;
  });

  // Sort teams: wins DESC, then setsDiff DESC, then pointsDiff DESC
  const rankings = Object.values(teamScores).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.setsDiff !== a.setsDiff) return b.setsDiff - a.setsDiff;
    return b.pointsDiff - a.pointsDiff;
  });

  // Assign ranks
  rankings.forEach((team, index) => {
    team.rank = index + 1;
  });

  console.log(`✅ Rankings calculated for ${rankings.length} teams`);
  return rankings;
}

/**
 * Calculate qualified teams from a completed phase
 */
export function calculatePhaseQualifiers(
  pools: TeamKingPool[],
  matches: TeamKingMatch[],
  qualifiedPerPoolDistribution: number[]
): string[] {
  console.log('📊 Calculating qualified teams from phase...');

  const qualifiedTeamIds: string[] = [];

  // Get rankings
  const rankings = calculateTeamRankings(pools, matches);

  // Separate by pool
  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const pool = pools[poolIdx];
    const qualifiersFromThisPool = qualifiedPerPoolDistribution[poolIdx];

    // Get teams from this pool
    const poolRankings = rankings.filter((r) => r.poolId === pool.id);

    // Sort by rank
    poolRankings.sort((a, b) => (a.rank || 0) - (b.rank || 0));

    // Take top N
    const poolQualifiers = poolRankings.slice(0, qualifiersFromThisPool);
    qualifiedTeamIds.push(...poolQualifiers.map((t) => t.teamId));

    console.log(`  📍 ${pool.name}: Top ${qualifiersFromThisPool} équipes qualifiées`);
  }

  console.log(`✅ Total équipes qualifiées: ${qualifiedTeamIds.length}`);
  return qualifiedTeamIds;
}

/**
 * Get eliminated teams from a phase
 */
export function getEliminatedTeams(
  participatingTeamIds: string[],
  qualifiedTeamIds: string[]
): string[] {
  return participatingTeamIds.filter((id) => !qualifiedTeamIds.includes(id));
}

// ========================================
// PHASE MANAGEMENT
// ========================================

/**
 * Create a new Team King phase
 */
export function createTeamKingPhase(
  tournamentId: string,
  phaseNumber: number,
  config: TeamKingPhaseConfig,
  participatingTeamIds: string[]
): TeamKingPhase {
  const phaseId = `phase-${phaseNumber}`;

  const phase: TeamKingPhase = {
    id: phaseId,
    tournamentId,
    phaseNumber,
    status: 'configured',
    config,
    participatingTeamIds,
    qualifiedTeamIds: [],
    eliminatedTeamIds: [],
    createdAt: new Date(),
    configuredAt: new Date(),
  };

  return phase;
}

/**
 * Initialize Team King tournament data
 */
export function initializeTeamKingTournament(
  gameMode: TeamKingGameMode,
  playersPerTeam: number,
  setsPerMatch: number = 2,
  pointsPerSet: number = 21,
  tieBreakEnabled: boolean = false
): TeamKingTournamentData {
  return {
    gameMode,
    playersPerTeam,
    setsPerMatch,
    pointsPerSet,
    tieBreakEnabled,
    phases: [],
    currentPhaseNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
