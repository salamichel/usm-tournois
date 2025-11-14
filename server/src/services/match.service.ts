/**
 * Match Service - Handles all match-related calculations and updates
 * - Score calculations
 * - Pool rankings
 * - Elimination rankings
 * - Match result propagation
 */

import { adminDb } from '../config/firebase.config';
import type { MatchSet, TeamStanding } from '@shared/types';

interface MatchOutcome {
  setsWonTeam1: number;
  setsWonTeam2: number;
  matchStatus: 'pending' | 'in_progress' | 'completed';
}

interface MatchResult extends MatchOutcome {
  winnerId: string | null;
  loserId: string | null;
}

interface CompleteMatchResult extends MatchResult {
  winnerName: string | null;
  loserName: string | null;
}

// ========================================
// SCORE CALCULATIONS
// ========================================

/**
 * Détermine le vainqueur d'un set basé sur les scores et les points par set.
 * @returns 1 si l'équipe 1 gagne, 2 si l'équipe 2 gagne, null si le set n'est pas terminé.
 */
export function calculateSetOutcome(
  score1: number,
  score2: number,
  pointsPerSet: number
): 1 | 2 | null {
  if (score1 >= pointsPerSet && score1 - score2 >= 2) {
    return 1;
  } else if (score2 >= pointsPerSet && score2 - score1 >= 2) {
    return 2;
  }
  return null; // Set non terminé
}

/**
 * Détermine le vainqueur d'un match basé sur les sets gagnés.
 */
export function calculateMatchOutcome(
  sets: MatchSet[],
  setsToWin: number,
  pointsPerSet: number,
  tieBreakEnabled: boolean
): MatchOutcome {
  let setsWonTeam1 = 0;
  let setsWonTeam2 = 0;
  let matchStatus: 'pending' | 'in_progress' | 'completed' = 'in_progress';

  sets.forEach((set) => {
    const outcome = calculateSetOutcome(set.score1, set.score2, pointsPerSet);
    if (outcome === 1) {
      setsWonTeam1++;
    } else if (outcome === 2) {
      setsWonTeam2++;
    }
  });

  if (setsWonTeam1 >= setsToWin) {
    matchStatus = 'completed';
  } else if (setsWonTeam2 >= setsToWin) {
    matchStatus = 'completed';
  } else if (sets.length === setsToWin * 2 - 1 && setsWonTeam1 !== setsWonTeam2) {
    // Tous les sets possibles ont été joués et il y a un vainqueur
    matchStatus = 'completed';
  }

  return { setsWonTeam1, setsWonTeam2, matchStatus };
}

// ========================================
// POOL RANKINGS
// ========================================

/**
 * Calcule le classement pour une poule donnée.
 */
export async function calculatePoolRanking(
  tournamentId: string,
  poolId: string,
  teamsInPool: any[],
  matches: any[]
): Promise<TeamStanding[]> {
  const ranking: Record<string, TeamStanding> = {};

  teamsInPool.forEach((team) => {
    ranking[team.id] = {
      teamId: team.id,
      teamName: team.name,
      rank: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setsDifferential: 0,
      pointsWon: 0,
      pointsLost: 0,
      pointsDifferential: 0,
    };
  });

  matches.forEach((match) => {
    if (match.status === 'completed' && match.sets && match.sets.length > 0) {
      const team1Id = match.team1.id;
      const team2Id = match.team2.id;

      if (!ranking[team1Id] || !ranking[team2Id]) {
        return;
      }

      ranking[team1Id].matchesPlayed++;
      ranking[team2Id].matchesPlayed++;

      let team1SetsWon = 0;
      let team2SetsWon = 0;
      let team1PointsWonMatch = 0;
      let team2PointsWonMatch = 0;

      const setsToWin = match.setsToWin || 1;
      const pointsPerSet = match.pointsPerSet || 21;

      match.sets.forEach((set: MatchSet) => {
        const outcome = calculateSetOutcome(set.score1, set.score2, pointsPerSet);
        if (outcome === 1) {
          team1SetsWon++;
        } else if (outcome === 2) {
          team2SetsWon++;
        }
        team1PointsWonMatch += set.score1 || 0;
        team2PointsWonMatch += set.score2 || 0;
      });

      ranking[team1Id].setsWon += team1SetsWon;
      ranking[team1Id].setsLost += team2SetsWon;
      ranking[team2Id].setsWon += team2SetsWon;
      ranking[team2Id].setsLost += team1SetsWon;

      ranking[team1Id].pointsWon += team1PointsWonMatch;
      ranking[team1Id].pointsLost += team2PointsWonMatch;
      ranking[team2Id].pointsWon += team2PointsWonMatch;
      ranking[team2Id].pointsLost += team1PointsWonMatch;

      if (team1SetsWon > team2SetsWon) {
        ranking[team1Id].wins++;
        ranking[team2Id].losses++;
      } else if (team2SetsWon > team1SetsWon) {
        ranking[team2Id].wins++;
        ranking[team1Id].losses++;
      }
    }
  });

  const sortedRanking = Object.values(ranking).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const diffSetsA = a.setsWon - a.setsLost;
    const diffSetsB = b.setsWon - b.setsLost;
    if (diffSetsB !== diffSetsA) return diffSetsB - diffSetsA;
    const diffPointsA = a.pointsWon - a.pointsLost;
    const diffPointsB = b.pointsWon - b.pointsLost;
    if (diffPointsB !== diffPointsA) return diffPointsB - diffPointsA;
    return b.pointsWon - a.pointsWon;
  });

  // Add differential calculations
  sortedRanking.forEach((team, index) => {
    team.rank = index + 1;
    team.setsDifferential = team.setsWon - team.setsLost;
    team.pointsDifferential = team.pointsWon - team.pointsLost;
  });

  return sortedRanking;
}

