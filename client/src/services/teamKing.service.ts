import apiService from './api.service';
import type {
  TeamKingPhaseConfig,
  TeamKingDashboardData,
  ConfigureTeamKingPhaseDto,
  GenerateTeamKingPhasePoolsDto,
  StartTeamKingPhaseDto,
  RecordTeamKingMatchResultDto,
  CompleteTeamKingPhaseDto,
  CompleteTeamKingPhaseResponse,
  AssignTeamKingPlayerPointsDto,
} from '@shared/types/team-king.types';

class TeamKingService {
  /**
   * Get Team King tournament dashboard
   */
  async getTeamKingDashboard(tournamentId: string) {
    return apiService.get<{ success: boolean; data: TeamKingDashboardData }>(
      `/team-king/tournaments/${tournamentId}/dashboard`
    );
  }

  /**
   * Initialize Team King Mode with phase configurations
   */
  async initializeTeamKing(tournamentId: string, phases: TeamKingPhaseConfig[]) {
    return apiService.post(`/team-king/tournaments/${tournamentId}/initialize`, { phases });
  }

  /**
   * Preview configuration before initialization
   */
  async previewConfiguration(tournamentId: string, phases: TeamKingPhaseConfig[]) {
    return apiService.post(`/team-king/tournaments/${tournamentId}/preview`, { phases });
  }

  /**
   * Update phase configuration
   */
  async updatePhaseConfiguration(tournamentId: string, phaseNumber: number, config: TeamKingPhaseConfig) {
    return apiService.put(
      `/team-king/tournaments/${tournamentId}/phases/${phaseNumber}/config`,
      { config }
    );
  }

  /**
   * Start a Team King phase (generate pools and matches)
   */
  async startPhase(tournamentId: string, phaseNumber: number) {
    return apiService.post(`/team-king/tournaments/${tournamentId}/phases/${phaseNumber}/start`);
  }

  /**
   * Complete a phase and calculate qualified teams
   */
  async completePhase(tournamentId: string, phaseNumber: number) {
    return apiService.post<{ success: boolean; data: CompleteTeamKingPhaseResponse }>(
      `/team-king/tournaments/${tournamentId}/phases/${phaseNumber}/complete`
    );
  }

  /**
   * Record match result for a Team King phase
   */
  async recordMatchResult(
    tournamentId: string,
    phaseNumber: number,
    matchId: string,
    setsWonTeam1: number,
    setsWonTeam2: number,
    sets?: Array<{ score1: number; score2: number; winner: 1 | 2 }>
  ) {
    return apiService.post(
      `/team-king/tournaments/${tournamentId}/phases/${phaseNumber}/matches/${matchId}/result`,
      { setsWonTeam1, setsWonTeam2, sets }
    );
  }

  /**
   * Get phase statistics
   */
  async getPhaseStatistics(tournamentId: string, phaseNumber: number) {
    return apiService.get(`/team-king/tournaments/${tournamentId}/phases/${phaseNumber}/statistics`);
  }

  /**
   * Get team statistics for a phase
   */
  async getTeamPhaseStatistics(tournamentId: string, phaseNumber: number, teamId: string) {
    return apiService.get(
      `/team-king/tournaments/${tournamentId}/phases/${phaseNumber}/teams/${teamId}/statistics`
    );
  }

  /**
   * Reset a Team King phase
   */
  async resetPhase(tournamentId: string, phaseNumber: number) {
    return apiService.post(`/team-king/tournaments/${tournamentId}/phases/${phaseNumber}/reset`);
  }

  /**
   * Set random scores for all incomplete matches (testing)
   */
  async setRandomScores(tournamentId: string) {
    return apiService.post(`/team-king/tournaments/${tournamentId}/set-random-scores`);
  }

  /**
   * Freeze tournament and generate final rankings
   */
  async freezeTournament(tournamentId: string) {
    return apiService.post(`/team-king/tournaments/${tournamentId}/freeze`);
  }

  /**
   * Assign individual player points at tournament end
   */
  async assignPlayerPoints(tournamentId: string, playerPoints: Array<{ playerId: string; points: number }>) {
    return apiService.post(`/team-king/tournaments/${tournamentId}/assign-player-points`, {
      playerPoints,
    });
  }
}

export default new TeamKingService();
