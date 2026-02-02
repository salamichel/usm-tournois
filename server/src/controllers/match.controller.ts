import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';
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
      ErrorHandlers.unauthorized('User not authenticated');
    }

    if (!sets || !Array.isArray(sets)) {
      ErrorHandlers.validation('Sets data is required and must be an array');
    }

    if (!matchType || (matchType !== 'pool' && matchType !== 'elimination')) {
      ErrorHandlers.validation('Invalid match type');
    }

    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
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
        ErrorHandlers.forbidden(
          'Le classement est figé. Vous ne pouvez plus modifier les scores.'
        );
      }
    }

    // Get match reference
    let matchRef;
    if (matchType === 'pool') {
      if (!poolId) {
        ErrorHandlers.validation('Pool ID is required for pool matches');
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
      ErrorHandlers.notFound('Match', matchId);
    }

    const matchData = matchDoc.data();

    // Verify user is captain of either team1 or team2
    if (!matchData?.team1?.id || !matchData?.team2?.id) {
      ErrorHandlers.validation('Match team information is incomplete');
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
      ErrorHandlers.forbidden(
        'Vous devez être le capitaine d\'une des équipes pour soumettre les scores'
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
    handleControllerError(error, 'submitting scores', 'Error submitting scores');
  }
};
