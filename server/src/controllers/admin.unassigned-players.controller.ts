import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';

/**
 * Unassigned Players Management Controller
 */

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

    // Get all global rankings to enrich players with points
    const rankingsSnapshot = await adminDb.collection('globalPlayerRanking').get();
    const rankingsMap = new Map<string, number>();
    rankingsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      rankingsMap.set(doc.id, data.totalPoints || 0);
    });

    const players = unassignedPlayersSnapshot.docs.map((doc) => {
      const data = doc.data();
      // Use userId if available, otherwise use doc.id
      const playerId = data.userId || doc.id;
      return convertTimestamps({
        id: doc.id,
        ...data,
        totalPoints: rankingsMap.get(playerId) || 0,
      });
    });

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

export const addUnassignedPlayer = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { userId } = req.body;

    // Validate parameters
    if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.trim() === '') {
      throw new AppError('Tournament ID is required', 400);
    }
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new AppError('User ID is required', 400);
    }

    // Check if tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }
    const userData = userDoc.data();

    // Check if player is already in the unassigned list
    const existingPlayerDoc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId)
      .get();

    if (existingPlayerDoc.exists) {
      throw new AppError('Ce joueur est déjà dans la liste des joueurs non assignés', 400);
    }

    // Check if player is already in a team
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const members = teamData.members || [];
      if (members.some((m: any) => m.userId === userId)) {
        throw new AppError('Ce joueur est déjà membre d\'une équipe dans ce tournoi', 400);
      }
    }

    // Add player to unassigned list
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId)
      .set({
        userId: userId,
        pseudo: userData?.pseudo || 'Inconnu',
        email: userData?.email || '',
        level: userData?.level || 'N/A',
        sexe: userData?.sexe || 'homme',
        registeredAt: new Date(),
      });

    res.json({
      success: true,
      message: 'Joueur ajouté avec succès',
    });
  } catch (error: any) {
    console.error('Error adding unassigned player:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error adding unassigned player', 500);
  }
};

export const updateUnassignedPlayer = async (req: Request, res: Response) => {
  try {
    const { tournamentId, userId } = req.params;
    const { pseudo, level, sexe, questionResponses } = req.body;

    // Validate parameters
    if (!tournamentId || typeof tournamentId !== 'string' || tournamentId.trim() === '') {
      ErrorHandlers.validation('Tournament ID is required');
    }
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      ErrorHandlers.validation('User ID is required');
    }

    // Check if tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    // Check if player exists in unassigned list
    const playerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      ErrorHandlers.notFound('Player in unassigned list', userId);
    }

    // Prepare update data
    const updateData: any = {};
    if (pseudo !== undefined && typeof pseudo === 'string' && pseudo.trim() !== '') {
      updateData.pseudo = pseudo.trim();
    }
    if (level !== undefined && typeof level === 'string') {
      if (!['Débutant', 'Intermédiaire', 'Confirmé'].includes(level)) {
        ErrorHandlers.validation('Invalid level value');
      }
      updateData.level = level;
    }
    if (sexe !== undefined && typeof sexe === 'string') {
      if (!['homme', 'femme'].includes(sexe)) {
        ErrorHandlers.validation('Invalid sexe value');
      }
      updateData.sexe = sexe;
    }
    if (questionResponses !== undefined) {
      if (Array.isArray(questionResponses)) {
        updateData.questionResponses = questionResponses;
      } else {
        ErrorHandlers.validation('questionResponses must be an array');
      }
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      ErrorHandlers.validation('No valid fields to update');
    }

    // Update the player
    await playerRef.update(updateData);

    res.json({
      success: true,
      message: 'Joueur mis à jour avec succès',
      data: { ...playerDoc.data(), ...updateData },
    });
  } catch (error) {
    handleControllerError(error, 'updating unassigned player', 'Error updating unassigned player');
  }
};
