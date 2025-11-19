/**
 * Season-related TypeScript types
 * Shared between client and server
 */

/**
 * Season definition for ranking periods
 */
export interface Season {
  id: string;
  name: string; // e.g., "2025-2026"
  startDate: Date;
  endDate: Date;
  isActive: boolean; // Currently active season
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Season ranking entry for a player
 */
export interface SeasonRanking {
  playerId: string;
  pseudo: string;
  clubId?: string;
  clubName?: string;
  seasonId: string;
  seasonName: string;
  totalPoints: number;
  tournamentsPlayed: number;
  averagePoints: number;
  bestRank: number;
  bestRankTournament?: string;
  rank?: number; // Rank within the season
  updatedAt: Date;
}

/**
 * Request/Response DTOs
 */
export interface CreateSeasonRequest {
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface UpdateSeasonRequest {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface GetSeasonRankingParams {
  seasonId: string;
  limit?: number;
  offset?: number;
}

/**
 * Response types
 */
export interface SeasonListResponse {
  success: boolean;
  data: {
    seasons: Season[];
  };
}

export interface SeasonRankingResponse {
  success: boolean;
  data: {
    rankings: SeasonRanking[];
    total: number;
    season: Season;
  };
}

export interface GlobalRankingResponse {
  success: boolean;
  data: {
    rankings: SeasonRanking[];
    total: number;
  };
}
