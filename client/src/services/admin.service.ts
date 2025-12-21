import apiService from './api.service';

class AdminService {
  /**
   * Dashboard
   */
  async getDashboard() {
    return apiService.get<{
      stats: {
        totalUsers: number;
        totalTournaments: number;
        activeTournaments: number;
        totalTeams: number;
      };
      recentTournaments: any[];
      recentUsers: any[];
    }>('/admin/dashboard');
  }

  /**
   * Tournament Management
   */
  async getAllTournaments() {
    return apiService.get<{ tournaments: any[] }>('/admin/tournaments');
  }

  async getTournamentById(id: string) {
    return apiService.get<{ tournament: any }>(`/admin/tournaments/${id}`);
  }

  async createTournament(data: FormData) {
    return apiService.post('/admin/tournaments', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async updateTournament(id: string, data: FormData) {
    return apiService.put(`/admin/tournaments/${id}`, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async deleteTournament(id: string) {
    return apiService.delete(`/admin/tournaments/${id}`);
  }

  async cloneTournament(id: string) {
    return apiService.post(`/admin/tournaments/${id}/clone`);
  }

  /**
   * User Management
   */
  async getAllUsers() {
    return apiService.get<{ users: any[] }>('/admin/users');
  }

  async getUserById(id: string) {
    return apiService.get<{ user: any }>(`/admin/users/${id}`);
  }

  async createUser(data: any) {
    return apiService.post('/admin/users', data);
  }

  async updateUser(id: string, data: any) {
    return apiService.put(`/admin/users/${id}`, data);
  }

  async deleteUser(id: string) {
    return apiService.delete(`/admin/users/${id}`);
  }

  async bulkUpdateUsers(userIds: string[], clubId: string | null) {
    return apiService.post('/admin/users/bulk-update', { userIds, clubId });
  }

  /**
   * Team Management
   */
  async getTeams(tournamentId: string) {
    return apiService.get<{ teams: any[] }>(`/admin/tournaments/${tournamentId}/teams`);
  }

  async createTeam(tournamentId: string, data: any) {
    return apiService.post(`/admin/tournaments/${tournamentId}/teams`, data);
  }

  async updateTeam(tournamentId: string, teamId: string, data: any) {
    return apiService.put(`/admin/tournaments/${tournamentId}/teams/${teamId}`, data);
  }

  async deleteTeam(tournamentId: string, teamId: string) {
    return apiService.delete(`/admin/tournaments/${tournamentId}/teams/${teamId}`);
  }

  async generateRandomTeams(tournamentId: string) {
    return apiService.post<{
      teamsCreated: number;
      playersAssigned: number;
      remainingPlayers: number;
    }>(`/admin/tournaments/${tournamentId}/generate-random-teams`);
  }

  async recalculateTeamsRanking(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/teams/recalculate-ranking`);
  }

  /**
   * Pool Management
   */
  async getPools(tournamentId: string) {
    return apiService.get<{ pools: any[] }>(`/admin/tournaments/${tournamentId}/pools`);
  }

  async createPool(tournamentId: string, data: any) {
    return apiService.post(`/admin/tournaments/${tournamentId}/pools`, data);
  }

  async assignTeamsToPool(tournamentId: string, poolId: string, teamIds: string[]) {
    return apiService.post(`/admin/tournaments/${tournamentId}/pools/${poolId}/assign-teams`, { teamIds });
  }

  async generatePoolMatches(tournamentId: string, poolId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/pools/${poolId}/generate-matches`);
  }

  async distributeTeamsToPoolsAutomatically(
    tournamentId: string,
    sortBy: 'weight' | 'globalRanking' = 'weight',
    clearExisting: boolean = false
  ) {
    return apiService.post(`/admin/tournaments/${tournamentId}/pools/distribute-teams`, { sortBy, clearExisting });
  }

  async updatePoolName(tournamentId: string, poolId: string, name: string) {
    return apiService.put(`/admin/tournaments/${tournamentId}/pools/${poolId}`, { name });
  }

  async deletePool(tournamentId: string, poolId: string) {
    return apiService.delete(`/admin/tournaments/${tournamentId}/pools/${poolId}`);
  }

  /**
   * Match Score Management
   */
  async updatePoolMatchScore(tournamentId: string, poolId: string, matchId: string, sets: any[]) {
    return apiService.post(`/admin/tournaments/${tournamentId}/pools/${poolId}/matches/${matchId}/update-score`, { sets });
  }

  async updateEliminationMatchScore(tournamentId: string, matchId: string, sets: any[]) {
    return apiService.post(`/admin/tournaments/${tournamentId}/elimination/${matchId}/update-score`, { sets });
  }

  async updateEliminationMatchTeams(tournamentId: string, matchId: string, team1?: { id: string; name: string }, team2?: { id: string; name: string }) {
    return apiService.put(`/admin/tournaments/${tournamentId}/elimination/${matchId}/teams`, { team1, team2 });
  }

  /**
   * Elimination Management
   */
  async getEliminationMatches(tournamentId: string) {
    return apiService.get<{ matches: any[] }>(`/admin/tournaments/${tournamentId}/elimination`);
  }

  async generateEliminationBracket(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/generate-elimination`);
  }

  async generateEliminationBracketWithTeams(tournamentId: string, qualifiedTeamIds: string[]) {
    return apiService.post(`/admin/tournaments/${tournamentId}/generate-elimination`, { qualifiedTeamIds });
  }

  async freezeRanking(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/freeze-ranking`);
  }

  async freezeEliminationRanking(tournamentId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/freeze-elimination-ranking`);
  }

  /**
   * Round Schedule Management
   */
  async getRoundSchedule(tournamentId: string) {
    return apiService.get<{
      data: {
        totalRounds: number;
        totalMatches: number;
        numberOfFields: number;
        rounds: {
          roundNumber: number;
          matches: {
            matchId: string;
            poolId: string;
            poolName: string;
            team1Name: string;
            team2Name: string;
            roundNumber: number;
            fieldNumber: number;
            status: string;
          }[];
        }[];
      };
    }>(`/admin/tournaments/${tournamentId}/round-schedule`);
  }

  async generateRoundSchedule(tournamentId: string) {
    return apiService.post<{
      message: string;
      data: {
        totalRounds: number;
        totalMatches: number;
        numberOfFields: number;
        rounds: any[];
      };
    }>(`/admin/tournaments/${tournamentId}/generate-round-schedule`);
  }

  async bulkUpdateMatchSchedules(
    tournamentId: string,
    updates: { poolId: string; matchId: string; roundNumber: number; fieldNumber: number }[]
  ) {
    return apiService.put(`/admin/tournaments/${tournamentId}/round-schedule`, { updates });
  }

  async clearRoundSchedule(tournamentId: string) {
    return apiService.delete(`/admin/tournaments/${tournamentId}/round-schedule`);
  }

  async updateMatchSchedule(
    tournamentId: string,
    poolId: string,
    matchId: string,
    roundNumber: number,
    fieldNumber: number
  ) {
    return apiService.put(`/admin/tournaments/${tournamentId}/pools/${poolId}/matches/${matchId}/schedule`, {
      roundNumber,
      fieldNumber,
    });
  }

  /**
   * Unassigned Players
   */
  async getUnassignedPlayers(tournamentId: string) {
    return apiService.get<{ players: any[] }>(`/admin/tournaments/${tournamentId}/unassigned-players`);
  }

  async addUnassignedPlayer(tournamentId: string, userId: string) {
    return apiService.post(`/admin/tournaments/${tournamentId}/unassigned-players`, { userId });
  }

  async removeUnassignedPlayer(tournamentId: string, userId: string) {
    return apiService.delete(`/admin/tournaments/${tournamentId}/unassigned-players/${userId}`);
  }
}

export default new AdminService();
