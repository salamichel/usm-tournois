import { Request, Response, NextFunction } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from './error.middleware';

/**
 * Middleware to fetch a tournament by ID and attach it to req.tournament
 * Passes errors to next() for proper error handling
 */
export const getTournament = async (req: Request, res: Response, next: NextFunction) => {
  const { tournamentId } = req.params;

  if (!tournamentId) {
    return next(new AppError('Tournament ID is required', 400));
  }

  try {
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();

    if (!tournamentDoc.exists) {
      return next(new AppError('Tournament not found', 404));
    }

    // Attach tournament to request object
    (req as any).tournament = {
      id: tournamentDoc.id,
      ...tournamentDoc.data()
    };

    next();
  } catch (error) {
    console.error('Error fetching tournament in middleware:', error);
    next(new AppError('Error fetching tournament', 500));
  }
};
