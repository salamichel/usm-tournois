import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import * as flexibleKingService from '../services/flexible-king.service';
import * as kingService from '../services/king.service';
import * as playerPointsService from '../services/playerPoints.service';
import type {
  FlexibleKingPhase,
  FlexibleKingTournamentData,
  KingPlayer,
  KingPool,
  KingMatch,
} from '@shared/types';

/**
 * Get flexible King tournament dashboard data
 */
export const getFlexibleKingDashboard = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;

  try {
    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

    // Get flexible King data
    const flexKingDocRef = tournamentDoc.ref.collection('flexibleKing').doc('mainData');
    const flexKingDoc = await flexKingDocRef.get();

    if (!flexKingDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Flexible King Mode not initialized for this tournament',
      });
    }

    const kingData = (flexKingDoc.data() || {}) as FlexibleKingTournamentData;

    // Load all phases with their pools and matches
    const phasesSnapshot = await flexKingDocRef.collection('phases').get();
    const phases: FlexibleKingPhase[] = [];

    for (const phaseDoc of phasesSnapshot.docs) {
      const phaseData = phaseDoc.data() || {};
      const phase = { id: phaseDoc.id, ...phaseData } as FlexibleKingPhase;

      // Load pools if phase is configured or in progress
      if (phase.status && phase.status !== 'not_configured') {
        const poolsSnapshot = await phaseDoc.ref.collection('pools').get();
        const pools: KingPool[] = [];
        const matches: KingMatch[] = [];

        for (const poolDoc of poolsSnapshot.docs) {
          const poolData = poolDoc.data() || {};
          const matchesSnapshot = await poolDoc.ref.collection('matches').get();
          const poolMatches = matchesSnapshot.docs.map((m) => ({ id: m.id, ...(m.data() || {}) })) as KingMatch[];

          pools.push({
            id: poolDoc.id,
            name: poolData.name || `Pool ${poolDoc.id}`,
            players: poolData.players || [],
            matches: poolMatches,
            playerCount: poolData.playerCount || 0,
            createdAt: poolData.createdAt,
          });

          matches.push(...poolMatches);
        }

        phase.pools = pools;
        phase.matches = matches;
      }

      phases.push(phase);
    }

    // Sort phases by phase number
    phases.sort((a, b) => a.phaseNumber - b.phaseNumber);

    // Get current phase
    const currentPhase = phases.find((p) => p.phaseNumber === kingData.currentPhaseNumber);

    // Get registered players count
    const unassignedPlayersSnapshot = await tournamentDoc.ref
      .collection('unassignedPlayers')
      .get();
    const registeredPlayersCount = unassignedPlayersSnapshot.size;

    console.log(`[Flexible King Dashboard] Tournament: ${tournamentId}`);
    console.log(`[Flexible King Dashboard] Registered players count: ${registeredPlayersCount}`);
    console.log(`[Flexible King Dashboard] Unassigned players path: events/${tournamentId}/unassignedPlayers`);

    res.json({
      success: true,
      data: {
        tournament,
        kingData: { ...kingData, phases },
        currentPhase,
        registeredPlayersCount,
      },
    });
  } catch (error: any) {
    console.error('Error getting flexible King dashboard:', error);
    res.status(500).json({ success: false, message: 'Error loading flexible King dashboard' });
  }
};

/**
 * Initialize flexible King Mode with configuration from frontend
 */
