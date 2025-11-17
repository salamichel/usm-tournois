import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import type { Tournament, UnassignedPlayer, Team, TeamMember } from '@shared/types';
import { convertTimestamps } from '../utils/firestore.utils';

/**
 * Get all active tournaments
 */
export const getAllTournaments = async (req: Request, res: Response) => {
  try {
    const tournamentsSnapshot = await adminDb
      .collection('events')
      .where('isActive', '==', true)
      .get();

    const tournaments = await Promise.all(
      tournamentsSnapshot.docs.map(async (doc) => {
        const tournamentData: any = doc.data();

        // Count registered teams
        const teamsSnapshot = await adminDb
          .collection('events')
          .doc(doc.id)
          .collection('teams')
          .get();

        return convertTimestamps({
          id: doc.id,
          ...tournamentData,
          registeredTeamsCount: teamsSnapshot.size,
        });
      })
    );

    res.json({
      success: true,
      data: { tournaments },
    });
  } catch (error) {
    console.error('Error getting tournaments:', error);
    throw new AppError('Error retrieving tournaments', 500);
  }
};

/**
 * Get tournament by ID
 */
export const getTournamentById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const tournamentDoc = await adminDb.collection('events').doc(id).get();

    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    // Get teams
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('teams')
      .get();
    const teams = teamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Get unassigned players
    const unassignedPlayersSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('unassignedPlayers')
      .get();
    const unassignedPlayers = unassignedPlayersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get pools and matches
    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('pools')
      .get();
    const pools = await Promise.all(
      poolsSnapshot.docs.map(async (poolDoc) => {
        const matchesSnapshot = await poolDoc.ref.collection('matches').orderBy('matchNumber').get();
        return {
          id: poolDoc.id,
          ...poolDoc.data(),
          matches: matchesSnapshot.docs.map((m) => ({ id: m.id, ...m.data() })),
        };
      })
    );

    // Get elimination matches
    const eliminationMatchesSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('eliminationMatches')
      .get();
    const eliminationMatches = eliminationMatchesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: 'elimination',
    }));

    // Get final ranking
    const finalRankingSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('finalRanking')
      .orderBy('rank')
      .get();
    const finalRanking = finalRankingSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get waiting list
    const waitingListSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('waitingListPlayers')
      .get();
    const waitingList = waitingListSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      data: convertTimestamps({
        tournament: { id: tournamentDoc.id, ...tournamentDoc.data() },
        teams,
        unassignedPlayers,
        pools,
        eliminationMatches,
        finalRanking,
        waitingList,
      }),
    });
  } catch (error) {
    console.error('Error getting tournament:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving tournament', 500);
  }
};

/**
 * Register player as free agent
 */
export const registerPlayer = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Check if tournament exists and is active
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    if (!tournament?.isActive) {
      throw new AppError('Tournament is not active', 400);
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const userData = userDoc.data();

    // Register as unassigned player
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId)
      .set({
        userId: userId,
        pseudo: userData?.pseudo || 'Unknown',
        level: userData?.level || 'N/A',
        registeredAt: new Date(),
      });

    res.json({
      success: true,
      message: 'Successfully registered as free player',
    });
  } catch (error) {
    console.error('Error registering player:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error registering player', 500);
  }
};

/**
 * Register team to tournament
 */
export const registerTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Verify tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    // Find team across all tournaments where user is captain
    let foundTeamData: any = null;
    const allEventsSnapshot = await adminDb.collection('events').get();

    for (const eventDoc of allEventsSnapshot.docs) {
      const teamsSnapshot = await adminDb
        .collection('events')
        .doc(eventDoc.id)
        .collection('teams')
        .where('captainId', '==', userId)
        .get();

      for (const teamDoc of teamsSnapshot.docs) {
        if (teamDoc.id === teamId) {
          foundTeamData = { id: teamDoc.id, ...teamDoc.data() };
          break;
        }
      }
      if (foundTeamData) break;
    }

    if (!foundTeamData) {
      throw new AppError('Team not found or you are not the captain', 404);
    }

    // Check if already registered
    const existingRegistration = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (existingRegistration.exists) {
      throw new AppError('Team is already registered for this tournament', 400);
    }

    // Register team
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .set({
        ...foundTeamData,
        registeredAt: new Date(),
      });

    res.json({
      success: true,
      message: 'Team successfully registered for tournament',
    });
  } catch (error) {
    console.error('Error registering team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error registering team', 500);
  }
};

/**
 * Unregister team from tournament
 */
export const unregisterTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const teamDoc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found in this tournament', 404);
    }

    const teamData = teamDoc.data();
    if (teamData?.captainId !== userId) {
      throw new AppError('You are not the captain of this team', 403);
    }

    // Remove team from tournament
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .delete();

    res.json({
      success: true,
      message: 'Team successfully unregistered from tournament',
    });
  } catch (error) {
    console.error('Error unregistering team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error unregistering team', 500);
  }
};

/**
 * Leave tournament (as player or team member)
 */
export const leaveTournament = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const batch = adminDb.batch();

    // Remove from unassigned players
    const unassignedPlayerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const unassignedPlayerDoc = await unassignedPlayerRef.get();
    if (unassignedPlayerDoc.exists) {
      batch.delete(unassignedPlayerRef);
    }

    // Remove from teams
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      if (teamData.members && Array.isArray(teamData.members)) {
        const userInTeam = teamData.members.find((m: any) => m.userId === userId);
        if (userInTeam) {
          const updatedMembers = teamData.members.filter((m: any) => m.userId !== userId);
          batch.update(teamDoc.ref, { members: updatedMembers });
        }
      }
    }

    await batch.commit();

    res.json({
      success: true,
      message: 'Successfully left tournament',
    });
  } catch (error) {
    console.error('Error leaving tournament:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error leaving tournament', 500);
  }
};

