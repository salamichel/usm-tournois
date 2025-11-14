import type { EliminationMatch } from '@shared/types';

/**
 * Structure of an elimination bracket
 */
export interface BracketStructure {
  totalSlots: number;
  byes: number;
  preliminaryMatches: number;
  mainBracketSize: number;
  firstMainRoundName: string;
  teamsPlayingPreliminary: number;
}

/**
 * Qualified team with ranking info
 */
export interface QualifiedTeam {
  id: string;
  name: string;
  poolName?: string;
}

/**
 * Tournament configuration for elimination phase
 */
export interface EliminationTournamentConfig {
  setsPerMatchElimination: number;
  pointsPerSetElimination: number;
  tieBreakEnabledElimination: boolean;
}

/**
 * Calculates the structure of a single-elimination bracket for a given number of teams.
 * Determines the number of byes, preliminary matches, and final bracket size.
 * @param numberOfTeams The total number of qualified teams
 * @returns An object containing bracket structure information
 */
export function calculateBracketStructure(numberOfTeams: number): BracketStructure {
  if (numberOfTeams < 2) {
    throw new Error('At least 2 teams are required for an elimination tournament.');
  }

  // Find the next power of 2 greater than or equal to the number of teams
  let totalSlots = 2;
  while (totalSlots < numberOfTeams) {
    totalSlots *= 2;
  }

  const byes = totalSlots - numberOfTeams;
  const teamsPlayingPreliminary = numberOfTeams - byes;
  const preliminaryMatches = teamsPlayingPreliminary / 2;
  const mainBracketSize = totalSlots / 2; // Number of teams in the first main bracket round

  // Determine the name of the first main round
  let firstMainRoundName: string;
  if (mainBracketSize === 2) {
    firstMainRoundName = 'Finale';
  } else if (mainBracketSize === 4) {
    firstMainRoundName = 'Demi-finale';
  } else if (mainBracketSize === 8) {
    firstMainRoundName = 'Quart de finale';
  } else if (mainBracketSize === 16) {
    firstMainRoundName = 'Huitième de finale';
  } else if (mainBracketSize === 32) {
    firstMainRoundName = 'Seizième de finale';
  } else {
    firstMainRoundName = `Tour de ${mainBracketSize}`;
  }

  return {
    totalSlots,
    byes,
    preliminaryMatches,
    mainBracketSize,
    firstMainRoundName,
    teamsPlayingPreliminary,
  };
}

/**
 * Generates a single-elimination bracket with placeholders for teams and links between matches.
 * @param qualifiedTeams The qualified teams, sorted by ranking (best team first)
 * @param tournamentConfig Tournament configuration (setsPerMatchElimination, pointsPerSetElimination, tieBreakEnabledElimination)
 * @returns An array of match objects ready to be saved
 */
