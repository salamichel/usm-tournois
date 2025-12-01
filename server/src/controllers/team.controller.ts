import { Request, Response } from 'express';
import { adminDb, adminAuth } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import * as teamService from '../services/team.service';

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
  const { id: teamId, userId: memberIdFromUrl } = req.params;
  const { tournamentId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId || !memberIdFromUrl) {
    throw new AppError('Tournament ID and Member ID are required', 400);
  }

  // Use memberId from URL params
  const memberId = memberIdFromUrl;

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

/**
 * Get all teams for a tournament with filters and pagination
 */
export const getAllTeams = async (req: Request, res: Response) => {
  const { tournamentId } = req.query;

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  try {
    const filters: teamService.TeamFilters = {
      search: req.query.search as string,
      poolId: req.query.poolId as string,
      recruitmentOpen: req.query.recruitmentOpen === 'true' ? true : req.query.recruitmentOpen === 'false' ? false : undefined,
      minMembers: req.query.minMembers ? parseInt(req.query.minMembers as string) : undefined,
      maxMembers: req.query.maxMembers ? parseInt(req.query.maxMembers as string) : undefined,
    };

    const pagination: teamService.PaginationOptions = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await teamService.getTeamsWithFilters(
      String(tournamentId),
      filters,
      pagination
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting teams:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving teams', 500);
  }
};

/**
 * Get team statistics
 */
export const getTeamStats = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  try {
    // Verify team exists
    const teamDoc = await adminDb
      .collection('events')
      .doc(String(tournamentId))
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const stats = await teamService.calculateTeamStats(
      String(tournamentId),
      teamId
    );

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error('Error getting team stats:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving team statistics', 500);
  }
};

/**
 * Get team match history
 */
export const getTeamHistory = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  try {
    const history = await teamService.getTeamHistory(
      String(tournamentId),
      teamId
    );

    res.json({
      success: true,
      data: { matches: history },
    });
  } catch (error) {
    console.error('Error getting team history:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving team history', 500);
  }
};

/**
 * Transfer captainship to another member
 */
export const transferCaptain = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId, newCaptainId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId || !newCaptainId) {
    throw new AppError('Tournament ID and new captain ID are required', 400);
  }

  try {
    await teamService.transferCaptainship(
      tournamentId,
      teamId,
      userId,
      newCaptainId
    );

    res.json({
      success: true,
      message: 'Captainship transferred successfully',
    });
  } catch (error) {
    console.error('Error transferring captainship:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error transferring captainship', 500);
  }
};

/**
 * Search teams by name or member
 */
export const searchTeams = async (req: Request, res: Response) => {
  const { tournamentId, query } = req.query;

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  if (!query || String(query).trim() === '') {
    throw new AppError('Search query is required', 400);
  }

  try {
    const teams = await teamService.searchTeams(
      String(tournamentId),
      String(query)
    );

    res.json({
      success: true,
      data: { teams },
    });
  } catch (error) {
    console.error('Error searching teams:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error searching teams', 500);
  }
};

/**
 * Get available players (unassigned to any team)
 */
export const getAvailablePlayers = async (req: Request, res: Response) => {
  const { tournamentId } = req.query;

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  try {
    const players = await teamService.getAvailablePlayers(String(tournamentId));

    res.json({
      success: true,
      data: { players },
    });
  } catch (error) {
    console.error('Error getting available players:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving available players', 500);
  }
};

/**
 * Validate team composition
 */
export const validateTeam = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  try {
    const validation = await teamService.validateTeamComposition(
      String(tournamentId),
      teamId
    );

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Error validating team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error validating team', 500);
  }
};

/**
 * Check member eligibility to join a team
 */
export const checkEligibility = async (req: Request, res: Response) => {
  const { tournamentId, userId, teamId } = req.query;

  if (!tournamentId || !userId) {
    throw new AppError('Tournament ID and user ID are required', 400);
  }

  try {
    const eligibility = await teamService.checkMemberEligibility(
      String(tournamentId),
      String(userId),
      teamId ? String(teamId) : undefined
    );

    res.json({
      success: true,
      data: eligibility,
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error checking eligibility', 500);
  }
};

/**
 * Get team with full member details
 */
export const getTeamDetails = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    throw new AppError('Tournament ID is required', 400);
  }

  try {
    const team = await teamService.getTeamWithMemberDetails(
      String(tournamentId),
      teamId
    );

    res.json({
      success: true,
      data: { team },
    });
  } catch (error) {
    console.error('Error getting team details:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error retrieving team details', 500);
  }
};

/**
 * Batch add members to team
 */
