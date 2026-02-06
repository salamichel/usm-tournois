import { Request, Response } from 'express';
import { adminDb, adminAuth } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';
import { convertTimestamps } from '../utils/firestore.utils';

/**
 * User Management Controller
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
    handleControllerError(error, 'getting all users', 'Error retrieving users');
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, pseudo, level, role, clubId, password } = req.body;

    if (!email) {
      ErrorHandlers.validation('Email is required');
    }

    if (!pseudo) {
      ErrorHandlers.validation('Pseudo is required');
    }

    if (!password || password.length < 6) {
      ErrorHandlers.validation('Password must be at least 6 characters');
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
    // Handle Firebase Auth specific errors
    if (error.code === 'auth/email-already-exists') {
      ErrorHandlers.validation('Un compte avec cet email existe déjà');
    }
    if (error.code === 'auth/invalid-email') {
      ErrorHandlers.validation('Email invalide');
    }
    handleControllerError(error, 'creating user', 'Error creating user');
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userDoc = await adminDb.collection('users').doc(id).get();

    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', id);
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
    handleControllerError(error, 'getting user by ID', 'Error retrieving user');
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, pseudo, level, role, clubId } = req.body;

    const userDoc = await adminDb.collection('users').doc(id).get();
    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', id);
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
  } catch (error) {
    handleControllerError(error, 'updating user', 'Error updating user');
  }
};

export const bulkUpdateUsers = async (req: Request, res: Response) => {
  try {
    const { userIds, clubId } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      ErrorHandlers.validation('User IDs array is required');
    }

    if (clubId === undefined) {
      ErrorHandlers.validation('Club ID is required (use null to remove club)');
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
  } catch (error) {
    handleControllerError(error, 'bulk updating users', 'Error updating users');
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userDoc = await adminDb.collection('users').doc(id).get();
    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', id);
    }

    const userData = userDoc.data();

    // Prevent deleting admin users
    if (userData?.role === 'admin') {
      ErrorHandlers.forbidden('Cannot delete admin users');
    }

    // Delete user
    await adminDb.collection('users').doc(id).delete();

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    handleControllerError(error, 'deleting user', 'Error deleting user');
  }
};