// ========================================
// ELIMINATION RANKINGS
// ========================================

interface EliminationTeamStats {
  team: any;
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsScored: number;
  pointsConceded: number;
  points: number;
  bonusPoints: number;
}

/**
 * Calcule le classement final des équipes pour la phase d'élimination.
 */
export function calculateEliminationRanking(eliminationMatches: any[]): [string, EliminationTeamStats][] {
  const teamStats: Record<string, EliminationTeamStats> = {};

  eliminationMatches.forEach((match) => {
    if (match.status === 'completed') {
      const team1Name = match.team1.name;
      const team2Name = match.team2.name;
      const setsWonTeam1 = match.setsWonTeam1 || 0;
      const setsWonTeam2 = match.setsWonTeam2 || 0;
      let pointsScoredTeam1Match = 0;
      let pointsConcededTeam1Match = 0;
      let pointsScoredTeam2Match = 0;
      let pointsConcededTeam2Match = 0;

      if (match.sets && Array.isArray(match.sets)) {
        match.sets.forEach((set: MatchSet) => {
          pointsScoredTeam1Match += set.score1 || 0;
          pointsConcededTeam1Match += set.score2 || 0;
          pointsScoredTeam2Match += set.score2 || 0;
          pointsConcededTeam2Match += set.score1 || 0;
        });
      }

      if (!teamStats[team1Name]) {
        teamStats[team1Name] = {
          team: match.team1,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          setsWon: 0,
          setsLost: 0,
          pointsScored: 0,
          pointsConceded: 0,
          points: 0,
          bonusPoints: 0,
        };
      }
      if (!teamStats[team2Name]) {
        teamStats[team2Name] = {
          team: match.team2,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          setsWon: 0,
          setsLost: 0,
          pointsScored: 0,
          pointsConceded: 0,
          points: 0,
          bonusPoints: 0,
        };
      }

      teamStats[team1Name].matchesPlayed++;
      teamStats[team2Name].matchesPlayed++;

      teamStats[team1Name].setsWon += setsWonTeam1;
      teamStats[team1Name].setsLost += setsWonTeam2;
      teamStats[team2Name].setsWon += setsWonTeam2;
      teamStats[team2Name].setsLost += setsWonTeam1;

      teamStats[team1Name].pointsScored += pointsScoredTeam1Match;
      teamStats[team1Name].pointsConceded += pointsConcededTeam1Match;
      teamStats[team2Name].pointsScored += pointsScoredTeam2Match;
      teamStats[team2Name].pointsConceded += pointsConcededTeam2Match;

      if (setsWonTeam1 > setsWonTeam2) {
        teamStats[team1Name].wins++;
        teamStats[team1Name].points += 3;
        teamStats[team2Name].losses++;
      } else if (setsWonTeam2 > setsWonTeam1) {
        teamStats[team2Name].wins++;
        teamStats[team2Name].points += 3;
        teamStats[team1Name].losses++;
      }
    }
  });

  let firstPlaceTeam: string | null = null;
  let secondPlaceTeam: string | null = null;
  let thirdPlaceTeam: string | null = null;

  const finalMatch = eliminationMatches.find(
    (m) => m.round === 'Finale' && m.status === 'completed'
  );
  if (finalMatch) {
    if (finalMatch.setsWonTeam1 > finalMatch.setsWonTeam2) {
      firstPlaceTeam = finalMatch.team1.name;
      secondPlaceTeam = finalMatch.team2.name;
    } else if (finalMatch.setsWonTeam2 > finalMatch.setsWonTeam1) {
      firstPlaceTeam = finalMatch.team2.name;
      secondPlaceTeam = finalMatch.team1.name;
    }
  }

  const m3pMatch = eliminationMatches.find(
    (m) => m.round === 'Match 3ème place' && m.status === 'completed'
  );
  if (m3pMatch) {
    if (m3pMatch.setsWonTeam1 > m3pMatch.setsWonTeam2) {
      thirdPlaceTeam = m3pMatch.team1.name;
    } else if (m3pMatch.setsWonTeam2 > m3pMatch.setsWonTeam1) {
      thirdPlaceTeam = m3pMatch.team2.name;
    }
  }

  // Bonus points for participation
  Object.values(teamStats).forEach((stats) => {
    if (stats.matchesPlayed > 0) {
      stats.bonusPoints += 1;
    }
  });

  // Bonus points for placement
  if (firstPlaceTeam && teamStats[firstPlaceTeam]) {
    teamStats[firstPlaceTeam].bonusPoints += 15;
  }
  if (secondPlaceTeam && teamStats[secondPlaceTeam]) {
    teamStats[secondPlaceTeam].bonusPoints += 9;
  }
  if (thirdPlaceTeam && teamStats[thirdPlaceTeam]) {
    teamStats[thirdPlaceTeam].bonusPoints += 4;
  }

  // Add bonus points to total
  Object.values(teamStats).forEach((stats) => {
    stats.points += stats.bonusPoints;
  });

  const sortedTeams = Object.entries(teamStats).sort(([, a], [, b]) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    return a.setsLost - b.setsLost;
  });

  return sortedTeams;
}

