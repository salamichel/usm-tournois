/**
 * Team Management Controller
 */

import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';
import { calculateTeamGlobalRanking } from './admin.helpers';

export const getTeams = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get all teams
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    // Get all pools to check which teams are already assigned
    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .get();

    // Get all global rankings to enrich members with points
    const rankingsSnapshot = await adminDb.collection('globalPlayerRanking').get();
    const rankingsMap = new Map<string, number>();
    rankingsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      rankingsMap.set(doc.id, data.totalPoints || 0);
    });

    // Create a set of team IDs that are already assigned to pools
    const assignedTeamIds = new Set<string>();
    poolsSnapshot.docs.forEach((poolDoc) => {
      const poolData = poolDoc.data();
      const poolTeams = poolData.teams || [];
      poolTeams.forEach((team: any) => {
        if (team.id) {
          assignedTeamIds.add(team.id);
        }
      });
    });

    // Map teams with isAssigned field and populate captainPseudo if missing
    const teamsPromises = teamsSnapshot.docs.map(async (doc) => {
      const teamData = doc.data();
      let captainPseudo = teamData.captainPseudo;

      // If captainPseudo is missing but captainId exists, fetch it
      if (!captainPseudo && teamData.captainId) {
        try {
          const captainDoc = await adminDb.collection('users').doc(teamData.captainId).get();
          if (captainDoc.exists) {
            captainPseudo = captainDoc.data()?.pseudo || 'Unknown';
            // Update the team document with the captain pseudo for future use
            await doc.ref.update({ captainPseudo });
          }
        } catch (err) {
          console.warn(`Failed to fetch captain for team ${doc.id}:`, err);
        }
      }

      // Enrich members with their points
      const members = (teamData.members || []).map((member: any) => ({
        ...member,
        totalPoints: rankingsMap.get(member.userId) || 0,
      }));

      return convertTimestamps({
        id: doc.id,
        ...teamData,
        members,
        captainPseudo,
        isAssigned: assignedTeamIds.has(doc.id),
      });
    });

    const teams = await Promise.all(teamsPromises);

    res.json({
      success: true,
      data: { teams },
    });
  } catch (error) {
    console.error('Error getting teams:', error);
    throw new AppError('Error retrieving teams', 500);
  }
};

export const createTeam = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { name, captainId, members, recruitmentOpen, weight } = req.body;

    if (!name) {
      throw new AppError('Team name is required', 400);
    }

    const teamData: any = {
      name,
      members: members || [],
      recruitmentOpen: recruitmentOpen !== undefined ? recruitmentOpen : false,
      weight: weight ? parseInt(weight) : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Captain ID is optional - admin can create team without captain
    if (captainId) {
      teamData.captainId = captainId;

      // If captain is provided, verify they exist and add to members if not already
      const captainDoc = await adminDb.collection('users').doc(captainId).get();
      if (!captainDoc.exists) {
        throw new AppError('Captain user not found', 404);
      }

      const captainData = captainDoc.data();
      const isCaptainInMembers = teamData.members.some((m: any) => m.userId === captainId);

      if (!isCaptainInMembers) {
        teamData.members.push({
          userId: captainId,
          pseudo: captainData?.pseudo || 'Unknown',
          level: captainData?.level || 'N/A',
        });
      }
    }

    // Automatically calculate globalRanking based on members' points
    teamData.globalRanking = await calculateTeamGlobalRanking(teamData.members);

    const teamRef = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .add(teamData);

    res.json({
      success: true,
      message: 'Team created successfully',
      data: {
        id: teamRef.id,
        globalRanking: teamData.globalRanking
      },
    });
  } catch (error: any) {
    console.error('Error creating team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error creating team', 500);
  }
};

export const updateTeam = async (req: Request, res: Response) => {
  try {
    const { tournamentId, teamId } = req.params;
    const { name, captainId, captainPseudo, members, recruitmentOpen, weight } = req.body;

    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined && name !== null) updateData.name = name;
    if (captainId !== undefined && captainId !== null) {
      updateData.captainId = captainId;

      // If captainPseudo is provided, use it; otherwise fetch from user data
      if (captainPseudo !== undefined && captainPseudo !== null) {
        updateData.captainPseudo = captainPseudo;
      } else {
        // Fetch captain's pseudo from user data
        const captainDoc = await adminDb.collection('users').doc(captainId).get();
        if (captainDoc.exists) {
          const captainData = captainDoc.data();
          updateData.captainPseudo = captainData?.pseudo || 'Unknown';
        }
      }
    }
    if (members !== undefined && members !== null) {
      updateData.members = members;
      // Automatically calculate globalRanking based on members' points
      updateData.globalRanking = await calculateTeamGlobalRanking(members);
    }
    if (recruitmentOpen !== undefined && recruitmentOpen !== null) updateData.recruitmentOpen = recruitmentOpen === true || recruitmentOpen === 'true';
    if (weight !== undefined && weight !== null) updateData.weight = parseInt(weight) || 0;

    await teamRef.update(updateData);

    res.json({
      success: true,
      message: 'Team updated successfully',
      data: {
        globalRanking: updateData.globalRanking
      }
    });
  } catch (error: any) {
    console.error('Error updating team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error updating team', 500);
  }
};

