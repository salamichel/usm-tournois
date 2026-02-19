import { Request, Response } from 'express';
import { adminDb } from '../config/firebase.config';
import * as teamKingService from '../services/team-king.service';
import type {
  TeamKingPhase,
  TeamKingTournamentData,
  TeamKingTeam,
  TeamKingPool,
  TeamKingMatch,
  TeamKingPhaseConfig,
} from '@shared/types/team-king.types';
import type { Team } from '@shared/types/team.types';

/**
 * Get Team King tournament dashboard data
 */
export const getTeamKingDashboard = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;

  try {
    // Get tournament
    const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

    // Get Team King data
    const teamKingDocRef = tournamentDoc.ref.collection('teamKing').doc('mainData');
    const teamKingDoc = await teamKingDocRef.get();

    if (!teamKingDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Team King Mode not initialized for this tournament',
      });
    }

    const kingData = (teamKingDoc.data() || {}) as TeamKingTournamentData;

    // Load all phases with their pools and matches
    const phasesSnapshot = await teamKingDocRef.collection('phases').get();
    const phases: TeamKingPhase[] = [];

    for (const phaseDoc of phasesSnapshot.docs) {
      const phaseData = phaseDoc.data() || {};
      const phase = { id: phaseDoc.id, ...phaseData } as TeamKingPhase;

      // Load pools if phase is configured or in progress
      if (phase.status && phase.status !== 'not_configured') {
        const poolsSnapshot = await phaseDoc.ref.collection('pools').get();
        const pools: TeamKingPool[] = [];
        const matches: TeamKingMatch[] = [];

        for (const poolDoc of poolsSnapshot.docs) {
          const poolData = poolDoc.data() || {};
          const matchesSnapshot = await poolDoc.ref.collection('matches').get();
          const poolMatches = matchesSnapshot.docs.map((m) => ({
            id: m.id,
            ...(m.data() || {}),
          })) as TeamKingMatch[];

          pools.push({
            id: poolDoc.id,
            name: poolData.name || `Pool ${poolDoc.id}`,
            teams: poolData.teams || [],
            matches: poolMatches,
            teamCount: poolData.teamCount || 0,
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

    // Get registered teams
    const teamsSnapshot = await tournamentDoc.ref.collection('teams').get();
    const teams = teamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Team[];
    const registeredTeamsCount = teams.length;

    console.log(`[Team King Dashboard] Tournament: ${tournamentId}`);
    console.log(`[Team King Dashboard] Registered teams count: ${registeredTeamsCount}`);

    res.json({
      success: true,
      data: {
        tournament,
        teamKingData: { ...kingData, phases },
        currentPhase,
        registeredTeamsCount,
        teams,
      },
    });
  } catch (error: any) {
    console.error('Error getting Team King dashboard:', error);
    res.status(500).json({ success: false, message: 'Error loading Team King dashboard' });
  }
};

/**
 * Initialize Team King Mode with configuration from frontend
 */
export const initializeTeamKing = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;
  const { phases, gameMode, playersPerTeam, setsPerMatch, pointsPerSet, tieBreakEnabled } = req.body;

  try {
    if (!phases || !Array.isArray(phases) || phases.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Phases configuration is required',
      });
    }

    if (!gameMode || !playersPerTeam) {
      return res.status(400).json({
        success: false,
        message: 'gameMode and playersPerTeam are required',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Get registered teams
    const teamsSnapshot = await tournamentRef.collection('teams').get();
    const teams = teamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Team[];
    const registeredTeamsCount = teams.length;

    // Validate that we have enough teams for phase 1
    const phase1Config = phases[0];
    if (registeredTeamsCount < phase1Config.totalTeams) {
      return res.status(400).json({
        success: false,
        message: `Not enough teams: ${registeredTeamsCount} registered, ${phase1Config.totalTeams} required for Phase 1`,
      });
    }

    // Initialize Team King data structure
    const kingData = teamKingService.initializeTeamKingTournament(
      gameMode,
      playersPerTeam,
      setsPerMatch || 2,
      pointsPerSet || 21,
      tieBreakEnabled || false
    );

    // Create phases
    const allTeamIds = teams.map((t) => t.id);
    const teamKingPhases: TeamKingPhase[] = [];

    for (let i = 0; i < phases.length; i++) {
      const config = phases[i] as TeamKingPhaseConfig;
      const phaseNumber = i + 1;

      // Phase 1 gets all registered teams, other phases get participants from previous phase
      const participatingTeamIds = phaseNumber === 1 ? allTeamIds.slice(0, config.totalTeams) : [];

      const phase = teamKingService.createTeamKingPhase(
        tournamentId,
        phaseNumber,
        config,
        participatingTeamIds
      );

      teamKingPhases.push(phase);
    }

    kingData.phases = teamKingPhases;

    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const batch = adminDb.batch();

    // Save main Team King data
    batch.set(teamKingDocRef, {
      gameMode: kingData.gameMode,
      playersPerTeam: kingData.playersPerTeam,
      setsPerMatch: kingData.setsPerMatch,
      pointsPerSet: kingData.pointsPerSet,
      tieBreakEnabled: kingData.tieBreakEnabled,
      currentPhaseNumber: null,
      winnerTeam: null,
      createdAt: kingData.createdAt,
      updatedAt: kingData.updatedAt,
    });

    // Save each phase configuration
    for (const phase of kingData.phases) {
      const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phase.phaseNumber}`);
      batch.set(phaseDocRef, {
        id: phase.id,
        tournamentId,
        phaseNumber: phase.phaseNumber,
        status: phase.status,
        config: phase.config,
        participatingTeamIds: phase.participatingTeamIds,
        qualifiedTeamIds: phase.qualifiedTeamIds,
        eliminatedTeamIds: phase.eliminatedTeamIds,
        createdAt: phase.createdAt,
        configuredAt: phase.configuredAt,
      });
    }

    // Update tournament
    batch.update(tournamentRef, {
      teamKingInitialized: true,
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Team King Mode initialized for tournament ${tournamentId}`);

    res.json({
      success: true,
      message: 'Team King Mode initialized successfully',
      data: kingData,
    });
  } catch (error) {
    console.error('Error initializing Team King:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing Team King Mode',
    });
  }
};

/**
 * Preview configuration before initialization
 */
export const previewConfiguration = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;
  const { phases } = req.body; // Array of TeamKingPhaseConfig

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

    // Get registered teams count
    const teamsSnapshot = await tournamentRef.collection('teams').get();
    const registeredTeamsCount = teamsSnapshot.size;

    // Validate phases
    const errors: string[] = [];
    let currentTeamCount = registeredTeamsCount;

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const phaseNumber = i + 1;

      if (phase.totalTeams > currentTeamCount) {
        errors.push(
          `Phase ${phaseNumber}: requires ${phase.totalTeams} teams but only ${currentTeamCount} available`
        );
      }

      // Update team count for next phase
      currentTeamCount = phase.totalQualified;
    }

    res.json({
      success: true,
      valid: errors.length === 0,
      errors,
      registeredTeamsCount,
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
 * Update phase configuration
 */
export const updatePhaseConfiguration = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;
  const { config } = req.body; // TeamKingPhaseConfig

  try {
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Phase configuration is required',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

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

    batch.update(teamKingDocRef, {
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
 * Start a Team King phase (generate pools and matches)
 */
export const startTeamKingPhase = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const phase = { id: phaseDoc.id, ...phaseDoc.data() } as TeamKingPhase;

    // Get all registered teams
    const teamsSnapshot = await tournamentRef.collection('teams').get();
    const allTeams = teamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Team[];

    // Generate pools and matches
    const { pools, matches } = teamKingService.generatePhasePoolsAndMatches(phase, allTeams);

    // Save to Firestore
    const batch = adminDb.batch();

    // Save pools
    for (const pool of pools) {
      const poolDocRef = phaseDocRef.collection('pools').doc(pool.id);
      batch.set(poolDocRef, {
        id: pool.id,
        name: pool.name,
        teams: pool.teams,
        teamCount: pool.teamCount,
        createdAt: pool.createdAt,
      });

      // Save matches for this pool
      const poolMatches = matches.filter((m) => m.poolId === pool.id);
      for (const match of poolMatches) {
        const matchDocRef = poolDocRef.collection('matches').doc(match.id);
        batch.set(matchDocRef, match);
      }
    }

    // Update phase status
    batch.update(phaseDocRef, {
      status: 'in_progress',
      startedAt: new Date(),
    });

    // Update main data
    batch.update(teamKingDocRef, {
      currentPhaseNumber: parseInt(phaseNumber),
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Phase ${phaseNumber} started with ${matches.length} matches`);

    res.json({
      success: true,
      message: `Phase ${phaseNumber} started successfully`,
      data: { pools, matches },
    });
  } catch (error: any) {
    console.error('Error starting Team King phase:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error starting Team King phase',
    });
  }
};

/**
 * Complete a phase and calculate qualified teams
 */
export const completeTeamKingPhase = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    const phase = { id: phaseDoc.id, ...phaseDoc.data() } as TeamKingPhase;

    // Load pools and matches
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    const pools: TeamKingPool[] = [];
    const matches: TeamKingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data() || {};
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      const poolMatches = matchesSnapshot.docs.map((m) => ({
        id: m.id,
        ...(m.data() || {}),
      })) as TeamKingMatch[];

      pools.push({
        id: poolDoc.id,
        name: poolData.name,
        teams: poolData.teams || [],
        matches: poolMatches,
        teamCount: poolData.teamCount,
        createdAt: poolData.createdAt,
      });

      matches.push(...poolMatches);
    }

    // Check if all matches are completed
    const incompleteMatches = matches.filter((m) => m.status !== 'completed');
    if (incompleteMatches.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete phase: ${incompleteMatches.length} matches still pending`,
      });
    }

    // Calculate rankings
    const rankings = teamKingService.calculateTeamRankings(pools, matches);

    // Calculate qualified teams
    const qualifiedPerPoolDistribution =
      phase.config.qualifiedPerPoolDistribution ||
      teamKingService.distributeQualifiedInPools(
        phase.config.totalQualified,
        phase.config.numberOfPools
      );

    const qualifiedTeamIds = teamKingService.calculatePhaseQualifiers(
      pools,
      matches,
      qualifiedPerPoolDistribution
    );

    const eliminatedTeamIds = teamKingService.getEliminatedTeams(
      phase.participatingTeamIds,
      qualifiedTeamIds
    );

    // Update phase
    const batch = adminDb.batch();

    batch.update(phaseDocRef, {
      status: 'completed',
      qualifiedTeamIds,
      eliminatedTeamIds,
      completedAt: new Date(),
    });

    // Update next phase with qualified teams (if exists)
    const nextPhaseNumber = parseInt(phaseNumber) + 1;
    const nextPhaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${nextPhaseNumber}`);
    const nextPhaseDoc = await nextPhaseDocRef.get();

    if (nextPhaseDoc.exists) {
      batch.update(nextPhaseDocRef, {
        participatingTeamIds: qualifiedTeamIds,
      });
    }

    batch.update(teamKingDocRef, {
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Phase ${phaseNumber} completed. ${qualifiedTeamIds.length} teams qualified`);

    res.json({
      success: true,
      message: `Phase ${phaseNumber} completed successfully`,
      data: {
        qualifiedTeamIds,
        eliminatedTeamIds,
        ranking: rankings,
      },
    });
  } catch (error: any) {
    console.error('Error completing Team King phase:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing Team King phase',
    });
  }
};

