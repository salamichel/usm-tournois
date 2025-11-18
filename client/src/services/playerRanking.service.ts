/**
 * Player Ranking Service
 * API calls for player points and rankings
 */

import apiService from './api.service';
import type {
  PlayerRankingResponse,
  PlayerStatsResponse,
  TournamentPlayerPointsResponse,
} from '@shared/types/playerPoints.types';

class PlayerRankingService {
  /**
   * Get global player rankings
   */
  async getGlobalRanking(limit: number = 100, offset: number = 0): Promise<PlayerRankingResponse> {
    return apiService.get<PlayerRankingResponse['data']>(
      `/players/ranking?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * Get detailed statistics for a specific player
   */
  async getPlayerStats(playerId: string): Promise<PlayerStatsResponse> {
    return apiService.get<PlayerStatsResponse['data']>(`/players/${playerId}/stats`);
  }

  /**
   * Get all player points for a specific tournament
   */
  async getTournamentPlayerPoints(tournamentId: string): Promise<TournamentPlayerPointsResponse> {
    return apiService.get<TournamentPlayerPointsResponse['data']>(
      `/admin/tournaments/${tournamentId}/player-points`
    );
  }

  /**
   * Recalculate all global rankings (admin only)
   */
  async recalculateRankings(): Promise<{ success: boolean; message: string }> {
    return apiService.post('/admin/players/recalculate-rankings');
  }
}

export default new PlayerRankingService();
