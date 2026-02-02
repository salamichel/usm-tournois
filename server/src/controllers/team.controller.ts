import { Request, Response } from 'express';
import { adminDb, adminAuth } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import * as teamService from '../services/team.service';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';

/**
 * Get team by ID
 */
export const getTeamById = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
  }

  try {
    const teamDoc = await adminDb
      .collection('events')
      .doc(String(tournamentId))
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = convertTimestamps({ id: teamDoc.id, ...teamDoc.data() });

    res.json({
      success: true,
      data: { team: teamData },
    });
  } catch (error) {
    handleControllerError(error, 'getting team', 'Error retrieving team');
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
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      ErrorHandlers.forbidden('Access denied. You are not the captain of this team');
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
    handleControllerError(error, 'updating team settings', 'Error updating team settings');
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
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId || !memberId) {
    ErrorHandlers.validation('Tournament ID and Member ID are required');
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      ErrorHandlers.forbidden('Access denied. You are not the captain of this team');
    }

    // Get tournament data
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournament = tournamentDoc.data();
    const maxPlayers = tournament?.playersPerTeam || 4;
    const currentMembers = teamData?.members || [];

    // Check if team is full
    if (currentMembers.length >= maxPlayers) {
      ErrorHandlers.validation('Team has reached maximum number of players');
    }

    // Check if player is already in team
    const alreadyInTeam = currentMembers.some((m: any) => m.userId === memberId);
    if (alreadyInTeam) {
      ErrorHandlers.validation('This player is already a member of this team');
    }

    // Get member data
    const memberDoc = await adminDb.collection('users').doc(memberId).get();
    if (!memberDoc.exists) {
      ErrorHandlers.notFound('Player', memberId);
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
    handleControllerError(error, 'adding member', 'Error adding member to team');
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
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId || !memberIdFromUrl) {
    ErrorHandlers.validation('Tournament ID and Member ID are required');
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
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      ErrorHandlers.forbidden('Access denied. You are not the captain of this team');
    }

    const members = teamData?.members || [];
    const memberToRemove = members.find((m: any) => m.userId === memberId);

    if (!memberToRemove) {
      ErrorHandlers.notFound('Member in team', memberId);
    }

    // Prevent captain from removing themselves
    if (memberId === teamData?.captainId) {
      ErrorHandlers.validation('Captain cannot be removed this way. Transfer captainship first or leave the team');
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
    handleControllerError(error, 'removing member', 'Error removing member from team');
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
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId || !pseudo || !level) {
    ErrorHandlers.validation('Tournament ID, pseudo, and level are required');
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      ErrorHandlers.forbidden('Access denied. You are not the captain of this team');
    }

    // Get tournament data
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournament = tournamentDoc.data();
    const maxPlayers = tournament?.playersPerTeam || 4;
    const currentMembers = teamData?.members || [];

    // Check if team is full
    if (currentMembers.length >= maxPlayers) {
      ErrorHandlers.validation('Team has reached maximum number of players');
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
          isVirtual: true,
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
    if (error.code === 'auth/email-already-exists') {
      ErrorHandlers.validation('Email address is already in use');
    }

    handleControllerError(error, 'adding virtual member', 'Error adding virtual member to team');
  }
};

/**
 * Get all teams for a tournament with filters and pagination
 */
export const getAllTeams = async (req: Request, res: Response) => {
  const { tournamentId } = req.query;

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
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
    handleControllerError(error, 'getting teams', 'Error retrieving teams');
  }
};

/**
 * Get team statistics
 */
export const getTeamStats = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
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
      ErrorHandlers.notFound('Team', teamId);
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
    handleControllerError(error, 'getting team stats', 'Error retrieving team statistics');
  }
};

/**
 * Get team match history
 */
export const getTeamHistory = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
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
    handleControllerError(error, 'getting team history', 'Error retrieving team history');
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
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId || !newCaptainId) {
    ErrorHandlers.validation('Tournament ID and new captain ID are required');
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
    handleControllerError(error, 'transferring captainship', 'Error transferring captainship');
  }
};

