import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAdmin, optionalAuth } from '../middlewares/auth.middleware';
import * as seasonController from '../controllers/season.controller';

const router = Router();

/**
 * Public routes (no auth required)
 */
router.get('/', asyncHandler(seasonController.getAllSeasons));
router.get('/active', asyncHandler(seasonController.getActiveSeason));
router.get('/:seasonId', asyncHandler(seasonController.getSeasonById));

/**
 * Admin routes (require admin auth)
 */
router.post('/', isAdmin, asyncHandler(seasonController.createSeason));
router.put('/:seasonId', isAdmin, asyncHandler(seasonController.updateSeason));
router.delete('/:seasonId', isAdmin, asyncHandler(seasonController.deleteSeason));

export default router;
