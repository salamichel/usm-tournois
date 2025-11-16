import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAdmin } from '../middlewares/auth.middleware';
import { uploadCoverImage } from '../middlewares/upload.middleware';
import * as adminController from '../controllers/admin.controller';
import * as kingController from '../controllers/king.controller';

const router = Router();

// All routes require admin authentication
router.use(isAdmin);

/**
 * Tournament Management
 */
router.get('/tournaments', asyncHandler(adminController.getAllTournaments));
router.post('/tournaments', uploadCoverImage, asyncHandler(adminController.createTournament));
router.get('/tournaments/:id', asyncHandler(adminController.getTournamentById));
router.put('/tournaments/:id', uploadCoverImage, asyncHandler(adminController.updateTournament));
router.delete('/tournaments/:id', asyncHandler(adminController.deleteTournament));
router.post('/tournaments/:id/clone', asyncHandler(adminController.cloneTournament));

/**
 * Pool Management
 */
router.get('/tournaments/:tournamentId/pools', asyncHandler(adminController.getPools));
router.post('/tournaments/:tournamentId/pools', asyncHandler(adminController.createPool));
router.post('/tournaments/:tournamentId/pools/:poolId/assign-teams', asyncHandler(adminController.assignTeamsToPool));
router.post('/tournaments/:tournamentId/pools/:poolId/generate-matches', asyncHandler(adminController.generatePoolMatches));

/**
 * Elimination Management
 */
router.get('/tournaments/:tournamentId/elimination', asyncHandler(adminController.getEliminationMatches));
router.post('/tournaments/:tournamentId/generate-elimination', asyncHandler(adminController.generateEliminationBracket));
router.post('/tournaments/:tournamentId/freeze-ranking', asyncHandler(adminController.freezeRanking));

/**
 * Team Management
 */
router.get('/tournaments/:tournamentId/teams', asyncHandler(adminController.getTeams));
router.post('/tournaments/:tournamentId/teams', asyncHandler(adminController.createTeam));
router.put('/tournaments/:tournamentId/teams/:teamId', asyncHandler(adminController.updateTeam));
router.delete('/tournaments/:tournamentId/teams/:teamId', asyncHandler(adminController.deleteTeam));

/**
 * User Management
 */
router.get('/users', asyncHandler(adminController.getAllUsers));
router.post('/users', asyncHandler(adminController.createUser));
router.get('/users/:id', asyncHandler(adminController.getUserById));
router.put('/users/:id', asyncHandler(adminController.updateUser));
router.delete('/users/:id', asyncHandler(adminController.deleteUser));

/**
 * Unassigned Players Management
 */
router.get('/tournaments/:tournamentId/unassigned-players', asyncHandler(adminController.getUnassignedPlayers));
router.delete('/tournaments/:tournamentId/unassigned-players/:userId', asyncHandler(adminController.removeUnassignedPlayer));

/**
 * Dashboard
 */
router.get('/dashboard', asyncHandler(adminController.getDashboard));

/**
 * King Mode Management
 */
router.get('/tournaments/:tournamentId/king', asyncHandler(kingController.getKingDashboard));
router.post('/tournaments/:tournamentId/king/start-phase-1', asyncHandler(kingController.startPhase1));
router.post('/tournaments/:tournamentId/king/start-phase-2', asyncHandler(kingController.startPhase2));
router.post('/tournaments/:tournamentId/king/start-phase-3', asyncHandler(kingController.startPhase3));
router.post('/tournaments/:tournamentId/king/matches/:matchId/record-result', asyncHandler(kingController.recordMatchResult));
router.post('/tournaments/:tournamentId/king/reset-phase-1', asyncHandler(kingController.resetPhase1));
router.post('/tournaments/:tournamentId/king/reset-phase-2', asyncHandler(kingController.resetPhase2));
router.post('/tournaments/:tournamentId/king/reset-phase-3', asyncHandler(kingController.resetPhase3));

export default router;
