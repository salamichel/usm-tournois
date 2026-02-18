import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';

export const getUserDashboard = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      ErrorHandlers.unauthorized('User not authenticated');
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', userId);
    }

    const userData = convertTimestamps({
      id: userDoc.id,
      ...userDoc.data(),
    });

    // Get user's registered tournaments
    const eventsSnapshot = await adminDb.collection('events').get();
    const registeredTournaments = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const eventId = eventDoc.id;

      // Check if user is in a team
      const teamsSnapshot = await adminDb
        .collection('events')
        .doc(eventId)
        .collection('teams')
        .get();

      let isRegistered = false;
      let teamName = null;

      for (const teamDoc of teamsSnapshot.docs) {
        const teamData = teamDoc.data();
        if (teamData.members?.some((member: any) => member.userId === userId)) {
          isRegistered = true;
          teamName = teamData.name;
          break;
        }
      }

      // Check if user is unassigned player
      if (!isRegistered) {
        const unassignedPlayerDoc = await adminDb
          .collection('events')
          .doc(eventId)
          .collection('unassignedPlayers')
          .doc(userId)
          .get();

        if (unassignedPlayerDoc.exists) {
          isRegistered = true;
        }
      }

      if (isRegistered) {
        registeredTournaments.push(
          convertTimestamps({
            id: eventDoc.id,
            ...eventDoc.data(),
            teamName,
          })
        );
      }
    }

    res.json({
      success: true,
      data: {
        user: userData,
        registeredTournaments,
      },
    });
  } catch (error) {
    handleControllerError(error, 'getting user dashboard');
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      ErrorHandlers.unauthorized('User not authenticated');
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', userId);
    }

    const user = convertTimestamps({
      id: userDoc.id,
      ...userDoc.data(),
    });

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    handleControllerError(error, 'getting user profile');
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      ErrorHandlers.unauthorized('User not authenticated');
    }

    const { pseudo, level, email, clubId } = req.body;

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', userId);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (pseudo !== undefined && pseudo !== null) updateData.pseudo = pseudo;
    if (level !== undefined && level !== null) updateData.level = level;
    if (email !== undefined && email !== null) updateData.email = email;
    if (clubId !== undefined) updateData.clubId = clubId || null;

    await adminDb.collection('users').doc(userId).update(updateData);

    // Update session with new user data
    if (req.session && req.session.user) {
      if (pseudo !== undefined && pseudo !== null) req.session.user.pseudo = pseudo;
      if (level !== undefined && level !== null) req.session.user.level = level;
      if (email !== undefined && email !== null) req.session.user.email = email;
      if (clubId !== undefined) req.session.user.clubId = clubId || undefined;
    }

    res.json({
      success: true,
      message: 'User profile updated successfully',
    });
  } catch (error) {
    handleControllerError(error, 'updating user profile');
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { query, excludeVirtual } = req.query;

    if (!query || String(query).trim() === '') {
      ErrorHandlers.validation('Search query is required');
    }

    const queryLower = String(query).toLowerCase().trim();

    // Get all users from Firestore
    const usersSnapshot = await adminDb.collection('users').get();

    // Filter users based on search query
    const matchingUsers = usersSnapshot.docs
      .map(doc => convertTimestamps({ id: doc.id, ...doc.data() }))
      .filter(user => {
        // Exclude virtual users if requested
        if (excludeVirtual === 'true' && user.isVirtual) {
          return false;
        }

        // Search in pseudo and email
        const pseudoMatch = user.pseudo?.toLowerCase().includes(queryLower);
        const emailMatch = user.email?.toLowerCase().includes(queryLower);

        return pseudoMatch || emailMatch;
      })
      .map(user => ({
        uid: user.id, // Use 'uid' to match User interface
        pseudo: user.pseudo,
        email: user.email,
        level: user.level,
        isVirtual: user.isVirtual || false,
      }))
      .slice(0, 10); // Limit results to 10

    res.json({
      success: true,
      data: { users: matchingUsers },
    });
  } catch (error) {
    handleControllerError(error, 'searching users');
  }
};
