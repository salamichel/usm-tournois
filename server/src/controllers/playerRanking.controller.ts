/**
 * Player Ranking Controller
 * Handles player points and global ranking endpoints
 */

import { Request, Response } from 'express';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';
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
  } catch (error) {
    handleControllerError(error, 'getting player ranking');
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
      ErrorHandlers.notFound('Player', playerId);
    }

    const response: PlayerStatsResponse = {
      success: true,
      data: {
        stats,
      },
    };

    res.json(response);
  } catch (error) {
    handleControllerError(error, 'getting player statistics');
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
  } catch (error) {
    handleControllerError(error, 'getting tournament player points');
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
  } catch (error) {
    handleControllerError(error, 'getting season ranking');
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
  } catch (error) {
    handleControllerError(error, 'recalculating rankings');
  }
};