/**
 * Record match result for a Team King phase
 */
export const recordTeamKingMatchResult = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber, matchId } = req.params;
  const { setsWonTeam1, setsWonTeam2, sets } = req.body;

  try {
    if (
      setsWonTeam1 === undefined ||
      setsWonTeam2 === undefined ||
      setsWonTeam1 === null ||
      setsWonTeam2 === null
    ) {
      return res.status(400).json({
        success: false,
        message: 'setsWonTeam1 and setsWonTeam2 are required',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    // Find match in pools
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    let matchDocRef = null;

    for (const poolDoc of poolsSnapshot.docs) {
      const matchRef = poolDoc.ref.collection('matches').doc(matchId);
      const matchDoc = await matchRef.get();

      if (matchDoc.exists) {
        matchDocRef = matchRef;
        break;
      }
    }

    if (!matchDocRef) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    const matchDoc = await matchDocRef.get();
    const matchData = matchDoc.data() as TeamKingMatch;

    // Determine winner
    let winnerTeamId: string | undefined;
    let winnerTeamName: string | undefined;

    if (setsWonTeam1 > setsWonTeam2) {
      winnerTeamId = matchData.team1.id;
      winnerTeamName = matchData.team1.name;
    } else if (setsWonTeam2 > setsWonTeam1) {
      winnerTeamId = matchData.team2.id;
      winnerTeamName = matchData.team2.name;
    }

    // Update match
    await matchDocRef.update({
      setsWonTeam1,
      setsWonTeam2,
      sets: sets || [],
      winnerTeamId,
      winnerTeamName,
      status: 'completed',
      updatedAt: new Date(),
    });

    console.log(`✅ Match ${matchId} result recorded`);

    res.json({
      success: true,
      message: 'Match result recorded successfully',
    });
  } catch (error: any) {
    console.error('Error recording match result:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error recording match result',
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
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    // Load pools and matches
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    const pools: TeamKingPool[] = [];
    const matches: TeamKingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data() || {};
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      const poolMatches = matchesSnapshot.docs.map((m) => ({
        id: m.id,
        ...(m.data() || {}),
      })) as TeamKingMatch[];

      pools.push({
        id: poolDoc.id,
        name: poolData.name,
        teams: poolData.teams || [],
        matches: poolMatches,
        teamCount: poolData.teamCount,
        createdAt: poolData.createdAt,
      });

      matches.push(...poolMatches);
    }

    // Calculate rankings
    const rankings = teamKingService.calculateTeamRankings(pools, matches);

    res.json({
      success: true,
      data: {
        rankings,
        totalMatches: matches.length,
        completedMatches: matches.filter((m) => m.status === 'completed').length,
        pools: pools.map((p) => ({
          id: p.id,
          name: p.name,
          teamCount: p.teamCount,
          matchesCount: p.matches.length,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error getting phase statistics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting phase statistics',
    });
  }
};

/**
 * Get team statistics for a phase
 */
export const getTeamPhaseStatistics = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber, teamId } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    // Load matches for this team
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    const teamMatches: TeamKingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      const matches = matchesSnapshot.docs
        .map((m) => ({ id: m.id, ...(m.data() || {}) }) as TeamKingMatch)
        .filter((m) => m.team1.id === teamId || m.team2.id === teamId);

      teamMatches.push(...matches);
    }

    res.json({
      success: true,
      data: {
        teamId,
        matches: teamMatches,
        totalMatches: teamMatches.length,
        completedMatches: teamMatches.filter((m) => m.status === 'completed').length,
      },
    });
  } catch (error: any) {
    console.error('Error getting team statistics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting team statistics',
    });
  }
};

/**
 * Reset a Team King phase
 */
export const resetTeamKingPhase = async (req: Request, res: Response) => {
  const { tournamentId, phaseNumber } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);

    const phaseDoc = await phaseDocRef.get();

    if (!phaseDoc.exists) {
      return res.status(404).json({
        success: false,
        message: `Phase ${phaseNumber} not found`,
      });
    }

    // Delete all pools and matches
    const poolsSnapshot = await phaseDocRef.collection('pools').get();
    const batch = adminDb.batch();

    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      matchesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(poolDoc.ref);
    }

    // Reset phase status
    batch.update(phaseDocRef, {
      status: 'configured',
      qualifiedTeamIds: [],
      eliminatedTeamIds: [],
      startedAt: null,
      completedAt: null,
    });

    batch.update(teamKingDocRef, {
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Phase ${phaseNumber} reset successfully`);

    res.json({
      success: true,
      message: `Phase ${phaseNumber} reset successfully`,
    });
  } catch (error: any) {
    console.error('Error resetting Team King phase:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error resetting Team King phase',
    });
  }
};

/**
 * Set random scores for all incomplete matches (testing)
 */
export const setAllMatchesRandomScores = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const teamKingDoc = await teamKingDocRef.get();

    if (!teamKingDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Team King Mode not initialized',
      });
    }

    const kingData = teamKingDoc.data() as TeamKingTournamentData;
    const currentPhaseNumber = kingData.currentPhaseNumber;

    if (!currentPhaseNumber) {
      return res.status(400).json({
        success: false,
        message: 'No phase currently in progress',
      });
    }

    const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${currentPhaseNumber}`);
    const poolsSnapshot = await phaseDocRef.collection('pools').get();

    const batch = adminDb.batch();
    let updatedCount = 0;

    for (const poolDoc of poolsSnapshot.docs) {
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();

      for (const matchDoc of matchesSnapshot.docs) {
        const match = matchDoc.data() as TeamKingMatch;

        if (match.status !== 'completed') {
          // Generate random score (2-0, 2-1, 0-2, 1-2)
          const team1Wins = Math.random() > 0.5;
          const isSweep = Math.random() > 0.3;

          const setsWonTeam1 = team1Wins ? 2 : isSweep ? 0 : 1;
          const setsWonTeam2 = team1Wins ? (isSweep ? 0 : 1) : 2;

          const winnerTeamId = team1Wins ? match.team1.id : match.team2.id;
          const winnerTeamName = team1Wins ? match.team1.name : match.team2.name;

          batch.update(matchDoc.ref, {
            setsWonTeam1,
            setsWonTeam2,
            winnerTeamId,
            winnerTeamName,
            status: 'completed',
            updatedAt: new Date(),
          });

          updatedCount++;
        }
      }
    }

    await batch.commit();

    console.log(`✅ Set random scores for ${updatedCount} matches`);

    res.json({
      success: true,
      message: `Random scores set for ${updatedCount} matches`,
    });
  } catch (error: any) {
    console.error('Error setting random scores:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error setting random scores',
    });
  }
};

