import { Request, Response } from 'express';
import { adminDb, adminAuth } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import { calculateMatchOutcome, propagateEliminationMatchResults, calculatePoolRanking } from '../services/match.service';
import {
  generateEliminationBracket as generateEliminationBracketService,
  generateDoubleBracket,
  QualifiedTeam,
  QualifiedTeamWithRank,
  EliminationTournamentConfig,
} from '../services/elimination.service';
import { awardPointsToTeam, deleteTournamentPoints, updateGlobalRankings } from '../services/playerPoints.service';

/**
 * Helper function to calculate team's global ranking based on members' points
 */
async function calculateTeamGlobalRanking(members: any[]): Promise<number> {
  let totalPoints = 0;

  for (const member of members) {
    // Skip virtual/placeholder members
    if (member.isVirtual) continue;

    try {
      // Get player's global ranking
      const playerRankingDoc = await adminDb
        .collection('globalPlayerRanking')
        .doc(member.userId)
        .get();

      if (playerRankingDoc.exists) {
        const rankingData = playerRankingDoc.data();
        totalPoints += rankingData?.totalPoints || 0;
      }
    } catch (error) {
      console.error(`Error fetching points for player ${member.userId}:`, error);
      // Continue with other members even if one fails
    }
  }

  return totalPoints;
}

/**
 * Tournament Management
 */
export const getAllTournaments = async (req: Request, res: Response) => {
  try {
    const eventsSnapshot = await adminDb.collection('events').orderBy('date', 'desc').get();

    const tournaments = await Promise.all(
      eventsSnapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Count registered teams
        const teamsSnapshot = await adminDb
          .collection('events')
          .doc(doc.id)
          .collection('teams')
          .get();

        // Count unassigned players
        const unassignedPlayersSnapshot = await adminDb
          .collection('events')
          .doc(doc.id)
          .collection('unassignedPlayers')
          .get();

        return convertTimestamps({
          id: doc.id,
          ...data,
          registeredTeamsCount: teamsSnapshot.size,
          unassignedPlayersCount: unassignedPlayersSnapshot.size,
        });
      })
    );

    res.json({
      success: true,
      data: { tournaments },
    });
  } catch (error) {
    console.error('Error getting all tournaments:', error);
    throw new AppError('Error retrieving tournaments', 500);
  }
};

export const createTournament = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      date,
      location,
      type,
      fields,
      fee,
      mixity,
      requiresFemalePlayer,
      maxTeams,
      playersPerTeam,
      minPlayersPerTeam,
      setsPerMatchPool,
      pointsPerSetPool,
      tieBreakEnabledPools,
      matchFormat,
      eliminationPhaseEnabled,
      setsPerMatchElimination,
      pointsPerSetElimination,
      tieBreakEnabledElimination,
      teamsQualifiedPerPool,
      maxTeamsPerPool,
      registrationStartDateTime,
      registrationEndDateTime,
      isActive,
      waitingListSize,
      whatsappGroupLink,
      registrationMode,
      tournamentFormat,
      isClubInternal,
      signupQuestions,
    } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      throw new AppError('Tournament name is required', 400);
    }

    // Handle uploaded file (if any)
    const coverImagePath = (req as any).file ? `/uploads/${(req as any).file.filename}` : undefined;

    // Parse signupQuestions if it's a string (from FormData)
    let parsedSignupQuestions = signupQuestions;
    if (typeof signupQuestions === 'string') {
      try {
        parsedSignupQuestions = JSON.parse(signupQuestions);
      } catch (e) {
        parsedSignupQuestions = [];
      }
    }

    const tournamentData: any = {
      name: name.trim(),
      description: description?.trim() || '',
      date: date ? new Date(date) : new Date(),
      location: location?.trim() || '',
      type: type || 'beach_volley',
      fields: fields ? parseInt(fields) : 2,
      fee: fee ? parseFloat(fee) : 0,
      mixity: mixity || 'none',
      requiresFemalePlayer: requiresFemalePlayer === true || requiresFemalePlayer === 'true' || false,
      maxTeams: maxTeams ? parseInt(maxTeams) : 8,
      playersPerTeam: playersPerTeam ? parseInt(playersPerTeam) : 2,
      minPlayersPerTeam: minPlayersPerTeam ? parseInt(minPlayersPerTeam) : 2,
      setsPerMatchPool: setsPerMatchPool ? parseInt(setsPerMatchPool) : 1,
      pointsPerSetPool: pointsPerSetPool ? parseInt(pointsPerSetPool) : 21,
      tieBreakEnabledPools: tieBreakEnabledPools === true || tieBreakEnabledPools === 'true' || false,
      matchFormat: matchFormat || 'aller',
      eliminationPhaseEnabled: eliminationPhaseEnabled === true || eliminationPhaseEnabled === 'true' || false,
      setsPerMatchElimination: setsPerMatchElimination ? parseInt(setsPerMatchElimination) : 3,
      pointsPerSetElimination: pointsPerSetElimination ? parseInt(pointsPerSetElimination) : 21,
      tieBreakEnabledElimination: tieBreakEnabledElimination === true || tieBreakEnabledElimination === 'true' || false,
      teamsQualifiedPerPool: teamsQualifiedPerPool ? parseInt(teamsQualifiedPerPool) : 2,
      maxTeamsPerPool: maxTeamsPerPool ? parseInt(maxTeamsPerPool) : 4,
      registrationStartDateTime: registrationStartDateTime ? new Date(registrationStartDateTime) : new Date(),
      registrationEndDateTime: registrationEndDateTime ? new Date(registrationEndDateTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: isActive === true || isActive === 'true' || false,
      waitingListSize: waitingListSize ? parseInt(waitingListSize) : 0,
      whatsappGroupLink: whatsappGroupLink?.trim() || '',
      registrationMode: registrationMode || 'teams',
      tournamentFormat: tournamentFormat || 'standard',
      isClubInternal: isClubInternal === true || isClubInternal === 'true' || false,
      signupQuestions: parsedSignupQuestions || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add cover image if provided
    if (coverImagePath) {
      tournamentData.coverImage = coverImagePath;
    }

    const tournamentRef = await adminDb.collection('events').add(tournamentData);

    res.json({
      success: true,
      message: 'Tournament created successfully',
      data: { id: tournamentRef.id },
    });
  } catch (error: any) {
    console.error('Error creating tournament:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating tournament', 500);
  }
};

export const getTournamentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tournamentDoc = await adminDb.collection('events').doc(id).get();

    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    // Get unassigned players
    const unassignedPlayersSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('unassignedPlayers')
      .get();

    const unassignedPlayers = unassignedPlayersSnapshot.docs.map((doc) => ({
      id: doc.id,
      userId: doc.data().userId || doc.id,
      pseudo: doc.data().pseudo || 'Unknown',
      level: doc.data().level || 'N/A',
      ...doc.data(),
    }));

    const tournament = convertTimestamps({
      id: tournamentDoc.id,
      ...tournamentDoc.data(),
    });

    res.json({
      success: true,
      data: { tournament, unassignedPlayers },
    });
  } catch (error: any) {
    console.error('Error getting tournament by ID:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving tournament', 500);
  }
};

