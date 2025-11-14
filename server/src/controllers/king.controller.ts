import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';

/**
 * King Tournament Controller
 * Handles all King format tournament operations
 *
 * TODO: This is a stub implementation. The full logic from
 * controllers/admin/admin.king.controller.js needs to be migrated here.
 */

export const getKingDashboard = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;

  try {
    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

    // Get King data
    const kingDocRef = tournamentDoc.ref.collection('king').doc('mainKingData');
    const kingDoc = await kingDocRef.get();

    const kingData = kingDoc.exists ? kingDoc.data() : null;

    // Get current phase data if exists
    let currentPhase = null;
    if (tournament.currentKingPhase && kingDoc.exists) {
      const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${tournament.currentKingPhase}`);
      const phaseDoc = await phaseDocRef.get();
      if (phaseDoc.exists) {
        currentPhase = { id: phaseDoc.id, ...phaseDoc.data() };

        // Get pools and matches for current phase
        const poolsSnapshot = await phaseDocRef.collection('pools').get();
        const pools = [];

        for (const poolDoc of poolsSnapshot.docs) {
          const matchesSnapshot = await poolDoc.ref.collection('matches').get();
          const matches = matchesSnapshot.docs.map(m => ({ id: m.id, ...m.data() }));

          pools.push({
            id: poolDoc.id,
            ...poolDoc.data(),
            matches,
          });
        }

        currentPhase.pools = pools;
      }
    }

    res.json({
      success: true,
      data: {
        tournament,
        kingData,
        currentPhase,
      },
    });
  } catch (error: any) {
    console.error('Error getting King dashboard:', error);
    res.status(500).json({ success: false, message: 'Error loading King dashboard' });
  }
};

export const startKingPhase1 = async (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'TODO: Implement startKingPhase1 - migrate from controllers/admin/admin.king.controller.js',
  });
};

export const startKingPhase2 = async (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'TODO: Implement startKingPhase2 - migrate from controllers/admin/admin.king.controller.js',
  });
};

export const startKingPhase3 = async (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'TODO: Implement startKingPhase3 - migrate from controllers/admin/admin.king.controller.js',
  });
};

export const recordKingMatchResult = async (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'TODO: Implement recordKingMatchResult - migrate from controllers/admin/admin.king.controller.js',
  });
};

export const resetKingPhase1 = async (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'TODO: Implement resetKingPhase1 - migrate from controllers/admin/admin.king.controller.js',
  });
};

export const resetKingPhase2 = async (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'TODO: Implement resetKingPhase2 - migrate from controllers/admin/admin.king.controller.js',
  });
};

export const resetKingPhase3 = async (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'TODO: Implement resetKingPhase3 - migrate from controllers/admin/admin.king.controller.js',
  });
};
