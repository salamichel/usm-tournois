import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAuthenticated } from '../middlewares/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

/**
 * @route   GET /api/users/me/dashboard
 * @desc    Get user dashboard data
 * @access  Private
 */
router.get('/me/dashboard', isAuthenticated, asyncHandler(userController.getUserDashboard));

/**
 * @route   GET /api/users/me/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/me/profile', isAuthenticated, asyncHandler(userController.getUserProfile));

/**
 * @route   PUT /api/users/me/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/me/profile', isAuthenticated, asyncHandler(userController.updateUserProfile));

export default router;
