import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import * as flexibleKingService from '../services/flexible-king.service';
import * as kingService from '../services/king.service';
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

    const kingData = flexKingDoc.data() as FlexibleKingTournamentData;

    // Load all phases with their pools and matches
    const phasesSnapshot = await flexKingDocRef.collection('phases').get();
    const phases: FlexibleKingPhase[] = [];

    for (const phaseDoc of phasesSnapshot.docs) {
      const phase = { id: phaseDoc.id, ...phaseDoc.data() } as FlexibleKingPhase;

      // Load pools if phase is configured or in progress
      if (phase.status !== 'not_configured') {
        const poolsSnapshot = await phaseDoc.ref.collection('pools').get();
        const pools: KingPool[] = [];
        const matches: KingMatch[] = [];

        for (const poolDoc of poolsSnapshot.docs) {
          const poolData = poolDoc.data();
          const matchesSnapshot = await poolDoc.ref.collection('matches').get();
          const poolMatches = matchesSnapshot.docs.map((m) => ({ id: m.id, ...m.data() })) as KingMatch[];

          pools.push({
            id: poolDoc.id,
            name: poolData.name,
            players: poolData.players || [],
            matches: poolMatches,
            playerCount: poolData.playerCount,
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
    const { pools, matches } = flexibleKingService.generatePhasePoolsAndMatches(
      phase,
      registeredPlayers
    );

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
