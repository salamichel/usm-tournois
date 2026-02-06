import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import type { Tournament, UnassignedPlayer, Team, TeamMember, TournamentQuestion, QuestionResponse } from '@shared/types';
import { convertTimestamps } from '../utils/firestore.utils';
import { calculateTournamentStatus } from '../utils/tournament.status.utils';
import { calculatePoolRanking } from '../services/match.service';
import { handleControllerError, ErrorHandlers } from '../utils/error.utils';

/**
 * Validate question responses against tournament's required questions
 */
const validateQuestionResponses = (
  signupQuestions: TournamentQuestion[] | undefined,
  questionResponses: QuestionResponse[] | undefined
): void => {
  if (!signupQuestions || signupQuestions.length === 0) {
    return; // No questions to validate
  }

  const requiredQuestions = signupQuestions.filter(q => q.required);

  if (requiredQuestions.length === 0) {
    return; // No required questions
  }

  if (!questionResponses || questionResponses.length === 0) {
    ErrorHandlers.validation('Des réponses aux questions sont requises pour l\'inscription');
  }

  for (const question of requiredQuestions) {
    const response = questionResponses.find(r => r.questionId === question.id);
    if (!response || !response.selectedOptionId) {
      ErrorHandlers.validation(`La question "${question.question}" est obligatoire`);
    }

    // Validate that the selected option exists
    const optionExists = question.options.some(o => o.id === response.selectedOptionId);
    if (!optionExists) {
      ErrorHandlers.validation(`Option invalide pour la question "${question.question}"`);
    }
  }
};

/**
 * Enrich question responses with option labels
 */
const enrichQuestionResponses = (
  signupQuestions: TournamentQuestion[] | undefined,
  questionResponses: QuestionResponse[] | undefined
): QuestionResponse[] | undefined => {
  if (!questionResponses || !signupQuestions) {
    return questionResponses;
  }

  return questionResponses.map(response => {
    const question = signupQuestions.find(q => q.id === response.questionId);
    const option = question?.options.find(o => o.id === response.selectedOptionId);
    return {
      ...response,
      selectedOptionLabel: option?.label || response.selectedOptionLabel,
    };
  });
};

/**
 * Get all active tournaments
 */
