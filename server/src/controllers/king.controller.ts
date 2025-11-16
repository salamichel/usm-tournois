import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import * as kingService from '../services/king.service';
import type { KingMatch, KingPool } from '@shared/types';

/**
 * Helper function to recalculate global and phase-specific rankings and update tournament status
 */
async function recalculateRankingAndUpdateTournament(
  batch: FirebaseFirestore.WriteBatch,
  tournamentRef: FirebaseFirestore.DocumentReference,
  kingDocRef: FirebaseFirestore.DocumentReference,
  isPhaseCompleted: boolean,
  currentKingPhase: number | null = null,
  phaseNumberToUpdateRanking: number | null = null
): Promise<void> {
  const allMatchesSnapshots = await kingDocRef.collection('phases').get();
  let allCompletedMatchesGlobal: KingMatch[] = [];
  let allMatchesCurrentPhase: KingMatch[] = [];

  for (const phaseDoc of allMatchesSnapshots.docs) {
    const phaseNumber = parseInt(phaseDoc.id.replace('phase-', ''));
    const phasePoolsSnapshot = await phaseDoc.ref.collection('pools').get();
    for (const poolDoc of phasePoolsSnapshot.docs) {
      const poolMatchesSnapshot = await poolDoc.ref.collection('matches').get();
      const matchesInPool = poolMatchesSnapshot.docs.map((doc) => ({
        ...doc.data(),
        setsWonTeam1: doc.data().setsWonTeam1 || 0,
        setsWonTeam2: doc.data().setsWonTeam2 || 0,
      })) as KingMatch[];
      allCompletedMatchesGlobal.push(...matchesInPool);

      if (phaseNumberToUpdateRanking !== null && phaseNumber === phaseNumberToUpdateRanking) {
        allMatchesCurrentPhase.push(...matchesInPool);
      }
    }
  }

  // Calculate and update global ranking
  const newGlobalRanking = kingService.calculateKingRanking(allCompletedMatchesGlobal);
  batch.update(kingDocRef, { ranking: newGlobalRanking, updatedAt: new Date() });

  // If a phase number is specified, calculate and update that phase's ranking
  if (phaseNumberToUpdateRanking !== null) {
    const newPhaseRanking = kingService.calculateKingRanking(allMatchesCurrentPhase);
    const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${phaseNumberToUpdateRanking}`);
    batch.update(phaseDocRef, { ranking: newPhaseRanking, updatedAt: new Date() });
  }

  const updateData: any = {
    isKingPhaseCompleted: isPhaseCompleted,
    updatedAt: new Date(),
  };
  if (currentKingPhase !== null) {
    updateData.currentKingPhase = currentKingPhase;
  }
  batch.update(tournamentRef, updateData);
}

/**
 * Check if all matches in a phase are completed
 */
async function isPhaseCompleted(
  kingDocRef: FirebaseFirestore.DocumentReference,
  phaseNumber: number
): Promise<boolean> {
  const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${phaseNumber}`);
  const poolsSnapshot = await phaseDocRef.collection('pools').get();

  for (const poolDoc of poolsSnapshot.docs) {
    const matchesSnapshot = await poolDoc.ref.collection('matches').get();
    for (const matchDoc of matchesSnapshot.docs) {
      if (matchDoc.data().status !== 'completed') {
        return false;
      }
    }
  }
  return true;
}

/**
 * Get King tournament dashboard
 */
