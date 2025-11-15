import { Request, Response } from 'express';
import { adminDb } from '../config/firebase';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';

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

        return convertTimestamps({
          id: doc.id,
          ...data,
          registeredTeamsCount: teamsSnapshot.size,
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
  res.json({ success: true, message: 'Create tournament - TODO' });
};

export const getTournamentById = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Get tournament by ID - TODO' });
};

export const updateTournament = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Update tournament - TODO' });
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
  res.json({ success: true, message: 'Get pools - TODO' });
};

export const createPool = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Create pool - TODO' });
};

export const assignTeamsToPool = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Assign teams to pool - TODO' });
};

export const generatePoolMatches = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Generate pool matches - TODO' });
};

export const getEliminationMatches = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Get elimination matches - TODO' });
};

export const generateEliminationBracket = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Generate elimination bracket - TODO' });
};

export const freezeRanking = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Freeze ranking - TODO' });
};

export const getTeams = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Get teams - TODO' });
};

export const createTeam = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Create team - TODO' });
};

export const updateTeam = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Update team - TODO' });
};

export const deleteTeam = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Delete team - TODO' });
};

/**
 * User Management
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const usersSnapshot = await adminDb.collection('users').orderBy('pseudo').get();

    const users = usersSnapshot.docs.map((doc) => convertTimestamps({
      id: doc.id,
      ...doc.data(),
    }));

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
  res.json({ success: true, message: 'Create user - TODO' });
};

export const getUserById = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Get user by ID - TODO' });
};

export const updateUser = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Update user - TODO' });
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
  res.json({ success: true, message: 'Get unassigned players - TODO' });
};

export const removeUnassignedPlayer = async (req: Request, res: Response) => {
  res.json({ success: true, message: 'Remove unassigned player - TODO' });
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
