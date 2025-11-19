/**
 * Team Service
 * Business logic and utility functions for team management
 */

import { adminDb } from '../config/firebase.config';
import { AppError } from '../middlewares/error.middleware';
import { convertTimestamps } from '../utils/firestore.utils';

export interface TeamStats {
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  setsDifferential: number;
  pointsDifferential: number;
  matchesPlayed: number;
}

export interface TeamFilters {
  search?: string;
  poolId?: string;
  recruitmentOpen?: boolean;
  minMembers?: number;
  maxMembers?: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Calculate team statistics from matches
 */
export async function calculateTeamStats(
  tournamentId: string,
  teamId: string
): Promise<TeamStats> {
  const stats: TeamStats = {
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
    setsDifferential: 0,
    pointsDifferential: 0,
    matchesPlayed: 0,
  };

  try {
    // Get pool matches
    const poolMatchesSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('matches')
      .where('status', '==', 'completed')
      .get();

    // Get elimination matches
    const eliminationMatchesSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .where('status', '==', 'completed')
      .get();

    const allMatches = [
      ...poolMatchesSnapshot.docs,
      ...eliminationMatchesSnapshot.docs,
    ];

    for (const matchDoc of allMatches) {
      const match = matchDoc.data();

      // Check if team participated in this match
      const isTeam1 = match.team1Id === teamId;
      const isTeam2 = match.team2Id === teamId;

      if (!isTeam1 && !isTeam2) continue;

      stats.matchesPlayed++;

      // Calculate sets and points
      if (match.sets && Array.isArray(match.sets)) {
        let teamSetsWon = 0;
        let opponentSetsWon = 0;

        for (const set of match.sets) {
          const teamScore = isTeam1 ? set.score1 : set.score2;
          const opponentScore = isTeam1 ? set.score2 : set.score1;

          if (teamScore !== undefined && opponentScore !== undefined) {
            stats.pointsWon += teamScore;
            stats.pointsLost += opponentScore;

            if (set.winner === (isTeam1 ? 1 : 2)) {
              teamSetsWon++;
            } else if (set.winner === (isTeam1 ? 2 : 1)) {
              opponentSetsWon++;
            }
          }
        }

        stats.setsWon += teamSetsWon;
        stats.setsLost += opponentSetsWon;
      }

      // Determine match winner
      if (match.winnerId === teamId) {
        stats.wins++;
      } else if (match.winnerId) {
        stats.losses++;
      }
    }

    stats.setsDifferential = stats.setsWon - stats.setsLost;
    stats.pointsDifferential = stats.pointsWon - stats.pointsLost;

    return stats;
  } catch (error) {
    console.error('Error calculating team stats:', error);
    return stats;
  }
}

/**
 * Check if a team name is unique within a tournament
 */
export async function isTeamNameUnique(
  tournamentId: string,
  teamName: string,
  excludeTeamId?: string
): Promise<boolean> {
  const normalizedName = teamName.trim().toLowerCase();

  const teamsSnapshot = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('teams')
    .get();

  for (const doc of teamsSnapshot.docs) {
    if (excludeTeamId && doc.id === excludeTeamId) continue;
    const team = doc.data();
    if (team.name?.trim().toLowerCase() === normalizedName) {
      return false;
    }
  }

  return true;
}

/**
 * Get all teams for a tournament with filters and pagination
 */
export async function getTeamsWithFilters(
  tournamentId: string,
  filters: TeamFilters = {},
  pagination: PaginationOptions = {}
): Promise<{
  teams: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { search, poolId, recruitmentOpen, minMembers, maxMembers } = filters;
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;

  // Get all teams
  let teamsSnapshot = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('teams')
    .get();

  let teams = teamsSnapshot.docs.map((doc) =>
    convertTimestamps({ id: doc.id, ...doc.data() })
  );

  // Apply filters
  if (search) {
    const searchLower = search.toLowerCase();
    teams = teams.filter(
      (team) =>
        team.name?.toLowerCase().includes(searchLower) ||
        team.members?.some((m: any) =>
          m.pseudo?.toLowerCase().includes(searchLower)
        )
    );
  }

  if (poolId) {
    teams = teams.filter((team) => team.poolId === poolId);
  }

  if (recruitmentOpen !== undefined) {
    teams = teams.filter((team) => team.recruitmentOpen === recruitmentOpen);
  }

  if (minMembers !== undefined) {
    teams = teams.filter(
      (team) => (team.members?.length || 0) >= minMembers
    );
  }

  if (maxMembers !== undefined) {
    teams = teams.filter(
      (team) => (team.members?.length || 0) <= maxMembers
    );
  }

  // Sort by name
  teams.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Pagination
  const total = teams.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedTeams = teams.slice(startIndex, startIndex + limit);

  return {
    teams: paginatedTeams,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Check if user is eligible to join a team
 */
export async function checkMemberEligibility(
  tournamentId: string,
  userId: string,
  teamId?: string
): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  // Check if user exists
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return { eligible: false, reason: 'User not found' };
  }

  // Check if user is already in another team
  const teamsSnapshot = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('teams')
    .get();

  for (const doc of teamsSnapshot.docs) {
    if (teamId && doc.id === teamId) continue;
    const team = doc.data();
    const isMember = team.members?.some((m: any) => m.userId === userId);
    if (isMember) {
      return {
        eligible: false,
        reason: `User is already a member of team "${team.name}"`,
      };
    }
  }

  return { eligible: true };
}

/**
 * Get team with full member details
 */
export async function getTeamWithMemberDetails(
  tournamentId: string,
  teamId: string
): Promise<any> {
  const teamDoc = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('teams')
    .doc(teamId)
    .get();

  if (!teamDoc.exists) {
    throw new AppError('Team not found', 404);
  }

  const team = convertTimestamps({ id: teamDoc.id, ...teamDoc.data() });

  // Enrich member data
  if (team.members && Array.isArray(team.members)) {
    const enrichedMembers = await Promise.all(
      team.members.map(async (member: any) => {
        const userDoc = await adminDb
          .collection('users')
          .doc(member.userId)
          .get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          return {
            ...member,
            email: userData?.email,
            isVirtual: userData?.isVirtual || false,
            createdAt: userData?.createdAt,
          };
        }
        return member;
      })
    );
    team.members = enrichedMembers;
  }

