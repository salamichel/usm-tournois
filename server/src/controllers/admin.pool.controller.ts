// Pool Management Controller

import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps, calculateMatchOutcome, calculatePoolRanking } from '../services/match.service';

export const getPools = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

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
      teamsByName[teamData.name] = teamObj;
    });

    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    const pools = await Promise.all(
      poolsSnapshot.docs.map(async (poolDoc) => {
        const poolData = poolDoc.data();

        // Get matches for this pool
        const matchesSnapshot = await adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('pools')
          .doc(poolDoc.id)
          .collection('matches')
          .orderBy('matchNumber')
          .get();

        const matches = matchesSnapshot.docs.map((matchDoc) => {
          const matchData = matchDoc.data();
          const enrichedMatch: any = convertTimestamps({
            id: matchDoc.id,
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

        // Calculate pool ranking from matches
        const teamsInPool = (poolData.teams || []).map((team: any) => ({
          id: team.id,
          name: team.name,
        }));

        const ranking = await calculatePoolRanking(
          tournamentId,
          poolDoc.id,
          teamsInPool,
          matches
        );

        // Enrich ranking with player info
        const enrichedRanking = ranking.map((standing) => {
          const teamData = teamsMap[standing.teamId] || teamsByName[standing.teamName];
          return {
            ...standing,
            id: standing.teamId, // Add id field for React key uniqueness
            name: standing.teamName,
            player1: teamData?.members?.[0] || null,
            player2: teamData?.members?.[1] || null,
          };
        });

        return convertTimestamps({
          id: poolDoc.id,
          ...poolData,
          matches,
          ranking: enrichedRanking,
        });
      })
    );

    res.json({
      success: true,
      data: { pools },
    });
  } catch (error) {
    console.error('Error getting pools:', error);
    throw new AppError('Error retrieving pools', 500);
  }
};

export const createPool = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { name } = req.body;

    if (!name) {
      throw new AppError('Pool name is required', 400);
    }

    const poolData = {
      name,
      teams: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const poolRef = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .add(poolData);

    res.json({
      success: true,
      message: 'Pool created successfully',
      data: { id: poolRef.id },
    });
  } catch (error: any) {
    console.error('Error creating pool:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating pool', 500);
  }
};

export const assignTeamsToPool = async (req: Request, res: Response) => {
  try {
    const { tournamentId, poolId } = req.params;
    const { teamIds } = req.body;

    if (!Array.isArray(teamIds)) {
      throw new AppError('teamIds must be an array', 400);
    }

    // Get tournament to check maxTeamsPerPool
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const maxTeamsPerPool = tournament?.maxTeamsPerPool || 4;

    if (teamIds.length > maxTeamsPerPool) {
      throw new AppError(`Cannot assign more than ${maxTeamsPerPool} teams to a pool`, 400);
    }

    // Get pool
    const poolRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .doc(poolId);

    const poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      throw new AppError('Pool not found', 404);
    }

    // Get team details
    const teams = [];
    for (const teamId of teamIds) {
      const teamDoc = await adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('teams')
        .doc(teamId)
        .get();

      if (teamDoc.exists) {
        teams.push({
          id: teamDoc.id,
          name: teamDoc.data()?.name || 'Unknown Team',
        });
      }
    }

    await poolRef.update({
      teams,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Teams assigned to pool successfully',
    });
  } catch (error: any) {
    console.error('Error assigning teams to pool:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error assigning teams to pool', 500);
  }
};

/**
 * Distributes teams automatically across pools in a balanced way based on weight/ranking
 * Uses snake draft algorithm for fair distribution
 */
