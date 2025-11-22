/**
 * Match Service
 * Handles match score submission and updates
 */

import apiService from './api.service';

export interface SubmitScoreRequest {
  sets: {
    score1: number;
    score2: number;
  }[];
  matchType: 'pool' | 'elimination';
  poolId?: string;
}

const matchService = {
  /**
   * Submit match scores (captain only)
   */
  async submitScores(
    tournamentId: string,
    matchId: string,
    data: SubmitScoreRequest
  ) {
    return apiService.post(
      `/matches/${tournamentId}/${matchId}/submit-scores`,
      data
    );
  },
};

export default matchService;
