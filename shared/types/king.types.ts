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