export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { tournamentId, teamId } = req.params;

    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId);

    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      throw new AppError('Team not found', 404);
    }

    await teamRef.delete();

    res.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting team:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error deleting team', 500);
  }
};

/**
 * Recalculate globalRanking for all teams in a tournament
 */
export const recalculateTeamsRanking = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get all teams for this tournament
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    if (teamsSnapshot.empty) {
      throw new AppError('No teams found for this tournament', 404);
    }

    const batch = adminDb.batch();
    let updatedCount = 0;

    // Calculate and update globalRanking for each team
    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const members = teamData.members || [];

      // Calculate new globalRanking
      const globalRanking = await calculateTeamGlobalRanking(members);

      // Update team with new globalRanking
      batch.update(teamDoc.ref, {
        globalRanking,
        updatedAt: new Date(),
      });

      updatedCount++;
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Successfully recalculated ranking for ${updatedCount} teams`,
      data: {
        teamsUpdated: updatedCount,
      },
    });
  } catch (error: any) {
    console.error('Error recalculating teams ranking:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error recalculating teams ranking', 500);
  }
};

/**
 * Generate random teams from unassigned players
 */
export const generateRandomTeams = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;

    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      throw new AppError('Tournament not found', 404);
    }

    const tournament = tournamentDoc.data();

    // Check if tournament is in random mode
    if (tournament?.registrationMode !== 'random') {
      throw new AppError('This tournament is not in random registration mode', 400);
    }

    const playersPerTeam = tournament.playersPerTeam || 4;

    // Get all unassigned players
    const unassignedPlayersSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .get();

    if (unassignedPlayersSnapshot.empty) {
      throw new AppError('No players registered for this tournament', 400);
    }

    const players: any[] = unassignedPlayersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Check if we have enough players
    if (players.length < playersPerTeam) {
      throw new AppError(`Not enough players. Need at least ${playersPerTeam} players to create teams.`, 400);
    }

    // Define level ranking (higher = better)
    const levelRanking: { [key: string]: number } = {
      'confirmé': 3,
      'confirme': 3,
      'intermédiaire': 2,
      'intermediaire': 2,
      'débutant': 1,
      'debutant': 1,
    };

    // Sort players by level (best to worst), with random shuffle for same levels
    const sortedPlayers = [...players].sort((a, b) => {
      const levelA = levelRanking[a.level?.toLowerCase()] || 0;
      const levelB = levelRanking[b.level?.toLowerCase()] || 0;

      if (levelA !== levelB) {
        return levelB - levelA; // Descending order (best first)
      }

      // Random order for players with same level
      return Math.random() - 0.5;
    });

    // Calculate number of complete teams we can create
    const numTeams = Math.floor(sortedPlayers.length / playersPerTeam);

    if (numTeams === 0) {
      throw new AppError(`Not enough players to create a complete team. Need at least ${playersPerTeam} players.`, 400);
    }

    // Distribute players using snake draft algorithm for balanced teams
    // This ensures each team gets a fair distribution of skill levels
    const teams: any[][] = Array.from({ length: numTeams }, () => []);
    let currentTeam = 0;
    let direction = 1; // 1 for forward, -1 for backward

    for (let i = 0; i < numTeams * playersPerTeam; i++) {
      teams[currentTeam].push(sortedPlayers[i]);

      // Move to next team
      currentTeam += direction;

      // Change direction when we reach either end
      if (currentTeam >= numTeams) {
        currentTeam = numTeams - 1;
        direction = -1;
      } else if (currentTeam < 0) {
        currentTeam = 0;
        direction = 1;
      }
    }

    // Create teams in database
    const batch = adminDb.batch();

    for (let teamNum = 0; teamNum < numTeams; teamNum++) {
      const teamPlayers = teams[teamNum];

      // Create team document
      const teamRef = adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('teams')
        .doc();

      const members = teamPlayers.map((player: any) => ({
        userId: player.userId || player.id,
        pseudo: player.pseudo,
        level: player.level || 'N/A',
        isVirtual: player.isVirtual || false,
      }));

      const teamData = {
        name: `Équipe ${teamNum + 1}`,
        captainId: members[0].userId, // First player (highest level) is captain
        members: members,
        recruitmentOpen: false,
        registeredAt: new Date(),
        createdAt: new Date(),
      };

      batch.set(teamRef, teamData);

      // Remove players from unassigned list
      teamPlayers.forEach((player: any) => {
        const unassignedRef = adminDb
          .collection('events')
          .doc(tournamentId)
          .collection('unassignedPlayers')
          .doc(player.id);
        batch.delete(unassignedRef);
      });
    }

    await batch.commit();

    // Calculate remaining players
    const remainingPlayers = sortedPlayers.length - (numTeams * playersPerTeam);

    res.json({
      success: true,
      message: `Successfully created ${numTeams} balanced team${numTeams > 1 ? 's' : ''} with ${playersPerTeam} players each.`,
      data: {
        teamsCreated: numTeams,
        playersAssigned: numTeams * playersPerTeam,
        remainingPlayers: remainingPlayers,
      },
    });
  } catch (error: any) {
    console.error('Error generating random teams:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Error generating random teams', 500);
  }
};