export const getAllTournaments = async (req: Request, res: Response) => {
  try {
    const userId = req.session?.user?.uid || null;

    const tournamentsSnapshot = await adminDb
      .collection('events')
      .where('isActive', '==', true)
      .get();

    const tournaments = await Promise.all(
      tournamentsSnapshot.docs.map(async (doc) => {
        const tournamentData: any = doc.data();

        // Count registered teams
        const teamsSnapshot = await adminDb
          .collection('events')
          .doc(doc.id)
          .collection('teams')
          .get();

        // Count complete teams (teams with required number of players) and total players in teams
        let completeTeamsCount = 0;
        let totalPlayersInTeams = 0;
        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          const membersCount = teamData.members?.length || 0;
          totalPlayersInTeams += membersCount;
          const minPlayers = tournamentData.minPlayersPerTeam || tournamentData.playersPerTeam;
          if (membersCount >= minPlayers) {
            completeTeamsCount++;
          }
        }

        // Count unassigned players (for random/individual registration mode)
        const unassignedPlayersSnapshot = await adminDb
          .collection('events')
          .doc(doc.id)
          .collection('unassignedPlayers')
          .get();
        const unassignedPlayersCount = unassignedPlayersSnapshot.size;

        // Count waiting list size
        const waitingListSnapshot = await adminDb
          .collection('events')
          .doc(doc.id)
          .collection('waitingListPlayers')
          .get();
        const waitingListCurrentSize = waitingListSnapshot.size;

        // Check if there are any matches (pools or elimination)
        let hasMatches = false;
        const poolsSnapshot = await adminDb
          .collection('events')
          .doc(doc.id)
          .collection('pools')
          .limit(1)
          .get();

        if (!poolsSnapshot.empty) {
          const firstPool = poolsSnapshot.docs[0];
          const matchesSnapshot = await adminDb
            .collection('events')
            .doc(doc.id)
            .collection('pools')
            .doc(firstPool.id)
            .collection('matches')
            .limit(1)
            .get();
          hasMatches = !matchesSnapshot.empty;
        }

        if (!hasMatches) {
          const eliminationMatchesSnapshot = await adminDb
            .collection('events')
            .doc(doc.id)
            .collection('eliminationMatches')
            .limit(1)
            .get();
          hasMatches = !eliminationMatchesSnapshot.empty;
        }

        // Check if ranking is frozen
        const finalRankingSnapshot = await adminDb
          .collection('events')
          .doc(doc.id)
          .collection('finalRanking')
          .limit(1)
          .get();

        const isRankingFrozen = !finalRankingSnapshot.empty &&
          finalRankingSnapshot.docs[0].data()?.frozenAt !== undefined;

        // Calculate tournament status
        const statusInfo = calculateTournamentStatus(
          tournamentData,
          completeTeamsCount,
          teamsSnapshot.size,
          hasMatches,
          isRankingFrozen,
          unassignedPlayersCount,
          waitingListCurrentSize,
          totalPlayersInTeams
        );

        const result: any = {
          id: doc.id,
          ...tournamentData,
          registeredTeamsCount: teamsSnapshot.size,
          completeTeamsCount: completeTeamsCount,
          unassignedPlayersCount: unassignedPlayersCount,
          status: statusInfo.status,
        };

        // Check user registration status if user is authenticated
        if (userId) {
          // Check if user is in a team
          for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();
            const members = teamData.members || [];
            const isInTeam = members.some((m: any) => m.userId === userId);

            if (isInTeam) {
              result.userRegistered = true;
              result.userTeamName = teamData.name;
              result.userRegistrationType = 'team';
              break;
            }
          }

          // If not in team, check if registered as free agent
          if (!result.userRegistered) {
            const unassignedPlayerDoc = await adminDb
              .collection('events')
              .doc(doc.id)
              .collection('unassignedPlayers')
              .doc(userId)
              .get();

            if (unassignedPlayerDoc.exists) {
              result.userRegistered = true;
              result.userRegistrationType = 'freeAgent';
            }
          }
        }

        return convertTimestamps(result);
      })
    );

    res.json({
      success: true,
      data: { tournaments },
    });
  } catch (error) {
    handleControllerError(error, 'getting tournaments', 'Error retrieving tournaments');
  }
};

/**
 * Get tournament by ID
 */
