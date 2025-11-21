/**
 * Player Ranking Routes
 * Routes for player points and global ranking
 */

import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { optionalAuth } from '../middlewares/auth.middleware';
import * as playerRankingController from '../controllers/playerRanking.controller';

const router = Router();

/**
 * @route   GET /api/players/ranking
 * @desc    Get global player rankings
 * @access  Public
 */
router.get('/ranking', optionalAuth, asyncHandler(playerRankingController.getPlayerRanking));

/**
 * @route   GET /api/players/ranking/season/:seasonId
 * @desc    Get rankings for a specific season
 * @access  Public
 */
router.get('/ranking/season/:seasonId', optionalAuth, asyncHandler(playerRankingController.getSeasonRanking));

/**
 * @route   GET /api/players/:playerId/stats
 * @desc    Get detailed statistics for a specific player
 * @access  Public
 */
router.get('/:playerId/stats', optionalAuth, asyncHandler(playerRankingController.getPlayerStatistics));

export default router;
