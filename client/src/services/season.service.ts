/**
 * Season Service
 * API calls for seasons and season rankings
 */

import apiService from './api.service';
import type { Season, SeasonRanking } from '@shared/types/season.types';

interface SeasonListResponse {
  success: boolean;
  data: {
    seasons: Season[];
  };
}

interface SeasonResponse {
  success: boolean;
  data: {
    season: Season | null;
  };
}

interface SeasonRankingResponse {
  success: boolean;
  data: {
    rankings: SeasonRanking[];
    total: number;
  };
}

class SeasonService {
  /**
   * Get all seasons
   */
  async getAllSeasons(): Promise<SeasonListResponse> {
    return apiService.get<SeasonListResponse['data']>('/seasons');
  }

  /**
   * Get active season
   */
  async getActiveSeason(): Promise<SeasonResponse> {
    return apiService.get<SeasonResponse['data']>('/seasons/active');
  }

  /**
   * Get season by ID
   */
  async getSeasonById(seasonId: string): Promise<SeasonResponse> {
    return apiService.get<SeasonResponse['data']>(`/seasons/${seasonId}`);
  }

  /**
   * Create a new season (admin only)
   */
  async createSeason(data: {
    name: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{ success: boolean; message: string; data?: { season: Season } }> {
    return apiService.post('/seasons', data);
  }

  /**
   * Update a season (admin only)
   */
  async updateSeason(
    seasonId: string,
    data: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
      isActive?: boolean;
    }
  ): Promise<{ success: boolean; message: string }> {
    return apiService.put(`/seasons/${seasonId}`, data);
  }

  /**
   * Delete a season (admin only)
   */
  async deleteSeason(seasonId: string): Promise<{ success: boolean; message: string }> {
    return apiService.delete(`/seasons/${seasonId}`);
  }

  /**
   * Get rankings for a specific season
   */
  async getSeasonRanking(
    seasonId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<SeasonRankingResponse> {
    return apiService.get<SeasonRankingResponse['data']>(
      `/players/ranking/season/${seasonId}?limit=${limit}&offset=${offset}`
    );
  }
}

export default new SeasonService();