export const updateTournament = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      date,
      location,
      type,
      fields,
      fee,
      mixity,
      requiresFemalePlayer,
      maxTeams,
      playersPerTeam,
      minPlayersPerTeam,
      setsPerMatchPool,
      pointsPerSetPool,
      tieBreakEnabledPools,
      matchFormat,
      eliminationPhaseEnabled,
      setsPerMatchElimination,
      pointsPerSetElimination,
      tieBreakEnabledElimination,
      teamsQualifiedPerPool,
      maxTeamsPerPool,
      registrationStartDateTime,
      registrationEndDateTime,
      isActive,
      waitingListSize,
      whatsappGroupLink,
      registrationMode,
      tournamentFormat,
      isClubInternal,
      signupQuestions,
    } = req.body;

    const tournamentDoc = await adminDb.collection('events').doc(id).get();

    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    // Parse signupQuestions if it's a string (from FormData)
    let parsedSignupQuestions = signupQuestions;
    if (typeof signupQuestions === 'string') {
      try {
        parsedSignupQuestions = JSON.parse(signupQuestions);
      } catch (e) {
        // Keep as is if parse fails
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Handle uploaded file (if any)
    if ((req as any).file) {
      updateData.coverImage = `/uploads/${(req as any).file.filename}`;
    }

    // Only add defined values to avoid Firestore undefined errors
    if (name !== undefined && name !== null) updateData.name = name.trim();
    if (description !== undefined && description !== null) updateData.description = description.trim();
    if (date !== undefined && date !== null) updateData.date = new Date(date);
    if (location !== undefined && location !== null) updateData.location = location.trim();
    if (type !== undefined && type !== null) updateData.type = type;
    if (fields !== undefined && fields !== null) updateData.fields = parseInt(fields);
    if (fee !== undefined && fee !== null) updateData.fee = parseFloat(fee);
    if (mixity !== undefined && mixity !== null) updateData.mixity = mixity;
    if (requiresFemalePlayer !== undefined && requiresFemalePlayer !== null) updateData.requiresFemalePlayer = requiresFemalePlayer === true || requiresFemalePlayer === 'true';
    if (maxTeams !== undefined && maxTeams !== null) updateData.maxTeams = parseInt(maxTeams);
    if (playersPerTeam !== undefined && playersPerTeam !== null) updateData.playersPerTeam = parseInt(playersPerTeam);
    if (minPlayersPerTeam !== undefined && minPlayersPerTeam !== null) updateData.minPlayersPerTeam = parseInt(minPlayersPerTeam);
    if (setsPerMatchPool !== undefined && setsPerMatchPool !== null) updateData.setsPerMatchPool = parseInt(setsPerMatchPool);
    if (pointsPerSetPool !== undefined && pointsPerSetPool !== null) updateData.pointsPerSetPool = parseInt(pointsPerSetPool);
    if (tieBreakEnabledPools !== undefined && tieBreakEnabledPools !== null) updateData.tieBreakEnabledPools = tieBreakEnabledPools === true || tieBreakEnabledPools === 'true';
    if (matchFormat !== undefined && matchFormat !== null) updateData.matchFormat = matchFormat;
    if (eliminationPhaseEnabled !== undefined && eliminationPhaseEnabled !== null) updateData.eliminationPhaseEnabled = eliminationPhaseEnabled === true || eliminationPhaseEnabled === 'true';
    if (setsPerMatchElimination !== undefined && setsPerMatchElimination !== null) updateData.setsPerMatchElimination = parseInt(setsPerMatchElimination);
    if (pointsPerSetElimination !== undefined && pointsPerSetElimination !== null) updateData.pointsPerSetElimination = parseInt(pointsPerSetElimination);
    if (tieBreakEnabledElimination !== undefined && tieBreakEnabledElimination !== null) updateData.tieBreakEnabledElimination = tieBreakEnabledElimination === true || tieBreakEnabledElimination === 'true';
    if (teamsQualifiedPerPool !== undefined && teamsQualifiedPerPool !== null) updateData.teamsQualifiedPerPool = parseInt(teamsQualifiedPerPool);
    if (maxTeamsPerPool !== undefined && maxTeamsPerPool !== null) updateData.maxTeamsPerPool = parseInt(maxTeamsPerPool);
    if (registrationStartDateTime !== undefined && registrationStartDateTime !== null) updateData.registrationStartDateTime = new Date(registrationStartDateTime);
    if (registrationEndDateTime !== undefined && registrationEndDateTime !== null) updateData.registrationEndDateTime = new Date(registrationEndDateTime);
    if (isActive !== undefined && isActive !== null) updateData.isActive = isActive === true || isActive === 'true';
    if (waitingListSize !== undefined && waitingListSize !== null) updateData.waitingListSize = parseInt(waitingListSize);
    if (whatsappGroupLink !== undefined && whatsappGroupLink !== null) updateData.whatsappGroupLink = whatsappGroupLink.trim();
    if (registrationMode !== undefined && registrationMode !== null) updateData.registrationMode = registrationMode;
    if (tournamentFormat !== undefined && tournamentFormat !== null) updateData.tournamentFormat = tournamentFormat;
    if (isClubInternal !== undefined && isClubInternal !== null) updateData.isClubInternal = isClubInternal === true || isClubInternal === 'true';
    if (parsedSignupQuestions !== undefined) updateData.signupQuestions = parsedSignupQuestions;

    await adminDb.collection('events').doc(id).update(updateData);

    res.json({
      success: true,
      message: 'Tournament updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating tournament:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating tournament', 500);
  }
};

export const deleteTournament = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete all subcollections first
    const eventRef = adminDb.collection('events').doc(id);

    // Delete teams
    const teamsSnapshot = await eventRef.collection('teams').get();
    const teamDeletePromises = teamsSnapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(teamDeletePromises);

    // Delete unassigned players
    const unassignedPlayersSnapshot = await eventRef.collection('unassignedPlayers').get();
    const unassignedPlayersDeletePromises = unassignedPlayersSnapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(unassignedPlayersDeletePromises);

    // Delete pools and their matches
    const poolsSnapshot = await eventRef.collection('pools').get();
    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      const matchesDeletePromises = matchesSnapshot.docs.map((doc) => doc.ref.delete());
      await Promise.all(matchesDeletePromises);
      await poolDoc.ref.delete();
    }

    // Delete elimination matches
    const eliminationMatchesSnapshot = await eventRef.collection('eliminationMatches').get();
    const eliminationMatchesDeletePromises = eliminationMatchesSnapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(eliminationMatchesDeletePromises);

    // Delete final ranking
    const finalRankingSnapshot = await eventRef.collection('finalRanking').get();
    const finalRankingDeletePromises = finalRankingSnapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(finalRankingDeletePromises);

    // Delete waiting list teams
    const waitingListSnapshot = await eventRef.collection('waitingListTeams').get();
    const waitingListDeletePromises = waitingListSnapshot.docs.map((doc) => doc.ref.delete());
    await Promise.all(waitingListDeletePromises);

    // Finally delete the event document
    await eventRef.delete();

    res.json({
      success: true,
      message: 'Tournament deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tournament:', error);
    throw new AppError('Error deleting tournament', 500);
  }
};

