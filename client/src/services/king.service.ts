import apiService from './api.service';
import type {
  KingDashboardData,
  RecordKingMatchResultDto,
} from '@shared/types';

class KingService {
  /**
   * Get King tournament dashboard
   */
  async getKingDashboard(tournamentId: string) {
    return apiService.get<KingDashboardData>(`/king/tournaments/${tournamentId}/dashboard`);
  }

  /**
   * Start Phase 1 (4v4)
   */
  async startPhase1(tournamentId: string) {
    return apiService.post(`/king/tournaments/${tournamentId}/phase1/start`);
  }

  /**
   * Start Phase 2 (3v3)
   */
  async startPhase2(tournamentId: string) {
    return apiService.post(`/king/tournaments/${tournamentId}/phase2/start`);
  }

  /**
   * Start Phase 3 (2v2 - Finals)
   */
  async startPhase3(tournamentId: string) {
    return apiService.post(`/king/tournaments/${tournamentId}/phase3/start`);
  }

  /**
   * Record match result
   */
  async recordMatchResult(tournamentId: string, matchId: string, setsWonTeam1: number, setsWonTeam2: number) {
    return apiService.post(`/king/matches/${matchId}/result`, {
      tournamentId,
      matchId,
      setsWonTeam1,
      setsWonTeam2,
    });
  }

  /**
   * Reset Phase 1
   */
  async resetPhase1(tournamentId: string) {
    return apiService.post(`/king/tournaments/${tournamentId}/phase1/reset`);
  }

  /**
   * Reset Phase 2
   */
  async resetPhase2(tournamentId: string) {
    return apiService.post(`/king/tournaments/${tournamentId}/phase2/reset`);
  }

  /**
   * Reset Phase 3
   */
  async resetPhase3(tournamentId: string) {
    return apiService.post(`/king/tournaments/${tournamentId}/phase3/reset`);
  }
}

export default new KingService();
