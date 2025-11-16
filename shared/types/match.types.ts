/**
 * Match, Pool, and Elimination-related TypeScript types
 * Shared between client and server
 */

import type { Team } from './team.types';

export type MatchStatus = 'pending' | 'in_progress' | 'completed';

export type EliminationRound =
  | 'Tour Préliminaire'
  | 'Huitième de finale'
  | 'Quart de finale'
  | 'Demi-finale'
  | 'Match 3ème place'
  | 'Finale';

export interface MatchSet {
  score1: number;
  score2: number;
  winner?: 1 | 2 | null;
}

export interface MatchTeam {
  id: string;
  name: string;
  sourceMatchId?: string; // For elimination brackets
}

export interface Match {
  id: string;
  matchNumber: number;
  team1: MatchTeam;
  team2: MatchTeam;
  status: MatchStatus;
  sets: MatchSet[];
  setsWonTeam1: number;
  setsWonTeam2: number;
  setsToWin: number;
  pointsPerSet: number;
  tieBreakEnabled: boolean;
  winner?: string; // Team ID
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PoolMatch extends Match {
  poolId: string;
  poolName: string;
}

export interface EliminationMatch extends Match {
  round: EliminationRound;
  nextMatchId?: string; // For winner progression
  position?: number; // Position in bracket
}

export interface Pool {
  id: string;
  name: string;
  teams: Team[];
  matches?: PoolMatch[];
  standings?: TeamStanding[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  rank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setsDifferential: number;
  pointsWon: number;
  pointsLost: number;
  pointsDifferential: number;
}

export interface FinalRanking {
  id: string; // Team ID
  rank: number;
  teamName: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  createdAt?: Date;
}

export interface SubmitScoresDto {
  matchId: string;
  tournamentId: string;
  poolId?: string; // For pool matches
  sets: MatchSet[];
  submittedBy: string; // User ID
}

export interface CreatePoolDto {
  tournamentId: string;
  name: string;
  teamIds: string[];
}

export interface AssignTeamsToPoolDto {
  tournamentId: string;
  poolId: string;
  teamIds: string[];
}

export interface GenerateMatchesDto {
  tournamentId: string;
  poolId: string;
}

export interface GenerateEliminationBracketDto {
  tournamentId: string;
}

export interface EliminationBracketStructure {
  totalSlots: number;
  preliminaryMatches: number;
  mainBracketSize: number;
  byes: number;
  rounds: {
    round: EliminationRound;
    matches: EliminationMatch[];
  }[];
}
