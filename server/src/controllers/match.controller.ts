import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import {
  determineMatchResult,
  propagateEliminationMatchResults
} from '../services/match.service';

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

    // Check if ranking is frozen (tournament is finished)
    const finalRankingSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('finalRanking')
      .limit(1)
      .get();

    if (!finalRankingSnapshot.empty) {
      const firstRanking = finalRankingSnapshot.docs[0].data();
      if (firstRanking?.frozenAt) {
        throw new AppError(
          'Le classement est figé. Vous ne pouvez plus modifier les scores.',
          403
        );
      }
    }

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

    // Verify user is captain of either team1 or team2
    if (!matchData?.team1?.id || !matchData?.team2?.id) {
      throw new AppError('Match team information is incomplete', 400);
    }

    const team1Doc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(matchData.team1.id)
      .get();

    const team2Doc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(matchData.team2.id)
      .get();

    const isTeam1Captain = team1Doc.exists && team1Doc.data()?.captainId === userId;
    const isTeam2Captain = team2Doc.exists && team2Doc.data()?.captainId === userId;

    if (!isTeam1Captain && !isTeam2Captain) {
      throw new AppError(
        'Vous devez être le capitaine d\'une des équipes pour soumettre les scores',
        403
      );
    }

    // Get tournament configuration
    const setsToWin = matchType === 'pool'
      ? (tournament?.setsPerMatchPool || 1)
      : (tournament?.setsPerMatchElimination || 3);

    const pointsPerSet = matchType === 'pool'
      ? (tournament?.pointsPerSetPool || 21)
      : (tournament?.pointsPerSetElimination || 21);

    const tieBreakEnabled = matchType === 'pool'
      ? (tournament?.tieBreakEnabledPools || false)
      : (tournament?.tieBreakEnabledElimination || false);

    // Calculate match result using service function
    const matchResult = determineMatchResult(
      sets,
      setsToWin,
      pointsPerSet,
      tieBreakEnabled,
      matchData.team1.id,
      matchData.team2.id
    );

    // Prepare update object
    const updateData: any = {
      sets,
      setsWonTeam1: matchResult.setsWonTeam1,
      setsWonTeam2: matchResult.setsWonTeam2,
      status: matchResult.matchStatus,
      winnerId: matchResult.winnerId,
      loserId: matchResult.loserId,
      submittedBy: userId,
      submittedAt: new Date(),
      updatedAt: new Date(),
    };

    // If elimination match and completed, use batch for propagation
    if (matchType === 'elimination' && matchResult.matchStatus === 'completed') {
      const batch = adminDb.batch();

      // Update current match
      batch.update(matchRef, updateData);

      // Propagate results to next matches
      if (matchResult.winnerId && matchResult.loserId) {
        await propagateEliminationMatchResults(
          tournamentId,
          matchData,
          matchResult.winnerId,
          matchResult.winnerId === matchData.team1.id ? matchData.team1.name : matchData.team2.name,
          matchResult.loserId,
          matchResult.loserId === matchData.team1.id ? matchData.team1.name : matchData.team2.name,
          batch
        );
      }

      await batch.commit();
    } else {
      // Simple update for pool matches
      await matchRef.update(updateData);
    }

    res.json({
      success: true,
      message: 'Match scores submitted successfully',
      data: {
        status: matchResult.matchStatus,
        setsWonTeam1: matchResult.setsWonTeam1,
        setsWonTeam2: matchResult.setsWonTeam2,
        winnerId: matchResult.winnerId,
      },
    });
  } catch (error: any) {
    console.error('Error submitting scores:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error submitting scores', 500);
  }
};
