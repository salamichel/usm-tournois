import apiService from './api.service';
import type { Team, UpdateTeamDto, AddTeamMemberDto } from '@shared/types';

class TeamService {
  /**
   * Get team by ID
   */
  async getTeamById(id: string) {
    return apiService.get<{ team: Team }>(`/teams/${id}`);
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
  async removeMember(id: string, userId: string) {
    return apiService.delete(`/teams/${id}/members/${userId}`);
  }

  /**
   * Add virtual member to team
   */
  async addVirtualMember(id: string, memberData: AddTeamMemberDto) {
    return apiService.post(`/teams/${id}/virtual-member`, memberData);
  }
}

export default new TeamService();