/**
 * Search teams by name or member
 */
export const searchTeams = async (req: Request, res: Response) => {
  const { tournamentId, query } = req.query;

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
  }

  if (!query || String(query).trim() === '') {
    ErrorHandlers.validation('Search query is required');
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
    handleControllerError(error, 'searching teams', 'Error searching teams');
  }
};

/**
 * Get available players (unassigned to any team)
 */
export const getAvailablePlayers = async (req: Request, res: Response) => {
  const { tournamentId } = req.query;

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
  }

  try {
    const players = await teamService.getAvailablePlayers(String(tournamentId));

    res.json({
      success: true,
      data: { players },
    });
  } catch (error) {
    handleControllerError(error, 'getting available players', 'Error retrieving available players');
  }
};

/**
 * Validate team composition
 */
export const validateTeam = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
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
    handleControllerError(error, 'validating team', 'Error validating team');
  }
};

/**
 * Check member eligibility to join a team
 */
export const checkEligibility = async (req: Request, res: Response) => {
  const { tournamentId, userId, teamId } = req.query;

  if (!tournamentId || !userId) {
    ErrorHandlers.validation('Tournament ID and user ID are required');
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
    handleControllerError(error, 'checking eligibility', 'Error checking eligibility');
  }
};

/**
 * Get team with full member details
 */
export const getTeamDetails = async (req: Request, res: Response) => {
  const { id: teamId } = req.params;
  const { tournamentId } = req.query;

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
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
    handleControllerError(error, 'getting team details', 'Error retrieving team details');
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
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId || !memberIds || !Array.isArray(memberIds)) {
    ErrorHandlers.validation('Tournament ID and member IDs array are required');
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      ErrorHandlers.forbidden('Access denied. You are not the captain of this team');
    }

    // Get tournament data for max players check
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournament = tournamentDoc.data();
    const maxPlayers = tournament?.playersPerTeam || 4;
    const currentMembers = teamData?.members || [];

    // Check if adding all members would exceed max
    if (currentMembers.length + memberIds.length > maxPlayers) {
      ErrorHandlers.validation(
        `Cannot add ${memberIds.length} members. Team would exceed maximum of ${maxPlayers} players`
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
    handleControllerError(error, 'batch adding members', 'Error adding members to team');
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
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId || !memberIds || !Array.isArray(memberIds)) {
    ErrorHandlers.validation('Tournament ID and member IDs array are required');
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      ErrorHandlers.forbidden('Access denied. You are not the captain of this team');
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
    handleControllerError(error, 'batch removing members', 'Error removing members from team');
  }
};

/**
 * Create a new team (public endpoint for captains)
 */
export const createTeam = async (req: Request, res: Response) => {
  const { tournamentId, name, recruitmentOpen } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId || !name || name.trim() === '') {
    ErrorHandlers.validation('Tournament ID and team name are required');
  }

  try {
    // Check tournament exists and is not in random mode
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournament = tournamentDoc.data();
    if (tournament?.registrationMode === 'random') {
      ErrorHandlers.validation('Cannot create teams in random registration mode');
    }

    // Check if team name is unique
    const isUnique = await teamService.isTeamNameUnique(tournamentId, name.trim());
    if (!isUnique) {
      ErrorHandlers.validation('A team with this name already exists');
    }

    // Check if user is already in a team
    const eligibility = await teamService.checkMemberEligibility(tournamentId, userId);
    if (!eligibility.eligible) {
      ErrorHandlers.validation(eligibility.reason || 'Cannot create team');
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', userId);
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
    handleControllerError(error, 'creating team', 'Error creating team');
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
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!tournamentId) {
    ErrorHandlers.validation('Tournament ID is required');
  }

  try {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();

    // Check if user is captain
    if (teamData?.captainId !== userId) {
      ErrorHandlers.forbidden('Access denied. Only the captain can delete this team');
    }

    // Check if team is assigned to a pool
    if (teamData?.poolId) {
      ErrorHandlers.validation('Cannot delete team that is assigned to a pool');
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
    handleControllerError(error, 'deleting team', 'Error deleting team');
  }
};
