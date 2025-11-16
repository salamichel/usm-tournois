import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware.ts';
import { isAuthenticated } from '../middlewares/auth.middleware.ts';
import * as matchController from '../controllers/match.controller.ts';

const router = Router();

/**
 * @route   POST /api/matches/:matchId/submit-scores
 * @desc    Submit match scores
 * @access  Private (Captain only)
 */
router.post('/:matchId/submit-scores', isAuthenticated, asyncHandler(matchController.submitScores));

export default router;
