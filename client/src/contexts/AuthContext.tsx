import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserSession, LoginCredentials, CreateUserDto } from '@shared/types';
import authService from '@services/auth.service';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (data: CreateUserDto) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await authService.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data.user);
      }
    } catch (error) {
      // User not authenticated
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      if (response.success && response.data) {
        setUser(response.data.user);
        toast.success('Connexion réussie !');
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Erreur de connexion';
      toast.error(message);
      throw error;
    }
  };

  const signup = async (data: CreateUserDto) => {
    try {
      const response = await authService.signup(data);
      if (response.success && response.data) {
        setUser(response.data.user);
        toast.success('Compte créé avec succès !');
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Erreur lors de l\'inscription';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      toast.success('Déconnexion réussie');
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Erreur lors de la déconnexion';
      toast.error(message);
      throw error;
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
