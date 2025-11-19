/**
 * Player Points-related TypeScript types
 * Shared between client and server
 */

/**
 * Points earned by a player in a specific tournament
 */
export interface PlayerTournamentPoints {
  playerId: string;
  playerPseudo: string;
  clubId?: string;
  clubName?: string;
  tournamentId: string;
  tournamentName: string;
  tournamentDate: Date;
  teamName: string;
  rank: number;
  points: number;
  earnedAt: Date;
}

/**
 * Global ranking entry for a player
 */
export interface PlayerGlobalRanking {
  playerId: string;
  pseudo: string;
  clubId?: string;
  clubName?: string;
  totalPoints: number;
  tournamentsPlayed: number;
  averagePoints: number;
  bestRank: number;
  bestRankTournament?: string;
  lastTournamentDate?: Date;
  rank?: number; // Global rank
  updatedAt: Date;
}

/**
 * Player statistics with detailed breakdown
 */
export interface PlayerStats extends PlayerGlobalRanking {
  tournaments: PlayerTournamentPoints[];
  podiums: number; // Number of top 3 finishes
  victories: number; // Number of 1st place finishes
}

/**
 * Request/Response DTOs
 */
export interface GetPlayerRankingParams {
  limit?: number;
  offset?: number;
}

export interface GetPlayerStatsParams {
  playerId: string;
}

export interface GetTournamentPlayerPointsParams {
  tournamentId: string;
}

/**
 * Response types
 */
export interface PlayerRankingResponse {
  success: boolean;
  data: {
    rankings: PlayerGlobalRanking[];
    total: number;
  };
}

export interface PlayerStatsResponse {
  success: boolean;
  data: {
    stats: PlayerStats;
  };
}

export interface TournamentPlayerPointsResponse {
  success: boolean;
  data: {
    points: PlayerTournamentPoints[];
  };
}
