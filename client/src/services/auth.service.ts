import apiService from './api.service';
import type {
  CreateUserDto,
  LoginCredentials,
  ChangePasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  UserSession,
  AuthResponse,
} from '@shared/types';

class AuthService {
  /**
   * User signup
   */
  async signup(data: CreateUserDto) {
    return apiService.post<AuthResponse>('/auth/signup', data);
  }

  /**
   * User login
   */
  async login(credentials: LoginCredentials) {
    return apiService.post<AuthResponse>('/auth/login', credentials);
  }

  /**
   * User logout
   */
  async logout() {
    return apiService.post('/auth/logout');
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    return apiService.get<{ user: UserSession }>('/auth/me');
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordDto) {
    return apiService.put('/auth/change-password', data);
  }

  /**
   * Claim virtual account
   */
  async claimVirtualAccount(data: {
    email: string;
    password: string;
    pseudo: string;
    level: string;
    virtualUserId: string;
  }) {
    return apiService.post<AuthResponse>('/auth/claim-virtual-account', data);
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: RequestPasswordResetDto) {
    return apiService.post<{ resetLink?: string }>('/auth/request-password-reset', data);
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(token: string) {
    return apiService.get<{ email: string }>(`/auth/verify-reset-token/${token}`);
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordDto) {
    return apiService.post('/auth/reset-password', data);
  }
}

export default new AuthService();
