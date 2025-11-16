import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAuthenticated } from '../middlewares/auth.middleware';
import * as authController from '../controllers/auth.controller';

const router = Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Create new user account
 * @access  Public
 */
router.post('/signup', asyncHandler(authController.signup));

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', asyncHandler(authController.login));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', isAuthenticated, asyncHandler(authController.logout));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', isAuthenticated, asyncHandler(authController.getCurrentUser));

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', isAuthenticated, asyncHandler(authController.changePassword));

export default router;