// ========================================
// MATCH RESULT DETERMINATION
// ========================================

/**
 * Détermine le résultat complet d'un match (sets gagnés, statut, vainqueur/perdant).
 */
export function determineMatchResult(
  submittedSets: MatchSet[],
  setsToWin: number,
  pointsPerSet: number,
  tieBreakEnabled: boolean,
  team1Id: string,
  team2Id: string
): MatchResult {
  let setsWonTeam1 = 0;
  let setsWonTeam2 = 0;
  let matchStatus: 'pending' | 'in_progress' | 'completed' = 'in_progress';
  let winnerId: string | null = null;
  let loserId: string | null = null;

  submittedSets.forEach((set) => {
    const outcome = calculateSetOutcome(set.score1, set.score2, pointsPerSet);
    if (outcome === 1) {
      setsWonTeam1++;
    } else if (outcome === 2) {
      setsWonTeam2++;
    }
  });

  // Déterminer le statut du match et le vainqueur/perdant
  if (setsWonTeam1 >= setsToWin) {
    matchStatus = 'completed';
    winnerId = team1Id;
    loserId = team2Id;
  } else if (setsWonTeam2 >= setsToWin) {
    matchStatus = 'completed';
    winnerId = team2Id;
    loserId = team1Id;
  } else if (submittedSets.length === setsToWin * 2 - 1 && setsWonTeam1 !== setsWonTeam2) {
    if (setsWonTeam1 > setsWonTeam2) {
      winnerId = team1Id;
      loserId = team2Id;
    } else {
      winnerId = team2Id;
      loserId = team1Id;
    }
    matchStatus = 'completed';
  }

  return { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId };
}

// ========================================
// MATCH UPDATES
// ========================================

/**
 * Met à jour les scores d'un match et son statut dans Firestore.
 */
