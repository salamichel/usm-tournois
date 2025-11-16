import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAdmin } from '../middlewares/auth.middleware';
import * as kingController from '../controllers/king.controller';

const router = Router();

// All routes require admin authentication
router.use(isAdmin);

/**
 * @route   GET /api/king/tournaments/:tournamentId/dashboard
 * @desc    Get King tournament dashboard data
 * @access  Admin
 */
router.get(
  '/tournaments/:tournamentId/dashboard',
  asyncHandler(kingController.getKingDashboard)
);

/**
 * @route   POST /api/king/tournaments/:tournamentId/phase1/start
 * @desc    Start Phase 1 (4v4)
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phase1/start',
  asyncHandler(kingController.startKingPhase1)
);

/**
 * @route   POST /api/king/tournaments/:tournamentId/phase2/start
 * @desc    Start Phase 2 (3v3)
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phase2/start',
  asyncHandler(kingController.startKingPhase2)
);

/**
 * @route   POST /api/king/tournaments/:tournamentId/phase3/start
 * @desc    Start Phase 3 (2v2 - Finals)
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phase3/start',
  asyncHandler(kingController.startKingPhase3)
);

/**
 * @route   POST /api/king/matches/:matchId/result
 * @desc    Record match result
 * @access  Admin
 */
router.post(
  '/matches/:matchId/result',
  asyncHandler(kingController.recordKingMatchResult)
);

/**
 * @route   POST /api/king/tournaments/:tournamentId/phase1/reset
 * @desc    Reset Phase 1
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phase1/reset',
  asyncHandler(kingController.resetKingPhase1)
);

/**
 * @route   POST /api/king/tournaments/:tournamentId/phase2/reset
 * @desc    Reset Phase 2
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phase2/reset',
  asyncHandler(kingController.resetKingPhase2)
);

/**
 * @route   POST /api/king/tournaments/:tournamentId/phase3/reset
 * @desc    Reset Phase 3
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phase3/reset',
  asyncHandler(kingController.resetKingPhase3)
);

export default router;
