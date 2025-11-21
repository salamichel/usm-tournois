import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';

export const getUserDashboard = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
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
  } catch (error: any) {
    console.error('Error getting user dashboard:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving user dashboard', 500);
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();

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
    console.error('Error getting user profile:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving user profile', 500);
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { pseudo, level, email, clubId } = req.body;

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (pseudo !== undefined && pseudo !== null) updateData.pseudo = pseudo;
    if (level !== undefined && level !== null) updateData.level = level;
    if (email !== undefined && email !== null) updateData.email = email;
    if (clubId !== undefined) updateData.clubId = clubId || null;

    await adminDb.collection('users').doc(userId).update(updateData);

    res.json({
      success: true,
      message: 'User profile updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating user profile', 500);
  }
};