export const initializeFlexibleKing = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;
  const { phases } = req.body; // Array of FlexiblePhaseConfig

  try {
    if (!phases || !Array.isArray(phases) || phases.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Phases configuration is required',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Get registered players count for validation
    const unassignedPlayersSnapshot = await tournamentRef
      .collection('unassignedPlayers')
      .get();
    const registeredPlayersCount = unassignedPlayersSnapshot.size;

    // Validate configuration before initializing
    const validation = flexibleKingService.validateInitialConfiguration(
      phases,
      registeredPlayersCount
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Configuration validation failed',
        errors: validation.errors,
      });
    }

    // Initialize King data structure
    const kingData = flexibleKingService.initializeFlexibleKingTournament(phases);

    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const batch = adminDb.batch();

    // Save main King data
    batch.set(flexKingDocRef, {
      currentPhaseNumber: null,
      winner: null,
      createdAt: kingData.createdAt,
      updatedAt: kingData.updatedAt,
    });

    // Save each phase configuration
    for (const phase of kingData.phases) {
      const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phase.phaseNumber}`);
      batch.set(phaseDocRef, {
        id: phase.id,
        tournamentId,
        phaseNumber: phase.phaseNumber,
        status: phase.status,
        config: phase.config,
        participantIds: phase.participantIds,
        qualifiedIds: phase.qualifiedIds,
        withdrawnIds: phase.withdrawnIds,
        repechedIds: phase.repechedIds,
        createdAt: phase.createdAt,
      });
    }

    // Update tournament
    batch.update(tournamentRef, {
      flexibleKingInitialized: true,
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Flexible King Mode initialized for tournament ${tournamentId}`);

    res.json({
      success: true,
      message: 'Flexible King Mode initialized successfully',
      data: kingData,
    });
  } catch (error) {
    console.error('Error initializing flexible King:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing flexible King Mode',
    });
  }
};

/**
 * Update phase configuration
 */
export const updatePhaseConfiguration = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;
  const { config } = req.body; // FlexiblePhaseConfig

  try {
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Phase configuration is required',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const batch = adminDb.batch();

    batch.update(phaseDocRef, {
      config,
      status: 'configured',
      configuredAt: new Date(),
    });

    batch.update(flexKingDocRef, {
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Phase ${phaseNumber} configuration updated`);

    res.json({
      success: true,
      message: `Phase ${phaseNumber} configuration updated successfully`,
    });
  } catch (error) {
    console.error('Error updating phase configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating phase configuration',
    });
  }
};

/**
 * Start a flexible King phase (generate pools and matches)
 */
export const startFlexibleKingPhase = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const phase = { id: phaseDoc.id, ...phaseDoc.data() } as FlexibleKingPhase;

    // Get registered players
    const unassignedPlayersSnapshot = await tournamentRef
      .collection('unassignedPlayers')
      .get();
    const registeredPlayers = unassignedPlayersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KingPlayer[];

    // For Phase 1, use all registered players
    // For subsequent phases, use qualified IDs from previous phase
    if (parseInt(phaseNumber) === 1) {
      phase.participantIds = registeredPlayers.map((p) => p.id);
    } else {
      const previousPhaseNumber = parseInt(phaseNumber) - 1;
      const previousPhaseDocRef = flexKingDocRef
        .collection('phases')
        .doc(`phase-${previousPhaseNumber}`);
      const previousPhaseDoc = await previousPhaseDocRef.get();

      if (!previousPhaseDoc.exists) {
        return res.status(400).json({
          success: false,
          message: `Previous phase ${previousPhaseNumber} not found`,
        });
      }

      const previousPhase = previousPhaseDoc.data() as FlexibleKingPhase;

      if (previousPhase.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: `Previous phase ${previousPhaseNumber} must be completed first`,
        });
      }

      phase.participantIds = previousPhase.qualifiedIds;
    }

    // Validate phase can be started
    const validation = flexibleKingService.validatePhaseStart(phase, registeredPlayers.length);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    // Generate pools and matches
    console.log(`[startFlexibleKingPhase] Phase ${phaseNumber} config:`, JSON.stringify(phase.config, null, 2));
    console.log(`[startFlexibleKingPhase] Participants: ${phase.participantIds.length}`);
    console.log(`[startFlexibleKingPhase] Registered players: ${registeredPlayers.length}`);

    const { pools, matches } = flexibleKingService.generatePhasePoolsAndMatches(
      phase,
      registeredPlayers
    );

    console.log(`[startFlexibleKingPhase] Generated ${pools.length} pools with ${matches.length} total matches`);
    pools.forEach((pool, idx) => {
      console.log(`  - Pool ${idx + 1}: ${pool.players.length} players, ${pool.matches.length} matches`);
    });

    const batch = adminDb.batch();

    // Save pools and matches
    for (const pool of pools) {
      const poolDocRef = phaseDocRef.collection('pools').doc(pool.id);
      batch.set(poolDocRef, {
        id: pool.id,
        name: pool.name,
        players: pool.players,
        playerCount: pool.players.length,
        createdAt: new Date(),
      });

      // Save matches
      for (const match of pool.matches) {
        const matchDocRef = poolDocRef.collection('matches').doc(match.id);
        batch.set(matchDocRef, {
          ...match,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Update phase status
    batch.update(phaseDocRef, {
      participantIds: phase.participantIds,
      status: 'in_progress',
      startedAt: new Date(),
    });

    // Update main King data
    batch.update(flexKingDocRef, {
      currentPhaseNumber: parseInt(phaseNumber),
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Phase ${phaseNumber} started: ${matches.length} matches generated`);

    res.json({
      success: true,
      message: `Phase ${phaseNumber} started! ${matches.length} matches to play.`,
      data: {
        pools,
        matchesCount: matches.length,
      },
    });
  } catch (error) {
    console.error('Error starting flexible King phase:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting phase',
    });
  }
};