export const getTournamentById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const tournamentDoc = await adminDb.collection('events').doc(id).get();

    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', id);
    }

    // Get teams
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('teams')
      .get();
    const teams = teamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Get unassigned players
    const unassignedPlayersSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('unassignedPlayers')
      .get();
    const unassignedPlayers = unassignedPlayersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || doc.id, // Ensure userId is set
        pseudo: data.pseudo || 'Unknown',
        level: data.level || 'N/A',
        ...data,
      };
    });

    // Get pools and matches
    const poolsSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('pools')
      .get();
    const pools = await Promise.all(
      poolsSnapshot.docs.map(async (poolDoc) => {
        const poolData = poolDoc.data();
        const matchesSnapshot = await poolDoc.ref.collection('matches').orderBy('matchNumber').get();
        const matches = matchesSnapshot.docs.map((m) => ({ id: m.id, ...m.data() }));

        // Calculate pool ranking
        const teamsInPool = (poolData.teams || []).map((team: any) => ({
          id: team.id,
          name: team.name,
        }));

        const ranking = await calculatePoolRanking(
          id,
          poolDoc.id,
          teamsInPool,
          matches
        );

        return {
          id: poolDoc.id,
          ...poolData,
          matches,
          ranking,
        };
      })
    );

    // Get elimination matches
    const eliminationMatchesSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('eliminationMatches')
      .get();
    const eliminationMatches = eliminationMatchesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: 'elimination',
    }));

    // Get final ranking
    const finalRankingSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('finalRanking')
      .orderBy('rank')
      .get();
    const finalRanking: any[] = finalRankingSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get waiting list
    const waitingListSnapshot = await adminDb
      .collection('events')
      .doc(id)
      .collection('waitingListPlayers')
      .get();
    const waitingList = waitingListSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Calculate tournament status
    const tournamentData = tournamentDoc.data();
    const completeTeamsCount = teams.filter((team: any) => {
      const minPlayers = tournamentData?.minPlayersPerTeam || tournamentData?.playersPerTeam;
      return (team.members?.length || 0) >= minPlayers;
    }).length;
    const totalPlayersInTeams = teams.reduce((sum: number, team: any) => sum + (team.members?.length || 0), 0);

    const hasMatches = pools.some((pool: any) => pool.matches && pool.matches.length > 0) ||
      eliminationMatches.length > 0;

    // Check if ranking is frozen
    const isRankingFrozen = finalRanking.length > 0 &&
      finalRanking[0]?.frozenAt !== undefined;

    const statusInfo = calculateTournamentStatus(
      tournamentData,
      completeTeamsCount,
      teams.length,
      hasMatches,
      isRankingFrozen,
      unassignedPlayers.length,
      waitingList.length,
      totalPlayersInTeams
    );

    res.json({
      success: true,
      data: convertTimestamps({
        tournament: {
          id: tournamentDoc.id,
          ...tournamentData,
          status: statusInfo.status
        },
        teams,
        unassignedPlayers,
        pools,
        eliminationMatches,
        finalRanking,
        waitingList,
      }),
    });
  } catch (error) {
    handleControllerError(error, 'getting tournament', 'Error retrieving tournament');
  }
};

/**
 * Register player as free agent
 */
export const registerPlayer = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { questionResponses } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  try {
    // Check if tournament exists and is active
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournament = tournamentDoc.data();
    if (!tournament?.isActive) {
      ErrorHandlers.validation('Tournament is not active');
    }

    // Validate question responses
    validateQuestionResponses(tournament?.signupQuestions, questionResponses);

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', userId);
    }

    const userData = userDoc.data();

    // Enrich responses with option labels
    const enrichedResponses = enrichQuestionResponses(tournament?.signupQuestions, questionResponses);

    // Register as unassigned player
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId)
      .set({
        userId: userId,
        pseudo: userData?.pseudo || 'Unknown',
        level: userData?.level || 'N/A',
        registeredAt: new Date(),
        questionResponses: enrichedResponses || [],
      });

    res.json({
      success: true,
      message: 'Successfully registered as free player',
    });
  } catch (error) {
    handleControllerError(error, 'registering player', 'Error registering player');
  }
};

/**
 * Register team to tournament
 */
export const registerTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  try {
    // Verify tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    // Find team across all tournaments where user is captain
    let foundTeamData: any = null;
    const allEventsSnapshot = await adminDb.collection('events').get();

    for (const eventDoc of allEventsSnapshot.docs) {
      const teamsSnapshot = await adminDb
        .collection('events')
        .doc(eventDoc.id)
        .collection('teams')
        .where('captainId', '==', userId)
        .get();

      for (const teamDoc of teamsSnapshot.docs) {
        if (teamDoc.id === teamId) {
          foundTeamData = { id: teamDoc.id, ...teamDoc.data() };
          break;
        }
      }
      if (foundTeamData) break;
    }

    if (!foundTeamData) {
      ErrorHandlers.notFound('Team', teamId);
    }

    // Check if already registered
    const existingRegistration = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (existingRegistration.exists) {
      ErrorHandlers.validation('Team is already registered for this tournament');
    }

    // Register team
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .set({
        ...foundTeamData,
        registeredAt: new Date(),
      });

    res.json({
      success: true,
      message: 'Team successfully registered for tournament',
    });
  } catch (error) {
    handleControllerError(error, 'registering team', 'Error registering team');
  }
};