export const distributeTeamsToPoolsAutomatically = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { sortBy = 'weight', clearExisting = false } = req.body;

    // Get all teams
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    const allTeams = teamsSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data()?.name || 'Unknown Team',
      weight: doc.data()?.weight || 0,
      globalRanking: doc.data()?.globalRanking || 0,
      poolId: doc.data()?.poolId,
    }));

    const teamsToDistribute = clearExisting ? allTeams : allTeams.filter((team) => !team.poolId);

    if (teamsToDistribute.length === 0) {
      throw new AppError('No unassigned teams to distribute', 400);
    }

    const sortedTeams = teamsToDistribute.sort((a, b) => {
      const valueA = sortBy === 'weight' ? a.weight : a.globalRanking;
      const valueB = sortBy === 'weight' ? b.weight : b.globalRanking;
      return valueB - valueA;
    });

    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    if (poolsSnapshot.empty) {
      throw new AppError('No pools found. Please create pools first.', 400);
    }

    const pools = poolsSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data()?.name || 'Unknown Pool',
      teams: doc.data()?.teams || [],
    }));

    const poolAssignments: { [poolId: string]: any[] } = {};
    pools.forEach((pool) => {
      poolAssignments[pool.id] = clearExisting ? [] : [...pool.teams];
    });

    let poolIndex = 0;
    let direction = 1;

    for (const team of sortedTeams) {
      const currentPool = pools[poolIndex];
      poolAssignments[currentPool.id].push({
        id: team.id,
        name: team.name,
      });

      poolIndex += direction;

      if (poolIndex >= pools.length) {
        poolIndex = pools.length - 1;
        direction = -1;
      } else if (poolIndex < 0) {
        poolIndex = 0;
        direction = 1;
      }
    }

    const batch = adminDb.batch();

    for (const poolId in poolAssignments) {
      const poolRef = adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('pools')
        .doc(poolId);

      batch.update(poolRef, {
        teams: poolAssignments[poolId],
        updatedAt: new Date(),
      });
    }

    for (const team of sortedTeams) {
      const assignedPoolId = Object.keys(poolAssignments).find((poolId) =>
        poolAssignments[poolId].some((t) => t.id === team.id)
      );

      if (assignedPoolId) {
        const teamRef = adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('teams')
          .doc(team.id);

        const assignedPool = pools.find((p) => p.id === assignedPoolId);

        batch.update(teamRef, {
          poolId: assignedPoolId,
          poolName: assignedPool?.name,
          updatedAt: new Date(),
        });
      }
    }

    await batch.commit();

    res.json({
      success: true,
      message: `${sortedTeams.length} teams distributed across ${pools.length} pools`,
      data: {
        teamsDistributed: sortedTeams.length,
        poolsCount: pools.length,
      },
    });
  } catch (error: any) {
    console.error('Error distributing teams to pools:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error distributing teams to pools', 500);
  }
};

