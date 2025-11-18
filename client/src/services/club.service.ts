import apiService from './api.service';
import type { Club, ClubWithStats } from '@shared/types/club.types';
import type { User } from '@shared/types';

class ClubService {
  /**
   * Get all clubs with player count
   */
  async getAllClubs() {
    return apiService.get<{ clubs: ClubWithStats[] }>('/clubs');
  }

  /**
   * Get club by ID
   */
  async getClubById(id: string) {
    return apiService.get<{ club: Club }>(`/clubs/${id}`);
  }

  /**
   * Get all players for a specific club (admin only)
   */
  async getClubPlayers(id: string) {
    return apiService.get<{ players: User[] }>(`/clubs/${id}/players`);
  }

  /**
   * Create a new club (admin only)
   */
  async createClub(name: string, logo?: File) {
    const formData = new FormData();
    formData.append('name', name);
    if (logo) {
      formData.append('logo', logo);
    }

    return apiService.post<{ club: Club }>('/clubs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Update a club (admin only)
   */
  async updateClub(id: string, name?: string, logo?: File) {
    const formData = new FormData();
    if (name) {
      formData.append('name', name);
    }
    if (logo) {
      formData.append('logo', logo);
    }

    return apiService.put<{ club: Club }>(`/clubs/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Delete a club (admin only)
   */
  async deleteClub(id: string) {
    return apiService.delete<{ message: string }>(`/clubs/${id}`);
  }
}

export default new ClubService();