/**
 * Join a team
 */
export const joinTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Check tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();

    // Check team exists
    const teamDoc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found in this tournament', 404);
    }

    const teamData = teamDoc.data();

    // Check if team is full
    const currentMembers = teamData?.members || [];
    if (currentMembers.length >= (tournament?.playersPerTeam || 4)) {
      throw new AppError('Team has reached maximum number of players', 400);
    }

    // Check if user is already in team
    const alreadyInTeam = currentMembers.some((m: any) => m.userId === userId);
    if (alreadyInTeam) {
      throw new AppError('You are already a member of this team', 400);
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const userData = userDoc.data();
    const batch = adminDb.batch();

    // Add to team
    batch.update(teamDoc.ref, {
      members: [
        ...currentMembers,
        {
          userId: userId,
          pseudo: userData?.pseudo || 'Unknown',
          level: userData?.level || 'N/A',
        },
      ],
    });

    // Remove from unassigned players if present
    const unassignedPlayerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const unassignedDoc = await unassignedPlayerRef.get();
    if (unassignedDoc.exists) {
      batch.delete(unassignedPlayerRef);
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Successfully joined team ${teamData?.name}`,
    });
  } catch (error) {
    console.error('Error joining team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error joining team', 500);
  }
};

/**
 * Leave a team
 */
export const leaveTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    const teamDoc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const teamData = teamDoc.data();
    const members = teamData?.members || [];
    const memberToLeave = members.find((m: any) => m.userId === userId);

    if (!memberToLeave) {
      throw new AppError('You are not a member of this team', 400);
    }

    const batch = adminDb.batch();

    if (userId === teamData?.captainId) {
      // Captain leaving
      const updatedMembers = members.filter((m: any) => m.userId !== userId);

      if (updatedMembers.length > 0) {
        // Transfer captainship to first remaining member
        const newCaptain = updatedMembers[0];
        batch.update(teamDoc.ref, {
          members: updatedMembers,
          captainId: newCaptain.userId,
        });
      } else {
        // Delete team if captain was only member
        batch.delete(teamDoc.ref);
      }
    } else {
      // Regular member leaving
      const updatedMembers = members.filter((m: any) => m.userId !== userId);
      batch.update(teamDoc.ref, { members: updatedMembers });
    }

    // Add to unassigned players
    batch.set(
      adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('unassignedPlayers')
        .doc(userId),
      {
        userId: memberToLeave.userId,
        pseudo: memberToLeave.pseudo,
        level: memberToLeave.level,
        leftTeamAt: new Date(),
      }
    );

    await batch.commit();

    res.json({
      success: true,
      message: 'Successfully left team',
    });
  } catch (error) {
    console.error('Error leaving team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error leaving team', 500);
  }
};

/**
 * Create a new team
 */
export const createTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamName } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!teamName || teamName.trim() === '') {
    throw new AppError('Team name is required', 400);
  }

  try {
    // Check tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournamentData = tournamentDoc.data();

    // Check if tournament is in random mode (teams are generated by admin)
    if (tournamentData?.registrationMode === 'random') {
      throw new AppError('Cannot create teams in this tournament. Teams will be generated randomly by the admin.', 403);
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const userData = userDoc.data();
    const batch = adminDb.batch();

    // Create team
    const newTeamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc();

    batch.set(newTeamRef, {
      name: teamName.trim(),
      captainId: userId,
      members: [
        {
          userId: userId,
          pseudo: userData?.pseudo || 'Unknown',
          level: userData?.level || 'N/A',
        },
      ],
      recruitmentOpen: true,
      createdAt: new Date(),
    });

    // Remove from unassigned players if present
    const unassignedPlayerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const unassignedDoc = await unassignedPlayerRef.get();
    if (unassignedDoc.exists) {
      batch.delete(unassignedPlayerRef);
    }

    await batch.commit();

    res.json({
      success: true,
      message: 'Team created successfully',
      teamId: newTeamRef.id,
    });
  } catch (error) {
    console.error('Error creating team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating team', 500);
  }
};

/**
 * Join waiting list
 */
export const joinWaitingList = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  try {
    // Check tournament exists and has waiting list enabled
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    if (!tournament?.waitingListEnabled || (tournament?.waitingListSize || 0) <= 0) {
      throw new AppError('Waiting list is not enabled for this tournament', 400);
    }

    // Find user's team where they are captain
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .where('captainId', '==', userId)
      .get();

    if (teamsSnapshot.empty) {
      throw new AppError('You must be a team captain to join the waiting list', 400);
    }

    const teamDoc = teamsSnapshot.docs[0];
    const teamData = { id: teamDoc.id, ...teamDoc.data() };

    // Check waiting list size
    const waitingListSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('waitingListTeams')
      .get();

    if (waitingListSnapshot.size >= (tournament.waitingListSize || 0)) {
      throw new AppError('Waiting list is full', 400);
    }

    // Add to waiting list
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('waitingListTeams')
      .doc(teamData.id)
      .set({
        ...teamData,
        addedAt: new Date(),
      });

    res.json({
      success: true,
      message: 'Successfully added to waiting list',
    });
  } catch (error) {
    console.error('Error joining waiting list:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error joining waiting list', 500);
  }
};
