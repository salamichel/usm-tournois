import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAuthenticated } from '../middlewares/auth.middleware';
import * as teamController from '../controllers/team.controller';

const router = Router();

/**
 * @route   GET /api/teams/:id
 * @desc    Get team details
 * @access  Private
 */
router.get('/:id', isAuthenticated, asyncHandler(teamController.getTeamById));

/**
 * @route   PUT /api/teams/:id/settings
 * @desc    Update team settings
 * @access  Private (Captain only)
 */
router.put('/:id/settings', isAuthenticated, asyncHandler(teamController.updateTeamSettings));

/**
 * @route   POST /api/teams/:id/members
 * @desc    Add member to team
 * @access  Private (Captain only)
 */
router.post('/:id/members', isAuthenticated, asyncHandler(teamController.addMember));

/**
 * @route   DELETE /api/teams/:id/members/:userId
 * @desc    Remove member from team
 * @access  Private (Captain only)
 */
router.delete('/:id/members/:userId', isAuthenticated, asyncHandler(teamController.removeMember));

/**
 * @route   POST /api/teams/:id/virtual-member
 * @desc    Add virtual member to team
 * @access  Private (Captain only)
 */
router.post('/:id/virtual-member', isAuthenticated, asyncHandler(teamController.addVirtualMember));

export default router;