/**
 * Complete a phase and calculate qualifiers
 */
export const completeFlexibleKingPhase = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const phase = phaseDoc.data() as FlexibleKingPhase;

    if (phase.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: `Phase ${phaseNumber} is not in progress`,
      });
    }

    // Load pools and matches
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    const pools: KingPool[] = [];
    const matches: KingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data();
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      const poolMatches = matchesSnapshot.docs.map((m) => ({
        id: m.id,
        ...m.data(),
      })) as KingMatch[];

      pools.push({
        id: poolDoc.id,
        name: poolData.name,
        players: poolData.players || [],
        matches: poolMatches,
        playerCount: poolData.playerCount,
      });

      matches.push(...poolMatches);
    }

    // Check all matches are completed
    const incompleteMatches = matches.filter((m) => m.status !== 'completed');

    if (incompleteMatches.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${incompleteMatches.length} matches still incomplete`,
      });
    }

    // Calculate qualifiers
    const qualifiedPerPoolDistribution =
      phase.config.qualifiedPerPoolDistribution ||
      flexibleKingService.distributeQualifiedInPools(
        phase.config.totalQualified,
        phase.config.numberOfPools
      );

    const qualifiers = flexibleKingService.calculatePhaseQualifiers(
      pools,
      matches,
      qualifiedPerPoolDistribution
    );

    const qualifiedIds = qualifiers.map((q) => q.id);

    // Calculate repechage candidates (non-qualified players)
    const repechageCandidates = flexibleKingService.calculateRepechageCandidates(
      pools,
      matches,
      qualifiedIds
    );

    // Calculate phase ranking
    const ranking = kingService.calculateKingRanking(matches);

    const batch = adminDb.batch();

    // Update phase
    batch.update(phaseDocRef, {
      qualifiedIds,
      ranking,
      status: 'completed',
      completedAt: new Date(),
    });

    // Update main King data
    batch.update(flexKingDocRef, {
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Phase ${phaseNumber} completed: ${qualifiedIds.length} qualifiers`);

    res.json({
      success: true,
      message: `Phase ${phaseNumber} completed successfully`,
      data: {
        qualifiedIds,
        qualifiedCount: qualifiedIds.length,
        repechageCandidates,
        ranking,
      },
    });
  } catch (error) {
    console.error('Error completing flexible King phase:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing phase',
    });
  }
};

/**
 * Manage withdrawals for a phase
 */
