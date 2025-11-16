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
}

export default new UserService();
