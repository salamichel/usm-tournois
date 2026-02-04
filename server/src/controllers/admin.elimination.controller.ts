/**
 * Elimination Management Controller
 */

import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';
import { convertTimestamps } from '../utils/firestore.utils';
import { calculateMatchOutcome, propagateEliminationMatchResults } from '../services/match.service';
import {
  generateEliminationBracket as generateEliminationBracketService,
  generateDoubleBracket,
  QualifiedTeam,
  QualifiedTeamWithRank,
  EliminationTournamentConfig
} from '../services/elimination.service';
import { awardPointsToTeam, deleteTournamentPoints, updateGlobalRankings, getPointsForRank } from '../services/playerPoints.service';

export const getEliminationMatches = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const eliminationMatchesSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .orderBy('round')
      .orderBy('matchNumber')
      .get();

    // Fetch all teams to get player information
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    const teamsMap: Record<string, any> = {};
    const teamsByName: Record<string, any> = {};
    teamsSnapshot.docs.forEach((doc) => {
      const teamData = doc.data();
      const teamObj = {
        id: doc.id,
        name: teamData.name,
        members: teamData.members || [],
      };
      teamsMap[doc.id] = teamObj;
      // Also index by name for fallback matching
      teamsByName[teamData.name] = teamObj;
    });

    // Enrich matches with player information
    const matches = eliminationMatchesSnapshot.docs.map((doc) => {
      const matchData = doc.data();
      const enrichedMatch: any = convertTimestamps({
        id: doc.id,
        ...matchData,
      });

      // Add players to team1 (try by ID first, then by name)
      if (enrichedMatch.team1?.id && teamsMap[enrichedMatch.team1.id]) {
        enrichedMatch.team1.members = teamsMap[enrichedMatch.team1.id].members;
      } else if (enrichedMatch.team1?.name && teamsByName[enrichedMatch.team1.name]) {
        enrichedMatch.team1.members = teamsByName[enrichedMatch.team1.name].members;
      }

      // Add players to team2 (try by ID first, then by name)
      if (enrichedMatch.team2?.id && teamsMap[enrichedMatch.team2.id]) {
        enrichedMatch.team2.members = teamsMap[enrichedMatch.team2.id].members;
      } else if (enrichedMatch.team2?.name && teamsByName[enrichedMatch.team2.name]) {
        enrichedMatch.team2.members = teamsByName[enrichedMatch.team2.name].members;
      }

      return enrichedMatch;
    });

    // Also fetch final ranking
    const finalRankingSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('finalRanking')
      .orderBy('rank')
      .get();

    const finalRanking = finalRankingSnapshot.docs.map((doc) =>
      convertTimestamps({
        id: doc.id,
        ...doc.data(),
      })
    );

    res.json({
      success: true,
      data: { matches, finalRanking },
    });
  } catch (error) {
    handleControllerError(error, 'retrieving elimination matches', 'Error retrieving elimination matches', 500);
  }
};

