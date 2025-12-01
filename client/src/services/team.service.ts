import apiService from './api.service';
import type { Team, UpdateTeamDto, AddTeamMemberDto, AddVirtualMemberDto, RemoveTeamMemberDto } from '@shared/types';

class TeamService {
  /**
   * Get team by ID
   */
  async getTeamById(id: string, tournamentId: string) {
    return apiService.get<{ team: Team }>(`/teams/${id}?tournamentId=${tournamentId}`);
  }

  /**
   * Update team settings
   */
  async updateTeamSettings(id: string, data: UpdateTeamDto) {
    return apiService.put(`/teams/${id}/settings`, data);
  }

  /**
   * Add member to team
   */
  async addMember(id: string, memberData: AddTeamMemberDto) {
    return apiService.post(`/teams/${id}/members`, memberData);
  }

  /**
   * Remove member from team
   */
  async removeMember(id: string, data: RemoveTeamMemberDto) {
    return apiService.delete(`/teams/${id}/members/${data.memberId}`, { data });
  }

  /**
   * Add virtual member to team
   */
  async addVirtualMember(id: string, memberData: AddVirtualMemberDto) {
    return apiService.post(`/teams/${id}/virtual-member`, memberData);
  }
}

export default new TeamService();
