import apiService from './api.service';
import type { FlexiblePhaseConfig } from '@shared/types';

interface InitializeRequest {
  phases: FlexiblePhaseConfig[];
}

interface PreviewRequest {
  phases: FlexiblePhaseConfig[];
}

interface RecordMatchResultRequest {
  setsWonTeam1: number;
  setsWonTeam2: number;
}

interface ManageWithdrawalsRequest {
  withdrawnPlayerIds: string[];
}

interface ManageRepechagesRequest {
  repechedPlayerIds: string[];
}

class FlexibleKingService {
  /**
   * Get Flexible King tournament dashboard
   */
  async getDashboard(tournamentId: string) {
    return apiService.get<any>(`/flexible-king/tournaments/${tournamentId}/dashboard`);
  }

  /**
   * Initialize Flexible King Mode with phase configurations
   */
  async initialize(tournamentId: string, data: InitializeRequest) {
    return apiService.post(`/flexible-king/tournaments/${tournamentId}/initialize`, data);
  }

  /**
   * Preview configuration before initialization
   */
  async previewConfiguration(tournamentId: string, data: PreviewRequest) {
    return apiService.post(`/flexible-king/tournaments/${tournamentId}/preview`, data);
  }

  /**
   * Update phase configuration
   */
  async updatePhaseConfiguration(tournamentId: string, phaseNumber: number, config: FlexiblePhaseConfig) {
    return apiService.put(`/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/config`, { config });
  }

  /**
   * Start a flexible King phase (generate pools and matches)
   */
  async startPhase(tournamentId: string, phaseNumber: number) {
    return apiService.post(`/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/start`);
  }

  /**
   * Complete a phase and calculate qualifiers
   */
  async completePhase(tournamentId: string, phaseNumber: number) {
    return apiService.post(`/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/complete`);
  }

  /**
   * Record match result for a flexible King phase
   */
  async recordMatchResult(tournamentId: string, phaseNumber: number, matchId: string, data: RecordMatchResultRequest) {
    return apiService.post(
      `/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/matches/${matchId}/result`,
      data
    );
  }

  /**
   * Get phase statistics
   */
  async getPhaseStatistics(tournamentId: string, phaseNumber: number) {
    return apiService.get(`/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/statistics`);
  }

  /**
   * Get player statistics for a phase
   */
  async getPlayerStatistics(tournamentId: string, phaseNumber: number, playerId: string) {
    return apiService.get(
      `/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/players/${playerId}/statistics`
    );
  }

  /**
   * Get repechage candidates for a completed phase
   */
  async getRepechageCandidates(tournamentId: string, phaseNumber: number) {
    return apiService.get(`/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/repechage-candidates`);
  }

  /**
   * Manage player withdrawals for a phase
   */
  async manageWithdrawals(tournamentId: string, phaseNumber: number, data: ManageWithdrawalsRequest) {
    return apiService.post(`/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/withdrawals`, data);
  }

  /**
   * Manage player repechages for a phase
   */
  async manageRepechages(tournamentId: string, phaseNumber: number, data: ManageRepechagesRequest) {
    return apiService.post(`/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/repechages`, data);
  }

  /**
   * Reset a flexible King phase
   */
  async resetPhase(tournamentId: string, phaseNumber: number) {
    return apiService.post(`/flexible-king/tournaments/${tournamentId}/phases/${phaseNumber}/reset`);
  }

  /**
   * Set random scores for all incomplete matches in current phase (testing)
   */
  async setRandomScores(tournamentId: string) {
    return apiService.post(`/flexible-king/tournaments/${tournamentId}/set-random-scores`);
  }
}

export default new FlexibleKingService();
