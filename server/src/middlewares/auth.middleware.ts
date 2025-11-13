import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import type { UserSession } from '@shared/types';

// Extend Express Request to include user session
declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}

/**
 * Middleware to check if user is authenticated
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.user) {
    req.user = req.session.user as UserSession;
    next();
  } else {
    throw new AppError('Vous devez être connecté pour accéder à cette ressource.', 401);
  }
};

/**
 * Middleware to check if user is an admin
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.user) {
    throw new AppError('Vous devez être connecté pour accéder à cette ressource.', 401);
  }

  const user = req.session.user as UserSession;

  if (user.role === 'admin') {
    req.user = user;
    next();
  } else {
    throw new AppError('Accès refusé. Vous n\'avez pas les permissions d\'administrateur.', 403);
  }
};

/**
 * Middleware to check if user is a team captain
 */
export const isCaptain = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !req.session.user) {
    throw new AppError('Vous devez être connecté pour accéder à cette ressource.', 401);
  }

  const user = req.session.user as UserSession;

  if (user.role === 'captain' || user.role === 'admin') {
    req.user = user;
    next();
  } else {
    throw new AppError('Accès refusé. Vous devez être capitaine d\'équipe.', 403);
  }
};

/**
 * Optional authentication - doesn't throw error if not authenticated
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.user) {
    req.user = req.session.user as UserSession;
  }
  next();
};
