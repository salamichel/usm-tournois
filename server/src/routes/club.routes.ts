import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import { isAdmin } from '../middlewares/auth.middleware';
import { uploadClubLogo } from '../middlewares/upload.middleware';
import * as clubController from '../controllers/club.controller';

const router = Router();

/**
 * Public routes - Anyone can view clubs
 */
router.get('/', asyncHandler(clubController.getAllClubs));
router.get('/:id', asyncHandler(clubController.getClubById));

/**
 * Admin routes - Require admin authentication
 */
router.post('/', isAdmin, uploadClubLogo, asyncHandler(clubController.createClub));
router.put('/:id', isAdmin, uploadClubLogo, asyncHandler(clubController.updateClub));
router.delete('/:id', isAdmin, asyncHandler(clubController.deleteClub));
router.get('/:id/players', isAdmin, asyncHandler(clubController.getClubPlayers));

export default router;
