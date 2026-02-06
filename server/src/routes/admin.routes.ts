import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAdmin } from '../middlewares/auth.middleware';
import { getTournament } from '../middlewares/tournament.middleware';
import { uploadCoverImage } from '../middlewares/upload.middleware';
import * as tournamentController from '../controllers/admin.tournament.controller';
import * as poolController from '../controllers/admin.pool.controller';
import * as eliminationController from '../controllers/admin.elimination.controller';
import * as teamController from '../controllers/admin.team.controller';
import * as userController from '../controllers/admin.user.controller';
import * as unassignedPlayersController from '../controllers/admin.unassigned-players.controller';
import * as virtualUsersController from '../controllers/admin.virtual-users.controller';
import * as dashboardController from '../controllers/admin.dashboard.controller';
import * as kingController from '../controllers/king.controller';
import * as playerRankingController from '../controllers/playerRanking.controller';

const router = Router();

// All routes require admin authentication
router.use(isAdmin);

/**
 * Tournament Management
 */
router.get('/tournaments', asyncHandler(tournamentController.getAllTournaments));
router.post('/tournaments', uploadCoverImage, asyncHandler(tournamentController.createTournament));
router.get('/tournaments/:id', asyncHandler(tournamentController.getTournamentById));
router.put('/tournaments/:id', uploadCoverImage, asyncHandler(tournamentController.updateTournament));
router.delete('/tournaments/:id', asyncHandler(tournamentController.deleteTournament));
router.post('/tournaments/:id/clone', asyncHandler(tournamentController.cloneTournament));

/**
 * Pool Management
 */
router.get('/tournaments/:tournamentId/pools', asyncHandler(poolController.getPools));
router.post('/tournaments/:tournamentId/pools', asyncHandler(poolController.createPool));
router.put('/tournaments/:tournamentId/pools/:poolId', asyncHandler(poolController.updatePoolName));
router.delete('/tournaments/:tournamentId/pools/:poolId', asyncHandler(poolController.deletePool));
router.post('/tournaments/:tournamentId/pools/:poolId/assign-teams', asyncHandler(poolController.assignTeamsToPool));
router.post('/tournaments/:tournamentId/pools/:poolId/generate-matches', asyncHandler(poolController.generatePoolMatches));
router.post('/tournaments/:tournamentId/pools/distribute-teams', asyncHandler(poolController.distributeTeamsToPoolsAutomatically));

/**
 * Elimination Management
 */
router.get('/tournaments/:tournamentId/elimination', asyncHandler(eliminationController.getEliminationMatches));
router.post('/tournaments/:tournamentId/generate-elimination', asyncHandler(eliminationController.generateEliminationBracket));
router.post('/tournaments/:tournamentId/freeze-ranking', asyncHandler(eliminationController.freezeRanking));
router.post('/tournaments/:tournamentId/freeze-elimination-ranking', asyncHandler(eliminationController.freezeEliminationRanking));
router.put('/tournaments/:tournamentId/elimination/:matchId/teams', asyncHandler(eliminationController.updateEliminationMatchTeams));

/**
 * Match Score Management
 */
router.post('/tournaments/:tournamentId/pools/:poolId/matches/:matchId/update-score', asyncHandler(poolController.updatePoolMatchScore));
router.post('/tournaments/:tournamentId/elimination/:matchId/update-score', asyncHandler(eliminationController.updateEliminationMatchScore));

/**
 * Round Schedule Management
 */
router.get('/tournaments/:tournamentId/round-schedule', asyncHandler(poolController.getRoundSchedule));
router.post('/tournaments/:tournamentId/generate-round-schedule', asyncHandler(poolController.generateRoundSchedule));
router.put('/tournaments/:tournamentId/round-schedule', asyncHandler(poolController.bulkUpdateMatchSchedules));
router.delete('/tournaments/:tournamentId/round-schedule', asyncHandler(poolController.clearRoundSchedule));
router.put('/tournaments/:tournamentId/pools/:poolId/matches/:matchId/schedule', asyncHandler(poolController.updateMatchSchedule));

