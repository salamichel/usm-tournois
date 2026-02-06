import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import type { Club, ClubWithStats } from '../../../shared/types/club.types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get all clubs with player count
 */
export const getAllClubs = async (req: Request, res: Response) => {
  try {
    const clubsSnapshot = await adminDb.collection('clubs').orderBy('name', 'asc').get();

    const clubs: ClubWithStats[] = await Promise.all(
      clubsSnapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Count players in this club
        const usersSnapshot = await adminDb
          .collection('users')
          .where('clubId', '==', doc.id)
          .get();

        return convertTimestamps({
          id: doc.id,
          ...data,
          playerCount: usersSnapshot.size,
        }) as ClubWithStats;
      })
    );

    res.json({
      success: true,
      data: { clubs },
    });
  } catch (error) {
    handleControllerError(error, 'getting all clubs', 'Error retrieving clubs', 500);
  }
};

/**
 * Get a single club by ID
 */
export const getClubById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const clubDoc = await adminDb.collection('clubs').doc(id).get();

    if (!clubDoc.exists) {
      ErrorHandlers.notFound('Club', id);
    }

    const clubData = convertTimestamps({
      id: clubDoc.id,
      ...clubDoc.data(),
    }) as Club;

    res.json({
      success: true,
      data: { club: clubData },
    });
  } catch (error) {
    handleControllerError(error, 'getting club', 'Error retrieving club', 500);
  }
};

/**
 * Create a new club
 */
export const createClub = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      ErrorHandlers.validation('Club name is required');
    }

    // Check if club with same name already exists
    const existingClubSnapshot = await adminDb
      .collection('clubs')
      .where('name', '==', name.trim())
      .get();

    if (!existingClubSnapshot.empty) {
      ErrorHandlers.validation('A club with this name already exists');
    }

    // Handle uploaded logo file (if any)
    const logoPath = (req as any).file ? `/uploads/${(req as any).file.filename}` : undefined;

    const clubData: any = {
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Only add logo field if logoPath is defined (Firestore doesn't accept undefined values)
    if (logoPath) {
      clubData.logo = logoPath;
    }

    const clubRef = await adminDb.collection('clubs').add(clubData);

    const createdClub = convertTimestamps({
      id: clubRef.id,
      ...clubData,
    }) as Club;

    res.status(201).json({
      success: true,
      data: { club: createdClub },
    });
  } catch (error) {
    handleControllerError(error, 'creating club', 'Error creating club', 500);
  }
};

/**
 * Update a club
 */
export const updateClub = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const clubDoc = await adminDb.collection('clubs').doc(id).get();

    if (!clubDoc.exists) {
      ErrorHandlers.notFound('Club', id);
    }

    // Check if new name already exists (excluding current club)
    if (name && name.trim() !== '') {
      const existingClubSnapshot = await adminDb
        .collection('clubs')
        .where('name', '==', name.trim())
        .get();

      if (!existingClubSnapshot.empty && existingClubSnapshot.docs[0].id !== id) {
        ErrorHandlers.validation('A club with this name already exists');
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name && name.trim() !== '') {
      updateData.name = name.trim();
    }

    // Handle uploaded logo file (if any)
    if ((req as any).file) {
      const oldData = clubDoc.data();

      // Delete old logo file if it exists
      if (oldData?.logo) {
        const oldLogoPath = path.join(__dirname, '../../public', oldData.logo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }

      updateData.logo = `/uploads/${(req as any).file.filename}`;
    }

    await adminDb.collection('clubs').doc(id).update(updateData);

    const updatedDoc = await adminDb.collection('clubs').doc(id).get();
    const updatedClub = convertTimestamps({
      id: updatedDoc.id,
      ...updatedDoc.data(),
    }) as Club;

    res.json({
      success: true,
      data: { club: updatedClub },
    });
  } catch (error) {
    handleControllerError(error, 'updating club', 'Error updating club', 500);
  }
};

/**
 * Delete a club
 */
export const deleteClub = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const clubDoc = await adminDb.collection('clubs').doc(id).get();

    if (!clubDoc.exists) {
      ErrorHandlers.notFound('Club', id);
    }

    // Check if there are players associated with this club
    const usersSnapshot = await adminDb
      .collection('users')
      .where('clubId', '==', id)
      .get();

    if (!usersSnapshot.empty) {
      ErrorHandlers.validation(
        `Cannot delete club. ${usersSnapshot.size} player(s) are still associated with this club.`
      );
    }

    const clubData = clubDoc.data();

    // Delete logo file if it exists
    if (clubData?.logo) {
      const logoPath = path.join(__dirname, '../../public', clubData.logo);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    await adminDb.collection('clubs').doc(id).delete();

    res.json({
      success: true,
      message: 'Club deleted successfully',
    });
  } catch (error) {
    handleControllerError(error, 'deleting club', 'Error deleting club', 500);
  }
};

/**
 * Get all players for a specific club
 */
export const getClubPlayers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const clubDoc = await adminDb.collection('clubs').doc(id).get();

    if (!clubDoc.exists) {
      ErrorHandlers.notFound('Club', id);
    }

    const usersSnapshot = await adminDb
      .collection('users')
      .where('clubId', '==', id)
      .get();

    const players = usersSnapshot.docs.map((doc) =>
      convertTimestamps({
        uid: doc.id,
        ...doc.data(),
      })
    );

    res.json({
      success: true,
      data: { players },
    });
  } catch (error) {
    handleControllerError(error, 'getting club players', 'Error retrieving club players', 500);
  }
};
