import apiService from './api.service';
import type {
  TournamentSummary,
  TournamentDetails,
  CreateTournamentDto,
  UpdateTournamentDto,
} from '@shared/types';

class TournamentService {
  /**
   * Get all tournaments
   */
  async getAllTournaments() {
    return apiService.get<{ tournaments: TournamentSummary[] }>('/tournaments');
  }

  /**
   * Get tournament by ID
   */
  async getTournamentById(id: string) {
    return apiService.get<{
      tournament: any;
      teams: any[];
      unassignedPlayers: any[];
      waitingList?: any[];
      pools: any[];
      eliminationMatches: any[];
      finalRanking?: any[];
    }>(`/tournaments/${id}`);
  }

  /**
   * Register as unassigned player
   */
  async registerPlayer(tournamentId: string) {
    return apiService.post(`/tournaments/${tournamentId}/register-player`);
  }

  /**
   * Register team to tournament
   */
  async registerTeam(tournamentId: string, teamId: string) {
    return apiService.post(`/tournaments/${tournamentId}/register-team`, { teamId });
  }

  /**
   * Unregister team from tournament
   */
  async unregisterTeam(tournamentId: string, teamId: string) {
    return apiService.post(`/tournaments/${tournamentId}/unregister-team`, { teamId });
  }

  /**
   * Leave tournament (as unassigned player)
   */
  async leaveTournament(tournamentId: string) {
    return apiService.post(`/tournaments/${tournamentId}/leave-tournament`);
  }

  /**
   * Join existing team
   */
  async joinTeam(tournamentId: string, teamId: string) {
    return apiService.post(`/tournaments/${tournamentId}/join-team`, { teamId });
  }

  /**
   * Leave team
   */
  async leaveTeam(tournamentId: string, teamId: string) {
    return apiService.post(`/tournaments/${tournamentId}/leave-team`, { teamId });
  }

  /**
   * Create new team
   */
  async createTeam(tournamentId: string, teamName: string) {
    return apiService.post(`/tournaments/${tournamentId}/create-team`, { teamName });
  }

  /**
   * Join waiting list
   */
  async joinWaitingList(tournamentId: string) {
    return apiService.post(`/tournaments/${tournamentId}/join-waiting-list`);
  }

  // Admin methods
  async createTournament(data: CreateTournamentDto) {
    return apiService.post('/admin/tournaments', data);
  }

  async updateTournament(id: string, data: UpdateTournamentDto) {
    return apiService.put(`/admin/tournaments/${id}`, data);
  }

  async deleteTournament(id: string) {
    return apiService.delete(`/admin/tournaments/${id}`);
  }

  async cloneTournament(id: string) {
    return apiService.post(`/admin/tournaments/${id}/clone`);
  }
}

export default new TournamentService();