export const getKingDashboard = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;

  try {
    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

    // Get King data
    const kingDocRef = tournamentDoc.ref.collection('king').doc('mainKingData');
    const kingDoc = await kingDocRef.get();

    const kingData = kingDoc.exists ? kingDoc.data() : null;

    // Helper function to load phase data
    const loadPhaseData = async (phaseNumber: number) => {
      const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${phaseNumber}`);
      const phaseDoc = await phaseDocRef.get();
      if (!phaseDoc.exists) return null;

      const phase = { id: phaseDoc.id, ...phaseDoc.data() };

      // Get pools and matches for this phase
      const poolsSnapshot = await phaseDocRef.collection('pools').get();
      const pools = [];

      for (const poolDoc of poolsSnapshot.docs) {
        const poolData = poolDoc.data();
        const matchesSnapshot = await poolDoc.ref.collection('matches').get();
        const matches = matchesSnapshot.docs.map((m) => ({ id: m.id, ...m.data() }));

        // Group matches by round
        const matchesByRound = new Map<string, any[]>();
        matches.forEach((match) => {
          const roundId = match.roundId || 'unknown';
          if (!matchesByRound.has(roundId)) {
            matchesByRound.set(roundId, []);
          }
          matchesByRound.get(roundId)!.push(match);
        });

        const rounds = Array.from(matchesByRound.entries()).map(([roundId, matches]) => ({
          id: roundId,
          name: matches[0]?.roundName || roundId,
          matches: matches.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0)),
        }));

        pools.push({
          id: poolDoc.id,
          name: poolData.name,
          playerCount: poolData.playerCount,
          ...poolData,
          matches,
          rounds: rounds.sort((a, b) => {
            const aNum = parseInt(a.id.split('-').pop() || '0');
            const bNum = parseInt(b.id.split('-').pop() || '0');
            return aNum - bNum;
          }),
        });
      }

      phase.pools = pools;
      return phase;
    };

    // Get all phases (not just current)
    const allPhases: any[] = [];
    let currentPhase = null;

    if (kingDoc.exists) {
      // Load all existing phases
      for (let phaseNum = 1; phaseNum <= 3; phaseNum++) {
        const phase = await loadPhaseData(phaseNum);
        if (phase) {
          allPhases.push(phase);
          if (phaseNum === tournament.currentKingPhase) {
            currentPhase = phase;
          }
        }
      }
    }

    // Calculate statistics
    const stats = {
      totalPlayers: 0,
      totalMatches: 0,
      completedMatches: 0,
      pendingMatches: 0,
      totalPools: 0,
      totalRounds: 0,
    };

    allPhases.forEach((phase) => {
      if (phase.pools) {
        stats.totalPools += phase.pools.length;
        phase.pools.forEach((pool: any) => {
          if (pool.rounds) {
            stats.totalRounds += pool.rounds.length;
          }
          if (pool.matches) {
            stats.totalMatches += pool.matches.length;
            pool.matches.forEach((match: any) => {
              if (match.status === 'completed') {
                stats.completedMatches++;
              } else {
                stats.pendingMatches++;
              }
            });
          }
        });
      }
    });

    res.json({
      success: true,
      data: {
        tournament,
        kingData,
        currentPhase,
        allPhases,
        stats,
      },
    });
  } catch (error: any) {
    console.error('Error getting King dashboard:', error);
    res.status(500).json({ success: false, message: 'Error loading King dashboard' });
  }
};

/**
 * Start Phase 1 (4v4)
 */
export const startKingPhase1 = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const tournament = (req as any).tournament;

    const unassignedPlayersSnapshot = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('unassignedPlayers')
      .get();
    const players = unassignedPlayersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (!tournament || players.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No players registered for the tournament',
      });
    }

    // Prepare players (sort for determinism)
    players.sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''));

    console.log(`📋 Phase 1: ${players.length} players`);

    // Generate Phase 1 with 3 rounds
    const phase1 = kingService.generatePhase1(players, tournament);

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

    const batch = adminDb.batch();

    // Create King document
    batch.set(
      kingDocRef,
      {
        currentPhase: 1,
        totalMatches: phase1.allMatches.length,
        ranking: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Save Phase 1
    const phaseDocRef = kingDocRef.collection('phases').doc('phase-1');
    batch.set(phaseDocRef, {
      phaseNumber: 1,
      description: phase1.description,
      status: 'in-progress',
      ranking: [],
      createdAt: new Date(),
    });

    // Save pools and matches
    for (const pool of phase1.pools) {
      const poolDocRef = phaseDocRef.collection('pools').doc(pool.id);
      batch.set(poolDocRef, {
        id: pool.id,
        name: pool.name,
        playerCount: pool.players.length,
        createdAt: new Date(),
      });

      // Save each round and its matches
      const roundsInPool = new Map<string, any>();
      pool.matches.forEach((match: KingMatch) => {
        if (!roundsInPool.has(match.roundId)) {
          roundsInPool.set(match.roundId, {
            id: match.roundId,
            name: match.roundName,
            phaseNumber: 1,
            roundNumber: parseInt(match.roundId.split('-').pop() || '1'),
            poolId: pool.id,
            createdAt: new Date(),
          });
        }
      });

      for (const roundData of roundsInPool.values()) {
        const roundDocRef = poolDocRef.collection('rounds').doc(roundData.id);
        batch.set(roundDocRef, roundData);
      }

      for (const match of pool.matches) {
        const matchDocRef = poolDocRef.collection('matches').doc(match.id);
        batch.set(matchDocRef, {
          ...match,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Update tournament
    batch.update(tournamentRef, {
      currentKingPhase: 1,
      kingStatus: 'phase1-in-progress',
      isKingPhaseCompleted: false,
      updatedAt: new Date(),
    });

    await batch.commit();

    // Recalculate global ranking and phase 1 ranking
    const finalBatch = adminDb.batch();
    await recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, false, 1, 1);
    await finalBatch.commit();

    console.log(`✅ Phase 1 started: ${phase1.allMatches.length} matches`);

    res.json({
      success: true,
      message: `Phase 1 started! ${phase1.allMatches.length} matches to play.`,
      phase: phase1,
    });
  } catch (error) {
    console.error('❌ Error startKingPhase1:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting Phase 1',
    });
  }
};

/**
 * Start Phase 2 (3v3)
 */
export const startKingPhase2 = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const tournament = (req as any).tournament;

    // Validations
    if (tournament.currentKingPhase !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Phase 1 must be the current phase',
      });
    }

    if (!tournament.isKingPhaseCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Phase 1 must be completely finished',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

    // 1. Retrieve Phase 1 data
    console.log('📊 Retrieving Phase 1 data...');
    const phase1DocRef = kingDocRef.collection('phases').doc('phase-1');
    const phase1PoolsSnapshot = await phase1DocRef.collection('pools').get();

    const phase1Pools: KingPool[] = [];
    const phase1Matches: KingMatch[] = [];

    for (const poolDoc of phase1PoolsSnapshot.docs) {
      const pool: any = {
        id: poolDoc.id,
        name: poolDoc.data().name,
        players: [],
        matches: [],
      };

      // Get matches
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      pool.matches = matchesSnapshot.docs.map((m) => ({ id: m.id, ...m.data() }));

      // Get players from matches
      for (const match of pool.matches) {
        if (match.team1 && match.team1.members) {
          pool.players.push(...match.team1.members);
        }
        if (match.team2 && match.team2.members) {
          pool.players.push(...match.team2.members);
        }
      }
      // Deduplicate players
      pool.players = Array.from(new Map(pool.players.map((p: any) => [p.id, p])).values());

      phase1Pools.push(pool);
      phase1Matches.push(...pool.matches);
    }

    console.log(`📋 Phase 1 found: ${phase1Pools.length} pools, ${phase1Matches.length} matches`);

    // 2. Calculate qualifiers (top 4 from each pool)
    const qualifiedPlayers = kingService.getPhase1Qualifiers(phase1Pools, phase1Matches, 4);

    console.log(`✅ Phase 1 qualifiers: ${qualifiedPlayers.length} players`);

    if (qualifiedPlayers.length < 8) {
      return res.status(400).json({
        success: false,
        message: `Not enough qualifiers: ${qualifiedPlayers.length} instead of 8`,
      });
    }

    // 3. Generate Phase 2
    console.log('🎮 Generating Phase 2 (3v3)...');
    const phase2 = kingService.generatePhase2(qualifiedPlayers, tournament);

    // 4. Save Phase 2
    const batch = adminDb.batch();

    const phase2DocRef = kingDocRef.collection('phases').doc('phase-2');
    batch.set(phase2DocRef, {
      phaseNumber: 2,
      description: phase2.description,
      qualifiedCount: qualifiedPlayers.length,
      status: 'in-progress',
      ranking: [],
      createdAt: new Date(),
    });

    for (const pool of phase2.pools) {
      const poolDocRef = phase2DocRef.collection('pools').doc(pool.id);
      batch.set(poolDocRef, {
        id: pool.id,
        name: pool.name,
        playerCount: pool.players.length,
        createdAt: new Date(),
      });

      // Save each round and its matches
      const roundsInPool = new Map<string, any>();
      pool.matches.forEach((match: KingMatch) => {
        if (!roundsInPool.has(match.roundId)) {
          roundsInPool.set(match.roundId, {
            id: match.roundId,
            name: match.roundName,
            phaseNumber: 2,
            roundNumber: parseInt(match.roundId.split('-').pop() || '1'),
            poolId: pool.id,
            createdAt: new Date(),
          });
        }
      });

      for (const roundData of roundsInPool.values()) {
        const roundDocRef = poolDocRef.collection('rounds').doc(roundData.id);
        batch.set(roundDocRef, roundData);
      }

      for (const match of pool.matches) {
        const matchDocRef = poolDocRef.collection('matches').doc(match.id);
        batch.set(matchDocRef, {
          ...match,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Get existing King data for cumulative total
    const existingKingDoc = await kingDocRef.get();
    let currentTotalMatches = 0;
    if (existingKingDoc.exists) {
      currentTotalMatches = existingKingDoc.data()?.totalMatches || 0;
    }

    // Update mainKingData with cumulative total
    batch.update(kingDocRef, {
      currentPhase: 2,
      totalMatches: currentTotalMatches + phase2.allMatches.length,
      ranking: [],
      updatedAt: new Date(),
    });

    batch.update(tournamentRef, {
      currentKingPhase: 2,
      kingStatus: 'phase2-in-progress',
      isKingPhaseCompleted: false,
      updatedAt: new Date(),
    });

    await batch.commit();

    // Recalculate global ranking and phase 2 ranking
    const finalBatch = adminDb.batch();
    await recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, false, 2, 2);
    await finalBatch.commit();

    console.log(`✅ Phase 2 started: ${phase2.allMatches.length} matches`);

    res.json({
      success: true,
      message: `Phase 2 started! ${qualifiedPlayers.length} qualified players, ${phase2.allMatches.length} matches.`,
      qualifiedCount: qualifiedPlayers.length,
      phase: phase2,
    });
  } catch (error) {
    console.error('❌ Error startKingPhase2:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting Phase 2',
    });
  }
};

/**
 * Start Phase 3 (2v2 - Finals)
 */
export const startKingPhase3 = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const tournament = (req as any).tournament;

    // Validations
    if (tournament.currentKingPhase !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Phase 2 must be the current phase',
      });
    }

    if (!tournament.isKingPhaseCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Phase 2 must be completely finished',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

    // 1. Retrieve Phase 2 data
    console.log('📊 Retrieving Phase 2 data...');
    const phase2DocRef = kingDocRef.collection('phases').doc('phase-2');
    const phase2PoolsSnapshot = await phase2DocRef.collection('pools').get();

    const phase2Pools: KingPool[] = [];
    const phase2Matches: KingMatch[] = [];

    for (const poolDoc of phase2PoolsSnapshot.docs) {
      const pool: any = {
        id: poolDoc.id,
        name: poolDoc.data().name,
        players: [],
        matches: [],
      };

      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      pool.matches = matchesSnapshot.docs.map((m) => ({ id: m.id, ...m.data() }));

      for (const match of pool.matches) {
        if (match.team1 && match.team1.members) {
          pool.players.push(...match.team1.members);
        }
        if (match.team2 && match.team2.members) {
          pool.players.push(...match.team2.members);
        }
      }
      pool.players = Array.from(new Map(pool.players.map((p: any) => [p.id, p])).values());

      phase2Pools.push(pool);
      phase2Matches.push(...pool.matches);
    }

    console.log(`📋 Phase 2 found: ${phase2Pools.length} pools, ${phase2Matches.length} matches`);

    // 2. Calculate finalists (top 4 from each pool = 8)
    const finalists = kingService.getPhase2Qualifiers(phase2Pools, phase2Matches, 4);

    console.log(`✅ Phase 2 finalists: ${finalists.length} players`);

    if (finalists.length !== 8) {
      return res.status(400).json({
        success: false,
        message: `Exactly 8 finalists required, currently: ${finalists.length}`,
      });
    }

    // 3. Generate Phase 3
    console.log('🎮 Generating Phase 3 (2v2 Finals)...');
    const phase3 = kingService.generatePhase3(finalists, tournament);

    // 4. Save Phase 3
    const batch = adminDb.batch();

    const phase3DocRef = kingDocRef.collection('phases').doc('phase-3');
    batch.set(phase3DocRef, {
      phaseNumber: 3,
      description: phase3.description,
      finalistCount: finalists.length,
      status: 'in-progress',
      ranking: [],
      createdAt: new Date(),
    });

    for (const pool of phase3.pools) {
      const poolDocRef = phase3DocRef.collection('pools').doc(pool.id);
      batch.set(poolDocRef, {
        id: pool.id,
        name: pool.name,
        playerCount: pool.players.length,
        createdAt: new Date(),
      });

      // Save each round and its matches
      const roundsInPool = new Map<string, any>();
      pool.matches.forEach((match: KingMatch) => {
        if (!roundsInPool.has(match.roundId)) {
          roundsInPool.set(match.roundId, {
            id: match.roundId,
            name: match.roundName,
            phaseNumber: 3,
            roundNumber: parseInt(match.roundId.split('-').pop() || '1'),
            poolId: pool.id,
            createdAt: new Date(),
          });
        }
      });

      for (const roundData of roundsInPool.values()) {
        const roundDocRef = poolDocRef.collection('rounds').doc(roundData.id);
        batch.set(roundDocRef, roundData);
      }

      for (const match of pool.matches) {
        const matchDocRef = poolDocRef.collection('matches').doc(match.id);
        batch.set(matchDocRef, {
          ...match,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Get existing King data for cumulative total
    const existingKingDoc = await kingDocRef.get();
    let currentTotalMatches = 0;
    if (existingKingDoc.exists) {
      currentTotalMatches = existingKingDoc.data()?.totalMatches || 0;
    }

    // Update mainKingData with cumulative total
    batch.update(kingDocRef, {
      currentPhase: 3,
      totalMatches: currentTotalMatches + phase3.allMatches.length,
      ranking: [],
      updatedAt: new Date(),
    });

    batch.update(tournamentRef, {
      currentKingPhase: 3,
      kingStatus: 'phase3-in-progress',
      isKingPhaseCompleted: false,
      updatedAt: new Date(),
    });

    await batch.commit();

    // Recalculate global ranking and phase 3 ranking
    const finalBatch = adminDb.batch();
    await recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, false, 3, 3);
    await finalBatch.commit();

    console.log(`✅ Phase 3 started: ${phase3.allMatches.length} matches`);

    res.json({
      success: true,
      message: `Final phase started! 8 finalists, ${phase3.allMatches.length} matches.`,
      finalists: finalists.map((p) => ({ id: p.id, name: p.pseudo })),
      phase: phase3,
    });
  } catch (error) {
    console.error('❌ Error startKingPhase3:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting Phase 3',
    });
  }
};

/**
 * Record match result
 */
export const recordKingMatchResult = async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const { setsWonTeam1, setsWonTeam2 } = req.body;

    const tournament = (req as any).tournament;
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found in request.' });
    }

    const tournamentId = tournament.id;
    console.log(`[recordKingMatchResult] Received for tournamentId: ${tournamentId}, matchId: ${matchId}`);

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
    const kingDoc = await kingDocRef.get();

    if (!kingDoc.exists) {
      return res.status(404).json({ success: false, message: 'King tournament data not found.' });
    }

    const currentPhaseNumber = tournament.currentKingPhase;
    const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${currentPhaseNumber}`);
    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({ success: false, message: 'Current King tournament phase not found.' });
    }

    const batch = adminDb.batch();

    // 1. Retrieve the match
    let matchToUpdate: any = null;
    let matchRef: FirebaseFirestore.DocumentReference | null = null;
    let poolId: string | null = null;

    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    for (const poolDoc of poolsSnapshot.docs) {
      const poolMatchesSnapshot = await poolDoc.ref.collection('matches').where('id', '==', matchId).get();
      if (!poolMatchesSnapshot.empty) {
        matchRef = poolMatchesSnapshot.docs[0].ref;
        matchToUpdate = { id: poolMatchesSnapshot.docs[0].id, ...poolMatchesSnapshot.docs[0].data() };
        poolId = poolDoc.id;
        console.log(`[recordKingMatchResult] Match found in pool ${poolDoc.id}: Match ID found = ${matchToUpdate.id}`);
        break;
      }
    }

    if (!matchToUpdate || !matchRef) {
      return res.status(404).json({ success: false, message: 'Match not found in current phase.' });
    }

    // 2. Parse sets won
    const parsedSetsWonTeam1 = parseInt(String(setsWonTeam1));
    const parsedSetsWonTeam2 = parseInt(String(setsWonTeam2));

    // 3. Determine winning team
    let winnerTeam = null;
    if (parsedSetsWonTeam1 > parsedSetsWonTeam2) {
      winnerTeam = matchToUpdate.team1;
    } else if (parsedSetsWonTeam2 > parsedSetsWonTeam1) {
      winnerTeam = matchToUpdate.team2;
    }

    // 4. Update match
    const updatedMatchData = {
      setsWonTeam1: parsedSetsWonTeam1,
      setsWonTeam2: parsedSetsWonTeam2,
      status: 'completed',
      winnerTeam: winnerTeam,
      winnerName: winnerTeam ? winnerTeam.name : null,
      winnerPlayerIds: winnerTeam ? winnerTeam.members.map((m: any) => m.id) : [],
      updatedAt: new Date(),
    };

    batch.update(matchRef, updatedMatchData);

    // 5. Update allMatches in phase document
    const allPhaseMatches = [];
    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      matchesSnapshot.docs.forEach((doc) => {
        const currentMatchData = { id: doc.id, ...doc.data() };
        if (currentMatchData.id === matchId) {
          allPhaseMatches.push({ ...currentMatchData, ...updatedMatchData });
        } else {
          allPhaseMatches.push(currentMatchData);
        }
      });
    }

    batch.update(phaseDocRef, {
      allMatches: allPhaseMatches,
      updatedAt: new Date(),
    });

    await batch.commit();

    // 6. Recalculate global ranking and current phase ranking
    const allMatchesInCurrentPhaseCompleted = await isPhaseCompleted(kingDocRef, currentPhaseNumber);
    const finalBatch = adminDb.batch();
    await recalculateRankingAndUpdateTournament(
      finalBatch,
      tournamentRef,
      kingDocRef,
      allMatchesInCurrentPhaseCompleted,
      currentPhaseNumber,
      currentPhaseNumber
    );
    await finalBatch.commit();

    res.json({ success: true, message: 'Match result recorded and ranking updated.' });
  } catch (error) {
    console.error('Error recording King match result:', error);
    res.status(500).json({ success: false, message: 'Server error while recording match result.' });
  }
};

