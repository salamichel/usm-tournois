import apiService from './api.service';
import type { UpdateUserDto, User } from '@shared/types';

class UserService {
  /**
   * Update user profile
   */
  async updateProfile(data: UpdateUserDto) {
    return apiService.put<{ user: User }>('/users/profile', data);
  }

  /**
   * Get user by ID (admin)
   */
  async getUserById(id: string) {
    return apiService.get<{ user: User }>(`/admin/users/${id}`);
  }

  /**
   * Search users by pseudo or email
   */
  async searchUsers(query: string, excludeVirtual: boolean = false) {
    return apiService.get<{ users: User[] }>('/users/search', {
      params: { query, excludeVirtual: excludeVirtual ? 'true' : 'false' },
    });
  }
}

export default new UserService();