export async function updateMatchScoresAndStatus(
  matchRef: any,
  currentMatch: any,
  submittedSets: any[],
  tournamentData: any,
  matchType: 'pool' | 'elimination',
  batch: any | null = null
): Promise<CompleteMatchResult> {
  // Valider les scores des sets
  if (
    !Array.isArray(submittedSets) ||
    submittedSets.some((s) => typeof s.score1 !== 'number' && typeof s.scoreTeam1 !== 'number')
  ) {
    throw new Error('Format de scores de sets invalide.');
  }

  const parsedSets: MatchSet[] = submittedSets.map((set) => ({
    score1: parseInt(set.score1 !== undefined ? set.score1 : set.scoreTeam1) || 0,
    score2: parseInt(set.score2 !== undefined ? set.score2 : set.scoreTeam2) || 0,
  }));

  // Récupérer les règles du tournoi pour le calcul du match
  const setsToWin =
    matchType === 'pool'
      ? tournamentData.setsPerMatchPool
      : tournamentData.setsPerMatchElimination;
  const pointsPerSet =
    matchType === 'pool' ? tournamentData.pointsPerSetPool : tournamentData.pointsPerSetElimination;
  const tieBreakEnabled =
    matchType === 'pool'
      ? tournamentData.tieBreakEnabledPools
      : tournamentData.tieBreakEnabledElimination;

  const { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId } = determineMatchResult(
    parsedSets,
    setsToWin,
    pointsPerSet,
    tieBreakEnabled,
    currentMatch.team1.id,
    currentMatch.team2.id
  );

  // Récupérer les noms des équipes
  const winnerName = winnerId
    ? winnerId === currentMatch.team1.id
      ? currentMatch.team1.name
      : currentMatch.team2.name
    : null;
  const loserName = loserId
    ? loserId === currentMatch.team1.id
      ? currentMatch.team1.name
      : currentMatch.team2.name
    : null;

  const updateData = {
    sets: parsedSets,
    setsWonTeam1: setsWonTeam1,
    setsWonTeam2: setsWonTeam2,
    winnerId: winnerId || null,
    winnerName: winnerName || null,
    loserId: loserId || null,
    loserName: loserName || null,
    status: matchStatus,
    updatedAt: new Date(),
  };

  if (batch) {
    batch.update(matchRef, updateData);
  } else {
    await matchRef.update(updateData);
  }

  return { setsWonTeam1, setsWonTeam2, matchStatus, winnerId, loserId, winnerName, loserName };
}

// ========================================
// ELIMINATION MATCH PROPAGATION
// ========================================

/**
 * Propage les résultats d'un match d'élimination aux matchs suivants.
 */
export async function propagateEliminationMatchResults(
  tournamentId: string,
  currentMatch: any,
  winnerId: string,
  winnerName: string,
  loserId: string,
  loserName: string,
  batch: any
): Promise<void> {
  // Logique de propagation pour les quarts de finale (vers les demi-finales)
  if (currentMatch.nextMatchId && currentMatch.nextMatchTeamSlot) {
    const nextMatchRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .doc(currentMatch.nextMatchId);

    const nextMatchDoc = await nextMatchRef.get();
    if (nextMatchDoc.exists) {
      const teamSlot = currentMatch.nextMatchTeamSlot;
      const updateObject: any = {};
      updateObject[`${teamSlot}.id`] = winnerId;
      updateObject[`${teamSlot}.name`] = winnerName;
      console.log(
        'DEBUG: Propagating winner (QF) to next match:',
        currentMatch.nextMatchId,
        'slot:',
        teamSlot
      );
      batch.update(nextMatchRef, updateObject);
    }
  }

  // Logique de propagation pour les demi-finales (vers la finale)
  if (currentMatch.nextMatchWinnerId && currentMatch.nextMatchWinnerTeamSlot) {
    const nextMatchRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .doc(currentMatch.nextMatchWinnerId);

    const nextMatchDoc = await nextMatchRef.get();
    if (nextMatchDoc.exists) {
      const teamSlot = currentMatch.nextMatchWinnerTeamSlot;
      const updateWinnerObject: any = {};
      updateWinnerObject[`${teamSlot}.id`] = winnerId;
      updateWinnerObject[`${teamSlot}.name`] = winnerName;
      console.log(
        'DEBUG: Propagating winner (DF/Final) to next match:',
        currentMatch.nextMatchWinnerId,
        'slot:',
        teamSlot
      );
      batch.update(nextMatchRef, updateWinnerObject);
    }
  }

  // Propager le perdant (pour le match de la 3ème place)
  if (currentMatch.nextMatchLoserId && currentMatch.nextMatchLoserTeamSlot) {
    const nextMatchRef = adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('eliminationMatches')
      .doc(currentMatch.nextMatchLoserId);

    const nextMatchDoc = await nextMatchRef.get();
    if (nextMatchDoc.exists) {
      const teamSlot = currentMatch.nextMatchLoserTeamSlot;
      const updateLoserObject: any = {};
      updateLoserObject[`${teamSlot}.id`] = loserId;
      updateLoserObject[`${teamSlot}.name`] = loserName;
      console.log(
        'DEBUG: Propagating loser to next match:',
        currentMatch.nextMatchLoserId,
        'slot:',
        teamSlot
      );
      batch.update(nextMatchRef, updateLoserObject);
    }
  }
}
