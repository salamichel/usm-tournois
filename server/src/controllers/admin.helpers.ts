import { adminDb } from '../config/firebase.config';

/**
 * Helper function to calculate team's global ranking based on members' points
 */
export async function calculateTeamGlobalRanking(members: any[]): Promise<number> {
  let totalPoints = 0;

  for (const member of members) {
    // Skip virtual/placeholder members
    if (member.isVirtual) continue;

    try {
      // Get player's global ranking
      const playerRankingDoc = await adminDb
        .collection('globalPlayerRanking')
        .doc(member.userId)
        .get();

      if (playerRankingDoc.exists) {
        const rankingData = playerRankingDoc.data();
        totalPoints += rankingData?.totalPoints || 0;
      }
    } catch (error) {
      console.error(`Error fetching points for player ${member.userId}:`, error);
      // Continue with other members even if one fails
    }
  }

  return totalPoints;
}