export const batchAddMembers = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId, memberIds } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId || !memberIds || !Array.isArray(memberIds)) {
    throw new AppError('Tournament ID and member IDs array are required', 400);
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

    // Get tournament data for max players check
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    const maxPlayers = tournament?.playersPerTeam || 4;
    const currentMembers = teamData?.members || [];

    // Check if adding all members would exceed max
    if (currentMembers.length + memberIds.length > maxPlayers) {
      throw new AppError(
        `Cannot add ${memberIds.length} members. Team would exceed maximum of ${maxPlayers} players`,
        400
      );
    }

    const batch = adminDb.batch();
    const newMembers: any[] = [];
    const errors: string[] = [];

    for (const memberId of memberIds) {
      // Check eligibility
      const eligibility = await teamService.checkMemberEligibility(
        tournamentId,
        memberId,
        teamId
      );

      if (!eligibility.eligible) {
        errors.push(`${memberId}: ${eligibility.reason}`);
        continue;
      }

      // Get member data
      const memberDoc = await adminDb.collection('users').doc(memberId).get();
      if (!memberDoc.exists) {
        errors.push(`${memberId}: User not found`);
        continue;
      }

      const memberData = memberDoc.data();
      newMembers.push({
        userId: memberId,
        pseudo: memberData?.pseudo || 'Unknown',
        level: memberData?.level || 'N/A',
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
    }

    if (newMembers.length > 0) {
      batch.update(teamRef, {
        members: [...currentMembers, ...newMembers],
        updatedAt: new Date(),
      });

      await batch.commit();
    }

    res.json({
      success: true,
      message: `Added ${newMembers.length} members to team`,
      data: {
        added: newMembers.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error batch adding members:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error adding members to team', 500);
  }
};

/**
 * Batch remove members from team
 */
export const batchRemoveMembers = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId, memberIds } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId || !memberIds || !Array.isArray(memberIds)) {
    throw new AppError('Tournament ID and member IDs array are required', 400);
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

    const currentMembers = teamData?.members || [];
    const batch = adminDb.batch();
    const removedMembers: any[] = [];
    const errors: string[] = [];

    for (const memberId of memberIds) {
      // Prevent captain from being removed
      if (memberId === teamData?.captainId) {
        errors.push(`${memberId}: Cannot remove captain. Transfer captainship first`);
        continue;
      }

      const memberToRemove = currentMembers.find((m: any) => m.userId === memberId);
      if (!memberToRemove) {
        errors.push(`${memberId}: Not a member of this team`);
        continue;
      }

      removedMembers.push(memberToRemove);

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
    }

    if (removedMembers.length > 0) {
      const updatedMembers = currentMembers.filter(
        (m: any) => !memberIds.includes(m.userId) || m.userId === teamData?.captainId
      );

      batch.update(teamRef, {
        members: updatedMembers,
        updatedAt: new Date(),
      });

      await batch.commit();
    }

    res.json({
      success: true,
      message: `Removed ${removedMembers.length} members from team`,
      data: {
        removed: removedMembers.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error batch removing members:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error removing members from team', 500);
  }
};

/**
 * Create a new team (public endpoint for captains)
 */
export const createTeam = async (req: Request, res: Response) => {
  const { tournamentId, name, recruitmentOpen } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  if (!tournamentId || !name || name.trim() === '') {
    throw new AppError('Tournament ID and team name are required', 400);
  }

  try {
    // Check tournament exists and is not in random mode
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();
    if (tournament?.registrationMode === 'random') {
      throw new AppError('Cannot create teams in random registration mode', 400);
    }

    // Check if team name is unique
    const isUnique = await teamService.isTeamNameUnique(tournamentId, name.trim());
    if (!isUnique) {
      throw new AppError('A team with this name already exists', 400);
    }

    // Check if user is already in a team
    const eligibility = await teamService.checkMemberEligibility(tournamentId, userId);
    if (!eligibility.eligible) {
      throw new AppError(eligibility.reason || 'Cannot create team', 400);
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const userData = userDoc.data();

    // Create team
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc();

    await teamRef.set({
      name: name.trim(),
      captainId: userId,
      captainPseudo: userData?.pseudo || 'Unknown',
      members: [
        {
          userId: userId,
          pseudo: userData?.pseudo || 'Unknown',
          level: userData?.level || 'N/A',
        },
      ],
      recruitmentOpen: recruitmentOpen !== false,
      registeredAt: new Date().toISOString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: { teamId: teamRef.id },
    });
  } catch (error) {
    console.error('Error creating team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating team', 500);
  }
};

/**
 * Delete team (captain only)
 */
export const deleteTeam = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.body;
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
      throw new AppError('Access denied. Only the captain can delete this team', 403);
    }

    // Check if team is assigned to a pool
    if (teamData?.poolId) {
      throw new AppError('Cannot delete team that is assigned to a pool', 400);
    }

    const batch = adminDb.batch();

    // Move all members to unassigned players
    const members = teamData?.members || [];
    for (const member of members) {
      batch.set(
        adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('unassignedPlayers')
          .doc(member.userId),
        {
          userId: member.userId,
          pseudo: member.pseudo,
          level: member.level,
          removedFromTeamAt: new Date(),
        }
      );
    }

    // Delete team
    batch.delete(teamRef);

    await batch.commit();

    res.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting team', 500);
  }
};
