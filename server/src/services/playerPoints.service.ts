/**
 * Player Points Service
 * Handles player points attribution and global ranking
 */

import { adminDb } from '../config/firebase.config';
import type {
  PlayerTournamentPoints,
  PlayerGlobalRanking,
  PlayerStats,
} from '../../../shared/types/playerPoints.types';
import type { TeamMember } from '../../../shared/types/team.types';

/**
 * Get points for a given rank based on tournament position
 */
function getPointsForRank(rank: number): number {
  if (rank === 1) return 100;
  if (rank === 2) return 80;
  if (rank === 3) return 65;
  if (rank === 4) return 55;
  if (rank >= 5 && rank <= 8) return 40;
  if (rank >= 9 && rank <= 16) return 25;
  if (rank >= 17 && rank <= 32) return 15;
  return 10; // 32nd+ (participation)
}

/**
 * Award points to all players in a team based on their rank
 */
export async function awardPointsToTeam(
  tournamentId: string,
  tournamentName: string,
  tournamentDate: Date,
  teamName: string,
  teamMembers: TeamMember[],
  rank: number
): Promise<void> {
  const points = getPointsForRank(rank);
  const batch = adminDb.batch();

  // Award points to each team member
  for (const member of teamMembers) {
    // Skip virtual/placeholder members
    if (member.isVirtual) continue;

    const playerPoints: PlayerTournamentPoints = {
      playerId: member.userId,
      playerPseudo: member.pseudo,
      tournamentId,
      tournamentName,
      tournamentDate,
      teamName,
      rank,
      points,
      earnedAt: new Date(),
    };

    // Store in playerTournamentPoints collection
    const pointsRef = adminDb
      .collection('playerTournamentPoints')
      .doc(member.userId)
      .collection('tournaments')
      .doc(tournamentId);

    batch.set(pointsRef, playerPoints);
  }

  await batch.commit();

  // Update global rankings for all players
  await updateGlobalRankings(teamMembers.filter(m => !m.isVirtual).map(m => m.userId));
}

/**
 * Update global ranking for specific players
 */
export async function updateGlobalRankings(playerIds: string[]): Promise<void> {
  const batch = adminDb.batch();

  for (const playerId of playerIds) {
    const ranking = await calculatePlayerGlobalRanking(playerId);
    if (ranking) {
      const rankingRef = adminDb.collection('globalPlayerRanking').doc(playerId);
      batch.set(rankingRef, ranking, { merge: true });
    }
  }

  await batch.commit();
}

/**
 * Calculate global ranking for a player
 */
export async function calculatePlayerGlobalRanking(
  playerId: string
): Promise<PlayerGlobalRanking | null> {
  // Get all tournament points for this player
  const tournamentsSnapshot = await adminDb
    .collection('playerTournamentPoints')
    .doc(playerId)
    .collection('tournaments')
    .get();

  if (tournamentsSnapshot.empty) {
    return null;
  }

  const tournaments: PlayerTournamentPoints[] = tournamentsSnapshot.docs.map(
    (doc) => doc.data() as PlayerTournamentPoints
  );

  // Calculate statistics
  const totalPoints = tournaments.reduce((sum, t) => sum + t.points, 0);
  const tournamentsPlayed = tournaments.length;
  const averagePoints = totalPoints / tournamentsPlayed;

  // Find best rank
  const bestRank = Math.min(...tournaments.map((t) => t.rank));
  const bestRankTournament = tournaments.find((t) => t.rank === bestRank);

  // Find last tournament date
  const lastTournament = tournaments.reduce((latest, current) => {
    return new Date(current.tournamentDate) > new Date(latest.tournamentDate)
      ? current
      : latest;
  });

  // Get player pseudo from first tournament entry
  const playerPseudo = tournaments[0].playerPseudo;

  const ranking: PlayerGlobalRanking = {
    playerId,
    pseudo: playerPseudo,
    totalPoints,
    tournamentsPlayed,
    averagePoints: Math.round(averagePoints * 100) / 100,
    bestRank,
    bestRankTournament: bestRankTournament?.tournamentName,
    lastTournamentDate: lastTournament.tournamentDate,
    updatedAt: new Date(),
  };

  return ranking;
}

/**
 * Get global player rankings
 */
export async function getGlobalPlayerRankings(
  limit: number = 100,
  offset: number = 0
): Promise<{ rankings: PlayerGlobalRanking[]; total: number }> {
  // Get all rankings
  const rankingsSnapshot = await adminDb
    .collection('globalPlayerRanking')
    .orderBy('totalPoints', 'desc')
    .get();

  const allRankings = rankingsSnapshot.docs.map((doc) => ({
    ...doc.data(),
    rank: 0, // Will be set below
  })) as PlayerGlobalRanking[];

  // Assign ranks
  allRankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  // Apply pagination
  const paginatedRankings = allRankings.slice(offset, offset + limit);

  return {
    rankings: paginatedRankings,
    total: allRankings.length,
  };
}

/**
 * Get player statistics with full details
 */
export async function getPlayerStats(playerId: string): Promise<PlayerStats | null> {
  // Get global ranking
  const rankingDoc = await adminDb.collection('globalPlayerRanking').doc(playerId).get();

  if (!rankingDoc.exists) {
    return null;
  }

  const ranking = rankingDoc.data() as PlayerGlobalRanking;

  // Get all tournament points
  const tournamentsSnapshot = await adminDb
    .collection('playerTournamentPoints')
    .doc(playerId)
    .collection('tournaments')
    .orderBy('tournamentDate', 'desc')
    .get();

  const tournaments = tournamentsSnapshot.docs.map(
    (doc) => doc.data() as PlayerTournamentPoints
  );

  // Calculate additional statistics
  const podiums = tournaments.filter((t) => t.rank <= 3).length;
  const victories = tournaments.filter((t) => t.rank === 1).length;

  // Get global rank
  const allRankingsSnapshot = await adminDb
    .collection('globalPlayerRanking')
    .orderBy('totalPoints', 'desc')
    .get();

  const globalRank =
    allRankingsSnapshot.docs.findIndex((doc) => doc.id === playerId) + 1;

  const stats: PlayerStats = {
    ...ranking,
    rank: globalRank,
    tournaments,
    podiums,
    victories,
  };

  return stats;
}

/**
 * Get all player points for a specific tournament
 */
export async function getTournamentPlayerPoints(
  tournamentId: string
): Promise<PlayerTournamentPoints[]> {
  // Query all players who have points for this tournament
  const playersSnapshot = await adminDb.collection('playerTournamentPoints').get();

  const allPoints: PlayerTournamentPoints[] = [];

  for (const playerDoc of playersSnapshot.docs) {
    const tournamentDoc = await playerDoc.ref
      .collection('tournaments')
      .doc(tournamentId)
      .get();

    if (tournamentDoc.exists) {
      allPoints.push(tournamentDoc.data() as PlayerTournamentPoints);
    }
  }

  // Sort by rank
  allPoints.sort((a, b) => a.rank - b.rank);

  return allPoints;
}

/**
 * Recalculate all global rankings
 * Useful for maintenance or after bulk updates
 */
export async function recalculateAllGlobalRankings(): Promise<void> {
  const playersSnapshot = await adminDb.collection('playerTournamentPoints').get();
  const playerIds = playersSnapshot.docs.map((doc) => doc.id);

  await updateGlobalRankings(playerIds);
}