export const manageWithdrawals = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;
  const { withdrawnPlayerIds } = req.body;

  try {
    if (!Array.isArray(withdrawnPlayerIds)) {
      return res.status(400).json({
        success: false,
        message: 'withdrawnPlayerIds must be an array',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const batch = adminDb.batch();

    batch.update(phaseDocRef, {
      withdrawnIds: withdrawnPlayerIds,
    });

    batch.update(flexKingDocRef, {
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Withdrawals updated for phase ${phaseNumber}: ${withdrawnPlayerIds.length} players`);

    res.json({
      success: true,
      message: 'Withdrawals updated successfully',
      data: {
        withdrawnCount: withdrawnPlayerIds.length,
      },
    });
  } catch (error) {
    console.error('Error managing withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Error managing withdrawals',
    });
  }
};

/**
 * Manage repechages for a phase
 */
export const manageRepechages = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;
  const { repechedPlayerIds } = req.body;

  try {
    if (!Array.isArray(repechedPlayerIds)) {
      return res.status(400).json({
        success: false,
        message: 'repechedPlayerIds must be an array',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const phase = phaseDoc.data() as FlexibleKingPhase;

    // Update participant IDs to include repechages
    const updatedParticipantIds = [...phase.qualifiedIds, ...repechedPlayerIds];

    const batch = adminDb.batch();

    batch.update(phaseDocRef, {
      repechedIds: repechedPlayerIds,
      participantIds: updatedParticipantIds,
    });

    batch.update(flexKingDocRef, {
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Repechages updated for phase ${phaseNumber}: ${repechedPlayerIds.length} players`);

    res.json({
      success: true,
      message: 'Repechages updated successfully',
      data: {
        repechedCount: repechedPlayerIds.length,
        totalParticipants: updatedParticipantIds.length,
      },
    });
  } catch (error) {
    console.error('Error managing repechages:', error);
    res.status(500).json({
      success: false,
      message: 'Error managing repechages',
    });
  }
};

/**
 * Reset a flexible King phase
 */
export const resetFlexibleKingPhase = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const batch = adminDb.batch();

    // Delete pools and matches
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      matchesSnapshot.docs.forEach((matchDoc) => batch.delete(matchDoc.ref));
      batch.delete(poolDoc.ref);
    }

    // Reset phase status
    batch.update(phaseDocRef, {
      status: 'configured',
      participantIds: [],
      qualifiedIds: [],
      withdrawnIds: [],
      repechedIds: [],
      ranking: [],
      startedAt: null,
      completedAt: null,
    });

    // Update main King data
    batch.update(flexKingDocRef, {
      currentPhaseNumber: parseInt(phaseNumber) > 1 ? parseInt(phaseNumber) - 1 : null,
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Phase ${phaseNumber} reset successfully`);

    res.json({
      success: true,
      message: `Phase ${phaseNumber} reset successfully`,
    });
  } catch (error) {
    console.error('Error resetting flexible King phase:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting phase',
    });
  }
};

/**
 * Record match result for flexible King phase
 */
export const recordFlexibleKingMatchResult = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber, matchId } = req.params;
  const { setsWonTeam1, setsWonTeam2 } = req.body;

  try {
    if (setsWonTeam1 === undefined || setsWonTeam2 === undefined) {
      return res.status(400).json({
        success: false,
        message: 'setsWonTeam1 and setsWonTeam2 are required',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    // Find the match
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    let matchRef: any = null;
    let matchData: any = null;
    let poolId: string | null = null;

    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').where('id', '==', matchId).get();
      if (!matchesSnapshot.empty) {
        matchRef = matchesSnapshot.docs[0].ref;
        matchData = { id: matchesSnapshot.docs[0].id, ...matchesSnapshot.docs[0].data() };
        poolId = poolDoc.id;
        break;
      }
    }

    if (!matchRef || !matchData) {
      return res.status(404).json({
        success: false,
        message: 'Match not found in this phase',
      });
    }

    // Determine winner
    let winnerTeam = null;
    if (setsWonTeam1 > setsWonTeam2) {
      winnerTeam = matchData.team1;
    } else if (setsWonTeam2 > setsWonTeam1) {
      winnerTeam = matchData.team2;
    }

    const batch = adminDb.batch();

    // Update match
    const updatedMatchData = {
      setsWonTeam1: parseInt(String(setsWonTeam1)),
      setsWonTeam2: parseInt(String(setsWonTeam2)),
      status: 'completed',
      winnerTeam,
      winnerName: winnerTeam ? winnerTeam.name : null,
      winnerPlayerIds: winnerTeam ? winnerTeam.members.map((m: any) => m.id) : [],
      updatedAt: new Date(),
    };

    batch.update(matchRef, updatedMatchData);

    await batch.commit();

    // Recalculate phase ranking
    const allMatches: KingMatch[] = [];
    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      matchesSnapshot.docs.forEach((doc) => {
        allMatches.push({ id: doc.id, ...doc.data() } as KingMatch);
      });
    }

    const ranking = kingService.calculateKingRanking(allMatches);

    // Update phase ranking
    await phaseDocRef.update({
      ranking,
      updatedAt: new Date(),
    });

    console.log(`✅ Match ${matchId} result recorded`);

    res.json({
      success: true,
      message: 'Match result recorded successfully',
      data: {
        matchId,
        setsWonTeam1: updatedMatchData.setsWonTeam1,
        setsWonTeam2: updatedMatchData.setsWonTeam2,
        winner: winnerTeam ? winnerTeam.name : 'Draw',
      },
    });
  } catch (error) {
    console.error('Error recording match result:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording match result',
    });
  }
};

/**
 * Get phase statistics
 */
export const getPhaseStatistics = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    // Load all matches
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    const matches: KingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      matchesSnapshot.docs.forEach((doc) => {
        matches.push({ id: doc.id, ...doc.data() } as KingMatch);
      });
    }

    // Calculate statistics
    const stats = flexibleKingService.calculatePhaseStatistics(matches);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting phase statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting phase statistics',
    });
  }
};

/**
 * Get player statistics for a phase
 */
export const getPlayerPhaseStatistics = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber, playerId } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    // Load all matches
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    const matches: KingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      matchesSnapshot.docs.forEach((doc) => {
        matches.push({ id: doc.id, ...doc.data() } as KingMatch);
      });
    }

    // Calculate player statistics
    const stats = flexibleKingService.getPlayerStatistics(matches, playerId);

    res.json({
      success: true,
      data: {
        playerId,
        ...stats,
      },
    });
  } catch (error) {
    console.error('Error getting player statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting player statistics',
    });
  }
};

/**
 * Validate and preview configuration before initialization
 */
export const previewConfiguration = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;
  const { phases } = req.body;

  try {
    if (!phases || !Array.isArray(phases) || phases.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Phases configuration is required',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Get registered players count
    const unassignedPlayersSnapshot = await tournamentRef.collection('unassignedPlayers').get();
    const registeredPlayersCount = unassignedPlayersSnapshot.size;

    // Validate configuration
    const validation = flexibleKingService.validateInitialConfiguration(
      phases,
      registeredPlayersCount
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Configuration validation failed',
        errors: validation.errors,
      });
    }

    // Generate preview for each phase
    const phasePreviews = phases.map((phaseConfig) => {
      const preview = flexibleKingService.generatePhasePreview(phaseConfig, registeredPlayersCount);
      return {
        phaseNumber: phaseConfig.phaseNumber,
        gameMode: phaseConfig.gameMode,
        ...preview,
      };
    });

    res.json({
      success: true,
      message: 'Configuration is valid',
      data: {
        registeredPlayersCount,
        phases: phasePreviews,
        validation,
      },
    });
  } catch (error) {
    console.error('Error previewing configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error previewing configuration',
    });
  }
};

/**
 * Get repechage candidates for a completed phase
 */
export const getRepechageCandidates = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const phase = phaseDoc.data() as FlexibleKingPhase;

    if (phase.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Phase ${phaseNumber} must be completed to get repechage candidates`,
      });
    }

    // Load pools and matches
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    const pools: KingPool[] = [];
    const matches: KingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data();
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      const poolMatches = matchesSnapshot.docs.map((m) => ({
        id: m.id,
        ...m.data(),
      })) as KingMatch[];

      pools.push({
        id: poolDoc.id,
        name: poolData.name,
        players: poolData.players || [],
        matches: poolMatches,
        playerCount: poolData.playerCount,
      });

      matches.push(...poolMatches);
    }

    // Calculate repechage candidates
    const candidates = flexibleKingService.calculateRepechageCandidates(
      pools,
      matches,
      phase.qualifiedIds
    );

    res.json({
      success: true,
      data: {
        candidates,
        qualifiedCount: phase.qualifiedIds.length,
      },
    });
  } catch (error) {
    console.error('Error getting repechage candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting repechage candidates',
    });
  }
};