export const cloneTournament = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const eventDoc = await adminDb.collection('events').doc(id).get();
    if (!eventDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const eventData = eventDoc.data();

    // Create a copy with modified name and reset fields
    const newEventData = {
      ...eventData,
      name: `${eventData?.name} (Copie)`,
      isActive: false,
      createdAt: new Date(),
    };

    const newEventRef = await adminDb.collection('events').add(newEventData);

    res.json({
      success: true,
      message: 'Tournament cloned successfully',
      data: { id: newEventRef.id },
    });
  } catch (error) {
    console.error('Error cloning tournament:', error);
    throw new AppError('Error cloning tournament', 500);
  }
};

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
    const { sortBy = 'weight', clearExisting = false } = req.body; // 'weight' or 'globalRanking', clearExisting to redistribute all teams

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

    // If clearExisting is true, we'll redistribute ALL teams (not just unassigned)
    const teamsToDistribute = clearExisting ? allTeams : allTeams.filter((team) => !team.poolId);

    if (teamsToDistribute.length === 0) {
      throw new AppError('No unassigned teams to distribute', 400);
    }

    // Sort teams by the selected criterion (descending order - strongest first)
    const sortedTeams = teamsToDistribute.sort((a, b) => {
      const valueA = sortBy === 'weight' ? a.weight : a.globalRanking;
      const valueB = sortBy === 'weight' ? b.weight : b.globalRanking;
      return valueB - valueA;
    });

    // Get all pools
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

    // Snake draft distribution
    // If clearExisting, start fresh. Otherwise, keep existing assignments.
    const poolAssignments: { [poolId: string]: any[] } = {};
    pools.forEach((pool) => {
      poolAssignments[pool.id] = clearExisting ? [] : [...pool.teams];
    });

    let poolIndex = 0;
    let direction = 1; // 1 for forward, -1 for backward

    for (const team of sortedTeams) {
      const currentPool = pools[poolIndex];
      poolAssignments[currentPool.id].push({
        id: team.id,
        name: team.name,
      });

      // Move to next pool
      poolIndex += direction;

      // Reverse direction at the ends (snake pattern)
      if (poolIndex >= pools.length) {
        poolIndex = pools.length - 1;
        direction = -1;
      } else if (poolIndex < 0) {
        poolIndex = 0;
        direction = 1;
      }
    }

    // Update pools and teams in batch
    const batch = adminDb.batch();

    // Update each pool with its assigned teams
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

    // Update each team with its pool assignment
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

    // Get tournament configuration
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const setsPerMatchPool = tournament?.setsPerMatchPool || 1;
    const pointsPerSetPool = tournament?.pointsPerSetPool || 21;
    const matchFormat = tournament?.matchFormat || 'aller';
    const tieBreakEnabledPools = tournament?.tieBreakEnabledPools || false;

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

    const poolData = poolDoc.data();
    const teams = poolData?.teams || [];

    if (teams.length < 2) {
      throw new AppError('At least 2 teams are required to generate matches', 400);
    }

    const batch = adminDb.batch();
    const matchesCollectionRef = poolRef.collection('matches');

    // Delete old matches
    const oldMatchesSnapshot = await matchesCollectionRef.get();
    oldMatchesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Generate matches using round-robin circle method for better distribution
    // This ensures teams don't play multiple consecutive matches
    const generateRoundRobinSchedule = (teamsList: any[]) => {
      const matches: { team1: any; team2: any }[] = [];
      const n = teamsList.length;

      if (n < 2) return matches;

      // For odd number of teams, add a "bye" placeholder
      const teamsWithBye = n % 2 === 1 ? [...teamsList, null] : [...teamsList];
      const numTeams = teamsWithBye.length;
      const numRounds = numTeams - 1;

      // Circle method: fix one team and rotate the others
      for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < numTeams / 2; i++) {
          const home = i === 0 ? 0 : (round + i) % (numTeams - 1) + 1;
          const away = (round + numTeams - 1 - i) % (numTeams - 1) + 1;

          // Adjust indices for the fixed team (index 0)
          const team1Idx = i === 0 ? 0 : home;
          const team2Idx = away;

          const team1 = teamsWithBye[team1Idx];
          const team2 = teamsWithBye[team2Idx];

          // Skip matches with "bye" (null)
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

      // Match aller
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

      // Match retour (if aller_retour format)
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
    console.error('Error getting elimination matches:', error);
    throw new AppError('Error retrieving elimination matches', 500);
  }
};

export const generateEliminationBracket = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { qualifiedTeamIds, bracketType } = req.body; // bracketType: 'single' (default) or 'double'

    // Get tournament configuration
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();

    if (!tournament?.eliminationPhaseEnabled) {
      throw new AppError('Elimination phase is not enabled for this tournament', 400);
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
      throw new AppError('At least 2 qualified teams are required to generate elimination bracket', 400);
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
      throw new AppError('No matches could be generated. Please check your tournament configuration.', 400);
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
    console.error('Error generating elimination bracket:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error generating elimination bracket', 500);
  }
};

export const freezeRanking = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { finalRanking } = req.body;

    if (!finalRanking || !Array.isArray(finalRanking)) {
      throw new AppError('Invalid final ranking data', 400);
    }

    // Get tournament data for name and date
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
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
    console.error('Error freezing ranking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error freezing ranking', 500);
  }
};

/**
 * Helper function to calculate ranking for a single bracket (main or consolation).
 * Returns an array of ranked teams with their points.
 */