export const generateEliminationBracket = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { qualifiedTeamIds, bracketType } = req.body; // bracketType: 'single' (default) or 'double'

    // Get tournament configuration
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournament = tournamentDoc.data();

    if (!tournament?.eliminationPhaseEnabled) {
      ErrorHandlers.validation('Elimination phase is not enabled for this tournament');
    }

    // Get all pools and their rankings
    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    let qualifiedTeams: QualifiedTeam[] = [];

    if (qualifiedTeamIds && Array.isArray(qualifiedTeamIds) && qualifiedTeamIds.length > 0) {
      // Mode manuel : utiliser les équipes sélectionnées par l'admin
      console.log(`Manual mode: ${qualifiedTeamIds.length} teams selected`);

      for (const poolDoc of poolsSnapshot.docs) {
        const poolData = poolDoc.data();
        const poolTeams = poolData.teams || [];

        // Get matches for ranking calculation
        const matchesSnapshot = await adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('pools')
          .doc(poolDoc.id)
          .collection('matches')
          .get();

        const matches = matchesSnapshot.docs.map((doc) => doc.data());

        // Calculate stats for all teams in this pool
        const teamStats: any = {};
        poolTeams.forEach((team: any) => {
          teamStats[team.id] = {
            id: team.id,
            name: team.name,
            poolName: poolData.name,
            wins: 0,
            points: 0,
            setsWon: 0,
            setsLost: 0,
          };
        });

        matches.forEach((match: any) => {
          if (match.status === 'completed') {
            const team1Id = match.team1?.id;
            const team2Id = match.team2?.id;
            const setsWonTeam1 = match.setsWonTeam1 || 0;
            const setsWonTeam2 = match.setsWonTeam2 || 0;

            if (team1Id && teamStats[team1Id]) {
              teamStats[team1Id].setsWon += setsWonTeam1;
              teamStats[team1Id].setsLost += setsWonTeam2;
              if (setsWonTeam1 > setsWonTeam2) {
                teamStats[team1Id].wins++;
                teamStats[team1Id].points += 3;
              }
            }

            if (team2Id && teamStats[team2Id]) {
              teamStats[team2Id].setsWon += setsWonTeam2;
              teamStats[team2Id].setsLost += setsWonTeam1;
              if (setsWonTeam2 > setsWonTeam1) {
                teamStats[team2Id].wins++;
                teamStats[team2Id].points += 3;
              }
            }
          }
        });

        // Only keep teams that are in the qualifiedTeamIds list
        const selectedTeams = Object.values(teamStats).filter((t: any) => qualifiedTeamIds.includes(t.id));
        qualifiedTeams.push(...selectedTeams.map((t: any) => ({
          id: t.id,
          name: t.name,
          poolName: t.poolName,
          points: t.points,
          setsWon: t.setsWon,
          setsLost: t.setsLost,
        })));
      }
    } else {
      // Mode automatique (rétro-compatibilité) : utiliser teamsQualifiedPerPool
      console.log('Automatic mode: using teamsQualifiedPerPool');
      const teamsQualifiedPerPool = tournament.teamsQualifiedPerPool || 2;

      for (const poolDoc of poolsSnapshot.docs) {
        const poolData = poolDoc.data();
        const poolTeams = poolData.teams || [];

        // Get matches for ranking calculation
        const matchesSnapshot = await adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('pools')
          .doc(poolDoc.id)
          .collection('matches')
          .get();

        const matches = matchesSnapshot.docs.map((doc) => doc.data());

        // Simple ranking calculation
        const teamStats: any = {};
        poolTeams.forEach((team: any) => {
          teamStats[team.id] = {
            id: team.id,
            name: team.name,
            poolName: poolData.name,
            wins: 0,
            points: 0,
            setsWon: 0,
            setsLost: 0,
          };
        });

        matches.forEach((match: any) => {
          if (match.status === 'completed') {
            const team1Id = match.team1?.id;
            const team2Id = match.team2?.id;
            const setsWonTeam1 = match.setsWonTeam1 || 0;
            const setsWonTeam2 = match.setsWonTeam2 || 0;

            if (team1Id && teamStats[team1Id]) {
              teamStats[team1Id].setsWon += setsWonTeam1;
              teamStats[team1Id].setsLost += setsWonTeam2;
              if (setsWonTeam1 > setsWonTeam2) {
                teamStats[team1Id].wins++;
                teamStats[team1Id].points += 3;
              }
            }

            if (team2Id && teamStats[team2Id]) {
              teamStats[team2Id].setsWon += setsWonTeam2;
              teamStats[team2Id].setsLost += setsWonTeam1;
              if (setsWonTeam2 > setsWonTeam1) {
                teamStats[team2Id].wins++;
                teamStats[team2Id].points += 3;
              }
            }
          }
        });

        // Sort teams by ranking
        const rankedTeams = Object.values(teamStats).sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
          return a.setsLost - b.setsLost;
        });

        // Take top teams
        const topTeams = rankedTeams.slice(0, teamsQualifiedPerPool);
        qualifiedTeams.push(...topTeams.map((t: any) => ({
          id: t.id,
          name: t.name,
          poolName: t.poolName,
        })));
      }
    }

    if (qualifiedTeams.length < 2) {
      ErrorHandlers.validation('At least 2 qualified teams are required to generate elimination bracket');
    }

    // Sort all qualified teams by their stats
    // Re-fetch stats for global sorting
    const allTeamStats: any = {};
    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data();
      const poolTeams = poolData.teams || [];

      const matchesSnapshot = await adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('pools')
        .doc(poolDoc.id)
        .collection('matches')
        .get();

      const matches = matchesSnapshot.docs.map((doc) => doc.data());

      poolTeams.forEach((team: any) => {
        allTeamStats[team.id] = {
          id: team.id,
          name: team.name,
          poolName: poolData.name,
          wins: 0,
          points: 0,
          setsWon: 0,
          setsLost: 0,
        };
      });

      matches.forEach((match: any) => {
        if (match.status === 'completed') {
          const team1Id = match.team1?.id;
          const team2Id = match.team2?.id;
          const setsWonTeam1 = match.setsWonTeam1 || 0;
          const setsWonTeam2 = match.setsWonTeam2 || 0;

          if (team1Id && allTeamStats[team1Id]) {
            allTeamStats[team1Id].setsWon += setsWonTeam1;
            allTeamStats[team1Id].setsLost += setsWonTeam2;
            if (setsWonTeam1 > setsWonTeam2) {
              allTeamStats[team1Id].wins++;
              allTeamStats[team1Id].points += 3;
            }
          }

          if (team2Id && allTeamStats[team2Id]) {
            allTeamStats[team2Id].setsWon += setsWonTeam2;
            allTeamStats[team2Id].setsLost += setsWonTeam1;
            if (setsWonTeam2 > setsWonTeam1) {
              allTeamStats[team2Id].wins++;
              allTeamStats[team2Id].points += 3;
            }
          }
        }
      });
    }

    // Sort qualified teams globally by stats
    qualifiedTeams.sort((a, b) => {
      const statsA = allTeamStats[a.id] || { points: 0, setsWon: 0, setsLost: 0 };
      const statsB = allTeamStats[b.id] || { points: 0, setsWon: 0, setsLost: 0 };
      if (statsB.points !== statsA.points) return statsB.points - statsA.points;
      if (statsB.setsWon !== statsA.setsWon) return statsB.setsWon - statsA.setsWon;
      return statsA.setsLost - statsB.setsLost;
    });

    // Prepare tournament configuration for the service
    const tournamentConfig: EliminationTournamentConfig = {
      setsPerMatchElimination: tournament.setsPerMatchElimination || 3,
      pointsPerSetElimination: tournament.pointsPerSetElimination || 21,
      tieBreakEnabledElimination: tournament.tieBreakEnabledElimination || false,
    };

    let generatedMatches: any[];
    const useBracketType = bracketType || tournament.bracketType || 'single';

    if (useBracketType === 'double') {
      // Double bracket: main + consolation
      console.log('Generating double bracket (main + consolation)');

      // Calculate pool rank for each team
      const teamsWithRank: QualifiedTeamWithRank[] = [];

      // Group qualified teams by pool and assign ranks
      const teamsByPool: { [poolName: string]: any[] } = {};
      qualifiedTeams.forEach((team: any) => {
        const poolName = team.poolName || 'Unknown';
        if (!teamsByPool[poolName]) {
          teamsByPool[poolName] = [];
        }
        const stats = allTeamStats[team.id] || { points: 0, setsWon: 0, setsLost: 0 };
        teamsByPool[poolName].push({ ...team, ...stats });
      });

      // Sort each pool and assign ranks
      Object.keys(teamsByPool).forEach(poolName => {
        teamsByPool[poolName].sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
          return a.setsLost - b.setsLost;
        });

        teamsByPool[poolName].forEach((team: any, index: number) => {
          teamsWithRank.push({
            id: team.id,
            name: team.name,
            poolName: team.poolName,
            poolRank: index + 1, // 1-based rank
          });
        });
      });

      // Determine teams per pool for splitting
      const poolSizes = Object.values(teamsByPool).map(teams => teams.length);
      const maxTeamsPerPool = Math.max(...poolSizes);

      const doubleBracketResult = generateDoubleBracket(teamsWithRank, tournamentConfig, maxTeamsPerPool);
      generatedMatches = doubleBracketResult.allMatches;

      console.log(`Double bracket generated: ${doubleBracketResult.mainBracket.length} main matches, ${doubleBracketResult.consolationBracket.length} consolation matches`);
    } else {
      // Single bracket (default)
      console.log('Generating single bracket');
      generatedMatches = generateEliminationBracketService(qualifiedTeams, tournamentConfig);
    }

    if (generatedMatches.length === 0) {
      ErrorHandlers.validation('No matches could be generated. Please check your tournament configuration.');
    }

    // Save matches to Firestore
    const batch = adminDb.batch();
    const eliminationMatchesRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches');

    // Delete old elimination matches
    const oldMatchesSnapshot = await eliminationMatchesRef.get();
    oldMatchesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Add new matches
    for (const match of generatedMatches) {
      const matchRef = eliminationMatchesRef.doc(match.id || undefined);
      // Cast to any to access service-specific fields not in shared type
      const matchAny = match as any;
      // Remove undefined values and use the document ID
      const matchData: any = {
        matchNumber: match.matchNumber,
        round: match.round,
        team1: match.team1,
        team2: match.team2,
        sets: match.sets,
        status: match.status,
        type: 'elimination',
        setsToWin: match.setsToWin,
        pointsPerSet: match.pointsPerSet,
        tieBreakEnabled: match.tieBreakEnabled,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      };
      // Add optional fields for match progression
      if (match.nextMatchId) matchData.nextMatchId = match.nextMatchId;
      if (matchAny.nextMatchTeamSlot) matchData.nextMatchTeamSlot = matchAny.nextMatchTeamSlot;
      if (matchAny.nextMatchLoserId) matchData.nextMatchLoserId = matchAny.nextMatchLoserId;
      if (matchAny.nextMatchLoserTeamSlot) matchData.nextMatchLoserTeamSlot = matchAny.nextMatchLoserTeamSlot;
      // Add bracket side for double bracket tournaments
      if (matchAny.bracket) matchData.bracket = matchAny.bracket;

      batch.set(matchRef, matchData);
    }

    await batch.commit();

    const bracketTypeLabel = useBracketType === 'double' ? 'double (principal + consolante)' : 'simple';
    res.json({
      success: true,
      message: `Tableau ${bracketTypeLabel} généré avec succès: ${generatedMatches.length} matchs pour ${qualifiedTeams.length} équipes`,
      bracketType: useBracketType,
      matchCount: generatedMatches.length,
      teamCount: qualifiedTeams.length,
    });
  } catch (error: any) {
    handleControllerError(error, 'generating elimination bracket', 'Error generating elimination bracket', 500);
  }
};

