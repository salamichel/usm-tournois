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
import type { Season, SeasonRanking } from '../../../shared/types/season.types';
import { findSeasonForDate } from '../controllers/season.controller';

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

  // Find the season for this tournament date
  const season = await findSeasonForDate(tournamentDate);
  if (!season) {
    throw new Error(`No season found for tournament date ${tournamentDate.toISOString()}. Please create a season that covers this date.`);
  }

  // Award points to each team member
  for (const member of teamMembers) {
    // Skip virtual/placeholder members
    if (member.isVirtual) continue;

    // Fetch player's club info
    let clubId: string | undefined;
    let clubName: string | undefined;

    try {
      const userDoc = await adminDb.collection('users').doc(member.userId).get();
      clubId = userDoc.data()?.clubId;

      if (clubId) {
        const clubDoc = await adminDb.collection('clubs').doc(clubId).get();
        clubName = clubDoc.data()?.name;
      }
    } catch (error) {
      console.error(`Error fetching club info for player ${member.userId}:`, error);
    }

    const playerPoints: PlayerTournamentPoints = {
      playerId: member.userId,
      playerPseudo: member.pseudo,
      clubId: clubId || null,
      clubName: clubName || null,
      seasonId: season.id,
      seasonName: season.name,
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

  // Get player pseudo and club from most recent tournament entry
  const playerPseudo = lastTournament.playerPseudo;
  const clubId = lastTournament.clubId;
  const clubName = lastTournament.clubName;

  const ranking: PlayerGlobalRanking = {
    playerId,
    pseudo: playerPseudo,
    clubId,
    clubName,
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

/**
 * Delete all points for a specific tournament (to allow re-freeze)
 */
export async function deleteTournamentPoints(tournamentId: string): Promise<string[]> {
  const playersSnapshot = await adminDb.collection('playerTournamentPoints').get();
  const batch = adminDb.batch();
  const affectedPlayerIds: string[] = [];

  for (const playerDoc of playersSnapshot.docs) {
    const tournamentPointsRef = playerDoc.ref.collection('tournaments').doc(tournamentId);
    const tournamentPointsDoc = await tournamentPointsRef.get();

    if (tournamentPointsDoc.exists) {
      batch.delete(tournamentPointsRef);
      affectedPlayerIds.push(playerDoc.id);
    }
  }

  if (affectedPlayerIds.length > 0) {
    await batch.commit();
  }

  return affectedPlayerIds;
}

/**
 * Get season rankings
 */
export async function getSeasonRankings(
  seasonId: string,
  limit: number = 100,
  offset: number = 0
): Promise<{ rankings: SeasonRanking[]; total: number }> {
  // Get all players' tournament points for this season
  const playersSnapshot = await adminDb.collection('playerTournamentPoints').get();

  const playerStats: Map<string, {
    playerId: string;
    pseudo: string;
    clubId?: string;
    clubName?: string;
    totalPoints: number;
    tournamentsPlayed: number;
    bestRank: number;
    bestRankTournament?: string;
  }> = new Map();

  for (const playerDoc of playersSnapshot.docs) {
    const tournamentsSnapshot = await playerDoc.ref
      .collection('tournaments')
      .where('seasonId', '==', seasonId)
      .get();

    if (tournamentsSnapshot.empty) continue;

    const tournaments = tournamentsSnapshot.docs.map(doc => doc.data() as PlayerTournamentPoints);

    const totalPoints = tournaments.reduce((sum, t) => sum + t.points, 0);
    const bestRank = Math.min(...tournaments.map(t => t.rank));
    const bestRankTournament = tournaments.find(t => t.rank === bestRank);
    const lastTournament = tournaments.reduce((latest, current) =>
      new Date(current.tournamentDate) > new Date(latest.tournamentDate) ? current : latest
    );

    playerStats.set(playerDoc.id, {
      playerId: playerDoc.id,
      pseudo: lastTournament.playerPseudo,
      clubId: lastTournament.clubId,
      clubName: lastTournament.clubName,
      totalPoints,
      tournamentsPlayed: tournaments.length,
      bestRank,
      bestRankTournament: bestRankTournament?.tournamentName,
    });
  }

  // Convert to array and sort by total points
  const sortedStats = Array.from(playerStats.values())
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Get season info
  const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
  const seasonName = seasonDoc.data()?.name || 'Unknown Season';

  // Create rankings with rank numbers
  const allRankings: SeasonRanking[] = sortedStats.map((stats, index) => ({
    playerId: stats.playerId,
    pseudo: stats.pseudo,
    clubId: stats.clubId,
    clubName: stats.clubName,
    seasonId,
    seasonName,
    totalPoints: stats.totalPoints,
    tournamentsPlayed: stats.tournamentsPlayed,
    averagePoints: Math.round((stats.totalPoints / stats.tournamentsPlayed) * 100) / 100,
    bestRank: stats.bestRank,
    bestRankTournament: stats.bestRankTournament,
    rank: index + 1,
    updatedAt: new Date(),
  }));

  // Apply pagination
  const paginatedRankings = allRankings.slice(offset, offset + limit);

  return {
    rankings: paginatedRankings,
    total: allRankings.length,
  };
}

/**
 * Award points to individual players based on their ranking in Flexible King tournament
 */
export async function awardPointsToFlexibleKingPlayers(
  tournamentId: string,
  tournamentName: string,
  tournamentDate: Date,
  ranking: Array<{ playerId: string; playerPseudo: string; wins: number; losses: number }>
): Promise<{ playersUpdated: number; totalPoints: number }> {
  const batch = adminDb.batch();
  let totalPoints = 0;

  // Find the season for this tournament date
  const season = await findSeasonForDate(tournamentDate);
  if (!season) {
    throw new Error(`No season found for tournament date ${tournamentDate.toISOString()}. Please create a season that covers this date.`);
  }

  // Award points to each player based on their rank
  for (let i = 0; i < ranking.length; i++) {
    const player = ranking[i];
    const rank = i + 1;
    const points = getPointsForRank(rank);
    totalPoints += points;

    // Fetch player's club info
    let clubId: string | undefined;
    let clubName: string | undefined;

    try {
      const userDoc = await adminDb.collection('users').doc(player.playerId).get();
      clubId = userDoc.data()?.clubId;

      if (clubId) {
        const clubDoc = await adminDb.collection('clubs').doc(clubId).get();
        clubName = clubDoc.data()?.name;
      }
    } catch (error) {
      console.error(`Error fetching club info for player ${player.playerId}:`, error);
    }

    const playerPoints: PlayerTournamentPoints = {
      playerId: player.playerId,
      playerPseudo: player.playerPseudo,
      clubId: clubId || null,
      clubName: clubName || null,
      seasonId: season.id,
      seasonName: season.name,
      tournamentId,
      tournamentName,
      tournamentDate,
      teamName: 'Individuel', // Individual player in King mode
      rank,
      points,
      earnedAt: new Date(),
    };

    // Store in playerTournamentPoints collection
    const pointsRef = adminDb
      .collection('playerTournamentPoints')
      .doc(player.playerId)
      .collection('tournaments')
      .doc(tournamentId);

    batch.set(pointsRef, playerPoints);
  }

  await batch.commit();

  // Update global rankings for all players
  const playerIds = ranking.map(p => p.playerId);
  await updateGlobalRankings(playerIds);

  return {
    playersUpdated: ranking.length,
    totalPoints
  };
}