export const generatePoolMatches = async (req: Request, res: Response) => {
  try {
    const { tournamentId, poolId } = req.params;

    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const setsPerMatchPool = tournament?.setsPerMatchPool || 1;
    const pointsPerSetPool = tournament?.pointsPerSetPool || 21;
    const matchFormat = tournament?.matchFormat || 'aller';
    const tieBreakEnabledPools = tournament?.tieBreakEnabledPools || false;

    const poolRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .doc(poolId);

    const poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      throw new AppError('Pool not found', 404);
    }

    const poolData = poolDoc.data();
    const teams = poolData?.teams || [];

    if (teams.length < 2) {
      throw new AppError('At least 2 teams are required to generate matches', 400);
    }

    const batch = adminDb.batch();
    const matchesCollectionRef = poolRef.collection('matches');

    const oldMatchesSnapshot = await matchesCollectionRef.get();
    oldMatchesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const generateRoundRobinSchedule = (teamsList: any[]) => {
      const matches: { team1: any; team2: any }[] = [];
      const n = teamsList.length;

      if (n < 2) return matches;

      const teamsWithBye = n % 2 === 1 ? [...teamsList, null] : [...teamsList];
      const numTeams = teamsWithBye.length;
      const numRounds = numTeams - 1;

      for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < numTeams / 2; i++) {
          const home = i === 0 ? 0 : (round + i) % (numTeams - 1) + 1;
          const away = (round + numTeams - 1 - i) % (numTeams - 1) + 1;

          const team1Idx = i === 0 ? 0 : home;
          const team2Idx = away;

          const team1 = teamsWithBye[team1Idx];
          const team2 = teamsWithBye[team2Idx];

          if (team1 !== null && team2 !== null) {
            matches.push({ team1, team2 });
          }
        }
      }

      return matches;
    };

    const roundRobinMatches = generateRoundRobinSchedule(teams);

    let matchNumber = 1;
    for (const match of roundRobinMatches) {
      const { team1, team2 } = match;

      const initialSets = Array.from({ length: setsPerMatchPool }, () => ({
        score1: null,
        score2: null,
      }));

      batch.set(matchesCollectionRef.doc(), {
        matchNumber: matchNumber++,
        team1: { id: team1.id, name: team1.name },
        team2: { id: team2.id, name: team2.name },
        sets: initialSets,
        status: 'scheduled',
        type: 'pool',
        setsToWin: setsPerMatchPool,
        pointsPerSet: pointsPerSetPool,
        tieBreakEnabled: tieBreakEnabledPools,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (matchFormat === 'aller_retour') {
        batch.set(matchesCollectionRef.doc(), {
          matchNumber: matchNumber++,
          team1: { id: team2.id, name: team2.name },
          team2: { id: team1.id, name: team1.name },
          sets: initialSets,
          status: 'scheduled',
          type: 'pool',
          setsToWin: setsPerMatchPool,
          pointsPerSet: pointsPerSetPool,
          tieBreakEnabled: tieBreakEnabledPools,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    await batch.commit();

    res.json({
      success: true,
      message: 'Pool matches generated successfully',
    });
  } catch (error: any) {
    console.error('Error generating pool matches:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error generating pool matches', 500);
  }
};

export const updatePoolMatchScore = async (req: Request, res: Response) => {
  try {
    const { tournamentId, poolId, matchId } = req.params;
    const { sets } = req.body;

    if (!sets || !Array.isArray(sets)) {
      throw new AppError('Invalid sets data', 400);
    }

    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }
    const tournament = tournamentDoc.data();

    const matchRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .doc(poolId)
      .collection('matches')
      .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      throw new AppError('Match not found', 404);
    }

    const matchData = matchDoc.data();
    const setsToWin = tournament?.setsPerMatchPool || 1;
    const pointsPerSet = tournament?.pointsPerSetPool || 21;
    const tieBreakEnabled = tournament?.tieBreakEnabledPools || false;

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

    await matchRef.update({
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

    res.json({
      success: true,
      message: 'Match score updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating pool match score:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating pool match score', 500);
  }
};

export const updatePoolName = async (req: Request, res: Response) => {
  try {
    const { tournamentId, poolId } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Pool name is required', 400);
    }

    const poolRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .doc(poolId);

    const poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      throw new AppError('Pool not found', 404);
    }

    await poolRef.update({
      name: name.trim(),
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Pool name updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating pool name:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating pool name', 500);
  }
};

export const deletePool = async (req: Request, res: Response) => {
  try {
    const { tournamentId, poolId } = req.params;

    const poolRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .doc(poolId);

    const poolDoc = await poolRef.get();
    if (!poolDoc.exists) {
      throw new AppError('Pool not found', 404);
    }

    const batch = adminDb.batch();

    const matchesSnapshot = await poolRef.collection('matches').get();
    matchesSnapshot.docs.forEach((matchDoc) => {
      batch.delete(matchDoc.ref);
    });

    batch.delete(poolRef);

    await batch.commit();

    res.json({
      success: true,
      message: 'Pool and all its matches deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting pool:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting pool', 500);
  }
};

export const generateRoundSchedule = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const numberOfFields = tournament?.fields || 1;

    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    if (poolsSnapshot.empty) {
      throw new AppError('No pools found for this tournament', 404);
    }

    interface PoolMatchData {
      poolId: string;
      poolName: string;
      matchId: string;
      matchRef: FirebaseFirestore.DocumentReference;
      match: any;
    }

    const poolMatches: Map<string, PoolMatchData[]> = new Map();

    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data();
      const matchesSnapshot = await poolDoc.ref.collection('matches').orderBy('matchNumber').get();

      const matches: PoolMatchData[] = matchesSnapshot.docs.map(matchDoc => ({
        poolId: poolDoc.id,
        poolName: poolData.name || 'Unknown Pool',
        matchId: matchDoc.id,
        matchRef: matchDoc.ref,
        match: matchDoc.data(),
      }));

      if (matches.length > 0) {
        poolMatches.set(poolDoc.id, matches);
      }
    }

    if (poolMatches.size === 0) {
      throw new AppError('No matches found in any pool', 404);
    }

    const poolIds = Array.from(poolMatches.keys());
    const poolIndices: Map<string, number> = new Map(poolIds.map(id => [id, 0]));

    let roundNumber = 1;
    const batch = adminDb.batch();
    const scheduledMatches: any[] = [];

    let hasUnscheduledMatches = true;
    while (hasUnscheduledMatches) {
      hasUnscheduledMatches = false;

      for (let field = 1; field <= numberOfFields; field++) {
        let matchAssigned = false;
        for (let attempt = 0; attempt < poolIds.length; attempt++) {
          const poolId = poolIds[(field - 1 + attempt) % poolIds.length];
          const poolMatchList = poolMatches.get(poolId)!;
          const currentIndex = poolIndices.get(poolId)!;

          if (currentIndex < poolMatchList.length) {
            const matchData = poolMatchList[currentIndex];

            batch.update(matchData.matchRef, {
              roundNumber: roundNumber,
              fieldNumber: field,
              updatedAt: new Date(),
            });

            scheduledMatches.push({
              matchId: matchData.matchId,
              poolId: matchData.poolId,
              poolName: matchData.poolName,
              team1Name: matchData.match.team1?.name || 'TBD',
              team2Name: matchData.match.team2?.name || 'TBD',
              roundNumber: roundNumber,
              fieldNumber: field,
              status: matchData.match.status,
            });

            poolIndices.set(poolId, currentIndex + 1);
            matchAssigned = true;
            hasUnscheduledMatches = true;
            break;
          }
        }

        if (!matchAssigned) {
          for (const poolId of poolIds) {
            const poolMatchList = poolMatches.get(poolId)!;
            const currentIndex = poolIndices.get(poolId)!;

            if (currentIndex < poolMatchList.length) {
              const matchData = poolMatchList[currentIndex];

              batch.update(matchData.matchRef, {
                roundNumber: roundNumber,
                fieldNumber: field,
                updatedAt: new Date(),
              });

              scheduledMatches.push({
                matchId: matchData.matchId,
                poolId: matchData.poolId,
                poolName: matchData.poolName,
                team1Name: matchData.match.team1?.name || 'TBD',
                team2Name: matchData.match.team2?.name || 'TBD',
                roundNumber: roundNumber,
                fieldNumber: field,
                status: matchData.match.status,
              });

              poolIndices.set(poolId, currentIndex + 1);
              hasUnscheduledMatches = true;
              break;
            }
          }
        }
      }

      if (hasUnscheduledMatches) {
        poolIds.push(poolIds.shift()!);
        roundNumber++;
      }
    }

    await batch.commit();

    const rounds: { roundNumber: number; matches: any[] }[] = [];
    for (let r = 1; r < roundNumber; r++) {
      rounds.push({
        roundNumber: r,
        matches: scheduledMatches.filter(m => m.roundNumber === r).sort((a, b) => a.fieldNumber - b.fieldNumber),
      });
    }

    res.json({
      success: true,
      message: `Round schedule generated: ${roundNumber - 1} rounds for ${scheduledMatches.length} matches on ${numberOfFields} fields`,
      data: {
        totalRounds: roundNumber - 1,
        totalMatches: scheduledMatches.length,
        numberOfFields,
        rounds,
      },
    });
  } catch (error: any) {
    console.error('Error generating round schedule:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error generating round schedule', 500);
  }
};

export const getRoundSchedule = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const numberOfFields = tournament?.fields || 1;

    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    const scheduledMatches: any[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data();
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        if (matchData.roundNumber !== undefined && matchData.fieldNumber !== undefined) {
          scheduledMatches.push({
            matchId: matchDoc.id,
            poolId: poolDoc.id,
            poolName: poolData.name || 'Unknown Pool',
            team1Name: matchData.team1?.name || 'TBD',
            team2Name: matchData.team2?.name || 'TBD',
            roundNumber: matchData.roundNumber,
            fieldNumber: matchData.fieldNumber,
            status: matchData.status,
          });
        }
      }
    }

    scheduledMatches.sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
      return a.fieldNumber - b.fieldNumber;
    });

    const rounds: { roundNumber: number; matches: any[] }[] = [];
    const roundNumbers = [...new Set(scheduledMatches.map(m => m.roundNumber))].sort((a, b) => a - b);

    for (const roundNum of roundNumbers) {
      rounds.push({
        roundNumber: roundNum,
        matches: scheduledMatches.filter(m => m.roundNumber === roundNum),
      });
    }

    res.json({
      success: true,
      data: {
        totalRounds: rounds.length,
        totalMatches: scheduledMatches.length,
        numberOfFields,
        rounds,
      },
    });
  } catch (error: any) {
    console.error('Error getting round schedule:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error getting round schedule', 500);
  }
};

