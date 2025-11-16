import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';

export const submitScores = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    const { tournamentId, matchId } = req.params;
    const { sets, matchType, poolId } = req.body;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    if (!sets || !Array.isArray(sets)) {
      throw new AppError('Sets data is required and must be an array', 400);
    }

    if (!matchType || (matchType !== 'pool' && matchType !== 'elimination')) {
      throw new AppError('Invalid match type', 400);
    }

    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();

    // Get match reference
    let matchRef;
    if (matchType === 'pool') {
      if (!poolId) {
        throw new AppError('Pool ID is required for pool matches', 400);
      }
      matchRef = adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('pools')
        .doc(poolId)
        .collection('matches')
        .doc(matchId);
    } else {
      matchRef = adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('eliminationMatches')
        .doc(matchId);
    }

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      throw new AppError('Match not found', 404);
    }

    const matchData = matchDoc.data();

    // Verify user is captain of team1
    if (!matchData?.team1?.id) {
      throw new AppError('Match team information is incomplete', 400);
    }

    const team1Doc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(matchData.team1.id)
      .get();

    if (!team1Doc.exists || team1Doc.data()?.captainId !== userId) {
      throw new AppError('You are not authorized to submit scores for this match', 403);
    }

    // Calculate match result
    const setsToWin = matchType === 'pool'
      ? (tournament?.setsPerMatchPool || 1)
      : (tournament?.setsPerMatchElimination || 3);

    let setsWonTeam1 = 0;
    let setsWonTeam2 = 0;

    sets.forEach((set: any) => {
      if (set.score1 > set.score2) {
        setsWonTeam1++;
      } else if (set.score2 > set.score1) {
        setsWonTeam2++;
      }
    });

    let matchStatus = 'in_progress';
    let winnerId = null;
    let loserId = null;

    if (setsWonTeam1 >= setsToWin || setsWonTeam2 >= setsToWin) {
      matchStatus = 'completed';
      if (setsWonTeam1 > setsWonTeam2) {
        winnerId = matchData.team1.id;
        loserId = matchData.team2?.id || null;
      } else {
        winnerId = matchData.team2?.id || null;
        loserId = matchData.team1.id;
      }
    }

    // Update match
    await matchRef.update({
      sets,
      setsWonTeam1,
      setsWonTeam2,
      status: matchStatus,
      winnerId,
      loserId,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Match scores submitted successfully',
      data: {
        status: matchStatus,
        setsWonTeam1,
        setsWonTeam2,
        winnerId,
      },
    });
  } catch (error: any) {
    console.error('Error submitting scores:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error submitting scores', 500);
  }
};