export const freezeRanking = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { finalRanking } = req.body;

    if (!finalRanking || !Array.isArray(finalRanking)) {
      ErrorHandlers.validation('Invalid final ranking data');
    }

    // Get tournament data for name and date
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }
    const tournament = tournamentDoc.data();
    const tournamentName = tournament?.name || 'Tournoi';
    const tournamentDate = tournament?.date?.toDate() || new Date();

    const batch = adminDb.batch();
    const finalRankingCollectionRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('finalRanking');

    // Delete old ranking
    const existingRankingSnapshot = await finalRankingCollectionRef.get();
    existingRankingSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete existing tournament points (allows re-freeze)
    const affectedPlayerIds = await deleteTournamentPoints(tournamentId);

    // Add new ranking
    finalRanking.forEach((teamEntry: any, index: number) => {
      const teamName = teamEntry[0];
      const stats = teamEntry[1];

      const rankData = {
        rank: index + 1,
        teamName,
        teamData: stats.team || {},
        matchesPlayed: stats.matchesPlayed || 0,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        setsWon: stats.setsWon || 0,
        setsLost: stats.setsLost || 0,
        pointsScored: stats.pointsScored || 0,
        pointsConceded: stats.pointsConceded || 0,
        pointsRatio:
          stats.pointsConceded > 0
            ? (stats.pointsScored / stats.pointsConceded).toFixed(2)
            : stats.pointsScored > 0
            ? 'Inf.'
            : '0.00',
        bonusPoints: stats.bonusPoints || 0,
        points: stats.points || 0,
        frozenAt: new Date(),
      };

      batch.set(finalRankingCollectionRef.doc(), rankData);
    });

    await batch.commit();

    // Award points to each team based on their final ranking
    const newAffectedPlayerIds: string[] = [...affectedPlayerIds];

    for (let i = 0; i < finalRanking.length; i++) {
      const teamEntry = finalRanking[i];
      const stats = teamEntry[1];
      const teamData = stats.team || {};
      const rank = i + 1;

      if (teamData.members && Array.isArray(teamData.members) && teamData.members.length > 0) {
        await awardPointsToTeam(
          tournamentId,
          tournamentName,
          tournamentDate,
          teamData.name || 'Équipe',
          teamData.members,
          rank
        );

        // Add non-virtual member IDs to affected list
        teamData.members.forEach((member: any) => {
          if (!member.isVirtual && !newAffectedPlayerIds.includes(member.userId)) {
            newAffectedPlayerIds.push(member.userId);
          }
        });
      }
    }

    // Update global rankings for all affected players
    if (newAffectedPlayerIds.length > 0) {
      await updateGlobalRankings(newAffectedPlayerIds);
    }

    // Update tournament status to frozen
    await adminDb.collection('events').doc(tournamentId).update({
      status: 'frozen',
      isFrozen: true,
      frozenAt: new Date()
    });

    console.log(`✅ Frozen pool tournament ${tournamentId}: ${newAffectedPlayerIds.length} players awarded points`);

    res.json({
      success: true,
      message: `Final ranking frozen successfully. ${newAffectedPlayerIds.length} joueurs ont reçu leurs points.`,
    });
  } catch (error: any) {
    handleControllerError(error, 'freezing ranking', 'Error freezing ranking', 500);
  }
};