/**
 * Unregister team from tournament
 */
export const unregisterTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  try {
    const teamDoc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();
    if (teamData?.captainId !== userId) {
      ErrorHandlers.forbidden('You are not the captain of this team');
    }

    // Remove team from tournament
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .delete();

    res.json({
      success: true,
      message: 'Team successfully unregistered from tournament',
    });
  } catch (error) {
    handleControllerError(error, 'unregistering team', 'Error unregistering team');
  }
};

/**
 * Leave tournament (as player or team member)
 */
export const leaveTournament = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  try {
    const batch = adminDb.batch();

    // Remove from unassigned players
    const unassignedPlayerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const unassignedPlayerDoc = await unassignedPlayerRef.get();
    if (unassignedPlayerDoc.exists) {
      batch.delete(unassignedPlayerRef);
    }

    // Remove from teams
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .get();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      if (teamData.members && Array.isArray(teamData.members)) {
        const userInTeam = teamData.members.find((m: any) => m.userId === userId);
        if (userInTeam) {
          const updatedMembers = teamData.members.filter((m: any) => m.userId !== userId);
          batch.update(teamDoc.ref, { members: updatedMembers });
        }
      }
    }

    await batch.commit();

    res.json({
      success: true,
      message: 'Successfully left tournament',
    });
  } catch (error) {
    handleControllerError(error, 'leaving tournament', 'Error leaving tournament');
  }
};

/**
 * Join a team
 */