function calculateBracketRanking(bracketMatches: any[], rankOffset: number): any[] {
  const ranking: any[] = [];
  const rankedTeamIds = new Set<string>();

  // Points allocation based on position within bracket
  const getPoints = (position: number, totalTeams: number) => {
    // Scale points: 1st in bracket gets 100, decreasing from there
    // For consolation bracket, points are already offset by rankOffset
    const basePoints = Math.max(100 - (position - 1) * 15, 10);
    return basePoints;
  };

  // Find final and 3rd place match
  const finale = bracketMatches.find((m: any) => m.round === 'Finale');
  const thirdPlaceMatch = bracketMatches.find((m: any) => m.round === 'Match 3ème place');

  let position = 1;

  // 1st place: Winner of finale
  if (finale?.winnerId && finale?.winnerName) {
    ranking.push({
      rank: rankOffset + position,
      teamName: finale.winnerName,
      teamId: finale.winnerId,
      points: getPoints(position, 0),
    });
    rankedTeamIds.add(finale.winnerId);
    position++;
  }

  // 2nd place: Loser of finale
  if (finale?.loserId && finale?.loserName) {
    ranking.push({
      rank: rankOffset + position,
      teamName: finale.loserName,
      teamId: finale.loserId,
      points: getPoints(position, 0),
    });
    rankedTeamIds.add(finale.loserId);
    position++;
  }

  // 3rd and 4th place from 3rd place match
  if (thirdPlaceMatch && thirdPlaceMatch.status === 'completed') {
    if (thirdPlaceMatch.winnerId && thirdPlaceMatch.winnerName && !rankedTeamIds.has(thirdPlaceMatch.winnerId)) {
      ranking.push({
        rank: rankOffset + position,
        teamName: thirdPlaceMatch.winnerName,
        teamId: thirdPlaceMatch.winnerId,
        points: getPoints(position, 0),
      });
      rankedTeamIds.add(thirdPlaceMatch.winnerId);
      position++;
    }
    if (thirdPlaceMatch.loserId && thirdPlaceMatch.loserName && !rankedTeamIds.has(thirdPlaceMatch.loserId)) {
      ranking.push({
        rank: rankOffset + position,
        teamName: thirdPlaceMatch.loserName,
        teamId: thirdPlaceMatch.loserId,
        points: getPoints(position, 0),
      });
      rankedTeamIds.add(thirdPlaceMatch.loserId);
      position++;
    }
  }

  // Process remaining rounds in order: semi-finals, quarter-finals, etc.
  const roundOrder = ['Demi-finale', 'Quart de finale', 'Huitième de finale', 'Seizième de finale', 'Tour Préliminaire'];

  for (const round of roundOrder) {
    const roundMatches = bracketMatches.filter((m: any) => m.round === round && m.status === 'completed');
    for (const match of roundMatches) {
      if (match.loserId && match.loserName && !rankedTeamIds.has(match.loserId)) {
        ranking.push({
          rank: rankOffset + position,
          teamName: match.loserName,
          teamId: match.loserId,
          points: getPoints(position, 0),
        });
        rankedTeamIds.add(match.loserId);
        position++;
      }
    }
  }

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
      throw new AppError('No elimination matches found', 400);
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

    // Detect double bracket mode
    const isDoubleBracket = matches.some((m: any) => m.bracket === 'main' || m.bracket === 'consolation');

    // Build ranking from elimination results
    const ranking: any[] = [];

    if (isDoubleBracket) {
      // Double bracket: calculate unified ranking
      const mainMatches = matches.filter((m: any) => m.bracket === 'main');
      const consolationMatches = matches.filter((m: any) => m.bracket === 'consolation');

      // Check both finales are completed
      const mainFinale = mainMatches.find((m: any) => m.round === 'Finale');
      const consolationFinale = consolationMatches.find((m: any) => m.round === 'Finale');

      if (!mainFinale || mainFinale.status !== 'completed') {
        throw new AppError('La finale du tableau principal doit être terminée pour figer le classement', 400);
      }
      if (!consolationFinale || consolationFinale.status !== 'completed') {
        throw new AppError('La finale du tableau consolante doit être terminée pour figer le classement', 400);
      }

      // Calculate ranking for main bracket
      const mainRanking = calculateBracketRanking(mainMatches, 0);

      // Calculate ranking for consolation bracket (offset by main bracket size)
      const consolationOffset = mainRanking.length;
      const consolationRanking = calculateBracketRanking(consolationMatches, consolationOffset);

      // Combine rankings
      ranking.push(...mainRanking, ...consolationRanking);

      console.log(`Double bracket ranking: ${mainRanking.length} main + ${consolationRanking.length} consolation = ${ranking.length} total`);
    } else {
      // Single bracket: original logic
      const finale = matches.find((m: any) => m.round === 'Finale');
      const thirdPlaceMatch = matches.find((m: any) => m.round === 'Match 3ème place');

      if (!finale || finale.status !== 'completed') {
        throw new AppError('La finale doit être terminée pour figer le classement', 400);
      }

      // 1st place: Winner of finale
      if (finale.winnerId && finale.winnerName) {
        ranking.push({
          rank: 1,
          teamName: finale.winnerName,
          teamId: finale.winnerId,
          points: 100,
        });
      }

      // 2nd place: Loser of finale
      if (finale.loserId && finale.loserName) {
        ranking.push({
          rank: 2,
          teamName: finale.loserName,
          teamId: finale.loserId,
          points: 80,
        });
      }

      // 3rd and 4th place from 3rd place match
      if (thirdPlaceMatch && thirdPlaceMatch.status === 'completed') {
        if (thirdPlaceMatch.winnerId && thirdPlaceMatch.winnerName) {
          ranking.push({
            rank: 3,
            teamName: thirdPlaceMatch.winnerName,
            teamId: thirdPlaceMatch.winnerId,
            points: 60,
          });
        }
        if (thirdPlaceMatch.loserId && thirdPlaceMatch.loserName) {
          ranking.push({
            rank: 4,
            teamName: thirdPlaceMatch.loserName,
            teamId: thirdPlaceMatch.loserId,
            points: 40,
          });
        }
      }

      // Find semi-final losers not already in ranking (if no 3rd place match)
      const semiFinals = matches.filter((m: any) => m.round === 'Demi-finale' && m.status === 'completed');
      const rankedTeamIds = new Set(ranking.map((r) => r.teamId));

      semiFinals.forEach((sf: any) => {
        if (sf.loserId && sf.loserName && !rankedTeamIds.has(sf.loserId)) {
          ranking.push({
            rank: ranking.length + 1,
            teamName: sf.loserName,
            teamId: sf.loserId,
            points: 30,
          });
          rankedTeamIds.add(sf.loserId);
        }
      });

      // Find quarter-final losers
      const quarterFinals = matches.filter((m: any) => m.round === 'Quart de finale' && m.status === 'completed');
      quarterFinals.forEach((qf: any) => {
        if (qf.loserId && qf.loserName && !rankedTeamIds.has(qf.loserId)) {
          ranking.push({
            rank: ranking.length + 1,
            teamName: qf.loserName,
            teamId: qf.loserId,
            points: 20,
          });
          rankedTeamIds.add(qf.loserId);
        }
      });

      // Find preliminary match losers
      const preliminaryMatches = matches.filter((m: any) => m.round === 'Tour Préliminaire' && m.status === 'completed');
      preliminaryMatches.forEach((pm: any) => {
        if (pm.loserId && pm.loserName && !rankedTeamIds.has(pm.loserId)) {
          ranking.push({
            rank: ranking.length + 1,
            teamName: pm.loserName,
            teamId: pm.loserId,
            points: 10,
          });
          rankedTeamIds.add(pm.loserId);
        }
      });
    }

    if (ranking.length === 0) {
      throw new AppError('Unable to calculate ranking from elimination matches', 400);
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
    console.error('Error freezing elimination ranking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error freezing elimination ranking', 500);
  }
};

export const getTeams = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get all teams
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    // Get all pools to check which teams are already assigned
    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    // Get all global rankings to enrich members with points
    const rankingsSnapshot = await adminDb.collection('globalPlayerRanking').get();
    const rankingsMap = new Map<string, number>();
    rankingsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      rankingsMap.set(doc.id, data.totalPoints || 0);
    });

    // Create a set of team IDs that are already assigned to pools
    const assignedTeamIds = new Set<string>();
    poolsSnapshot.docs.forEach((poolDoc) => {
      const poolData = poolDoc.data();
      const poolTeams = poolData.teams || [];
      poolTeams.forEach((team: any) => {
        if (team.id) {
          assignedTeamIds.add(team.id);
        }
      });
    });

    // Map teams with isAssigned field and populate captainPseudo if missing
    const teamsPromises = teamsSnapshot.docs.map(async (doc) => {
      const teamData = doc.data();
      let captainPseudo = teamData.captainPseudo;

      // If captainPseudo is missing but captainId exists, fetch it
      if (!captainPseudo && teamData.captainId) {
        try {
          const captainDoc = await adminDb.collection('users').doc(teamData.captainId).get();
          if (captainDoc.exists) {
            captainPseudo = captainDoc.data()?.pseudo || 'Unknown';
            // Update the team document with the captain pseudo for future use
            await doc.ref.update({ captainPseudo });
          }
        } catch (err) {
          console.warn(`Failed to fetch captain for team ${doc.id}:`, err);
        }
      }

      // Enrich members with their points
      const members = (teamData.members || []).map((member: any) => ({
        ...member,
        totalPoints: rankingsMap.get(member.userId) || 0,
      }));

      return convertTimestamps({
        id: doc.id,
        ...teamData,
        members,
        captainPseudo,
        isAssigned: assignedTeamIds.has(doc.id),
      });
    });

    const teams = await Promise.all(teamsPromises);

    res.json({
      success: true,
      data: { teams },
    });
  } catch (error) {
    console.error('Error getting teams:', error);
    throw new AppError('Error retrieving teams', 500);
  }
};

export const createTeam = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { name, captainId, members, recruitmentOpen, weight } = req.body;

    if (!name) {
      throw new AppError('Team name is required', 400);
    }

    const teamData: any = {
      name,
      members: members || [],
      recruitmentOpen: recruitmentOpen !== undefined ? recruitmentOpen : false,
      weight: weight ? parseInt(weight) : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Captain ID is optional - admin can create team without captain
    if (captainId) {
      teamData.captainId = captainId;

      // If captain is provided, verify they exist and add to members if not already
      const captainDoc = await adminDb.collection('users').doc(captainId).get();
      if (!captainDoc.exists) {
        throw new AppError('Captain user not found', 404);
      }

      const captainData = captainDoc.data();
      const isCaptainInMembers = teamData.members.some((m: any) => m.userId === captainId);

      if (!isCaptainInMembers) {
        teamData.members.push({
          userId: captainId,
          pseudo: captainData?.pseudo || 'Unknown',
          level: captainData?.level || 'N/A',
        });
      }
    }

    // Automatically calculate globalRanking based on members' points
    teamData.globalRanking = await calculateTeamGlobalRanking(teamData.members);

    const teamRef = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .add(teamData);

    res.json({
      success: true,
      message: 'Team created successfully',
      data: {
        id: teamRef.id,
        globalRanking: teamData.globalRanking
      },
    });
  } catch (error: any) {
    console.error('Error creating team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating team', 500);
  }
};

