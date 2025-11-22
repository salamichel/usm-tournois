import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAuthenticated } from '../middlewares/auth.middleware';
import * as matchController from '../controllers/match.controller';

const router = Router();

/**
 * @route   POST /api/matches/:tournamentId/:matchId/submit-scores
 * @desc    Submit match scores
 * @access  Private (Captain only)
 */
router.post('/:tournamentId/:matchId/submit-scores', isAuthenticated, asyncHandler(matchController.submitScores));

export default router;
