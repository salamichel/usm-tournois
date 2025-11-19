/**
 * Season Controller
 * Handles season management for ranking periods
 */

import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import type { Season } from '../../../shared/types/season.types';

/**
 * Get all seasons
 */
export const getAllSeasons = async (req: Request, res: Response) => {
  try {
    const seasonsSnapshot = await adminDb
      .collection('seasons')
      .orderBy('startDate', 'desc')
      .get();

    const seasons = seasonsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate,
        endDate: data.endDate?.toDate ? data.endDate.toDate() : data.endDate,
        isActive: data.isActive || false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      } as Season;
    });

    res.json({
      success: true,
      data: { seasons },
    });
  } catch (error) {
    console.error('Error fetching seasons:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching seasons',
    });
  }
};

/**
 * Get active season
 */
export const getActiveSeason = async (req: Request, res: Response) => {
  try {
    const seasonsSnapshot = await adminDb
      .collection('seasons')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (seasonsSnapshot.empty) {
      return res.json({
        success: true,
        data: { season: null },
      });
    }

    const doc = seasonsSnapshot.docs[0];
    const data = doc.data();
    const season: Season = {
      id: doc.id,
      name: data.name,
      startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate,
      endDate: data.endDate?.toDate ? data.endDate.toDate() : data.endDate,
      isActive: data.isActive || false,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    };

    res.json({
      success: true,
      data: { season },
    });
  } catch (error) {
    console.error('Error fetching active season:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active season',
    });
  }
};

/**
 * Get season by ID
 */
export const getSeasonById = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;

    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();

    if (!seasonDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Season not found',
      });
    }

    const data = seasonDoc.data()!;
    const season: Season = {
      id: seasonDoc.id,
      name: data.name,
      startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate,
      endDate: data.endDate?.toDate ? data.endDate.toDate() : data.endDate,
      isActive: data.isActive || false,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    };

    res.json({
      success: true,
      data: { season },
    });
  } catch (error) {
    console.error('Error fetching season:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching season',
    });
  }
};

/**
 * Create a new season (admin only)
 */
export const createSeason = async (req: Request, res: Response) => {
  try {
    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Name, startDate, and endDate are required',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date',
      });
    }

    // Check for overlapping seasons
    const existingSeasons = await adminDb.collection('seasons').get();
    for (const doc of existingSeasons.docs) {
      const existing = doc.data();
      const existingStart = existing.startDate?.toDate ? existing.startDate.toDate() : new Date(existing.startDate);
      const existingEnd = existing.endDate?.toDate ? existing.endDate.toDate() : new Date(existing.endDate);

      // Check if dates overlap
      if (start < existingEnd && end > existingStart) {
        return res.status(400).json({
          success: false,
          message: `Les dates chevauchent la saison "${existing.name}"`,
        });
      }
    }

    const seasonData = {
      name,
      startDate: start,
      endDate: end,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await adminDb.collection('seasons').add(seasonData);

    res.status(201).json({
      success: true,
      message: 'Season created successfully',
      data: {
        season: {
          id: docRef.id,
          ...seasonData,
        },
      },
    });
  } catch (error) {
    console.error('Error creating season:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating season',
    });
  }
};

/**
 * Update a season (admin only)
 */
export const updateSeason = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;
    const { name, startDate, endDate, isActive } = req.body;

    const seasonRef = adminDb.collection('seasons').doc(seasonId);
    const seasonDoc = await seasonRef.get();

    if (!seasonDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Season not found',
      });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);

    // If setting this season as active, deactivate others
    if (isActive === true) {
      const batch = adminDb.batch();

      // Deactivate all other seasons
      const allSeasons = await adminDb.collection('seasons').where('isActive', '==', true).get();
      allSeasons.docs.forEach((doc) => {
        if (doc.id !== seasonId) {
          batch.update(doc.ref, { isActive: false, updatedAt: new Date() });
        }
      });

      updateData.isActive = true;
      batch.update(seasonRef, updateData);
      await batch.commit();
    } else {
      if (isActive !== undefined) updateData.isActive = isActive;
      await seasonRef.update(updateData);
    }

    res.json({
      success: true,
      message: 'Season updated successfully',
    });
  } catch (error) {
    console.error('Error updating season:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating season',
    });
  }
};

/**
 * Delete a season (admin only)
 */
export const deleteSeason = async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;

    const seasonRef = adminDb.collection('seasons').doc(seasonId);
    const seasonDoc = await seasonRef.get();

    if (!seasonDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Season not found',
      });
    }

    // Check if season has any rankings
    const rankingsSnapshot = await adminDb
      .collection('seasonRankings')
      .where('seasonId', '==', seasonId)
      .limit(1)
      .get();

    if (!rankingsSnapshot.empty) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete season with existing rankings. Please clear rankings first.',
      });
    }

    await seasonRef.delete();

    res.json({
      success: true,
      message: 'Season deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting season:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting season',
    });
  }
};

/**
 * Find season for a given date
 */
export async function findSeasonForDate(date: Date): Promise<Season | null> {
  const seasonsSnapshot = await adminDb.collection('seasons').get();

  for (const doc of seasonsSnapshot.docs) {
    const data = doc.data();
    const startDate = data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate);
    const endDate = data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate);

    if (date >= startDate && date <= endDate) {
      return {
        id: doc.id,
        name: data.name,
        startDate,
        endDate,
        isActive: data.isActive || false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      };
    }
  }

  return null;
}