export const updateTeam = async (req: Request, res: Response) => {
  try {
    const { tournamentId, teamId } = req.params;
    const { name, captainId, captainPseudo, members, recruitmentOpen, weight } = req.body;

    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined && name !== null) updateData.name = name;
    if (captainId !== undefined && captainId !== null) {
      updateData.captainId = captainId;

      // If captainPseudo is provided, use it; otherwise fetch from user data
      if (captainPseudo !== undefined && captainPseudo !== null) {
        updateData.captainPseudo = captainPseudo;
      } else {
        // Fetch captain's pseudo from user data
        const captainDoc = await adminDb.collection('users').doc(captainId).get();
        if (captainDoc.exists) {
          const captainData = captainDoc.data();
          updateData.captainPseudo = captainData?.pseudo || 'Unknown';
        }
      }
    }
    if (members !== undefined && members !== null) {
      updateData.members = members;
      // Automatically calculate globalRanking based on members' points
      updateData.globalRanking = await calculateTeamGlobalRanking(members);
    }
    if (recruitmentOpen !== undefined && recruitmentOpen !== null) updateData.recruitmentOpen = recruitmentOpen === true || recruitmentOpen === 'true';
    if (weight !== undefined && weight !== null) updateData.weight = parseInt(weight) || 0;

    await teamRef.update(updateData);

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: {
        globalRanking: updateData.globalRanking
      }
    });
  } catch (error: any) {
    console.error('Error updating team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating team', 500);
  }
};

export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { tournamentId, teamId } = req.params;

    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    await teamRef.delete();

    res.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting team', 500);
  }
};

/**
 * Recalculate globalRanking for all teams in a tournament
 */
