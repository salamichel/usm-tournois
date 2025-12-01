import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import { calculateMatchOutcome, propagateEliminationMatchResults } from '../services/match.service';
import { generateEliminationBracket as generateEliminationBracketService, QualifiedTeam, EliminationTournamentConfig } from '../services/elimination.service';
import { awardPointsToTeam, deleteTournamentPoints, updateGlobalRankings } from '../services/playerPoints.service';

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
      waitingListEnabled,
      waitingListSize,
      whatsappGroupLink,
      registrationMode,
      tournamentFormat,
      minPlayers,
      maxPlayers,
      isClubInternal,
    } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      throw new AppError('Tournament name is required', 400);
    }

    // Handle uploaded file (if any)
    const coverImagePath = (req as any).file ? `/uploads/${(req as any).file.filename}` : undefined;

    const tournamentData: any = {
      name: name.trim(),
      description: description?.trim() || '',
      date: date ? new Date(date) : new Date(),
      location: location?.trim() || '',
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
      waitingListEnabled: waitingListEnabled === true || waitingListEnabled === 'true' || false,
      waitingListSize: waitingListSize ? parseInt(waitingListSize) : 0,
      whatsappGroupLink: whatsappGroupLink?.trim() || '',
      registrationMode: registrationMode || 'teams',
      tournamentFormat: tournamentFormat || 'standard',
      minPlayers: minPlayers ? parseInt(minPlayers) : 0,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : 0,
      isClubInternal: isClubInternal === true || isClubInternal === 'true' || false,
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
      waitingListEnabled,
      waitingListSize,
      whatsappGroupLink,
      registrationMode,
      tournamentFormat,
      minPlayers,
      maxPlayers,
      isClubInternal,
    } = req.body;

    const tournamentDoc = await adminDb.collection('events').doc(id).get();

    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
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
    if (waitingListEnabled !== undefined && waitingListEnabled !== null) updateData.waitingListEnabled = waitingListEnabled === true || waitingListEnabled === 'true';
    if (waitingListSize !== undefined && waitingListSize !== null) updateData.waitingListSize = parseInt(waitingListSize);
    if (whatsappGroupLink !== undefined && whatsappGroupLink !== null) updateData.whatsappGroupLink = whatsappGroupLink.trim();
    if (registrationMode !== undefined && registrationMode !== null) updateData.registrationMode = registrationMode;
    if (tournamentFormat !== undefined && tournamentFormat !== null) updateData.tournamentFormat = tournamentFormat;
    if (minPlayers !== undefined && minPlayers !== null) updateData.minPlayers = parseInt(minPlayers);
    if (maxPlayers !== undefined && maxPlayers !== null) updateData.maxPlayers = parseInt(maxPlayers);
    if (isClubInternal !== undefined && isClubInternal !== null) updateData.isClubInternal = isClubInternal === true || isClubInternal === 'true';

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

        return convertTimestamps({
          id: poolDoc.id,
          ...poolData,
          matches,
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

    // Generate matches
    let matchNumber = 1;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const team1 = teams[i];
        const team2 = teams[j];

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
    const { qualifiedTeamIds } = req.body; // Nouvelle option : liste manuelle des équipes qualifiées

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

    // Generate bracket using the service (handles any number of teams)
    const generatedMatches = generateEliminationBracketService(qualifiedTeams, tournamentConfig);

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

      batch.set(matchRef, matchData);
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Elimination bracket generated successfully with ${generatedMatches.length} matches for ${qualifiedTeams.length} teams`,
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
        const playerIds = await awardPointsToTeam(
          tournamentId,
          tournamentName,
          tournamentDate,
          teamData,
          rank
        );

        playerIds.forEach(id => {
          if (!newAffectedPlayerIds.includes(id)) {
            newAffectedPlayerIds.push(id);
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

export const freezeEliminationRanking = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get all elimination matches
    const eliminationMatchesSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .get();

    const matches = eliminationMatchesSnapshot.docs.map((doc) => ({
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

    // Find final and 3rd place match
    const finale = matches.find((m: any) => m.round === 'Finale');
    const thirdPlaceMatch = matches.find((m: any) => m.round === 'Match 3ème place');

    if (!finale || finale.status !== 'completed') {
      throw new AppError('La finale doit être terminée pour figer le classement', 400);
    }

    // Build ranking from elimination results
    const ranking: any[] = [];

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

    // Map teams with isAssigned field
    const teams = teamsSnapshot.docs.map((doc) =>
      convertTimestamps({
        id: doc.id,
        ...doc.data(),
        isAssigned: assignedTeamIds.has(doc.id),
      })
    );

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
    const { name, captainId, members, recruitmentOpen } = req.body;

    if (!name) {
      throw new AppError('Team name is required', 400);
    }

    const teamData: any = {
      name,
      members: members || [],
      recruitmentOpen: recruitmentOpen !== undefined ? recruitmentOpen : false,
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

    const teamRef = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .add(teamData);

    res.json({
      success: true,
      message: 'Team created successfully',
      data: { id: teamRef.id },
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
    const { name, captainId, members, recruitmentOpen } = req.body;

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
    if (captainId !== undefined && captainId !== null) updateData.captainId = captainId;
    if (members !== undefined && members !== null) updateData.members = members;
    if (recruitmentOpen !== undefined && recruitmentOpen !== null) updateData.recruitmentOpen = recruitmentOpen === true || recruitmentOpen === 'true';

    await teamRef.update(updateData);

    res.json({
      success: true,
      message: 'Team updated successfully',
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
 * User Management
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const usersSnapshot = await adminDb.collection('users').orderBy('pseudo').get();

    // Filter out virtual accounts and fake players
    const users = usersSnapshot.docs
      .map((doc) => convertTimestamps({
        id: doc.id,
        ...doc.data(),
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
    const { email, pseudo, level, role, clubId } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    if (!pseudo) {
      throw new AppError('Pseudo is required', 400);
    }

    const userData: any = {
      email,
      pseudo,
      level: level || 'Débutant',
      role: role || 'user',
      clubId: clubId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const userRef = await adminDb.collection('users').add(userData);

    res.json({
      success: true,
      message: 'User created successfully',
      data: { id: userRef.id },
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    if (error instanceof AppError) throw error;
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

    const players = unassignedPlayersSnapshot.docs.map((doc) =>
      convertTimestamps({
        id: doc.id,
        ...doc.data(),
      })
    );

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

    if (!virtualUserData?.isVirtual) {
      throw new AppError('This is not a virtual account', 400);
    }

    // Verify real user exists and is not virtual
    const realUserDoc = await adminDb.collection('users').doc(realUserId).get();

    if (!realUserDoc.exists) {
      throw new AppError('Real user not found', 404);
    }

    const realUserData = realUserDoc.data();

    if (realUserData?.isVirtual) {
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

    // Delete virtual user from Firebase Auth
    const { adminAuth } = await import('../config/firebase.config');
    try {
      await adminAuth.deleteUser(virtualUserId);
    } catch (error) {
      console.warn('Failed to delete virtual user from Firebase Auth:', error);
    }

    res.json({
      success: true,
      message: 'Virtual account successfully linked to real account',
    });
  } catch (error) {
    console.error('Error linking virtual to real user:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error linking virtual account', 500);
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

    const players = unassignedPlayersSnapshot.docs.map(doc => ({
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