/**
 * Freeze tournament and generate final rankings
 */
export const freezeTeamKingTournament = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');

    const teamKingDoc = await teamKingDocRef.get();

    if (!teamKingDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Team King Mode not initialized',
      });
    }

    const kingData = teamKingDoc.data() as TeamKingTournamentData;

    // Get final phase
    const phasesSnapshot = await teamKingDocRef.collection('phases').get();
    const phases = phasesSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as TeamKingPhase))
      .sort((a, b) => b.phaseNumber - a.phaseNumber);

    const finalPhase = phases[0];

    if (!finalPhase || finalPhase.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Final phase must be completed before freezing tournament',
      });
    }

    // Load final phase data
    const finalPhaseDocRef = teamKingDocRef.collection('phases').doc(finalPhase.id);
    const poolsSnapshot = await finalPhaseDocRef.collection('pools').get();
    const pools: TeamKingPool[] = [];
    const matches: TeamKingMatch[] = [];

    for (const poolDoc of poolsSnapshot.docs) {
      const poolData = poolDoc.data() || {};
      const matchesSnapshot = await poolDoc.ref.collection('matches').get();
      const poolMatches = matchesSnapshot.docs.map((m) => ({
        id: m.id,
        ...(m.data() || {}),
      })) as TeamKingMatch[];

      pools.push({
        id: poolDoc.id,
        name: poolData.name,
        teams: poolData.teams || [],
        matches: poolMatches,
        teamCount: poolData.teamCount,
        createdAt: poolData.createdAt,
      });

      matches.push(...poolMatches);
    }

    // Calculate final rankings
    const finalRankings = teamKingService.calculateTeamRankings(pools, matches);

    // Determine winner
    const winner = finalRankings[0];

    // Update main data
    await teamKingDocRef.update({
      winnerTeam: {
        teamId: winner.teamId,
        teamName: winner.teamName,
      },
      updatedAt: new Date(),
    });

    // Save final rankings to tournament
    const batch = adminDb.batch();
    const finalRankingRef = tournamentRef.collection('teamKingFinalRanking');

    // Clear existing rankings
    const existingRankings = await finalRankingRef.get();
    existingRankings.docs.forEach((doc) => batch.delete(doc.ref));

    // Save new rankings
    finalRankings.forEach((ranking, index) => {
      const rankingDocRef = finalRankingRef.doc(`rank-${index + 1}`);
      batch.set(rankingDocRef, {
        ...ranking,
        createdAt: new Date(),
      });
    });

    // Update tournament status
    batch.update(tournamentRef, {
      status: 'Terminé',
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Team King tournament ${tournamentId} frozen. Winner: ${winner.teamName}`);

    res.json({
      success: true,
      message: 'Tournament frozen successfully',
      data: {
        winner,
        finalRankings,
      },
    });
  } catch (error: any) {
    console.error('Error freezing Team King tournament:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error freezing Team King tournament',
    });
  }
};

/**
 * Assign individual player points at tournament end
 */
export const assignPlayerPoints = async (req: Request, res: Response) => {
  const { tournamentId } = req.params;
  const { playerPoints } = req.body; // Array of { playerId, points }

  try {
    if (!playerPoints || !Array.isArray(playerPoints)) {
      return res.status(400).json({
        success: false,
        message: 'playerPoints array is required',
      });
    }

    const tournamentRef = adminDb.collection('events').doc(tournamentId);
    const batch = adminDb.batch();

    const playerPointsRef = tournamentRef.collection('teamKingPlayerPoints');

    // Clear existing points
    const existingPoints = await playerPointsRef.get();
    existingPoints.docs.forEach((doc) => batch.delete(doc.ref));

    // Save new points
    playerPoints.forEach((pp: { playerId: string; points: number }) => {
      const pointsDocRef = playerPointsRef.doc(pp.playerId);
      batch.set(pointsDocRef, {
        playerId: pp.playerId,
        points: pp.points,
        createdAt: new Date(),
      });
    });

    await batch.commit();

    console.log(`✅ Assigned points to ${playerPoints.length} players`);

    res.json({
      success: true,
      message: `Player points assigned successfully`,
    });
  } catch (error: any) {
    console.error('Error assigning player points:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error assigning player points',
    });
  }
};
