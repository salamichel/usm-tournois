/**
 * Player Ranking Controller
 * Handles player points and global ranking endpoints
 */

import { Request, Response } from 'express';
import { AppError } from '../middlewares/error.middleware';
import {
  getGlobalPlayerRankings,
  getPlayerStats,
  getTournamentPlayerPoints,
  recalculateAllGlobalRankings,
  getSeasonRankings,
} from '../services/playerPoints.service';
import type {
  PlayerRankingResponse,
  PlayerStatsResponse,
  TournamentPlayerPointsResponse,
} from '../../../shared/types/playerPoints.types';

/**
 * Get global player rankings
 * GET /api/players/ranking
 */
export const getPlayerRanking = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const { rankings, total } = await getGlobalPlayerRankings(limit, offset);

    const response: PlayerRankingResponse = {
      success: true,
      data: {
        rankings,
        total,
      },
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error getting player ranking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error getting player ranking', 500);
  }
};

/**
 * Get detailed statistics for a specific player
 * GET /api/players/:playerId/stats
 */
export const getPlayerStatistics = async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;

    const stats = await getPlayerStats(playerId);

    if (!stats) {
      throw new AppError('Player not found or has no tournament data', 404);
    }

    const response: PlayerStatsResponse = {
      success: true,
      data: {
        stats,
      },
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error getting player statistics:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error getting player statistics', 500);
  }
};

/**
 * Get all player points for a specific tournament
 * GET /api/tournaments/:tournamentId/player-points
 */
export const getTournamentPoints = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const points = await getTournamentPlayerPoints(tournamentId);

    const response: TournamentPlayerPointsResponse = {
      success: true,
      data: {
        points,
      },
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error getting tournament player points:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error getting tournament player points', 500);
  }
};

/**
 * Get rankings for a specific season
 * GET /api/players/ranking/season/:seasonId
 */
export const getSeasonRanking = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const { rankings, total } = await getSeasonRankings(seasonId, limit, offset);

    res.json({
      success: true,
      data: {
        rankings,
        total,
      },
    });
  } catch (error: any) {
    console.error('Error getting season ranking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error getting season ranking', 500);
  }
};

/**
 * Recalculate all global rankings (admin only)
 * POST /admin/players/recalculate-rankings
 */
export const recalculateRankings = async (req: Request, res: Response) => {
  try {
    await recalculateAllGlobalRankings();

    res.json({
      success: true,
      message: 'All global rankings recalculated successfully',
    });
  } catch (error: any) {
    console.error('Error recalculating rankings:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error recalculating rankings', 500);
  }
};
