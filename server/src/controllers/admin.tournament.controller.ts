import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';

/**
 * Tournament Management Controller
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
      waitingListEnabled,
      waitingListSize,
      whatsappGroupLink,
      registrationMode,
      tournamentFormat,
      minPlayers,
      maxPlayers,
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
      waitingListEnabled: waitingListEnabled === true || waitingListEnabled === 'true' || false,
      waitingListSize: waitingListSize ? parseInt(waitingListSize) : 0,
      whatsappGroupLink: whatsappGroupLink?.trim() || '',
      registrationMode: registrationMode || 'teams',
      tournamentFormat: tournamentFormat || 'standard',
      minPlayers: minPlayers ? parseInt(minPlayers) : 0,
      maxPlayers: maxPlayers ? parseInt(maxPlayers) : 0,
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
      waitingListEnabled,
      waitingListSize,
      whatsappGroupLink,
      registrationMode,
      tournamentFormat,
      minPlayers,
      maxPlayers,
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
    if (waitingListEnabled !== undefined && waitingListEnabled !== null) updateData.waitingListEnabled = waitingListEnabled === true || waitingListEnabled === 'true';
    if (waitingListSize !== undefined && waitingListSize !== null) updateData.waitingListSize = parseInt(waitingListSize);
    if (whatsappGroupLink !== undefined && whatsappGroupLink !== null) updateData.whatsappGroupLink = whatsappGroupLink.trim();
    if (registrationMode !== undefined && registrationMode !== null) updateData.registrationMode = registrationMode;
    if (tournamentFormat !== undefined && tournamentFormat !== null) updateData.tournamentFormat = tournamentFormat;
    if (minPlayers !== undefined && minPlayers !== null) updateData.minPlayers = parseInt(minPlayers);
    if (maxPlayers !== undefined && maxPlayers !== null) updateData.maxPlayers = parseInt(maxPlayers);
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