export function generateEliminationBracket(
  qualifiedTeams: QualifiedTeam[],
  tournamentConfig: EliminationTournamentConfig
): EliminationMatch[] {
  console.log('Starting generateEliminationBracket');
  console.log(`Qualified teams (${qualifiedTeams.length}):`, qualifiedTeams.map((t) => t.name));
  console.log('Tournament configuration:', tournamentConfig);

  const numberOfTeams = qualifiedTeams.length;
  const { byes, preliminaryMatches, mainBracketSize, firstMainRoundName, teamsPlayingPreliminary } =
    calculateBracketStructure(numberOfTeams);

  console.log(
    `Calculated bracket structure: Total Slots=${numberOfTeams}, Byes=${byes}, Preliminary Matches=${preliminaryMatches}, Main Bracket Size=${mainBracketSize}, First Main Round Name='${firstMainRoundName}'`
  );

  const matches: EliminationMatch[] = [];
  let matchNumberCounter = 1;
  const initialSets = Array.from(
    { length: tournamentConfig.setsPerMatchElimination || 3 },
    () => ({ score1: null, score2: null })
  );

  // 1. Generate preliminary matches if necessary
  const preliminaryMatchRefs: Array<{
    id: string;
    matchNumber: number;
    team1Index: number;
    team2Index: number;
  }> = [];

  if (preliminaryMatches > 0) {
    // Teams playing preliminary matches are the last in the ranking
    // For 9 teams: teams 8 and 9
    // For 10 teams: teams 7, 8, 9, 10
    // For 11 teams: teams 6, 7, 8, 9, 10, 11
    // For 12 teams: teams 5, 6, 7, 8, 9, 10, 11, 12

    console.log(`Generating ${preliminaryMatches} preliminary matches.`);
    const startIndex = byes;
    for (let i = 0; i < preliminaryMatches; i++) {
      const team1Index = startIndex + i;
      const team2Index = numberOfTeams - 1 - i; // Last teams

      const team1 = qualifiedTeams[team1Index];
      const team2 = qualifiedTeams[team2Index];

      const matchRefId = `preliminary-${matchNumberCounter}`;
      preliminaryMatchRefs.push({
        id: matchRefId,
        matchNumber: matchNumberCounter,
        team1Index,
        team2Index,
      });

      matches.push({
        id: matchRefId,
        matchNumber: matchNumberCounter++,
        round: 'Tour Préliminaire',
        team1: {
          id: team1.id,
          name: team1.name,
          poolName: team1.poolName,
        },
        team2: {
          id: team2.id,
          name: team2.name,
          poolName: team2.poolName,
        },
        sets: JSON.parse(JSON.stringify(initialSets)),
        status: 'scheduled',
        type: 'elimination',
        setsToWin: tournamentConfig.setsPerMatchElimination,
        pointsPerSet: tournamentConfig.pointsPerSetElimination,
        tieBreakEnabled: tournamentConfig.tieBreakEnabledElimination || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Preliminary match created: M${matchRefId} between ${team1.name} and ${team2.name}`);
    }
  } else {
    console.log('No preliminary matches necessary.');
  }

  // 2. Prepare teams for the main bracket
  // Teams with byes + winners of preliminary matches
  const teamsForMainBracket: Array<
    | { type: 'direct'; team: QualifiedTeam }
    | { type: 'preliminary'; sourceMatchId: string; sourceMatchNumber: number }
  > = [];

  // Teams with byes (the best teams)
  for (let i = 0; i < byes; i++) {
    teamsForMainBracket.push({
      type: 'direct',
      team: qualifiedTeams[i],
    });
    console.log(`Team with bye added to main bracket: ${qualifiedTeams[i].name}`);
  }

  // Winners of preliminary matches
  for (let i = 0; i < preliminaryMatchRefs.length; i++) {
    teamsForMainBracket.push({
      type: 'preliminary',
      sourceMatchId: preliminaryMatchRefs[i].id,
      sourceMatchNumber: preliminaryMatchRefs[i].matchNumber,
    });
    console.log(`Winner of preliminary match M${preliminaryMatchRefs[i].matchNumber} added to main bracket.`);
  }
  console.log(`Total number of teams for main bracket: ${teamsForMainBracket.length}`);

  // 3. Generate matches for the first main bracket round
  // Strategic placement: best teams are separated
  // For balanced placement, use classic bracket pattern
  const mainBracketMatches: Array<{ id: string; matchNumber: number }> = [];
  const numMainBracketMatches = mainBracketSize / 2;
  console.log(`Generating ${numMainBracketMatches} matches for first main round (${firstMainRoundName}).`);

  for (let i = 0; i < numMainBracketMatches; i++) {
    // Placement pattern: 1 vs last, 2 vs second-to-last, etc.
    const team1Data = teamsForMainBracket[i];
    const team2Data = teamsForMainBracket[mainBracketSize - 1 - i];

    const matchRefId = `main-${matchNumberCounter}`;
    mainBracketMatches.push({
      id: matchRefId,
      matchNumber: matchNumberCounter,
    });

    // Build team1
    let team1: any;
    if (team1Data.type === 'direct') {
      team1 = {
        id: team1Data.team.id,
        name: team1Data.team.name,
        poolName: team1Data.team.poolName,
      };
    } else {
      team1 = {
        id: null,
        name: `Vainqueur P${team1Data.sourceMatchNumber}`,
        sourceMatchId: team1Data.sourceMatchId,
        sourceTeamType: 'winner',
      };
    }

    // Build team2
    let team2: any;
    if (team2Data.type === 'direct') {
      team2 = {
        id: team2Data.team.id,
        name: team2Data.team.name,
        poolName: team2Data.team.poolName,
      };
    } else {
      team2 = {
        id: null,
        name: `Vainqueur P${team2Data.sourceMatchNumber}`,
        sourceMatchId: team2Data.sourceMatchId,
        sourceTeamType: 'winner',
      };
    }

    matches.push({
      id: matchRefId,
      matchNumber: matchNumberCounter++,
      round: firstMainRoundName,
      team1: team1,
      team2: team2,
      sets: JSON.parse(JSON.stringify(initialSets)),
      status: 'scheduled',
      type: 'elimination',
      setsToWin: tournamentConfig.setsPerMatchElimination,
      pointsPerSet: tournamentConfig.pointsPerSetElimination,
      tieBreakEnabled: tournamentConfig.tieBreakEnabledElimination || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Main match created: M${matchRefId} (${firstMainRoundName}) between ${team1.name} and ${team2.name}`);
  }

  // 4. Update preliminary matches with nextMatchId
  console.log('Updating preliminary matches with nextMatchId.');
  for (let i = 0; i < preliminaryMatchRefs.length; i++) {
    const prelimMatch = preliminaryMatchRefs[i];

    // Find the main match waiting for this winner
    const targetMainMatchIndex = matches.findIndex((m) => {
      if (m.round !== firstMainRoundName) return false;
      return m.team1?.sourceMatchId === prelimMatch.id || m.team2?.sourceMatchId === prelimMatch.id;
    });

    if (targetMainMatchIndex !== -1) {
      const prelimMatchIndex = matches.findIndex((m) => m.id === prelimMatch.id);
      if (prelimMatchIndex !== -1) {
        matches[prelimMatchIndex].nextMatchId = matches[targetMainMatchIndex].id;

        // Determine if the winner goes to team1 or team2
        if (matches[targetMainMatchIndex].team1?.sourceMatchId === prelimMatch.id) {
          matches[prelimMatchIndex].nextMatchTeamSlot = 'team1';
        } else {
          matches[prelimMatchIndex].nextMatchTeamSlot = 'team2';
        }
        console.log(
          `Preliminary match M${prelimMatch.matchNumber} linked to main match M${matches[targetMainMatchIndex].matchNumber} (slot: ${matches[prelimMatchIndex].nextMatchTeamSlot}).`
        );
      }
    }
  }

  // 5. Generate subsequent rounds (Semi-finals, Final, etc.)
  let previousRoundMatches = mainBracketMatches;
  let currentRoundName = firstMainRoundName;
  console.log('Generating subsequent rounds...');

  while (previousRoundMatches.length > 1) {
    const nextRoundMatches: Array<{ id: string; matchNumber: number }> = [];
    let nextRoundName: string;

    // Determine the name of the next round
    if (currentRoundName === 'Seizième de finale') {
      nextRoundName = 'Huitième de finale';
    } else if (currentRoundName === 'Huitième de finale') {
      nextRoundName = 'Quart de finale';
    } else if (currentRoundName === 'Quart de finale') {
      nextRoundName = 'Demi-finale';
    } else if (currentRoundName === 'Demi-finale') {
      nextRoundName = 'Finale';
    } else {
      console.log('End of round generation (reached final or unhandled round).');
      break;
    }
    console.log(`Generating ${previousRoundMatches.length / 2} matches for round: ${nextRoundName}`);

    // Create matches for the next round
    for (let i = 0; i < previousRoundMatches.length / 2; i++) {
      const sourceMatch1 = previousRoundMatches[i * 2];
      const sourceMatch2 = previousRoundMatches[i * 2 + 1];

      const matchRefId = `${nextRoundName.replace(/\s/g, '-').toLowerCase()}-${matchNumberCounter}`;
      nextRoundMatches.push({
        id: matchRefId,
        matchNumber: matchNumberCounter,
      });

      matches.push({
        id: matchRefId,
        matchNumber: matchNumberCounter++,
        round: nextRoundName,
        team1: {
          id: null,
          name: `Vainqueur M${sourceMatch1.matchNumber}`,
          sourceMatchId: sourceMatch1.id,
          sourceTeamType: 'winner',
        },
        team2: {
          id: null,
          name: `Vainqueur M${sourceMatch2.matchNumber}`,
          sourceMatchId: sourceMatch2.id,
          sourceTeamType: 'winner',
        },
        sets: JSON.parse(JSON.stringify(initialSets)),
        status: 'scheduled',
        type: 'elimination',
        setsToWin: tournamentConfig.setsPerMatchElimination,
        pointsPerSet: tournamentConfig.pointsPerSetElimination,
        tieBreakEnabled: tournamentConfig.tieBreakEnabledElimination || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update source matches with nextMatchId
      const matchIndex1 = matches.findIndex((m) => m.id === sourceMatch1.id);
      if (matchIndex1 !== -1) {
        matches[matchIndex1].nextMatchId = matchRefId;
        matches[matchIndex1].nextMatchTeamSlot = 'team1';
      }

      const matchIndex2 = matches.findIndex((m) => m.id === sourceMatch2.id);
      if (matchIndex2 !== -1) {
        matches[matchIndex2].nextMatchId = matchRefId;
        matches[matchIndex2].nextMatchTeamSlot = 'team2';
      }
      console.log(
        `Next round match created: M${matchRefId} (${nextRoundName}) linked to M${sourceMatch1.matchNumber} and M${sourceMatch2.matchNumber}`
      );
    }

    previousRoundMatches = nextRoundMatches;
    currentRoundName = nextRoundName;
  }

  // 6. Add 3rd place match
  console.log('Checking and adding 3rd place match if necessary.');
  const semiFinals = matches.filter((m) => m.round === 'Demi-finale');
  if (semiFinals.length === 2) {
    const m3pRefId = `match-3eme-place-${matchNumberCounter}`;

    matches.push({
      id: m3pRefId,
      matchNumber: matchNumberCounter++,
      round: 'Match 3ème place',
      team1: {
        id: null,
        name: `Perdant M${semiFinals[0].matchNumber}`,
        sourceMatchId: semiFinals[0].id,
        sourceTeamType: 'loser',
      },
      team2: {
        id: null,
        name: `Perdant M${semiFinals[1].matchNumber}`,
        sourceMatchId: semiFinals[1].id,
        sourceTeamType: 'loser',
      },
      sets: JSON.parse(JSON.stringify(initialSets)),
      status: 'scheduled',
      type: 'elimination',
      setsToWin: tournamentConfig.setsPerMatchElimination,
      pointsPerSet: tournamentConfig.pointsPerSetElimination,
      tieBreakEnabled: tournamentConfig.tieBreakEnabledElimination || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(
      `3rd place match created: M${m3pRefId} linked to losers of semi-finals M${semiFinals[0].matchNumber} and M${semiFinals[1].matchNumber}`
    );

    // Update semi-finals to point to 3rd place match
    const df1Index = matches.findIndex((m) => m.id === semiFinals[0].id);
    if (df1Index !== -1) {
      matches[df1Index].nextMatchLoserId = m3pRefId;
      matches[df1Index].nextMatchLoserTeamSlot = 'team1';
      console.log(`Semi-final M${semiFinals[0].matchNumber} updated for 3rd place match.`);
    }

    const df2Index = matches.findIndex((m) => m.id === semiFinals[1].id);
    if (df2Index !== -1) {
      matches[df2Index].nextMatchLoserId = m3pRefId;
      matches[df2Index].nextMatchLoserTeamSlot = 'team2';
      console.log(`Semi-final M${semiFinals[1].matchNumber} updated for 3rd place match.`);
    }
  } else {
    console.log('No 3rd place match necessary (less than 2 semi-finals).');
  }

  console.log('End of generateEliminationBracket. Total number of matches generated:', matches.length);
  return matches;
}