/**
 * Team Management
 */
router.get('/tournaments/:tournamentId/teams', asyncHandler(teamController.getTeams));
router.post('/tournaments/:tournamentId/teams', asyncHandler(teamController.createTeam));
router.put('/tournaments/:tournamentId/teams/:teamId', asyncHandler(teamController.updateTeam));
router.delete('/tournaments/:tournamentId/teams/:teamId', asyncHandler(teamController.deleteTeam));
router.post('/tournaments/:tournamentId/generate-random-teams', asyncHandler(teamController.generateRandomTeams));
router.post('/tournaments/:tournamentId/teams/recalculate-ranking', asyncHandler(teamController.recalculateTeamsRanking));

/**
 * User Management
 */
router.get('/users', asyncHandler(userController.getAllUsers));
router.post('/users', asyncHandler(userController.createUser));
router.post('/users/bulk-update', asyncHandler(userController.bulkUpdateUsers));
router.get('/users/:id', asyncHandler(userController.getUserById));
router.put('/users/:id', asyncHandler(userController.updateUser));
router.delete('/users/:id', asyncHandler(userController.deleteUser));

/**
 * Unassigned Players Management
 */
router.get('/tournaments/:tournamentId/unassigned-players', asyncHandler(unassignedPlayersController.getUnassignedPlayers));
router.post('/tournaments/:tournamentId/unassigned-players', asyncHandler(unassignedPlayersController.addUnassignedPlayer));
router.put('/tournaments/:tournamentId/unassigned-players/:userId', asyncHandler(unassignedPlayersController.updateUnassignedPlayer));
router.delete('/tournaments/:tournamentId/unassigned-players/:userId', asyncHandler(unassignedPlayersController.removeUnassignedPlayer));

/**
 * Dashboard
 */
router.get('/dashboard', asyncHandler(dashboardController.getDashboard));

/**
 * Virtual Accounts Management
 */
router.get('/virtual-users', asyncHandler(virtualUsersController.getAllVirtualUsers));
router.post('/virtual-users/link', asyncHandler(virtualUsersController.linkVirtualToRealUser));
router.delete('/virtual-users/:userId', asyncHandler(virtualUsersController.deleteVirtualUser));

/**
 * King Mode Management
 */
router.get('/tournaments/:tournamentId/king', asyncHandler(getTournament), asyncHandler(kingController.getKingDashboard));
router.post('/tournaments/:tournamentId/king/start-phase-1', asyncHandler(getTournament), asyncHandler(kingController.startKingPhase1));
router.post('/tournaments/:tournamentId/king/start-phase-2', asyncHandler(getTournament), asyncHandler(kingController.startKingPhase2));
router.post('/tournaments/:tournamentId/king/start-phase-3', asyncHandler(getTournament), asyncHandler(kingController.startKingPhase3));
router.post('/tournaments/:tournamentId/king/matches/:matchId/record-result', asyncHandler(getTournament), asyncHandler(kingController.recordKingMatchResult));
router.post('/tournaments/:tournamentId/king/reset-phase-1', asyncHandler(getTournament), asyncHandler(kingController.resetKingPhase1));
router.post('/tournaments/:tournamentId/king/reset-phase-2', asyncHandler(getTournament), asyncHandler(kingController.resetKingPhase2));
router.post('/tournaments/:tournamentId/king/reset-phase-3', asyncHandler(getTournament), asyncHandler(kingController.resetKingPhase3));
router.post('/tournaments/:tournamentId/king/set-all-matches-scores', asyncHandler(getTournament), asyncHandler(kingController.setAllKingMatchesScores));

/**
 * Player Ranking Management
 */
router.post('/players/recalculate-rankings', asyncHandler(playerRankingController.recalculateRankings));
router.get('/tournaments/:tournamentId/player-points', asyncHandler(playerRankingController.getTournamentPoints));

export default router;
