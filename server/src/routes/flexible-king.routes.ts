import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAdmin } from '../middlewares/auth.middleware';
import * as flexibleKingController from '../controllers/flexible-king.controller';

const router = Router();

// All routes require admin authentication
router.use(isAdmin);

/**
 * @route   GET /api/flexible-king/tournaments/:tournamentId/dashboard
 * @desc    Get flexible King tournament dashboard data
 * @access  Admin
 */
router.get(
  '/tournaments/:tournamentId/dashboard',
  asyncHandler(flexibleKingController.getFlexibleKingDashboard)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/initialize
 * @desc    Initialize flexible King Mode with phase configurations
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/initialize',
  asyncHandler(flexibleKingController.initializeFlexibleKing)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/preview
 * @desc    Validate and preview configuration before initialization
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/preview',
  asyncHandler(flexibleKingController.previewConfiguration)
);

/**
 * @route   PUT /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/config
 * @desc    Update phase configuration
 * @access  Admin
 */
router.put(
  '/tournaments/:tournamentId/phases/:phaseNumber/config',
  asyncHandler(flexibleKingController.updatePhaseConfiguration)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/start
 * @desc    Start a flexible King phase (generate pools and matches)
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/start',
  asyncHandler(flexibleKingController.startFlexibleKingPhase)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/complete
 * @desc    Complete a phase and calculate qualifiers
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/complete',
  asyncHandler(flexibleKingController.completeFlexibleKingPhase)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/matches/:matchId/result
 * @desc    Record match result for a flexible King phase
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/matches/:matchId/result',
  asyncHandler(flexibleKingController.recordFlexibleKingMatchResult)
);

/**
 * @route   GET /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/statistics
 * @desc    Get phase statistics
 * @access  Admin
 */
router.get(
  '/tournaments/:tournamentId/phases/:phaseNumber/statistics',
  asyncHandler(flexibleKingController.getPhaseStatistics)
);

/**
 * @route   GET /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/players/:playerId/statistics
 * @desc    Get player statistics for a phase
 * @access  Admin
 */
router.get(
  '/tournaments/:tournamentId/phases/:phaseNumber/players/:playerId/statistics',
  asyncHandler(flexibleKingController.getPlayerPhaseStatistics)
);

/**
 * @route   GET /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/repechage-candidates
 * @desc    Get repechage candidates for a completed phase
 * @access  Admin
 */
router.get(
  '/tournaments/:tournamentId/phases/:phaseNumber/repechage-candidates',
  asyncHandler(flexibleKingController.getRepechageCandidates)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/withdrawals
 * @desc    Manage player withdrawals for a phase
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/withdrawals',
  asyncHandler(flexibleKingController.manageWithdrawals)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/repechages
 * @desc    Manage player repechages for a phase
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/repechages',
  asyncHandler(flexibleKingController.manageRepechages)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/phases/:phaseNumber/reset
 * @desc    Reset a flexible King phase
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/reset',
  asyncHandler(flexibleKingController.resetFlexibleKingPhase)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/set-random-scores
 * @desc    Set random scores for all incomplete matches in current phase (testing)
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/set-random-scores',
  asyncHandler(flexibleKingController.setAllMatchesRandomScores)
);

/**
 * @route   POST /api/flexible-king/tournaments/:tournamentId/freeze
 * @desc    Freeze tournament and award ranking points to players
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/freeze',
  asyncHandler(flexibleKingController.freezeFlexibleKingTournament)
);

export default router;