/**
 * Helper function to build ranking from a single bracket (main or consolation)
 * @param matches Array of matches from the bracket
 * @param startRank Starting rank for this bracket
 * @returns Array of ranked teams
 */
function buildBracketRanking(matches: any[], startRank: number): any[] {
  const ranking: any[] = [];
  const rankedTeamIds = new Set<string>();

  // Find finale and 3rd place match
  const finale = matches.find((m: any) => m.round === 'Finale');
  const thirdPlaceMatch = matches.find((m: any) => m.round === 'Match 3ème place');

  if (!finale || finale.status !== 'completed') {
    // No finale found or not completed, cannot rank this bracket
    return ranking;
  }

  let currentRank = startRank;

  // 1st place: Winner of finale
  if (finale.winnerId && finale.winnerName) {
    ranking.push({
      rank: currentRank,
      teamName: finale.winnerName,
      teamId: finale.winnerId,
      points: getPointsForRank(currentRank),
    });
    rankedTeamIds.add(finale.winnerId);
    currentRank++;
  }

  // 2nd place: Loser of finale
  if (finale.loserId && finale.loserName) {
    ranking.push({
      rank: currentRank,
      teamName: finale.loserName,
      teamId: finale.loserId,
      points: getPointsForRank(currentRank),
    });
    rankedTeamIds.add(finale.loserId);
    currentRank++;
  }

  // 3rd and 4th place from 3rd place match
  if (thirdPlaceMatch && thirdPlaceMatch.status === 'completed') {
    if (thirdPlaceMatch.winnerId && thirdPlaceMatch.winnerName) {
      ranking.push({
        rank: currentRank,
        teamName: thirdPlaceMatch.winnerName,
        teamId: thirdPlaceMatch.winnerId,
        points: getPointsForRank(currentRank),
      });
      rankedTeamIds.add(thirdPlaceMatch.winnerId);
      currentRank++;
    }
    if (thirdPlaceMatch.loserId && thirdPlaceMatch.loserName) {
      ranking.push({
        rank: currentRank,
        teamName: thirdPlaceMatch.loserName,
        teamId: thirdPlaceMatch.loserId,
        points: getPointsForRank(currentRank),
      });
      rankedTeamIds.add(thirdPlaceMatch.loserId);
      currentRank++;
    }
  }

  // Find semi-final losers not already in ranking (if no 3rd place match)
  const semiFinals = matches.filter((m: any) => m.round === 'Demi-finale' && m.status === 'completed');
  semiFinals.forEach((sf: any) => {
    if (sf.loserId && sf.loserName && !rankedTeamIds.has(sf.loserId)) {
      ranking.push({
        rank: currentRank,
        teamName: sf.loserName,
        teamId: sf.loserId,
        points: getPointsForRank(currentRank),
      });
      rankedTeamIds.add(sf.loserId);
      currentRank++;
    }
  });

  // Find quarter-final losers
  const quarterFinals = matches.filter((m: any) => m.round === 'Quart de finale' && m.status === 'completed');
  quarterFinals.forEach((qf: any) => {
    if (qf.loserId && qf.loserName && !rankedTeamIds.has(qf.loserId)) {
      ranking.push({
        rank: currentRank,
        teamName: qf.loserName,
        teamId: qf.loserId,
        points: getPointsForRank(currentRank),
      });
      rankedTeamIds.add(qf.loserId);
      currentRank++;
    }
  });

  // Find preliminary match losers
  const preliminaryMatches = matches.filter((m: any) => m.round === 'Tour Préliminaire' && m.status === 'completed');
  preliminaryMatches.forEach((pm: any) => {
    if (pm.loserId && pm.loserName && !rankedTeamIds.has(pm.loserId)) {
      ranking.push({
        rank: currentRank,
        teamName: pm.loserName,
        teamId: pm.loserId,
        points: getPointsForRank(currentRank),
      });
      rankedTeamIds.add(pm.loserId);
      currentRank++;
    }
  });

  return ranking;
}