/**
 * Reset Phase 1
 */
export const resetKingPhase1 = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const kingDocRef = tournamentRef.collection('king').doc('mainKingData');

    const batch = adminDb.batch();

    const phasesSnapshot = await kingDocRef.collection('phases').get();
    for (const phaseDoc of phasesSnapshot.docs) {
      await kingService.deleteKingPhaseData(batch, phaseDoc.ref);
    }
    batch.delete(kingDocRef);

    batch.update(tournamentRef, {
      currentKingPhase: 0,
      isKingPhaseCompleted: false,
      updatedAt: new Date(),
    });

    await batch.commit();

    res.json({ success: true, message: 'Phase 1 reset successfully.' });
  } catch (error) {
    console.error('Error resetting King Phase 1:', error);
    res.status(500).json({ success: false, message: 'Server error while resetting Phase 1.' });
  }
};

/**
 * Reset Phase 2
 */
export const resetKingPhase2 = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found.' });
    }
    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

    if (tournament.tournamentFormat !== 'king' || !tournament.king) {
      return res.status(400).json({ success: false, message: 'This is not a valid King tournament.' });
    }
    if (tournament.currentKingPhase < 2) {
      return res.status(400).json({ success: false, message: 'Phase 2 has not been started yet.' });
    }

    const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
    const kingDoc = await kingDocRef.get();
    if (!kingDoc.exists) {
      return res.status(404).json({ success: false, message: 'King tournament data not found.' });
    }

    const batch = adminDb.batch();
    const phase2DocRef = kingDocRef.collection('phases').doc('phase-2');
    await kingService.deleteKingPhaseData(batch, phase2DocRef);

    // Update phase 2 ranking to empty
    batch.update(phase2DocRef, { ranking: [], updatedAt: new Date() });

    // Recalculate global ranking and phase 1 ranking (previous phase)
    await recalculateRankingAndUpdateTournament(batch, tournamentRef, kingDocRef, true, 1, 1);

    await batch.commit();

    res.json({ success: true, message: 'Phase 2 reset successfully.' });
  } catch (error) {
    console.error('Error resetting King Phase 2:', error);
    res.status(500).json({ success: false, message: 'Server error while resetting Phase 2.' });
  }
};

