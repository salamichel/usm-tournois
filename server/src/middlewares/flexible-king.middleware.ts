import { Request, Response, NextFunction } from 'express';
import { adminDb } from '../config/firebase.config';
import type { FlexibleKingTournamentData } from '@shared/types';

/**
 * Middleware to check if tournament exists and attach it to request
 */
export const validateFlexibleKingTournament = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { tournamentId } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

    // Check if flexible King Mode is initialized
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const flexKingDoc = await flexKingDocRef.get();

    if (!flexKingDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Flexible King Mode not initialized for this tournament',
      });
    }

    // Attach to request object
    (req as any).tournament = tournament;
    (req as any).tournamentRef = tournamentRef;
    (req as any).flexKingRef = flexKingDocRef;
    (req as any).flexKingData = flexKingDoc.data() as FlexibleKingTournamentData;

    next();
  } catch (error) {
    console.error('Error validating flexible King tournament:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating tournament',
    });
  }
};

/**
 * Middleware to validate that a specific phase exists
 */
export const validatePhaseExists = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { phaseNumber } = req.params;
  const flexKingRef = (req as any).flexKingRef;

  if (!flexKingRef) {
    return res.status(500).json({
      success: false,
      message: 'Flexible King reference not found. Use validateFlexibleKingTournament middleware first.',
    });
  }

  try {
    const phaseDocRef = flexKingRef.collection('phases').doc(`phase-${phaseNumber}`);
    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    // Attach to request object
    (req as any).phaseRef = phaseDocRef;
    (req as any).phase = { id: phaseDoc.id, ...phaseDoc.data() };

    next();
  } catch (error) {
    console.error('Error validating phase:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating phase',
    });
  }
};

/**
 * Middleware to check if phase is in progress (for recording match results)
 */
export const requirePhaseInProgress = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const phase = (req as any).phase;

  if (!phase) {
    return res.status(500).json({
      success: false,
      message: 'Phase not loaded. Use validatePhaseExists middleware first.',
    });
  }

  if (phase.status !== 'in_progress') {
    return res.status(400).json({
      success: false,
      message: `Cannot perform this action. Phase ${phase.phaseNumber} is ${phase.status}`,
    });
  }

  next();
};

/**
 * Middleware to check if phase is completed (for accessing results)
 */
export const requirePhaseCompleted = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const phase = (req as any).phase;

  if (!phase) {
    return res.status(500).json({
      success: false,
      message: 'Phase not loaded. Use validatePhaseExists middleware first.',
    });
  }

  if (phase.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: `Phase ${phase.phaseNumber} is not completed yet`,
    });
  }

  next();
};