export const recalculateTeamsRanking = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get all teams for this tournament
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    if (teamsSnapshot.empty) {
      throw new AppError('No teams found for this tournament', 404);
    }

    const batch = adminDb.batch();
    let updatedCount = 0;

    // Calculate and update globalRanking for each team
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const members = teamData.members || [];

      // Calculate new globalRanking
      const globalRanking = await calculateTeamGlobalRanking(members);

      // Update team with new globalRanking
      batch.update(teamDoc.ref, {
        globalRanking,
        updatedAt: new Date(),
      });

      updatedCount++;
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Successfully recalculated ranking for ${updatedCount} teams`,
      data: {
        teamsUpdated: updatedCount,
      },
    });
  } catch (error: any) {
    console.error('Error recalculating teams ranking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error recalculating teams ranking', 500);
  }
};

/**
 * User Management
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const usersSnapshot = await adminDb.collection('users').orderBy('pseudo').get();

    // Get all global rankings to enrich users with points
    const rankingsSnapshot = await adminDb.collection('globalPlayerRanking').get();
    const rankingsMap = new Map<string, number>();
    rankingsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      rankingsMap.set(doc.id, data.totalPoints || 0);
    });

    // Filter out virtual accounts and fake players
    const users = usersSnapshot.docs
      .map((doc) => convertTimestamps({
        id: doc.id,
        ...doc.data(),
        totalPoints: rankingsMap.get(doc.id) || 0,
      }))
      .filter((user: any) => {
        // Exclude virtual accounts (emails ending with @virtual.tournoi.com)
        if (user.email && user.email.endsWith('@virtual.tournoi.com')) {
          return false;
        }
        // Exclude fake players (pseudo starting with "JoueurFactice")
        if (user.pseudo && user.pseudo.startsWith('JoueurFactice')) {
          return false;
        }
        return true;
      });

    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    console.error('Error getting all users:', error);
    throw new AppError('Error retrieving users', 500);
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, pseudo, level, role, clubId, password } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    if (!pseudo) {
      throw new AppError('Pseudo is required', 400);
    }

    if (!password || password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    // Create Firebase Auth account
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: pseudo,
    });

    const userId = userRecord.uid;

    const userData: any = {
      email,
      pseudo,
      level: level || 'Débutant',
      role: role || 'user',
      clubId: clubId || null,
      isVirtual: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use Firebase Auth UID as document ID for consistency
    await adminDb.collection('users').doc(userId).set(userData);

    res.json({
      success: true,
      message: 'User created successfully',
      data: { id: userId },
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error instanceof AppError) throw error;
    // Handle Firebase Auth specific errors
    if (error.code === 'auth/email-already-exists') {
      throw new AppError('Un compte avec cet email existe déjà', 400);
    }
    if (error.code === 'auth/invalid-email') {
      throw new AppError('Email invalide', 400);
    }
    throw new AppError('Error creating user', 500);
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userDoc = await adminDb.collection('users').doc(id).get();

    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const user = convertTimestamps({
      id: userDoc.id,
      ...userDoc.data(),
    });

    res.json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    console.error('Error getting user by ID:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving user', 500);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, pseudo, level, role, clubId } = req.body;

    const userDoc = await adminDb.collection('users').doc(id).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (email !== undefined && email !== null) updateData.email = email;
    if (pseudo !== undefined && pseudo !== null) updateData.pseudo = pseudo;
    if (level !== undefined && level !== null) updateData.level = level;
    if (role !== undefined && role !== null) updateData.role = role;
    if (clubId !== undefined) updateData.clubId = clubId || null;

    await adminDb.collection('users').doc(id).update(updateData);

    res.json({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating user', 500);
  }
};

export const bulkUpdateUsers = async (req: Request, res: Response) => {
  try {
    const { userIds, clubId } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError('User IDs array is required', 400);
    }

    if (clubId === undefined) {
      throw new AppError('Club ID is required (use null to remove club)', 400);
    }

    const updateData: any = {
      clubId: clubId || null,
      updatedAt: new Date(),
    };

    // Update all users in batch
    const batch = adminDb.batch();
    let updatedCount = 0;

    for (const userId of userIds) {
      const userRef = adminDb.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        batch.update(userRef, updateData);
        updatedCount++;
      }
    }

    await batch.commit();

    res.json({
      success: true,
      message: `${updatedCount} user(s) updated successfully`,
      data: { updatedCount },
    });
  } catch (error: any) {
    console.error('Error bulk updating users:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating users', 500);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userDoc = await adminDb.collection('users').doc(id).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const userData = userDoc.data();

    // Prevent deleting admin users
    if (userData?.role === 'admin') {
      throw new AppError('Cannot delete admin users', 403);
    }

    // Delete user
    await adminDb.collection('users').doc(id).delete();

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting user', 500);
  }
};

export const getUnassignedPlayers = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Validate parameters
    if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.trim() === '') {
      throw new AppError('Tournament ID is required', 400);
    }

    const unassignedPlayersSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .get();

    // Get all global rankings to enrich players with points
    const rankingsSnapshot = await adminDb.collection('globalPlayerRanking').get();
    const rankingsMap = new Map<string, number>();
    rankingsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      rankingsMap.set(doc.id, data.totalPoints || 0);
    });

    const players = unassignedPlayersSnapshot.docs.map((doc) => {
      const data = doc.data();
      // Use userId if available, otherwise use doc.id
      const playerId = data.userId || doc.id;
      return convertTimestamps({
        id: doc.id,
        ...data,
        totalPoints: rankingsMap.get(playerId) || 0,
      });
    });

    res.json({
      success: true,
      data: { players },
    });
  } catch (error) {
    console.error('Error getting unassigned players:', error);
    throw new AppError('Error retrieving unassigned players', 500);
  }
};

export const removeUnassignedPlayer = async (req: Request, res: Response) => {
  try {
    const { tournamentId, userId } = req.params;

    // Validate parameters
    if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.trim() === '') {
      throw new AppError('Tournament ID is required', 400);
    }
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AppError('User ID is required', 400);
    }

    const playerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      throw new AppError('Unassigned player not found', 404);
    }

    await playerRef.delete();

    res.json({
      success: true,
      message: 'Unassigned player removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing unassigned player:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error removing unassigned player', 500);
  }
};

export const addUnassignedPlayer = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { userId, questionResponses } = req.body;

    // Validate parameters
    if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.trim() === '') {
      throw new AppError('Tournament ID is required', 400);
    }
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AppError('User ID is required', 400);
    }

    // Check if tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }
    const userData = userDoc.data();

    // Check if player is already in the unassigned list
    const existingPlayerDoc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId)
      .get();

    if (existingPlayerDoc.exists) {
      throw new AppError('Ce joueur est déjà dans la liste des joueurs non assignés', 400);
    }

    // Check if player is already in a team
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const members = teamData.members || [];
      if (members.some((m: any) => m.userId === userId)) {
        throw new AppError('Ce joueur est déjà membre d\'une équipe dans ce tournoi', 400);
      }
    }

    // Prepare player data
    const playerData: any = {
      userId: userId,
      pseudo: userData?.pseudo || 'Inconnu',
      email: userData?.email || '',
      level: userData?.level || 'N/A',
      sexe: userData?.sexe || 'homme',
      registeredAt: new Date(),
    };

    // Add question responses if provided
    if (questionResponses && Array.isArray(questionResponses) && questionResponses.length > 0) {
      playerData.questionResponses = questionResponses;
    }

    // Add player to unassigned list
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId)
      .set(playerData);

    res.json({
      success: true,
      message: 'Joueur ajouté avec succès',
    });
  } catch (error: any) {
    console.error('Error adding unassigned player:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error adding unassigned player', 500);
  }
};

export const updateUnassignedPlayer = async (req: Request, res: Response) => {
  try {
    const { tournamentId, userId } = req.params;
    const { pseudo, level, sexe, questionResponses } = req.body;

    // Validate parameters
    if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.trim() === '') {
      throw new AppError('Tournament ID is required', 400);
    }
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AppError('User ID is required', 400);
    }

    // Check if tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    // Check if player exists in unassigned list
    const playerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      throw new AppError('Player not found in unassigned list', 404);
    }

    // Prepare update data
    const updateData: any = {};
    if (pseudo !== undefined && typeof pseudo === 'string' && pseudo.trim() !== '') {
      updateData.pseudo = pseudo.trim();
    }
    if (level !== undefined && typeof level === 'string') {
      if (!['Débutant', 'Intermédiaire', 'Confirmé'].includes(level)) {
        throw new AppError('Invalid level value', 400);
      }
      updateData.level = level;
    }
    if (sexe !== undefined && typeof sexe === 'string') {
      if (!['homme', 'femme'].includes(sexe)) {
        throw new AppError('Invalid sexe value', 400);
      }
      updateData.sexe = sexe;
    }
    if (questionResponses !== undefined) {
      if (Array.isArray(questionResponses)) {
        updateData.questionResponses = questionResponses;
      } else {
        throw new AppError('questionResponses must be an array', 400);
      }
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    // Update the player
    await playerRef.update(updateData);

    res.json({
      success: true,
      message: 'Joueur mis à jour avec succès',
      data: { ...playerDoc.data(), ...updateData },
    });
  } catch (error: any) {
    console.error('Error updating unassigned player:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating unassigned player', 500);
  }
};

/**
 * Dashboard
 */
export const getDashboard = async (req: Request, res: Response) => {
  try {
    // Get total users count
    const usersSnapshot = await adminDb.collection('users').get();
    const totalUsers = usersSnapshot.size;

    // Get total tournaments count
    const eventsSnapshot = await adminDb.collection('events').get();
    const totalTournaments = eventsSnapshot.size;

    // Get active tournaments count
    const activeEventsSnapshot = await adminDb.collection('events').where('isActive', '==', true).get();
    const activeTournaments = activeEventsSnapshot.size;

    // Get total teams count (across all tournaments)
    let totalTeams = 0;
    for (const eventDoc of eventsSnapshot.docs) {
      const teamsSnapshot = await adminDb.collection('events').doc(eventDoc.id).collection('teams').get();
      totalTeams += teamsSnapshot.size;
    }

    // Get recent tournaments (last 5)
    const recentTournamentsSnapshot = await adminDb
      .collection('events')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const recentTournaments = recentTournamentsSnapshot.docs.map((doc) => convertTimestamps({
      id: doc.id,
      ...doc.data(),
    }));

    // Get recent users (last 5)
    const recentUsersSnapshot = await adminDb
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const recentUsers = recentUsersSnapshot.docs.map((doc) => convertTimestamps({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalTournaments,
          activeTournaments,
          totalTeams,
        },
        recentTournaments,
        recentUsers,
      },
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    throw new AppError('Error retrieving dashboard data', 500);
  }
};

/**
 * Virtual Accounts Management
 */

/**
 * Get all virtual users
 */
export const getAllVirtualUsers = async (req: Request, res: Response) => {
  try {
    // Get all users and filter by virtual email pattern
    const usersSnapshot = await adminDb.collection('users').get();

    // Filter virtual users by email pattern
    const virtualUserDocs = usersSnapshot.docs.filter((doc) => {
      const userData = doc.data();
      return userData.email && userData.email.endsWith('@virtual.tournoi.com');
    });

    const virtualUsers = await Promise.all(
      virtualUserDocs.map(async (doc) => {
        const userData = doc.data();

        // Find which teams this virtual user belongs to
        const teams: any[] = [];
        const eventsSnapshot = await adminDb.collection('events').get();

        for (const eventDoc of eventsSnapshot.docs) {
          const teamsSnapshot = await eventDoc.ref.collection('teams').get();

          for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();
            const members = teamData.members || [];

            if (members.some((m: any) => m.userId === doc.id)) {
              teams.push({
                teamId: teamDoc.id,
                teamName: teamData.name,
                tournamentId: eventDoc.id,
                tournamentName: eventDoc.data().name,
                isCaptain: teamData.captainId === doc.id,
              });
            }
          }
        }

        return convertTimestamps({
          id: doc.id,
          ...userData,
          teams,
        });
      })
    );

    res.json({
      success: true,
      data: { virtualUsers },
    });
  } catch (error) {
    console.error('Error getting virtual users:', error);
    throw new AppError('Error retrieving virtual users', 500);
  }
};

/**
 * Link virtual account to existing real account (admin operation)
 */
export const linkVirtualToRealUser = async (req: Request, res: Response) => {
  const { virtualUserId, realUserId } = req.body;

  if (!virtualUserId || !realUserId) {
    throw new AppError('Virtual user ID and real user ID are required', 400);
  }

  try {
    // Verify virtual user exists and is virtual
    const virtualUserDoc = await adminDb.collection('users').doc(virtualUserId).get();

    if (!virtualUserDoc.exists) {
      throw new AppError('Virtual user not found', 404);
    }

    const virtualUserData = virtualUserDoc.data();

    // Check if user is virtual by email pattern (consistent with getAllVirtualUsers)
    const isVirtualByEmail = virtualUserData?.email?.endsWith('@virtual.tournoi.com');
    const isVirtualByFlag = virtualUserData?.isVirtual;

    if (!isVirtualByEmail && !isVirtualByFlag) {
      throw new AppError('This is not a virtual account', 400);
    }

    // Verify real user exists and is not virtual
    const realUserDoc = await adminDb.collection('users').doc(realUserId).get();

    if (!realUserDoc.exists) {
      throw new AppError('Real user not found', 404);
    }

    const realUserData = realUserDoc.data();

    // Check if target is virtual (by email pattern or flag)
    const targetIsVirtualByEmail = realUserData?.email?.endsWith('@virtual.tournoi.com');
    const targetIsVirtualByFlag = realUserData?.isVirtual;

    if (targetIsVirtualByEmail || targetIsVirtualByFlag) {
      throw new AppError('Target user is also a virtual account', 400);
    }

    // Start batch operations
    const batch = adminDb.batch();

    // Update all teams that reference the virtual user
    const eventsSnapshot = await adminDb.collection('events').get();

    for (const eventDoc of eventsSnapshot.docs) {
      const teamsSnapshot = await eventDoc.ref.collection('teams').get();

      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const members = teamData.members || [];

        // Check if virtual user is in this team
        const memberIndex = members.findIndex((m: any) => m.userId === virtualUserId);

        if (memberIndex !== -1) {
          // Check if real user is already in this team
          const realUserInTeam = members.some((m: any) => m.userId === realUserId);

          if (realUserInTeam) {
            // Real user already in team, just remove virtual user
            members.splice(memberIndex, 1);
          } else {
            // Replace virtual user with real user
            members[memberIndex] = {
              userId: realUserId,
              pseudo: realUserData.pseudo,
              level: realUserData.level,
            };
          }

          batch.update(teamDoc.ref, {
            members,
            updatedAt: new Date(),
          });

          // If virtual user was captain, transfer captainship
          if (teamData.captainId === virtualUserId) {
            batch.update(teamDoc.ref, {
              captainId: realUserId,
              captainPseudo: realUserData.pseudo,
              updatedAt: new Date(),
            });
          }
        }
      }

      // Handle unassigned players
      const unassignedRef = eventDoc.ref.collection('unassignedPlayers').doc(virtualUserId);
      const unassignedDoc = await unassignedRef.get();

      if (unassignedDoc.exists) {
        batch.delete(unassignedRef);

        // Check if real user is not already in unassigned
        const realUnassignedRef = eventDoc.ref.collection('unassignedPlayers').doc(realUserId);
        const realUnassignedDoc = await realUnassignedRef.get();

        if (!realUnassignedDoc.exists) {
          batch.set(realUnassignedRef, {
            userId: realUserId,
            pseudo: realUserData.pseudo,
            level: realUserData.level,
            updatedAt: new Date(),
          });
        }
      }
    }

    // Delete virtual user document
    batch.delete(adminDb.collection('users').doc(virtualUserId));

    // Commit all changes
    await batch.commit();

    // Transfer tournament points from virtual user to real user
    let pointsTransferred = 0;
    try {
      const virtualPointsSnapshot = await adminDb
        .collection('playerTournamentPoints')
        .doc(virtualUserId)
        .collection('tournaments')
        .get();

      if (!virtualPointsSnapshot.empty) {
        const pointsBatch = adminDb.batch();

        for (const pointsDoc of virtualPointsSnapshot.docs) {
          const pointsData = pointsDoc.data();

          // Transfer points to real user (update playerId and pseudo)
          const realPointsRef = adminDb
            .collection('playerTournamentPoints')
            .doc(realUserId)
            .collection('tournaments')
            .doc(pointsDoc.id);

          pointsBatch.set(realPointsRef, {
            ...pointsData,
            playerId: realUserId,
            playerPseudo: realUserData.pseudo,
          });

          // Delete old virtual user points
          pointsBatch.delete(pointsDoc.ref);
          pointsTransferred++;
        }

        await pointsBatch.commit();

        // Delete virtual user's playerTournamentPoints parent document if it exists
        await adminDb.collection('playerTournamentPoints').doc(virtualUserId).delete().catch(() => {
          // Ignore error if document doesn't exist
        });

        // Delete virtual user's global ranking if it exists
        await adminDb.collection('globalPlayerRanking').doc(virtualUserId).delete().catch(() => {
          // Ignore error if document doesn't exist
        });

        // Recalculate global ranking for the real user
        await updateGlobalRankings([realUserId]);
      }
    } catch (error) {
      console.error('Error transferring tournament points:', error);
      // Don't throw - the main linking operation succeeded
    }

    // Delete virtual user from Firebase Auth
    try {
      await adminAuth.deleteUser(virtualUserId);
    } catch (error) {
      console.warn('Failed to delete virtual user from Firebase Auth:', error);
    }

    res.json({
      success: true,
      message: `Virtual account successfully linked to real account. ${pointsTransferred} tournament points transferred.`,
    });
  } catch (error) {
    console.error('Error linking virtual to real user:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error linking virtual account', 500);
  }
};

/**
 * Delete a virtual user
 */
export const deleteVirtualUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  try {
    // Verify user exists and is virtual
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const userData = userDoc.data();

    // Check if user is virtual by email pattern or flag
    const isVirtualByEmail = userData?.email?.endsWith('@virtual.tournoi.com');
    const isVirtualByFlag = userData?.isVirtual;

    if (!isVirtualByEmail && !isVirtualByFlag) {
      throw new AppError('This is not a virtual account', 400);
    }

    const batch = adminDb.batch();

    // Remove virtual user from all teams
    const eventsSnapshot = await adminDb.collection('events').get();

    for (const eventDoc of eventsSnapshot.docs) {
      const teamsSnapshot = await eventDoc.ref.collection('teams').get();

      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        const members = teamData.members || [];

        // Check if virtual user is in this team
        const memberIndex = members.findIndex((m: any) => m.userId === userId);

        if (memberIndex !== -1) {
          // Remove virtual user from team
          members.splice(memberIndex, 1);

          batch.update(teamDoc.ref, {
            members,
            updatedAt: new Date(),
          });

          // If virtual user was captain and there are remaining members, transfer captainship
          if (teamData.captainId === userId && members.length > 0) {
            batch.update(teamDoc.ref, {
              captainId: members[0].userId,
              captainPseudo: members[0].pseudo,
            });
          }
        }
      }

      // Remove from unassigned players
      const unassignedRef = eventDoc.ref.collection('unassignedPlayers').doc(userId);
      const unassignedDoc = await unassignedRef.get();

      if (unassignedDoc.exists) {
        batch.delete(unassignedRef);
      }
    }

    // Delete user document
    batch.delete(adminDb.collection('users').doc(userId));

    // Commit all changes
    await batch.commit();

    // Delete tournament points if any
    try {
      const pointsSnapshot = await adminDb
        .collection('playerTournamentPoints')
        .doc(userId)
        .collection('tournaments')
        .get();

      if (!pointsSnapshot.empty) {
        const pointsBatch = adminDb.batch();
        for (const pointsDoc of pointsSnapshot.docs) {
          pointsBatch.delete(pointsDoc.ref);
        }
        await pointsBatch.commit();
      }

      // Delete parent document
      await adminDb.collection('playerTournamentPoints').doc(userId).delete().catch(() => {});

      // Delete global ranking
      await adminDb.collection('globalPlayerRanking').doc(userId).delete().catch(() => {});
    } catch (error) {
      console.error('Error deleting tournament points:', error);
    }

    // Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(userId);
    } catch (error) {
      console.warn('Failed to delete virtual user from Firebase Auth:', error);
    }

    res.json({
      success: true,
      message: 'Virtual account deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting virtual user:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting virtual account', 500);
  }
};

/**
 * Generate random teams from unassigned players
 */
export const generateRandomTeams = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();

    // Check if tournament is in random mode
    if (tournament?.registrationMode !== 'random') {
      throw new AppError('This tournament is not in random registration mode', 400);
    }

    const playersPerTeam = tournament.playersPerTeam || 4;

    // Get all unassigned players
    const unassignedPlayersSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .get();

    if (unassignedPlayersSnapshot.empty) {
      throw new AppError('No players registered for this tournament', 400);
    }

    const players: any[] = unassignedPlayersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Check if we have enough players
    if (players.length < playersPerTeam) {
      throw new AppError(`Not enough players. Need at least ${playersPerTeam} players to create teams.`, 400);
    }

    // Define level ranking (higher = better)
    const levelRanking: { [key: string]: number } = {
      'confirmé': 3,
      'confirme': 3,
      'intermédiaire': 2,
      'intermediaire': 2,
      'débutant': 1,
      'debutant': 1,
    };

    // Sort players by level (best to worst), with random shuffle for same levels
    const sortedPlayers = [...players].sort((a, b) => {
      const levelA = levelRanking[a.level?.toLowerCase()] || 0;
      const levelB = levelRanking[b.level?.toLowerCase()] || 0;

      if (levelA !== levelB) {
        return levelB - levelA; // Descending order (best first)
      }

      // Random order for players with same level
      return Math.random() - 0.5;
    });

    // Calculate number of complete teams we can create
    const numTeams = Math.floor(sortedPlayers.length / playersPerTeam);

    if (numTeams === 0) {
      throw new AppError(`Not enough players to create a complete team. Need at least ${playersPerTeam} players.`, 400);
    }

    // Distribute players using snake draft algorithm for balanced teams
    // This ensures each team gets a fair distribution of skill levels
    const teams: any[][] = Array.from({ length: numTeams }, () => []);
    let currentTeam = 0;
    let direction = 1; // 1 for forward, -1 for backward

    for (let i = 0; i < numTeams * playersPerTeam; i++) {
      teams[currentTeam].push(sortedPlayers[i]);

      // Move to next team
      currentTeam += direction;

      // Change direction when we reach either end
      if (currentTeam >= numTeams) {
        currentTeam = numTeams - 1;
        direction = -1;
      } else if (currentTeam < 0) {
        currentTeam = 0;
        direction = 1;
      }
    }

    // Create teams in database
    const batch = adminDb.batch();

    for (let teamNum = 0; teamNum < numTeams; teamNum++) {
      const teamPlayers = teams[teamNum];

      // Create team document
      const teamRef = adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('teams')
        .doc();

      const members = teamPlayers.map((player: any) => ({
        userId: player.userId || player.id,
        pseudo: player.pseudo,
        level: player.level || 'N/A',
        isVirtual: player.isVirtual || false,
      }));

      const teamData = {
        name: `Équipe ${teamNum + 1}`,
        captainId: members[0].userId, // First player (highest level) is captain
        members: members,
        recruitmentOpen: false,
        registeredAt: new Date(),
        createdAt: new Date(),
      };

      batch.set(teamRef, teamData);

      // Remove players from unassigned list
      teamPlayers.forEach((player: any) => {
        const unassignedRef = adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('unassignedPlayers')
          .doc(player.id);
        batch.delete(unassignedRef);
      });
    }

    await batch.commit();

    // Calculate remaining players
    const remainingPlayers = sortedPlayers.length - (numTeams * playersPerTeam);

    res.json({
      success: true,
      message: `Successfully created ${numTeams} balanced team${numTeams > 1 ? 's' : ''} with ${playersPerTeam} players each.`,
      data: {
        teamsCreated: numTeams,
        playersAssigned: numTeams * playersPerTeam,
        remainingPlayers: remainingPlayers,
      },
    });
  } catch (error: any) {
    console.error('Error generating random teams:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error generating random teams', 500);
  }
};
/**
 * Match Score Management
 */

/**
 * Update pool match score (admin only)
 * POST /admin/tournaments/:tournamentId/pools/:poolId/matches/:matchId/update-score
 */
export const updatePoolMatchScore = async (req: Request, res: Response) => {
  try {
    const { tournamentId, poolId, matchId } = req.params;
    const { sets } = req.body;

    if (!sets || !Array.isArray(sets)) {
      throw new AppError('Invalid sets data', 400);
    }

    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }
    const tournament = tournamentDoc.data();

    // Get match
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

    // Update match
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

/**
 * Update elimination match score with result propagation (admin only)
 * POST /admin/tournaments/:tournamentId/elimination/:matchId/update-score
 */
export const updateEliminationMatchScore = async (req: Request, res: Response) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { sets } = req.body;

    if (!sets || !Array.isArray(sets)) {
      throw new AppError('Invalid sets data', 400);
    }

    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
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
      throw new AppError('Elimination match not found', 404);
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
    console.error('Error updating elimination match score:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating elimination match score', 500);
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
      throw new AppError('At least one team must be provided', 400);
    }

    // Get match
    const matchRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .doc(matchId);

    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      throw new AppError('Elimination match not found', 404);
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
    console.error('Error updating elimination match teams:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating elimination match teams', 500);
  }
};

/**
 * Pool Name Management
 */

/**
 * Update pool name
 * PUT /admin/tournaments/:tournamentId/pools/:poolId
 */
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

/**
 * Delete pool and all its matches
 * DELETE /admin/tournaments/:tournamentId/pools/:poolId
 */
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

    // Delete all matches in the pool
    const matchesSnapshot = await poolRef.collection('matches').get();
    matchesSnapshot.docs.forEach((matchDoc) => {
      batch.delete(matchDoc.ref);
    });

    // Delete the pool itself
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

/**
 * Round Schedule Management
 */

/**
 * Generate round schedule for all pool matches
 * POST /admin/tournaments/:tournamentId/generate-round-schedule
 *
 * Algorithm:
 * - Collect all matches from all pools
 * - Distribute matches across rounds based on number of fields (courts)
 * - Alternate between pools to balance the schedule
 */
export const generateRoundSchedule = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get tournament configuration
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const numberOfFields = tournament?.fields || 1;

    // Get all pools with their matches
    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    if (poolsSnapshot.empty) {
      throw new AppError('No pools found for this tournament', 404);
    }

    // Collect all matches from all pools
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

    // Build the round schedule by alternating between pools
    const poolIds = Array.from(poolMatches.keys());
    const poolIndices: Map<string, number> = new Map(poolIds.map(id => [id, 0]));

    let roundNumber = 1;
    let fieldNumber = 1;
    const batch = adminDb.batch();
    const scheduledMatches: any[] = [];

    // Keep distributing until all matches are scheduled
    let hasUnscheduledMatches = true;
    while (hasUnscheduledMatches) {
      hasUnscheduledMatches = false;

      // For each field in this round, pick a match from the next pool in rotation
      for (let field = 1; field <= numberOfFields; field++) {
        // Find the next pool that has unscheduled matches
        let matchAssigned = false;
        for (let attempt = 0; attempt < poolIds.length; attempt++) {
          const poolId = poolIds[(field - 1 + attempt) % poolIds.length];
          const poolMatchList = poolMatches.get(poolId)!;
          const currentIndex = poolIndices.get(poolId)!;

          if (currentIndex < poolMatchList.length) {
            const matchData = poolMatchList[currentIndex];

            // Update the match with round and field info
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

        // If no match was assigned for this field, try to fill from any pool with remaining matches
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

      // Rotate pool order for next round to ensure better alternation
      if (hasUnscheduledMatches) {
        poolIds.push(poolIds.shift()!);
        roundNumber++;
      }
    }

    await batch.commit();

    // Group scheduled matches by round for response
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

/**
 * Get round schedule for a tournament
 * GET /admin/tournaments/:tournamentId/round-schedule
 */
export const getRoundSchedule = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get tournament configuration
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const numberOfFields = tournament?.fields || 1;

    // Get all pools with their matches
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

    // Sort and group by round
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

/**
 * Update match schedule (for drag & drop reordering)
 * PUT /admin/tournaments/:tournamentId/pools/:poolId/matches/:matchId/schedule
 */
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

/**
 * Bulk update match schedules (for drag & drop reordering multiple matches)
 * PUT /admin/tournaments/:tournamentId/round-schedule
 */
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

/**
 * Clear round schedule (remove roundNumber and fieldNumber from all matches)
 * DELETE /admin/tournaments/:tournamentId/round-schedule
 */
export const clearRoundSchedule = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get all pools with their matches
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
