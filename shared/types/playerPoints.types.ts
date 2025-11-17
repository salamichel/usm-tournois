/**
 * Player Points-related TypeScript types
 * Shared between client and server
 */

/**
 * Points configuration for tournament positions
 */
export interface PointsConfig {
  1: number;    // 1st place
  2: number;    // 2nd place
  3: number;    // 3rd place
  4: number;    // 4th place
  5: number;    // 5th-8th place
  9: number;    // 9th-16th place
  17: number;   // 17th-32nd place
  default: number; // 32nd+ (participation)
}

/**
 * Default points configuration
 */
export const DEFAULT_POINTS_CONFIG: PointsConfig = {
  1: 100,
  2: 80,
  3: 65,
  4: 55,
  5: 40,  // 5th-8th
  9: 25,  // 9th-16th
  17: 15, // 17th-32nd
  default: 10, // 32nd+ (participation)
};

/**
 * Get points for a given rank
 */
export function getPointsForRank(rank: number, config: PointsConfig = DEFAULT_POINTS_CONFIG): number {
  if (rank === 1) return config[1];
  if (rank === 2) return config[2];
  if (rank === 3) return config[3];
  if (rank === 4) return config[4];
  if (rank >= 5 && rank <= 8) return config[5];
  if (rank >= 9 && rank <= 16) return config[9];
  if (rank >= 17 && rank <= 32) return config[17];
  return config.default;
}

/**
 * Points earned by a player in a specific tournament
 */
export interface PlayerTournamentPoints {
  playerId: string;
  playerPseudo: string;
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
