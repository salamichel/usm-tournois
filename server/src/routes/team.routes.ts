import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAuthenticated } from '../middlewares/auth.middleware';
import * as teamController from '../controllers/team.controller';

const router = Router();

// ============================================
// LIST & SEARCH ROUTES
// ============================================

/**
 * @route   GET /api/teams
 * @desc    Get all teams for a tournament with filters and pagination
 * @access  Private
 * @query   tournamentId (required), search, poolId, recruitmentOpen, minMembers, maxMembers, page, limit
 */
router.get('/', isAuthenticated, asyncHandler(teamController.getAllTeams));

/**
 * @route   GET /api/teams/search
 * @desc    Search teams by name or member
 * @access  Private
 * @query   tournamentId (required), query (required)
 */
router.get('/search', isAuthenticated, asyncHandler(teamController.searchTeams));

/**
 * @route   GET /api/teams/available-players
 * @desc    Get available players (unassigned to any team)
 * @access  Private
 * @query   tournamentId (required)
 */
router.get('/available-players', isAuthenticated, asyncHandler(teamController.getAvailablePlayers));

/**
 * @route   GET /api/teams/check-eligibility
 * @desc    Check if a user is eligible to join a team
 * @access  Private
 * @query   tournamentId (required), userId (required), teamId (optional)
 */
router.get('/check-eligibility', isAuthenticated, asyncHandler(teamController.checkEligibility));

// ============================================
// TEAM CRUD ROUTES
// ============================================

/**
 * @route   POST /api/teams
 * @desc    Create a new team
 * @access  Private
 * @body    tournamentId, name, recruitmentOpen (optional)
 */
router.post('/', isAuthenticated, asyncHandler(teamController.createTeam));

/**
 * @route   GET /api/teams/:id
 * @desc    Get team details
 * @access  Private
 * @query   tournamentId (required)
 */
router.get('/:id', isAuthenticated, asyncHandler(teamController.getTeamById));

/**
 * @route   GET /api/teams/:id/details
 * @desc    Get team with full member details
 * @access  Private
 * @query   tournamentId (required)
 */
router.get('/:id/details', isAuthenticated, asyncHandler(teamController.getTeamDetails));

/**
 * @route   PUT /api/teams/:id/settings
 * @desc    Update team settings
 * @access  Private (Captain only)
 * @body    tournamentId, teamName (optional), recruitmentOpen (optional)
 */
router.put('/:id/settings', isAuthenticated, asyncHandler(teamController.updateTeamSettings));

/**
 * @route   DELETE /api/teams/:id
 * @desc    Delete team
 * @access  Private (Captain only)
 * @body    tournamentId
 */
router.delete('/:id', isAuthenticated, asyncHandler(teamController.deleteTeam));

// ============================================
// TEAM STATISTICS & HISTORY ROUTES
// ============================================

/**
 * @route   GET /api/teams/:id/stats
 * @desc    Get team statistics (wins, losses, points, etc.)
 * @access  Private
 * @query   tournamentId (required)
 */
router.get('/:id/stats', isAuthenticated, asyncHandler(teamController.getTeamStats));

/**
 * @route   GET /api/teams/:id/history
 * @desc    Get team match history
 * @access  Private
 * @query   tournamentId (required)
 */
router.get('/:id/history', isAuthenticated, asyncHandler(teamController.getTeamHistory));

/**
 * @route   GET /api/teams/:id/validate
 * @desc    Validate team composition
 * @access  Private
 * @query   tournamentId (required)
 */
router.get('/:id/validate', isAuthenticated, asyncHandler(teamController.validateTeam));

// ============================================
// MEMBER MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/teams/:id/members
 * @desc    Add member to team
 * @access  Private (Captain only)
 * @body    tournamentId, memberId
 */
router.post('/:id/members', isAuthenticated, asyncHandler(teamController.addMember));

/**
 * @route   POST /api/teams/:id/members/batch
 * @desc    Add multiple members to team
 * @access  Private (Captain only)
 * @body    tournamentId, memberIds (array)
 */
router.post('/:id/members/batch', isAuthenticated, asyncHandler(teamController.batchAddMembers));

/**
 * @route   DELETE /api/teams/:id/members/:userId
 * @desc    Remove member from team
 * @access  Private (Captain only)
 * @body    tournamentId, memberId
 */
router.delete('/:id/members/:userId', isAuthenticated, asyncHandler(teamController.removeMember));

/**
 * @route   DELETE /api/teams/:id/members/batch
 * @desc    Remove multiple members from team
 * @access  Private (Captain only)
 * @body    tournamentId, memberIds (array)
 */
router.delete('/:id/members/batch', isAuthenticated, asyncHandler(teamController.batchRemoveMembers));

/**
 * @route   POST /api/teams/:id/virtual-member
 * @desc    Add virtual member to team
 * @access  Private (Captain only)
 * @body    tournamentId, pseudo, level, email (optional)
 */
router.post('/:id/virtual-member', isAuthenticated, asyncHandler(teamController.addVirtualMember));

// ============================================
// CAPTAIN MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/teams/:id/transfer-captain
 * @desc    Transfer captainship to another member
 * @access  Private (Captain only)
 * @body    tournamentId, newCaptainId
 */
router.post('/:id/transfer-captain', isAuthenticated, asyncHandler(teamController.transferCaptain));

export default router;
