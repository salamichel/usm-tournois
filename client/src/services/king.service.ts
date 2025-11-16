import apiService from './api.service';

class KingService {
  /**
   * Get King tournament dashboard
   */
  async getKingDashboard(tournamentId: string) {
    return apiService.get<any>(`/admin/tournaments/${tournamentId}/king`);
  }

  /**
   * Start Phase 1 (4v4)
   */
  async startPhase1(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/start-phase-1`);
  }

  /**
   * Start Phase 2 (3v3)
   */
  async startPhase2(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/start-phase-2`);
  }

  /**
   * Start Phase 3 (2v2 - Finals)
   */
  async startPhase3(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/start-phase-3`);
  }

  /**
   * Record match result
   */
  async recordMatchResult(tournamentId: string, matchId: string, setsWonTeam1: number, setsWonTeam2: number) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/matches/${matchId}/record-result`, {
      setsWonTeam1,
      setsWonTeam2,
    });
  }

  /**
   * Reset Phase 1
   */
  async resetPhase1(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/reset-phase-1`);
  }

  /**
   * Reset Phase 2
   */
  async resetPhase2(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/reset-phase-2`);
  }

  /**
   * Reset Phase 3
   */
  async resetPhase3(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/reset-phase-3`);
  }

  /**
   * Update Phase 1 configuration
   */
  async updatePhase1Config(tournamentId: string, config: any) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/update-phase1-config`, config);
  }

  /**
   * Update team name in King tournament
   */
  async updateTeamName(tournamentId: string, data: { phaseNumber: number; poolId: string; matchId: string; teamIndex: number; newName: string }) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/update-team-name`, data);
  }

  /**
   * Set all matches scores (for testing)
   */
  async setAllMatchesScores(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/king/set-all-matches-scores`);
  }
}

export default new KingService();