export const freezeEliminationRanking = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get all elimination matches
    const eliminationMatchesSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .get();

    const matches: any[] = eliminationMatchesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (matches.length === 0) {
      ErrorHandlers.validation('No elimination matches found');
    }

    // Calculate team statistics from all elimination matches
    const teamStats: { [key: string]: {
      matchesPlayed: number;
      wins: number;
      losses: number;
      setsWon: number;
      setsLost: number;
      pointsScored: number;
      pointsConceded: number;
    }} = {};

    // Initialize stats for all teams and calculate from matches
    matches.forEach((match: any) => {
      if (match.status === 'completed') {
        const team1Id = match.team1?.id;
        const team2Id = match.team2?.id;

        // Initialize team stats if not exists
        if (team1Id && !teamStats[team1Id]) {
          teamStats[team1Id] = {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            setsWon: 0,
            setsLost: 0,
            pointsScored: 0,
            pointsConceded: 0
          };
        }
        if (team2Id && !teamStats[team2Id]) {
          teamStats[team2Id] = {
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
            setsWon: 0,
            setsLost: 0,
            pointsScored: 0,
            pointsConceded: 0
          };
        }

        const setsWonTeam1 = match.setsWonTeam1 || 0;
        const setsWonTeam2 = match.setsWonTeam2 || 0;

        // Calculate points scored from sets
        let pointsScoredTeam1 = 0;
        let pointsScoredTeam2 = 0;
        if (match.sets && Array.isArray(match.sets)) {
          match.sets.forEach((set: any) => {
            pointsScoredTeam1 += set.score1 || 0;
            pointsScoredTeam2 += set.score2 || 0;
          });
        }

        // Update team1 stats
        if (team1Id && teamStats[team1Id]) {
          teamStats[team1Id].matchesPlayed++;
          teamStats[team1Id].setsWon += setsWonTeam1;
          teamStats[team1Id].setsLost += setsWonTeam2;
          teamStats[team1Id].pointsScored += pointsScoredTeam1;
          teamStats[team1Id].pointsConceded += pointsScoredTeam2;
          if (setsWonTeam1 > setsWonTeam2) {
            teamStats[team1Id].wins++;
          } else {
            teamStats[team1Id].losses++;
          }
        }

        // Update team2 stats
        if (team2Id && teamStats[team2Id]) {
          teamStats[team2Id].matchesPlayed++;
          teamStats[team2Id].setsWon += setsWonTeam2;
          teamStats[team2Id].setsLost += setsWonTeam1;
          teamStats[team2Id].pointsScored += pointsScoredTeam2;
          teamStats[team2Id].pointsConceded += pointsScoredTeam1;
          if (setsWonTeam2 > setsWonTeam1) {
            teamStats[team2Id].wins++;
          } else {
            teamStats[team2Id].losses++;
          }
        }
      }
    });

    // Detect if this is a double bracket tournament
    const isDoubleBracket = matches.some((m: any) => m.bracket);

    // Build ranking from elimination results
    const ranking: any[] = [];

    if (isDoubleBracket) {
      // DOUBLE BRACKET: Separate main and consolation brackets
      const mainMatches = matches.filter((m: any) => m.bracket === 'main');
      const consolationMatches = matches.filter((m: any) => m.bracket === 'consolation');

      // Find finals for each bracket
      const mainFinale = mainMatches.find((m: any) => m.round === 'Finale');
      const consolationFinale = consolationMatches.find((m: any) => m.round === 'Finale');

      if (!mainFinale || mainFinale.status !== 'completed') {
        ErrorHandlers.validation('La finale du tableau principal doit être terminée pour figer le classement');
      }

      // Build main bracket ranking
      const mainRanking = buildBracketRanking(mainMatches, 1);
      ranking.push(...mainRanking);

      // Build consolation bracket ranking (ranks continue after main bracket)
      const consolationRanking = buildBracketRanking(consolationMatches, ranking.length + 1);
      ranking.push(...consolationRanking);

    } else {
      // SINGLE BRACKET: Use same helper function
      const finale = matches.find((m: any) => m.round === 'Finale');

      if (!finale || finale.status !== 'completed') {
        ErrorHandlers.validation('La finale doit être terminée pour figer le classement');
      }

      const singleRanking = buildBracketRanking(matches, 1);
      ranking.push(...singleRanking);
    }

    if (ranking.length === 0) {
      ErrorHandlers.validation('Unable to calculate ranking from elimination matches');
    }

    // Save to Firestore
    const batch = adminDb.batch();
    const finalRankingCollectionRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('finalRanking');

    // Delete old ranking
    const existingRankingSnapshot = await finalRankingCollectionRef.get();
    existingRankingSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Add new ranking
    ranking.forEach((team) => {
      const stats = teamStats[team.teamId] || {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        pointsScored: 0,
        pointsConceded: 0
      };

      const rankData = {
        rank: team.rank,
        teamName: team.teamName,
        teamId: team.teamId,
        matchesPlayed: stats.matchesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        setsWon: stats.setsWon,
        setsLost: stats.setsLost,
        pointsScored: stats.pointsScored,
        pointsConceded: stats.pointsConceded,
        pointsRatio:
          stats.pointsConceded > 0
            ? (stats.pointsScored / stats.pointsConceded).toFixed(2)
            : stats.pointsScored > 0
            ? 'Inf.'
            : '0.00',
        bonusPoints: 0,
        points: team.points,
        frozenAt: new Date(),
      };
      batch.set(finalRankingCollectionRef.doc(), rankData);
    });

    // Update tournament status
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    batch.update(tournamentRef, {
      status: 'frozen',
      isFrozen: true,
      frozenAt: new Date(),
    });

    await batch.commit();

    // Award points to players based on ranking
    const tournamentDoc = await tournamentRef.get();
    const tournament = tournamentDoc.data();

    if (tournament) {
      const tournamentName = tournament.name || 'Tournoi';
      const tournamentDate = tournament.date?.toDate ? tournament.date.toDate() : new Date();

      // Delete existing points for this tournament (to allow re-freeze)
      const affectedPlayerIds = await deleteTournamentPoints(tournamentId);
      if (affectedPlayerIds.length > 0) {
        console.log(`🗑️ Deleted existing points for ${affectedPlayerIds.length} players`);
      }

      let playersAwarded = 0;

      for (const team of ranking) {
        try {
          // Get team members
          const teamDoc = await adminDb
            .collection('events')
            .doc(tournamentId)
            .collection('teams')
            .doc(team.teamId)
            .get();

          if (teamDoc.exists) {
            const teamData = teamDoc.data();
            const members = teamData?.members || [];

            if (members.length > 0) {
              await awardPointsToTeam(
                tournamentId,
                tournamentName,
                tournamentDate,
                team.teamName,
                members,
                team.rank
              );
              playersAwarded += members.filter((m: any) => !m.isVirtual).length;
            }
          }
        } catch (error) {
          console.error(`Error awarding points to team ${team.teamName}:`, error);
        }
      }

      // Also update global rankings for previously affected players (in case of re-freeze)
      if (affectedPlayerIds.length > 0) {
        await updateGlobalRankings(affectedPlayerIds);
      }

      console.log(`✅ Frozen elimination tournament ${tournamentId}: ${playersAwarded} players awarded points`);

      res.json({
        success: true,
        message: `Classement figé avec succès ! ${ranking.length} équipes classées, ${playersAwarded} joueurs ont reçu leurs points.`,
      });
    } else {
      res.json({
        success: true,
        message: `Classement figé avec succès ! ${ranking.length} équipes classées.`,
      });
    }
  } catch (error: any) {
    handleControllerError(error, 'freezing elimination ranking', 'Error freezing elimination ranking', 500);
  }
};