export const updateMatchSchedule = async (req: Request, res: Response) => {
  try {
    const { tournamentId, poolId, matchId } = req.params;
    const { roundNumber, fieldNumber } = req.body;

    if (roundNumber === undefined || fieldNumber === undefined) {
      throw new AppError('roundNumber and fieldNumber are required', 400);
    }

    const matchRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .doc(poolId)
      .collection('matches')
      .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      throw new AppError('Match not found', 404);
    }

    await matchRef.update({
      roundNumber,
      fieldNumber,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Match schedule updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating match schedule:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating match schedule', 500);
  }
};

export const bulkUpdateMatchSchedules = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError('updates array is required', 400);
    }

    const batch = adminDb.batch();

    for (const update of updates) {
      const { poolId, matchId, roundNumber, fieldNumber } = update;

      if (!poolId || !matchId || roundNumber === undefined || fieldNumber === undefined) {
        throw new AppError('Each update must include poolId, matchId, roundNumber, and fieldNumber', 400);
      }

      const matchRef = adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('pools')
        .doc(poolId)
        .collection('matches')
        .doc(matchId);

      batch.update(matchRef, {
        roundNumber,
        fieldNumber,
        updatedAt: new Date(),
      });
    }

    await batch.commit();

    res.json({
      success: true,
      message: `${updates.length} match schedules updated successfully`,
    });
  } catch (error: any) {
    console.error('Error bulk updating match schedules:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error bulk updating match schedules', 500);
  }
};

export const clearRoundSchedule = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    const batch = adminDb.batch();
    let matchCount = 0;

    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        if (matchData.roundNumber !== undefined || matchData.fieldNumber !== undefined) {
          batch.update(matchDoc.ref, {
            roundNumber: null,
            fieldNumber: null,
            updatedAt: new Date(),
          });
          matchCount++;
        }
      }
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Round schedule cleared for ${matchCount} matches`,
    });
  } catch (error: any) {
    console.error('Error clearing round schedule:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error clearing round schedule', 500);
  }
};
