import { Request, Response } from 'express';
import { adminDb, adminAuth } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';

/**
 * Get team by ID
 */
export const getTeamById = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  try {
    const teamDoc = await adminDb
      .collection('events')
      .doc(String(tournamentId))
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const teamData = convertTimestamps({ id: teamDoc.id, ...teamDoc.data() });

    res.json({
      success: true,
      data: { team: teamData },
    });
  } catch (error) {
    console.error('Error getting team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving team', 500);
  }
};

/**
 * Update team settings (name, recruitment status)
 */
export const updateTeamSettings = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId, teamName, recruitmentOpen } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      throw new AppError('Access denied. You are not the captain of this team', 403);
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (teamName !== undefined && teamName.trim() !== '') {
      updateData.name = teamName.trim();
    }

    if (recruitmentOpen !== undefined) {
      updateData.recruitmentOpen = recruitmentOpen;
    }

    await teamRef.update(updateData);

    res.json({
      success: true,
      message: 'Team settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating team settings:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating team settings', 500);
  }
};

/**
 * Add member to team
 */
export const addMember = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId, memberId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId || !memberId) {
    throw new AppError('Tournament ID and Member ID are required', 400);
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      throw new AppError('Access denied. You are not the captain of this team', 403);
    }

    // Get tournament data
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const maxPlayers = tournament?.playersPerTeam || 4;
    const currentMembers = teamData?.members || [];

    // Check if team is full
    if (currentMembers.length >= maxPlayers) {
      throw new AppError('Team has reached maximum number of players', 400);
    }

    // Check if player is already in team
    const alreadyInTeam = currentMembers.some((m: any) => m.userId === memberId);
    if (alreadyInTeam) {
      throw new AppError('This player is already a member of this team', 400);
    }

    // Get member data
    const memberDoc = await adminDb.collection('users').doc(memberId).get();
    if (!memberDoc.exists) {
      throw new AppError('Player not found', 404);
    }

    const memberData = memberDoc.data();
    const batch = adminDb.batch();

    // Add member to team
    batch.update(teamRef, {
      members: [
        ...currentMembers,
        {
          userId: memberId,
          pseudo: memberData?.pseudo || 'Unknown',
          level: memberData?.level || 'N/A',
        },
      ],
      updatedAt: new Date(),
    });

    // Remove from unassigned players if present
    const unassignedPlayerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(memberId);

    const unassignedDoc = await unassignedPlayerRef.get();
    if (unassignedDoc.exists) {
      batch.delete(unassignedPlayerRef);
    }

    await batch.commit();

    res.json({
      success: true,
      message: 'Member added to team successfully',
    });
  } catch (error) {
    console.error('Error adding member:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error adding member to team', 500);
  }
};

/**
 * Remove member from team
 */
export const removeMember = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId, memberId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId || !memberId) {
    throw new AppError('Tournament ID and Member ID are required', 400);
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      throw new AppError('Access denied. You are not the captain of this team', 403);
    }

    const members = teamData?.members || [];
    const memberToRemove = members.find((m: any) => m.userId === memberId);

    if (!memberToRemove) {
      throw new AppError('Member not found in team', 404);
    }

    // Prevent captain from removing themselves
    if (memberId === teamData?.captainId) {
      throw new AppError('Captain cannot be removed this way. Transfer captainship first or leave the team', 400);
    }

    const batch = adminDb.batch();

    // Remove member from team
    const updatedMembers = members.filter((m: any) => m.userId !== memberId);
    batch.update(teamRef, {
      members: updatedMembers,
      updatedAt: new Date(),
    });

    // Add to unassigned players
    batch.set(
      adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('unassignedPlayers')
        .doc(memberId),
      {
        userId: memberToRemove.userId,
        pseudo: memberToRemove.pseudo,
        level: memberToRemove.level,
        removedFromTeamAt: new Date(),
      }
    );

    await batch.commit();

    res.json({
      success: true,
      message: 'Member removed from team and added to free players',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error removing member from team', 500);
  }
};

/**
 * Add virtual member to team (creates a new user account)
 */
export const addVirtualMember = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId, pseudo, level, email } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId || !pseudo || !level) {
    throw new AppError('Tournament ID, pseudo, and level are required', 400);
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      throw new AppError('Access denied. You are not the captain of this team', 403);
    }

    // Get tournament data
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const maxPlayers = tournament?.playersPerTeam || 4;
    const currentMembers = teamData?.members || [];

    // Check if team is full
    if (currentMembers.length >= maxPlayers) {
      throw new AppError('Team has reached maximum number of players', 400);
    }

    // Generate email if not provided
    const finalEmail = email || `${pseudo.toLowerCase().replace(/\s/g, '')}-${Date.now()}@virtual.tournoi.com`;

    // Create virtual user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: finalEmail,
      password: Math.random().toString(36).slice(-8),
      displayName: pseudo,
    });

    const virtualUserId = userRecord.uid;

    // Create user document in Firestore
    await adminDb.collection('users').doc(virtualUserId).set({
      pseudo: pseudo,
      level: level,
      email: finalEmail,
      isVirtual: true,
      createdAt: new Date(),
    });

    // Add to team
    await teamRef.update({
      members: [
        ...currentMembers,
        {
          userId: virtualUserId,
          pseudo: pseudo,
          level: level,
        },
      ],
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Virtual member created and added to team successfully',
      memberId: virtualUserId,
    });
  } catch (error: any) {
    console.error('Error adding virtual member:', error);

    if (error.code === 'auth/email-already-exists') {
      throw new AppError('Email address is already in use', 400);
    }

    if (error instanceof AppError) throw error;
    throw new AppError('Error adding virtual member to team', 500);
  }
};
