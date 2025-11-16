/**
 * King Tournament Format TypeScript Types
 * Format: 4v4 (Phase 1) → 3v3 (Phase 2) → 2v2 (Phase 3)
 */

export type KingPhaseNumber = 1 | 2 | 3;

export type KingPhaseStatus = 'pending' | 'in-progress' | 'completed';

export type KingTournamentStatus =
  | 'not-started'
  | 'phase1-in-progress'
  | 'phase2-in-progress'
  | 'phase3-in-progress'
  | 'completed';

export interface KingPlayer {
  id: string;
  pseudo: string;
  level: string;
}

export interface KingTeam {
  name: string;
  members: KingPlayer[];
}

export interface KingMatch {
  id: string;
  matchNumber: number;
  team1: KingTeam;
  team2: KingTeam;
  format: '4v4' | '3v3' | '2v2';
  status: 'pending' | 'in_progress' | 'completed';
  roundId: string;
  roundName: string;
  poolId: string;
  setsWonTeam1?: number;
  setsWonTeam2?: number;
  winnerTeam?: KingTeam;
  winnerName?: string;
  winnerPlayerIds?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface KingRound {
  id: string;
  name: string;
  phaseNumber: KingPhaseNumber;
  roundNumber: number;
  poolId: string;
  createdAt: Date;
}

export interface KingPool {
  id: string;
  name: string;
  players: KingPlayer[];
  matches: KingMatch[];
  playerCount?: number;
  createdAt?: Date;
}

export interface KingPlayerRanking {
  playerId: string;
  playerPseudo: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setsDiff: number;
  pointsWon: number;
  pointsLost: number;
  pointsDiff: number;
  rank?: number;
}

export interface KingPhase {
  phaseNumber: KingPhaseNumber;
  description: string;
  status: KingPhaseStatus;
  pools: KingPool[];
  allMatches: KingMatch[];
  ranking: KingPlayerRanking[];
  qualifiedCount?: number;
  finalistCount?: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface KingTournamentData {
  currentPhase: KingPhaseNumber;
  totalMatches: number;
  ranking: KingPlayerRanking[];
  phases?: {
    [key: string]: KingPhase; // 'phase-1', 'phase-2', 'phase-3'
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface KingTournamentConfig {
  // Phase 1 (4v4)
  phase1TeamsPerPool: number;      // Default: 3
  phase1TeamSize: number;          // Default: 4
  phase1NumRoundsPerPool: number;  // Default: 3
  phase1PlayersPerPool: number;    // Default: 12
  phase1QualifiersPerPool: number; // Default: 4

  // Phase 2 (3v3)
  phase2NumPools: number;          // Default: 2
  phase2TeamSize: number;          // Default: 3
  phase2NumRounds: number;         // Default: 5
  phase2QualifiersPerPool: number; // Default: 4

  // Phase 3 (2v2)
  phase3TeamSize: number;          // Default: 2
  phase3NumRounds: number;         // Default: 7
}

// DTOs for API

export interface StartKingPhaseDto {
  tournamentId: string;
  phaseNumber: KingPhaseNumber;
}

export interface RecordKingMatchResultDto {
  tournamentId: string;
  matchId: string;
  setsWonTeam1: number;
  setsWonTeam2: number;
}

export interface ResetKingPhaseDto {
  tournamentId: string;
  phaseNumber: KingPhaseNumber;
}

export interface KingDashboardData {
  tournament: any; // Tournament type
  kingData: KingTournamentData;
  currentPhase?: KingPhase;
  status: KingTournamentStatus;
}

// ========================================
// FLEXIBLE KING MODE TYPES (NEW SYSTEM)
// ========================================

/**
 * Supported game modes for flexible King tournaments
 */
export type GameMode = '6v6' | '5v5' | '4v4' | '3v3' | '2v2' | '1v1';

/**
 * Status of a flexible King phase
 */
export type FlexiblePhaseStatus =
  | 'not_configured'   // Not yet configured by admin
  | 'configured'       // Configured, ready to start
  | 'in_progress'      // Currently running
  | 'completed';       // Finished

/**
 * Configuration for a single phase in flexible King mode
 */
export interface FlexiblePhaseConfig {
  phaseNumber: number;
  gameMode: GameMode;
  playersPerTeam: number;
  teamsPerPool: number;
  numberOfPools: number;
  totalParticipants: number;  // Total players in this phase
  qualifiedPerPool: number;
  totalQualified: number;     // Total qualified for next phase
  fields: number;             // Number of available fields
  estimatedRounds: number;

  // Game rules
  setsPerMatch: number;
  pointsPerSet: number;
  tieBreakEnabled: boolean;

  // Scheduling
  scheduledDate?: string;     // ISO date string
}

/**
 * A phase in a flexible King tournament
 */
export interface FlexibleKingPhase {
  id: string;                 // Unique phase ID
  tournamentId: string;
  phaseNumber: number;
  status: FlexiblePhaseStatus;
  config: FlexiblePhaseConfig;

  // Participants
  participantIds: string[];   // Player IDs participating in this phase
  qualifiedIds: string[];     // Player IDs qualified to next phase (filled after completion)
  withdrawnIds: string[];     // Player IDs marked as withdrawn (manual)
  repechedIds: string[];      // Player IDs manually repêched from previous phase

  // Generated data
  pools?: KingPool[];         // Generated pools (if status >= 'configured')
  matches?: KingMatch[];      // Generated matches
  ranking?: KingPlayerRanking[];

  // Metadata
  createdAt: Date;
  configuredAt?: Date;        // When phase was configured
  startedAt?: Date;           // When phase started
  completedAt?: Date;         // When phase completed
}

/**
 * Overall flexible King tournament data
 */
export interface FlexibleKingTournamentData {
  phases: FlexibleKingPhase[];
  currentPhaseNumber: number | null;  // null if no phase in progress
  winner?: {
    playerId: string;
    playerPseudo: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// DTOs FOR FLEXIBLE KING MODE API
// ========================================

export interface ConfigureKingPhaseDto {
  tournamentId: string;
  phaseNumber: number;
  config: FlexiblePhaseConfig;
}

export interface GeneratePhasePoolsDto {
  tournamentId: string;
  phaseNumber: number;
}

export interface MarkWithdrawalsDto {
  tournamentId: string;
  phaseNumber: number;
  withdrawnPlayerIds: string[];
}

export interface ManageRepechagesDto {
  tournamentId: string;
  phaseNumber: number;
  repechedPlayerIds: string[];
}

export interface CompletePhaseDto {
  tournamentId: string;
  phaseNumber: number;
}

export interface GetKingPreviewDto {
  tournamentId: string;
  registeredCount?: number;  // Optional override for preview calculation
}

export interface RepechageCandidate {
  playerId: string;
  playerPseudo: string;
  rank: number;
  wins: number;
  losses: number;
}

export interface CompletePhaseResponse {
  qualifiedIds: string[];
  repechageCandidates: RepechageCandidate[];
}

export interface FlexibleKingDashboardData {
  tournament: any; // Tournament type
  kingData: FlexibleKingTournamentData;
  currentPhase?: FlexibleKingPhase;
  registeredPlayersCount: number;
}
