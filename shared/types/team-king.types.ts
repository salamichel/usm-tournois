/**
 * Team King Tournament Format TypeScript Types
 * Team-based King tournament where teams remain fixed throughout phases
 */

import type { Team } from './team.types';

/**
 * Supported game modes for team King tournaments
 */
export type TeamKingGameMode = '6v6' | '5v5' | '4v4' | '3v3' | '2v2';

/**
 * Phase format: KOB (King of the Beach - rotation pairing)
 */
export type TeamKingPhaseFormat = 'kob';

/**
 * Status of a Team King phase
 */
export type TeamKingPhaseStatus =
  | 'not_configured'   // Not yet configured by admin
  | 'configured'       // Configured, ready to start
  | 'in_progress'      // Currently running
  | 'completed';       // Finished

/**
 * Configuration for a single phase in Team King mode
 */
export interface TeamKingPhaseConfig {
  phaseNumber: number;
  gameMode: TeamKingGameMode;
  phaseFormat: TeamKingPhaseFormat;
  playersPerTeam: number;
  totalTeams: number;               // Total teams in this phase
  numberOfPools: number;
  teamsPerPool: number;             // Average teams per pool
  qualifiedPerPool: number;         // ÉQUIPES qualifiées par poule
  totalQualified: number;           // Total ÉQUIPES qualifiées for next phase
  fields: number;                   // Number of available fields
  estimatedRounds: number;
  totalMatches: number;             // Total matches in this phase
  estimatedTime: number;            // Estimated time in minutes

  // Optional: for unbalanced pool distributions
  poolDistribution?: number[];      // ex: [3, 3, 4] teams per pool
  qualifiedPerPoolDistribution?: number[]; // ex: [2, 2, 2] ÉQUIPES per pool

  // Game rules
  setsPerMatch: number;
  pointsPerSet: number;
  tieBreakEnabled: boolean;

  // Scheduling
  scheduledDate?: string;           // ISO date string
}

/**
 * Simplified team for Team King matches
 */
export interface TeamKingTeam {
  id: string;
  name: string;
  captainId: string;
  captainPseudo?: string;
  memberCount: number;
}

/**
 * Match between two teams in Team King format
 */
export interface TeamKingMatch {
  id: string;
  matchNumber: number;
  team1: TeamKingTeam;
  team2: TeamKingTeam;
  gameMode: TeamKingGameMode;
  status: 'pending' | 'in_progress' | 'completed';
  roundId: string;
  roundName: string;
  poolId: string;
  poolName: string;

  // Match results
  setsWonTeam1?: number;
  setsWonTeam2?: number;
  sets?: Array<{
    score1: number;
    score2: number;
    winner: 1 | 2;
  }>;
  winnerTeamId?: string;
  winnerTeamName?: string;

  // Metadata
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Round in a Team King phase
 */
export interface TeamKingRound {
  id: string;
  name: string;
  phaseNumber: number;
  roundNumber: number;
  poolId: string;
  createdAt: Date;
}

/**
 * Pool containing teams in Team King
 */
export interface TeamKingPool {
  id: string;
  name: string;
  teams: TeamKingTeam[];
  matches: TeamKingMatch[];
  teamCount?: number;
  createdAt?: Date;
}

/**
 * Team ranking/statistics in Team King
 */
export interface TeamKingRanking {
  teamId: string;
  teamName: string;
  captainId: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setsDiff: number;
  pointsWon: number;
  pointsLost: number;
  pointsDiff: number;
  rank?: number;
  poolId?: string;
  poolName?: string;
}

/**
 * A phase in a Team King tournament
 */
export interface TeamKingPhase {
  id: string;
  tournamentId: string;
  phaseNumber: number;
  status: TeamKingPhaseStatus;
  config: TeamKingPhaseConfig;

  // Participating teams
  participatingTeamIds: string[];   // Team IDs participating in this phase
  qualifiedTeamIds: string[];       // Team IDs qualified to next phase (filled after completion)
  eliminatedTeamIds: string[];      // Team IDs eliminated in this phase

  // Generated data
  pools?: TeamKingPool[];
  matches?: TeamKingMatch[];
  ranking?: TeamKingRanking[];

  // Metadata
  createdAt: Date;
  configuredAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Overall Team King tournament data
 */
export interface TeamKingTournamentData {
  phases: TeamKingPhase[];
  currentPhaseNumber: number | null;  // null if no phase in progress
  winnerTeam?: {
    teamId: string;
    teamName: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual player points awarded at tournament end
 */
export interface TeamKingPlayerPoints {
  playerId: string;
  playerPseudo: string;
  teamId: string;
  teamName: string;
  points: number;
  rank: number;
}

/**
 * Final tournament results with both team and player rankings
 */
export interface TeamKingFinalResults {
  teamRanking: TeamKingRanking[];
  playerPoints?: TeamKingPlayerPoints[];
  createdAt: Date;
}

// ========================================
// DTOs FOR TEAM KING MODE API
// ========================================

/**
 * DTO to configure a Team King phase
 */
export interface ConfigureTeamKingPhaseDto {
  tournamentId: string;
  phaseNumber: number;
  config: TeamKingPhaseConfig;
}

/**
 * DTO to generate pools and matches for a phase
 */
export interface GenerateTeamKingPhasePoolsDto {
  tournamentId: string;
  phaseNumber: number;
}

/**
 * DTO to start a Team King phase
 */
export interface StartTeamKingPhaseDto {
  tournamentId: string;
  phaseNumber: number;
}

/**
 * DTO to record match result
 */
export interface RecordTeamKingMatchResultDto {
  tournamentId: string;
  phaseNumber: number;
  matchId: string;
  setsWonTeam1: number;
  setsWonTeam2: number;
  sets?: Array<{
    score1: number;
    score2: number;
    winner: 1 | 2;
  }>;
}

/**
 * DTO to complete a phase and advance qualified teams
 */
export interface CompleteTeamKingPhaseDto {
  tournamentId: string;
  phaseNumber: number;
}

/**
 * Response after completing a phase
 */
export interface CompleteTeamKingPhaseResponse {
  qualifiedTeamIds: string[];
  eliminatedTeamIds: string[];
  ranking: TeamKingRanking[];
}

/**
 * DTO to get Team King tournament preview/configuration
 */
export interface GetTeamKingPreviewDto {
  tournamentId: string;
  registeredTeamsCount?: number;  // Optional override for preview calculation
}

/**
 * Dashboard data for Team King tournament
 */
export interface TeamKingDashboardData {
  tournament: any; // Tournament type
  teamKingData: TeamKingTournamentData;
  currentPhase?: TeamKingPhase;
  registeredTeamsCount: number;
  teams: Team[];
}

/**
 * DTO to assign player points at tournament end
 */
export interface AssignTeamKingPlayerPointsDto {
  tournamentId: string;
  playerPoints: Array<{
    playerId: string;
    points: number;
  }>;
}