/**
 * Update elimination match score with result propagation (admin only)
 * POST /admin/tournaments/:tournamentId/elimination/:matchId/update-score
 */
export const updateEliminationMatchScore = async (req: Request, res: Response) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { sets } = req.body;

    if (!sets || !Array.isArray(sets)) {
      ErrorHandlers.validation('Invalid sets data');
    }

    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }
    const tournament = tournamentDoc.data();

    // Get match
    const matchRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      ErrorHandlers.notFound('Elimination match', matchId);
    }

    const matchData = matchDoc.data();
    const setsToWin = tournament?.setsPerMatchElimination || 3;
    const pointsPerSet = tournament?.pointsPerSetElimination || 21;
    const tieBreakEnabled = tournament?.tieBreakEnabledElimination || false;

    // Calculate match outcome
    const { setsWonTeam1, setsWonTeam2, matchStatus } = calculateMatchOutcome(
      sets,
      setsToWin,
      pointsPerSet,
      tieBreakEnabled
    );

    let winnerId = null;
    let loserId = null;
    let winnerName = null;
    let loserName = null;

    if (matchStatus === 'completed') {
      if (setsWonTeam1 > setsWonTeam2) {
        winnerId = matchData?.team1?.id || null;
        winnerName = matchData?.team1?.name || null;
        loserId = matchData?.team2?.id || null;
        loserName = matchData?.team2?.name || null;
      } else {
        winnerId = matchData?.team2?.id || null;
        winnerName = matchData?.team2?.name || null;
        loserId = matchData?.team1?.id || null;
        loserName = matchData?.team1?.name || null;
      }
    }

    const batch = adminDb.batch();

    // Update current match
    batch.update(matchRef, {
      sets,
      setsWonTeam1,
      setsWonTeam2,
      status: matchStatus,
      winnerId,
      loserId,
      winnerName,
      loserName,
      updatedAt: new Date(),
    });

    // If match is completed, propagate results to next matches
    if (matchStatus === 'completed' && winnerId && loserId) {
      await propagateEliminationMatchResults(
        tournamentId,
        matchData,
        winnerId,
        winnerName || '',
        loserId,
        loserName || '',
        batch
      );
    }

    await batch.commit();

    res.json({
      success: true,
      message: 'Elimination match score updated and results propagated successfully',
    });
  } catch (error: any) {
    handleControllerError(error, 'updating elimination match score', 'Error updating elimination match score', 500);
  }
};