/**
 * Set random scores for all incomplete matches in current phase
 * For testing purposes only
 */
export const setAllMatchesRandomScores = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const flexKingDoc = await flexKingDocRef.get();

    if (!flexKingDoc.exists) {
      return res.status(404).json({ success: false, message: 'Flexible King Mode not initialized' });
    }

    const kingData = flexKingDoc.data();
    const currentPhaseNumber = kingData?.currentPhaseNumber;

    if (!currentPhaseNumber) {
      return res.status(400).json({ success: false, message: 'No active phase to set scores for' });
    }

    const phaseDocRef = flexKingDocRef.collection('phases').doc(`phase-${currentPhaseNumber}`);
    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({ success: false, message: `Phase ${currentPhaseNumber} not found` });
    }

    const phase = phaseDoc.data();
    if (phase?.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'Phase must be in progress to set scores' });
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
      return res.json({ success: true, message: 'Tous les matchs sont déjà terminés' });
    }

    // Update phase ranking
    const ranking = kingService.calculateKingRanking(allPhaseMatches);
    batch.update(phaseDocRef, {
      ranking,
      updatedAt: new Date()
    });

    await batch.commit();

    console.log(`✅ Set random scores for ${matchesUpdatedCount} matches in phase ${currentPhaseNumber}`);

    res.json({
      success: true,
      message: `${matchesUpdatedCount} matchs mis à jour avec des scores aléatoires`,
      data: {
        matchesUpdated: matchesUpdatedCount,
        totalMatches: allPhaseMatches.length
      }
    });
  } catch (error) {
    console.error('Error setting random scores:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting random scores',
    });
  }
};