/**
 * Reset Phase 3
 */
export const resetKingPhase3 = async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found.' });
    }
    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

    if (tournament.tournamentFormat !== 'king' || !tournament.king) {
      return res.status(400).json({ success: false, message: 'This is not a valid King tournament.' });
    }
    if (tournament.currentKingPhase < 3) {
      return res.status(400).json({ success: false, message: 'Final phase has not been started yet.' });
    }

    const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
    const kingDoc = await kingDocRef.get();
    if (!kingDoc.exists) {
      return res.status(404).json({ success: false, message: 'King tournament data not found.' });
    }

    const batch = adminDb.batch();
    const phase3DocRef = kingDocRef.collection('phases').doc('phase-3');
    await kingService.deleteKingPhaseData(batch, phase3DocRef);

    // Update phase 3 ranking to empty
    batch.update(phase3DocRef, { ranking: [], updatedAt: new Date() });

    // Recalculate global ranking and phase 2 ranking (previous phase)
    await recalculateRankingAndUpdateTournament(batch, tournamentRef, kingDocRef, true, 2, 2);

    await batch.commit();

    res.json({ success: true, message: 'Final phase reset successfully.' });
  } catch (error) {
    console.error('Error resetting King Phase 3:', error);
    res.status(500).json({ success: false, message: 'Server error while resetting final phase.' });
  }
};

