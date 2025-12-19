/**
 * Match, Pool, and Elimination-related TypeScript types
 * Shared between client and server
 */

import type { Team } from './team.types';

export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'scheduled';

export type EliminationRound =
  | 'Tour Préliminaire'
  | 'Seizième de finale'
  | 'Huitième de finale'
  | 'Quart de finale'
  | 'Demi-finale'
  | 'Match 3ème place'
  | 'Finale'
  | string; // Allow dynamic round names like "Tour de X"

export interface MatchSet {
  score1: number;
  score2: number;
  winner?: 1 | 2 | null;
}

export interface MatchTeam {
  id: string | null;
  name: string;
  sourceMatchId?: string; // For elimination brackets
  sourceTeamType?: 'winner' | 'loser'; // For elimination brackets
  poolName?: string; // Pool name for qualified teams
}

export interface Match {
  id: string;
  matchNumber: number;
  team1: MatchTeam;
  team2: MatchTeam;
  status: MatchStatus;
  sets: MatchSet[];
  setsWonTeam1?: number; // Defaults to 0, optional when creating match
  setsWonTeam2?: number; // Defaults to 0, optional when creating match
  setsToWin: number;
  pointsPerSet: number;
  tieBreakEnabled: boolean;
  winner?: string; // Team ID
  winnerId?: string; // Alias for winner
  winnerName?: string; // Name of winning team
  loserId?: string; // ID of losing team
  loserName?: string; // Name of losing team
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
  nextMatchTeamSlot?: 'team1' | 'team2'; // Which slot the winner goes to
  nextMatchLoserId?: string; // For loser progression (3rd place match)
  nextMatchLoserTeamSlot?: 'team1' | 'team2'; // Which slot the loser goes to
  position?: number; // Position in bracket
  type?: 'elimination'; // Match type
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