export const joinTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamId, questionResponses } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  try {
    // Check tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournament = tournamentDoc.data();

    // Validate question responses
    validateQuestionResponses(tournament?.signupQuestions, questionResponses);

    // Check team exists
    const teamDoc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();

    // Check if team is full
    const currentMembers = teamData?.members || [];
    if (currentMembers.length >= (tournament?.playersPerTeam || 4)) {
      ErrorHandlers.validation('Team has reached maximum number of players');
    }

    // Check if user is already in team
    const alreadyInTeam = currentMembers.some((m: any) => m.userId === userId);
    if (alreadyInTeam) {
      ErrorHandlers.validation('You are already a member of this team');
    }

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', userId);
    }

    const userData = userDoc.data();
    const batch = adminDb.batch();

    // Enrich responses with option labels
    const enrichedResponses = enrichQuestionResponses(tournament?.signupQuestions, questionResponses);

    // Add to team
    batch.update(teamDoc.ref, {
      members: [
        ...currentMembers,
        {
          userId: userId,
          pseudo: userData?.pseudo || 'Unknown',
          level: userData?.level || 'N/A',
          questionResponses: enrichedResponses || [],
        },
      ],
    });

    // Remove from unassigned players if present
    const unassignedPlayerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const unassignedDoc = await unassignedPlayerRef.get();
    if (unassignedDoc.exists) {
      batch.delete(unassignedPlayerRef);
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Successfully joined team ${teamData?.name}`,
    });
  } catch (error) {
    handleControllerError(error, 'joining team', 'Error joining team');
  }
};

/**
 * Leave a team
 */
export const leaveTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamId } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  try {
    const teamDoc = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      ErrorHandlers.notFound('Team', teamId);
    }

    const teamData = teamDoc.data();
    const members = teamData?.members || [];
    const memberToLeave = members.find((m: any) => m.userId === userId);

    if (!memberToLeave) {
      ErrorHandlers.validation('You are not a member of this team');
    }

    const batch = adminDb.batch();

    if (userId === teamData?.captainId) {
      // Captain leaving
      const updatedMembers = members.filter((m: any) => m.userId !== userId);

      if (updatedMembers.length > 0) {
        // Transfer captainship to first remaining member
        const newCaptain = updatedMembers[0];
        batch.update(teamDoc.ref, {
          members: updatedMembers,
          captainId: newCaptain.userId,
        });
      } else {
        // Delete team if captain was only member
        batch.delete(teamDoc.ref);
      }
    } else {
      // Regular member leaving
      const updatedMembers = members.filter((m: any) => m.userId !== userId);
      batch.update(teamDoc.ref, { members: updatedMembers });
    }

    // Add to unassigned players
    batch.set(
      adminDb
        .collection('events')
        .doc(tournamentId)
        .collection('unassignedPlayers')
        .doc(userId),
      {
        userId: memberToLeave.userId,
        pseudo: memberToLeave.pseudo,
        level: memberToLeave.level,
        leftTeamAt: new Date(),
      }
    );

    await batch.commit();

    res.json({
      success: true,
      message: 'Successfully left team',
    });
  } catch (error) {
    handleControllerError(error, 'leaving team', 'Error leaving team');
  }
};

/**
 * Create a new team
 */
export const createTeam = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const { teamName, questionResponses } = req.body;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  if (!teamName || teamName.trim() === '') {
    ErrorHandlers.validation('Team name is required');
  }

  try {
    // Check tournament exists
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournamentData = tournamentDoc.data();

    // Check if tournament is in random mode (teams are generated by admin)
    if (tournamentData?.registrationMode === 'random') {
      ErrorHandlers.forbidden('Cannot create teams in this tournament. Teams will be generated randomly by the admin.');
    }

    // Validate question responses
    validateQuestionResponses(tournamentData?.signupQuestions, questionResponses);

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      ErrorHandlers.notFound('User', userId);
    }

    const userData = userDoc.data();
    const batch = adminDb.batch();

    // Enrich responses with option labels
    const enrichedResponses = enrichQuestionResponses(tournamentData?.signupQuestions, questionResponses);

    // Create team
    const newTeamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc();

    batch.set(newTeamRef, {
      name: teamName.trim(),
      captainId: userId,
      members: [
        {
          userId: userId,
          pseudo: userData?.pseudo || 'Unknown',
          level: userData?.level || 'N/A',
          questionResponses: enrichedResponses || [],
        },
      ],
      recruitmentOpen: true,
      createdAt: new Date(),
    });

    // Remove from unassigned players if present
    const unassignedPlayerRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .doc(userId);

    const unassignedDoc = await unassignedPlayerRef.get();
    if (unassignedDoc.exists) {
      batch.delete(unassignedPlayerRef);
    }

    await batch.commit();

    res.json({
      success: true,
      message: 'Team created successfully',
      teamId: newTeamRef.id,
    });
  } catch (error) {
    handleControllerError(error, 'creating team', 'Error creating team');
  }
};

/**
 * Join waiting list
 */
export const joinWaitingList = async (req: Request, res: Response) => {
  const { id: tournamentId } = req.params;
  const userId = (req as any).user?.uid;

  if (!userId) {
    ErrorHandlers.unauthorized('User not authenticated');
  }

  try {
    // Check tournament exists and has waiting list enabled
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      ErrorHandlers.notFound('Tournament', tournamentId);
    }

    const tournament = tournamentDoc.data();
    if ((tournament?.waitingListSize || 0) <= 0) {
      ErrorHandlers.validation('Waiting list is not enabled for this tournament');
    }

    // Find user's team where they are captain
    const teamsSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .where('captainId', '==', userId)
      .get();

    if (teamsSnapshot.empty) {
      ErrorHandlers.validation('You must be a team captain to join the waiting list');
    }

    const teamDoc = teamsSnapshot.docs[0];
    const teamData = { id: teamDoc.id, ...teamDoc.data() };

    // Check waiting list size
    const waitingListSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('waitingListTeams')
      .get();

    if (waitingListSnapshot.size >= (tournament.waitingListSize || 0)) {
      ErrorHandlers.validation('Waiting list is full');
    }

    // Add to waiting list
    await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('waitingListTeams')
      .doc(teamData.id)
      .set({
        ...teamData,
        addedAt: new Date(),
      });

    res.json({
      success: true,
      message: 'Successfully added to waiting list',
    });
  } catch (error) {
    handleControllerError(error, 'joining waiting list', 'Error joining waiting list');
  }
};