  return team;
}

/**
 * Get available players for a team (from unassigned players)
 */
export async function getAvailablePlayers(
  tournamentId: string
): Promise<any[]> {
  const unassignedSnapshot = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('unassignedPlayers')
    .get();

  return unassignedSnapshot.docs.map((doc) =>
    convertTimestamps({ id: doc.id, ...doc.data() })
  );
}

/**
 * Transfer captainship to another member
 */
export async function transferCaptainship(
  tournamentId: string,
  teamId: string,
  currentCaptainId: string,
  newCaptainId: string
): Promise<void> {
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

  // Verify current captain
  if (teamData?.captainId !== currentCaptainId) {
    throw new AppError('Only the current captain can transfer captainship', 403);
  }

  // Verify new captain is a member
  const isMember = teamData?.members?.some(
    (m: any) => m.userId === newCaptainId
  );
  if (!isMember) {
    throw new AppError('New captain must be a member of the team', 400);
  }

  // Get new captain info
  const newCaptainMember = teamData?.members?.find(
    (m: any) => m.userId === newCaptainId
  );

  await teamRef.update({
    captainId: newCaptainId,
    captainPseudo: newCaptainMember?.pseudo,
    updatedAt: new Date(),
  });
}

/**
 * Validate team composition
 */
export async function validateTeamComposition(
  tournamentId: string,
  teamId: string
): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  const teamDoc = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('teams')
    .doc(teamId)
    .get();

  if (!teamDoc.exists) {
    return { valid: false, issues: ['Team not found'] };
  }

  const team = teamDoc.data();

  // Get tournament rules
  const tournamentDoc = await adminDb
    .collection('events')
    .doc(tournamentId)
    .get();

  if (!tournamentDoc.exists) {
    return { valid: false, issues: ['Tournament not found'] };
  }

  const tournament = tournamentDoc.data();
  const minPlayers = tournament?.minPlayersPerTeam || 1;
  const maxPlayers = tournament?.playersPerTeam || 4;
  const memberCount = team?.members?.length || 0;

  // Check member count
  if (memberCount < minPlayers) {
    issues.push(
      `Team needs at least ${minPlayers} members (currently has ${memberCount})`
    );
  }

  if (memberCount > maxPlayers) {
    issues.push(
      `Team has too many members (${memberCount}/${maxPlayers})`
    );
  }

  // Check if captain is a member
  const captainIsMember = team?.members?.some(
    (m: any) => m.userId === team?.captainId
  );
  if (!captainIsMember) {
    issues.push('Captain is not a member of the team');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get teams by pool
 */
export async function getTeamsByPool(
  tournamentId: string,
  poolId: string
): Promise<any[]> {
  const teamsSnapshot = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('teams')
    .where('poolId', '==', poolId)
    .get();

  return teamsSnapshot.docs.map((doc) =>
    convertTimestamps({ id: doc.id, ...doc.data() })
  );
}

/**
 * Batch update teams (for admin operations)
 */
export async function batchUpdateTeams(
  tournamentId: string,
  updates: Array<{ teamId: string; data: any }>
): Promise<void> {
  const batch = adminDb.batch();

  for (const update of updates) {
    const teamRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .doc(update.teamId);

    batch.update(teamRef, {
      ...update.data,
      updatedAt: new Date(),
    });
  }

  await batch.commit();
}

/**
 * Search teams by name or member
 */
export async function searchTeams(
  tournamentId: string,
  query: string
): Promise<any[]> {
  const teamsSnapshot = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('teams')
    .get();

  const queryLower = query.toLowerCase();

  return teamsSnapshot.docs
    .map((doc) => convertTimestamps({ id: doc.id, ...doc.data() }))
    .filter(
      (team) =>
        team.name?.toLowerCase().includes(queryLower) ||
        team.members?.some((m: any) =>
          m.pseudo?.toLowerCase().includes(queryLower)
        )
    );
}

/**
 * Get team history (matches and results)
 */
export async function getTeamHistory(
  tournamentId: string,
  teamId: string
): Promise<any[]> {
  // Get pool matches
  const poolMatchesSnapshot = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('matches')
    .get();

  // Get elimination matches
  const eliminationMatchesSnapshot = await adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('eliminationMatches')
    .get();

  const allMatches = [
    ...poolMatchesSnapshot.docs.map((doc) => ({
      ...convertTimestamps({ id: doc.id, ...doc.data() }),
      matchType: 'pool',
    })),
    ...eliminationMatchesSnapshot.docs.map((doc) => ({
      ...convertTimestamps({ id: doc.id, ...doc.data() }),
      matchType: 'elimination',
    })),
  ];

  // Filter matches for this team
  const teamMatches = allMatches.filter(
    (match) => match.team1Id === teamId || match.team2Id === teamId
  );

  // Sort by date
  teamMatches.sort((a, b) => {
    const dateA = a.scheduledAt || a.createdAt || '';
    const dateB = b.scheduledAt || b.createdAt || '';
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  return teamMatches;
}

export default {
  calculateTeamStats,
  isTeamNameUnique,
  getTeamsWithFilters,
  checkMemberEligibility,
  getTeamWithMemberDetails,
  getAvailablePlayers,
  transferCaptainship,
  validateTeamComposition,
  getTeamsByPool,
  batchUpdateTeams,
  searchTeams,
  getTeamHistory,
};
