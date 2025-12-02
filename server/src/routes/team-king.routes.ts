import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAdmin } from '../middlewares/auth.middleware';
import * as teamKingController from '../controllers/team-king.controller';

const router = Router();

// All routes require admin authentication
router.use(isAdmin);

/**
 * @route   GET /api/team-king/tournaments/:tournamentId/dashboard
 * @desc    Get Team King tournament dashboard data
 * @access  Admin
 */
router.get(
  '/tournaments/:tournamentId/dashboard',
  asyncHandler(teamKingController.getTeamKingDashboard)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/initialize
 * @desc    Initialize Team King Mode with phase configurations
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/initialize',
  asyncHandler(teamKingController.initializeTeamKing)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/preview
 * @desc    Validate and preview configuration before initialization
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/preview',
  asyncHandler(teamKingController.previewConfiguration)
);

/**
 * @route   PUT /api/team-king/tournaments/:tournamentId/phases/:phaseNumber/config
 * @desc    Update phase configuration
 * @access  Admin
 */
router.put(
  '/tournaments/:tournamentId/phases/:phaseNumber/config',
  asyncHandler(teamKingController.updatePhaseConfiguration)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/phases/:phaseNumber/start
 * @desc    Start a Team King phase (generate pools and matches)
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/start',
  asyncHandler(teamKingController.startTeamKingPhase)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/phases/:phaseNumber/complete
 * @desc    Complete a phase and calculate qualified teams
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/complete',
  asyncHandler(teamKingController.completeTeamKingPhase)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/phases/:phaseNumber/matches/:matchId/result
 * @desc    Record match result for a Team King phase
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/matches/:matchId/result',
  asyncHandler(teamKingController.recordTeamKingMatchResult)
);

/**
 * @route   GET /api/team-king/tournaments/:tournamentId/phases/:phaseNumber/statistics
 * @desc    Get phase statistics
 * @access  Admin
 */
router.get(
  '/tournaments/:tournamentId/phases/:phaseNumber/statistics',
  asyncHandler(teamKingController.getPhaseStatistics)
);

/**
 * @route   GET /api/team-king/tournaments/:tournamentId/phases/:phaseNumber/teams/:teamId/statistics
 * @desc    Get team statistics for a phase
 * @access  Admin
 */
router.get(
  '/tournaments/:tournamentId/phases/:phaseNumber/teams/:teamId/statistics',
  asyncHandler(teamKingController.getTeamPhaseStatistics)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/phases/:phaseNumber/reset
 * @desc    Reset a Team King phase
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/phases/:phaseNumber/reset',
  asyncHandler(teamKingController.resetTeamKingPhase)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/set-random-scores
 * @desc    Set random scores for all incomplete matches in current phase (testing)
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/set-random-scores',
  asyncHandler(teamKingController.setAllMatchesRandomScores)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/freeze
 * @desc    Freeze tournament and generate final rankings
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/freeze',
  asyncHandler(teamKingController.freezeTeamKingTournament)
);

/**
 * @route   POST /api/team-king/tournaments/:tournamentId/assign-player-points
 * @desc    Assign individual player points at tournament end
 * @access  Admin
 */
router.post(
  '/tournaments/:tournamentId/assign-player-points',
  asyncHandler(teamKingController.assignPlayerPoints)
);

export default router;