/**
 * Freeze tournament and award ranking points to players
 */
export const freezeFlexibleKingTournament = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const tournament = tournamentDoc.data();

    const flexKingDocRef = tournamentRef.collection('flexibleKing').doc('mainData');
    const flexKingDoc = await flexKingDocRef.get();

    if (!flexKingDoc.exists) {
      return res.status(404).json({ success: false, message: 'Flexible King Mode not initialized' });
    }

    const kingData = flexKingDoc.data();

    // Get all phases
    const phasesSnapshot = await flexKingDocRef.collection('phases').get();
    const phases = phasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FlexibleKingPhase[];

    // Find the last phase
    const lastPhase = phases.sort((a, b) => b.phaseNumber - a.phaseNumber)[0];

    if (!lastPhase || lastPhase.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'La dernière phase doit être terminée pour figer le tournoi'
      });
    }

    // Get final ranking from last phase
    const finalRanking = lastPhase.ranking;

    if (!finalRanking || finalRanking.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pas de classement disponible pour la dernière phase'
      });
    }

    // Delete existing points for this tournament (allows re-freeze)
    await playerPointsService.deleteTournamentPoints(tournamentId);

    // Award points to all players based on final ranking
    const result = await playerPointsService.awardPointsToFlexibleKingPlayers(
      tournamentId,
      tournament?.name || 'Tournoi Flexible King',
      tournament?.date?.toDate() || new Date(),
      finalRanking
    );

    // Update tournament status to frozen
    await flexKingDocRef.update({
      status: 'frozen',
      frozenAt: new Date(),
      finalRanking: finalRanking,
      pointsAwarded: true
    });

    // Also update main tournament document
    await tournamentRef.update({
      status: 'frozen',
      isFrozen: true,
      frozenAt: new Date()
    });

    console.log(`✅ Frozen Flexible King tournament ${tournamentId}: ${result.playersUpdated} players awarded points`);

    res.json({
      success: true,
      message: `Tournoi figé ! ${result.playersUpdated} joueurs ont reçu leurs points de classement`,
      data: {
        playersUpdated: result.playersUpdated,
        totalPointsAwarded: result.totalPoints,
        winner: finalRanking[0]?.playerPseudo || 'Unknown'
      }
    });
  } catch (error) {
    console.error('Error freezing tournament:', error);
    res.status(500).json({
      success: false,
      message: 'Error freezing tournament',
    });
  }
};
