import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware.ts';
import { isAuthenticated, optionalAuth } from '../middlewares/auth.middleware.ts';
import * as tournamentController from '../controllers/tournament.controller.ts';

const router = Router();

/**
 * @route   GET /api/tournaments
 * @desc    Get all tournaments
 * @access  Public
 */
router.get('/', optionalAuth, asyncHandler(tournamentController.getAllTournaments));

/**
 * @route   GET /api/tournaments/:id
 * @desc    Get tournament by ID with full details
 * @access  Public
 */
router.get('/:id', optionalAuth, asyncHandler(tournamentController.getTournamentById));

/**
 * @route   POST /api/tournaments/:id/register-player
 * @desc    Register as unassigned player
 * @access  Private
 */
router.post('/:id/register-player', isAuthenticated, asyncHandler(tournamentController.registerPlayer));

/**
 * @route   POST /api/tournaments/:id/register-team
 * @desc    Register team to tournament
 * @access  Private
 */
router.post('/:id/register-team', isAuthenticated, asyncHandler(tournamentController.registerTeam));

/**
 * @route   POST /api/tournaments/:id/unregister-team
 * @desc    Unregister team from tournament
 * @access  Private
 */
router.post('/:id/unregister-team', isAuthenticated, asyncHandler(tournamentController.unregisterTeam));

/**
 * @route   POST /api/tournaments/:id/leave-tournament
 * @desc    Leave tournament (as unassigned player)
 * @access  Private
 */
router.post('/:id/leave-tournament', isAuthenticated, asyncHandler(tournamentController.leaveTournament));

/**
 * @route   POST /api/tournaments/:id/join-team
 * @desc    Join existing team
 * @access  Private
 */
router.post('/:id/join-team', isAuthenticated, asyncHandler(tournamentController.joinTeam));

/**
 * @route   POST /api/tournaments/:id/leave-team
 * @desc    Leave team
 * @access  Private
 */
router.post('/:id/leave-team', isAuthenticated, asyncHandler(tournamentController.leaveTeam));

/**
 * @route   POST /api/tournaments/:id/create-team
 * @desc    Create new team
 * @access  Private
 */
router.post('/:id/create-team', isAuthenticated, asyncHandler(tournamentController.createTeam));

/**
 * @route   POST /api/tournaments/:id/join-waiting-list
 * @desc    Join waiting list
 * @access  Private
 */
router.post('/:id/join-waiting-list', isAuthenticated, asyncHandler(tournamentController.joinWaitingList));

export default router;
