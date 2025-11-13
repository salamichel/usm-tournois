/**
 * User-related TypeScript types
 * Shared between client and server
 */

export type UserRole = 'player' | 'captain' | 'admin';

export type UserLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface User {
  uid: string;
  pseudo: string;
  email: string;
  level: UserLevel;
  role: UserRole;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  pseudo: string;
  level: UserLevel;
  role?: UserRole;
}

export interface UpdateUserDto {
  pseudo?: string;
  email?: string;
  level?: UserLevel;
  role?: UserRole;
  avatar?: string;
}

export interface UserSession {
  uid: string;
  email: string;
  pseudo: string;
  level: UserLevel;
  role: UserRole;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserSession;
  token?: string;
}