/**
 * Set random scores for all incomplete matches in current phase
 * For testing purposes only
 */
export const setAllKingMatchesScores = async (req: Request, res: Response) => {
  try {
    const tournament = (req as any).tournament;
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found in request.' });
    }

    const tournamentId = tournament.id;
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const kingDocRef = tournamentRef.collection('king').doc('mainKingData');
    const kingDoc = await kingDocRef.get();

    if (!kingDoc.exists) {
      return res.status(404).json({ success: false, message: 'King tournament data not found.' });
    }

    const currentPhaseNumber = tournament.currentKingPhase;
    if (!currentPhaseNumber || currentPhaseNumber === 0) {
      return res.status(400).json({ success: false, message: 'No active phase to set scores for.' });
    }

    const phaseDocRef = kingDocRef.collection('phases').doc(`phase-${currentPhaseNumber}`);
    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({ success: false, message: 'Current King tournament phase not found.' });
    }

    const batch = adminDb.batch();
    let matchesUpdatedCount = 0;
    const allPhaseMatches: any[] = [];

    // Random score options (2-0, 2-1, 0-2, 1-2)
    const scoreOptions = [
      { s1: 2, s2: 0 }, { s1: 2, s2: 1 },
      { s1: 0, s2: 2 }, { s1: 1, s2: 2 }
    ];

    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      for (const matchDoc of matchesSnapshot.docs) {
        const matchData: any = { id: matchDoc.id, ...matchDoc.data() };

        if (matchData.status !== 'completed') {
          // Generate random score
          const randomScore = scoreOptions[Math.floor(Math.random() * scoreOptions.length)];

          matchData.setsWonTeam1 = randomScore.s1;
          matchData.setsWonTeam2 = randomScore.s2;
          matchData.status = 'completed';
          matchData.updatedAt = new Date();

          // Determine winner
          let winnerTeam = null;
          if (matchData.setsWonTeam1 > matchData.setsWonTeam2) {
            winnerTeam = matchData.team1;
          } else if (matchData.setsWonTeam2 > matchData.setsWonTeam1) {
            winnerTeam = matchData.team2;
          }
          matchData.winnerTeam = winnerTeam;
          matchData.winnerName = winnerTeam ? winnerTeam.name : null;
          matchData.winnerPlayerIds = winnerTeam ? winnerTeam.members.map((m: any) => m.id) : [];

          batch.update(matchDoc.ref, matchData);
          matchesUpdatedCount++;
        }
        allPhaseMatches.push(matchData);
      }
    }

    if (matchesUpdatedCount === 0) {
      return res.json({ success: true, message: 'All matches in current phase are already completed.' });
    }

    // Update phase document with all matches
    batch.update(phaseDocRef, {
      allMatches: allPhaseMatches,
      updatedAt: new Date()
    });

    await batch.commit();

    // Recalculate rankings
    const allMatchesCompleted = await isPhaseCompleted(kingDocRef, currentPhaseNumber);
    const finalBatch = adminDb.batch();
    await recalculateRankingAndUpdateTournament(finalBatch, tournamentRef, kingDocRef, allMatchesCompleted, currentPhaseNumber, currentPhaseNumber);
    await finalBatch.commit();

    res.json({ success: true, message: `${matchesUpdatedCount} matches updated with random scores.` });
  } catch (error) {
    console.error('Error setting random scores:', error);
    res.status(500).json({ success: false, message: 'Server error while setting random scores.' });
  }
};
