import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';
import { convertTimestamps } from '../utils/firestore.utils';

/**
 * Dashboard Controller
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
    handleControllerError(error, 'getting dashboard data');
  }
};