/**
 * Update teams in an elimination match
 * PUT /admin/tournaments/:tournamentId/elimination/:matchId/teams
 */
export const updateEliminationMatchTeams = async (req: Request, res: Response) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { team1, team2 } = req.body;

    if (!team1 && !team2) {
      ErrorHandlers.validation('At least one team must be provided');
    }

    // Get match
    const matchRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      ErrorHandlers.notFound('Elimination match', matchId);
    }

    const matchData = matchDoc.data();
    const batch = adminDb.batch();

    // If match was completed, we need to reset it and unpropgate results
    if (matchData?.status === 'completed') {
      // Reset the match score
      const setsToWin = matchData.setsToWin || 3;
      const resetSets = Array.from({ length: setsToWin * 2 - 1 }, () => ({
        score1: null,
        score2: null,
      }));

      // Unpropgate: clear the winner from next match(es)
      if (matchData.nextMatchId && matchData.nextMatchTeamSlot) {
        const nextMatchRef = adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('eliminationMatches')
          .doc(matchData.nextMatchId);

        const clearObject: any = {};
        clearObject[`${matchData.nextMatchTeamSlot}.id`] = null;
        clearObject[`${matchData.nextMatchTeamSlot}.name`] = 'À déterminer';
        batch.update(nextMatchRef, clearObject);
      }

      if (matchData.nextMatchWinnerId && matchData.nextMatchWinnerTeamSlot) {
        const nextMatchRef = adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('eliminationMatches')
          .doc(matchData.nextMatchWinnerId);

        const clearObject: any = {};
        clearObject[`${matchData.nextMatchWinnerTeamSlot}.id`] = null;
        clearObject[`${matchData.nextMatchWinnerTeamSlot}.name`] = 'À déterminer';
        batch.update(nextMatchRef, clearObject);
      }

      if (matchData.nextMatchLoserId && matchData.nextMatchLoserTeamSlot) {
        const nextMatchRef = adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('eliminationMatches')
          .doc(matchData.nextMatchLoserId);

        const clearObject: any = {};
        clearObject[`${matchData.nextMatchLoserTeamSlot}.id`] = null;
        clearObject[`${matchData.nextMatchLoserTeamSlot}.name`] = 'À déterminer';
        batch.update(nextMatchRef, clearObject);
      }

      // Reset match status
      batch.update(matchRef, {
        sets: resetSets,
        setsWonTeam1: 0,
        setsWonTeam2: 0,
        status: 'scheduled',
        winnerId: null,
        loserId: null,
        winnerName: null,
        loserName: null,
        updatedAt: new Date(),
      });
    }

    // Update teams
    const updateData: any = { updatedAt: new Date() };
    if (team1) {
      updateData.team1 = {
        id: team1.id,
        name: team1.name,
      };
    }
    if (team2) {
      updateData.team2 = {
        id: team2.id,
        name: team2.name,
      };
    }

    batch.update(matchRef, updateData);
    await batch.commit();

    res.json({
      success: true,
      message: matchData?.status === 'completed'
        ? 'Teams updated and match reset. Previous results have been cleared from the bracket.'
        : 'Teams updated successfully',
    });
  } catch (error: any) {
    handleControllerError(error, 'updating elimination match teams', 'Error updating elimination match teams', 500);
  }
};
