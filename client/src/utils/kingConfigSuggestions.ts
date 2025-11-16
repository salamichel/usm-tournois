/**
 * Algorithme de suggestion de configurations optimales pour le mode King
 * Supporte des configurations flexibles multi-jours avec différents modes de jeu
 */

export type GameMode = '6v6' | '5v5' | '4v4' | '3v3' | '2v2' | '1v1';

export interface PhaseConfig {
  phaseNumber: number;
  gameMode: GameMode;
  playersPerTeam: number;
  teamsPerPool: number;
  numberOfPools: number;
  totalTeams: number;
  qualifiedPerPool: number;
  totalQualified: number;
  fields: number; // nombre de terrains utilisés
  estimatedRounds: number; // nombre de rounds KOB nécessaires
  totalMatches: number; // nombre total de matchs dans la phase
  // Règles de jeu
  setsPerMatch: number;
  pointsPerSet: number;
  tieBreakEnabled: boolean;
  // Estimation temporelle
  estimatedDurationMinutes: number; // durée estimée en minutes
  estimatedDurationDisplay: string; // ex: "2h30" ou "45min"
  // Planning
  suggestedDate?: string; // peut être rempli par l'utilisateur
}

export interface KingConfiguration {
  totalPlayers: number;
  availableFields: number;
  phases: PhaseConfig[];
  totalMatches: number; // nombre total de matchs du tournoi
  estimatedDuration: string; // estimation de la durée totale (ex: "2-3 jours")
  estimatedTotalMinutes: number; // durée totale en minutes
  estimatedTotalDisplay: string; // ex: "8h30"
  description: string;
  warnings?: string[];
}

/**
 * Constants pour le calcul de durée
 */
const MINUTES_PER_SET = 18; // Durée moyenne d'un set en minutes
const MINUTES_BREAK_BETWEEN_SETS = 2; // Pause entre sets
const MINUTES_BREAK_BETWEEN_MATCHES = 3; // Pause entre matchs
const MINUTES_SETUP_PER_PHASE = 15; // Temps d'installation début de phase

/**
 * Calcule le nombre de rounds nécessaires pour une phase KOB (King of the Beach)
 */
function calculateKOBRounds(teamsPerPool: number): number {
  // Formule KOB : chaque équipe doit jouer contre toutes les autres
  // Pour N équipes : N-1 rounds minimum
  // Mais on optimise pour que chaque équipe joue environ le même nombre de matchs

  if (teamsPerPool <= 2) return 1;
  if (teamsPerPool === 3) return 3;
  if (teamsPerPool === 4) return 5;
  if (teamsPerPool === 5) return 7;
  if (teamsPerPool === 6) return 9;
  if (teamsPerPool === 7) return 11;
  if (teamsPerPool === 8) return 13;

  // Formule générale pour plus de 8 équipes
  return teamsPerPool * 2 - 3;
}

/**
 * Calcule le nombre total de matchs pour une phase
 */
function calculateTotalMatches(
  numberOfPools: number,
  estimatedRounds: number
): number {
  // En KOB, chaque round = 1 match par poule
  // (2 équipes s'affrontent, les autres sont sur le banc)
  return estimatedRounds * numberOfPools;
}

/**
 * Calcule la durée estimée d'un match en minutes
 */
function calculateMatchDuration(setsPerMatch: number): number {
  const setsDuration = setsPerMatch * MINUTES_PER_SET;
  const breaksDuration = Math.max(0, setsPerMatch - 1) * MINUTES_BREAK_BETWEEN_SETS;
  return setsDuration + breaksDuration + MINUTES_BREAK_BETWEEN_MATCHES;
}

/**
 * Calcule la durée estimée d'une phase en minutes
 */
function calculatePhaseDuration(
  totalMatches: number,
  fields: number,
  setsPerMatch: number
): number {
  const matchDuration = calculateMatchDuration(setsPerMatch);
  const matchesInParallel = Math.ceil(totalMatches / fields);
  return matchesInParallel * matchDuration + MINUTES_SETUP_PER_PHASE;
}

/**
 * Formate une durée en minutes vers un format lisible (ex: "2h30" ou "45min")
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

/**
 * Trouve le diviseur le plus proche d'un nombre pour créer des poules équilibrées
 * Note: Fonction utilitaire non utilisée pour le moment mais conservée pour référence future
 */
/*
function findOptimalDivisor(total: number, preferred: number): number {
  // Essaie de trouver un diviseur proche de la valeur préférée
  for (let i = preferred; i >= 2; i--) {
    if (total % i === 0) return i;
  }
  // Si aucun diviseur parfait, retourne le plus grand diviseur possible
  for (let i = Math.floor(total / 2); i >= 2; i--) {
    if (total % i === 0) return i;
  }
  return total; // Cas extrême : une seule poule
}
*/

/**
 * Enrichit une phase avec les calculs de matchs et durée
 */
export function enrichPhaseWithTimings(phase: Partial<PhaseConfig>): PhaseConfig {
  const totalMatches = calculateTotalMatches(
    phase.numberOfPools!,
    phase.estimatedRounds!
  );

  const durationMinutes = calculatePhaseDuration(
    totalMatches,
    phase.fields!,
    phase.setsPerMatch!
  );

  return {
    ...phase,
    totalMatches,
    estimatedDurationMinutes: durationMinutes,
    estimatedDurationDisplay: formatDuration(durationMinutes),
  } as PhaseConfig;
}

/**
 * Enrichit une configuration complète avec les totaux
 */
function enrichConfigurationWithTotals(
  config: Omit<KingConfiguration, 'totalMatches' | 'estimatedTotalMinutes' | 'estimatedTotalDisplay'>
): KingConfiguration {
  const totalMatches = config.phases.reduce((sum, phase) => sum + phase.totalMatches, 0);
  const totalMinutes = config.phases.reduce((sum, phase) => sum + phase.estimatedDurationMinutes, 0);

  return {
    ...config,
    totalMatches,
    estimatedTotalMinutes: totalMinutes,
    estimatedTotalDisplay: formatDuration(totalMinutes),
  };
}

/**
 * Suggère des configurations optimales pour le mode King
 */
export function suggestKingConfigurations(
  totalPlayers: number,
  availableFields: number
): KingConfiguration[] {
  const configurations: KingConfiguration[] = [];

  // Validation de base
  if (totalPlayers < 6 || availableFields < 1) {
    return [];
  }

  // --- Configuration 1 : Progression classique 4v4 → 3v3 → 2v2 ---
  if (totalPlayers >= 24) {
    const config1 = generateClassicProgression(totalPlayers, availableFields);
    if (config1) configurations.push(config1);
  }

  // --- Configuration 2 : Progression 6v6 pour beaucoup de joueurs ---
  if (totalPlayers >= 48) {
    const config2 = generateBigProgression(totalPlayers, availableFields);
    if (config2) configurations.push(config2);
  }

  // --- Configuration 3 : Progression rapide 4v4 → 2v2 ---
  if (totalPlayers >= 16 && totalPlayers < 48) {
    const config3 = generateFastProgression(totalPlayers, availableFields);
    if (config3) configurations.push(config3);
  }

  // --- Configuration 4 : Configuration compacte (2 phases) ---
  if (totalPlayers >= 12 && totalPlayers < 32) {
    const config4 = generateCompactProgression(totalPlayers, availableFields);
    if (config4) configurations.push(config4);
  }

  return configurations;
}

/**
 * Progression classique : 4v4 → 3v3 → 2v2
 * Optimisée pour 24-60 joueurs
 */
function generateClassicProgression(
  totalPlayers: number,
  availableFields: number
): KingConfiguration | null {
  const phases: PhaseConfig[] = [];

  // Phase 1 : 4v4
  const phase1Teams = Math.floor(totalPlayers / 4);
  const phase1Pools = Math.min(availableFields, Math.max(2, Math.floor(phase1Teams / 8)));
  const phase1TeamsPerPool = Math.floor(phase1Teams / phase1Pools);
  const phase1QualifiedPerPool = Math.max(2, Math.floor(phase1TeamsPerPool / 3));
  const phase1Qualified = phase1QualifiedPerPool * phase1Pools;

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 1,
    gameMode: '4v4',
    playersPerTeam: 4,
    teamsPerPool: phase1TeamsPerPool,
    numberOfPools: phase1Pools,
    totalTeams: phase1Teams,
    qualifiedPerPool: phase1QualifiedPerPool,
    totalQualified: phase1Qualified,
    fields: Math.min(availableFields, phase1Pools),
    estimatedRounds: calculateKOBRounds(phase1TeamsPerPool),
    setsPerMatch: 1,
    pointsPerSet: 21,
    tieBreakEnabled: false,
  }));

  // Phase 2 : 3v3
  const phase2Teams = phase1Qualified;
  const phase2Pools = Math.min(availableFields, Math.max(2, Math.floor(phase2Teams / 4)));
  const phase2TeamsPerPool = Math.floor(phase2Teams / phase2Pools);
  const phase2QualifiedPerPool = Math.max(2, Math.floor(phase2TeamsPerPool / 2));
  const phase2Qualified = phase2QualifiedPerPool * phase2Pools;

  // Assurer que phase2Qualified est une puissance de 2 pour la phase finale
  let adjustedPhase2Qualified = phase2Qualified;
  if (![2, 4, 8, 16].includes(phase2Qualified)) {
    adjustedPhase2Qualified = [2, 4, 8, 16].find(n => n >= phase2Qualified && n <= phase2Teams) || 4;
  }

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 2,
    gameMode: '3v3',
    playersPerTeam: 3,
    teamsPerPool: phase2TeamsPerPool,
    numberOfPools: phase2Pools,
    totalTeams: phase2Teams,
    qualifiedPerPool: phase2QualifiedPerPool,
    totalQualified: adjustedPhase2Qualified,
    fields: Math.min(availableFields, phase2Pools),
    estimatedRounds: calculateKOBRounds(phase2TeamsPerPool),
    setsPerMatch: 2,
    pointsPerSet: 15,
    tieBreakEnabled: true,
  }));

  // Phase 3 : 2v2 (finale)
  const phase3Teams = adjustedPhase2Qualified;
  phases.push(enrichPhaseWithTimings({
    phaseNumber: 3,
    gameMode: '2v2',
    playersPerTeam: 2,
    teamsPerPool: phase3Teams,
    numberOfPools: 1,
    totalTeams: phase3Teams,
    qualifiedPerPool: 1,
    totalQualified: 1,
    fields: Math.min(availableFields, 2),
    estimatedRounds: calculateKOBRounds(phase3Teams),
    setsPerMatch: 3,
    pointsPerSet: 21,
    tieBreakEnabled: true,
  }));

  return enrichConfigurationWithTotals({
    totalPlayers,
    availableFields,
    phases,
    estimatedDuration: '2-3 jours',
    description: 'Progression classique (recommandée) : 4v4 → 3v3 → 2v2',
  });
}

/**
 * Progression pour beaucoup de joueurs : 6v6 → 4v4 → 2v2
 * Optimisée pour 48+ joueurs
 */
function generateBigProgression(
  totalPlayers: number,
  availableFields: number
): KingConfiguration | null {
  const phases: PhaseConfig[] = [];

  // Phase 1 : 6v6
  const phase1Teams = Math.floor(totalPlayers / 6);
  const phase1Pools = Math.min(availableFields, Math.max(2, Math.floor(phase1Teams / 10)));
  const phase1TeamsPerPool = Math.floor(phase1Teams / phase1Pools);
  const phase1QualifiedPerPool = Math.max(3, Math.floor(phase1TeamsPerPool / 3));
  const phase1Qualified = phase1QualifiedPerPool * phase1Pools;

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 1,
    gameMode: '6v6',
    playersPerTeam: 6,
    teamsPerPool: phase1TeamsPerPool,
    numberOfPools: phase1Pools,
    totalTeams: phase1Teams,
    qualifiedPerPool: phase1QualifiedPerPool,
    totalQualified: phase1Qualified,
    fields: Math.min(availableFields, phase1Pools),
    estimatedRounds: calculateKOBRounds(phase1TeamsPerPool),
    setsPerMatch: 1,
    pointsPerSet: 21,
    tieBreakEnabled: false,
  }));

  // Phase 2 : 4v4
  const phase2Teams = phase1Qualified;
  const phase2Pools = Math.min(availableFields, Math.max(2, Math.floor(phase2Teams / 4)));
  const phase2TeamsPerPool = Math.floor(phase2Teams / phase2Pools);
  const phase2QualifiedPerPool = Math.max(2, Math.floor(phase2TeamsPerPool / 2));
  const phase2Qualified = phase2QualifiedPerPool * phase2Pools;

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 2,
    gameMode: '4v4',
    playersPerTeam: 4,
    teamsPerPool: phase2TeamsPerPool,
    numberOfPools: phase2Pools,
    totalTeams: phase2Teams,
    qualifiedPerPool: phase2QualifiedPerPool,
    totalQualified: phase2Qualified,
    fields: Math.min(availableFields, phase2Pools),
    estimatedRounds: calculateKOBRounds(phase2TeamsPerPool),
    setsPerMatch: 2,
    pointsPerSet: 21,
    tieBreakEnabled: true,
  }));

  // Phase 3 : 2v2 (finale)
  phases.push(enrichPhaseWithTimings({
    phaseNumber: 3,
    gameMode: '2v2',
    playersPerTeam: 2,
    teamsPerPool: phase2Qualified,
    numberOfPools: 1,
    totalTeams: phase2Qualified,
    qualifiedPerPool: 1,
    totalQualified: 1,
    fields: Math.min(availableFields, 2),
    estimatedRounds: calculateKOBRounds(phase2Qualified),
    setsPerMatch: 3,
    pointsPerSet: 21,
    tieBreakEnabled: true,
  }));

  return enrichConfigurationWithTotals({
    totalPlayers,
    availableFields,
    phases,
    estimatedDuration: '3-4 jours',
    description: 'Progression pour grand tournoi : 6v6 → 4v4 → 2v2',
  });
}

/**
 * Progression rapide : 4v4 → 2v2
 * Optimisée pour 16-48 joueurs
 */
function generateFastProgression(
  totalPlayers: number,
  availableFields: number
): KingConfiguration | null {
  const phases: PhaseConfig[] = [];

  // Phase 1 : 4v4
  const phase1Teams = Math.floor(totalPlayers / 4);
  const phase1Pools = Math.min(availableFields, Math.max(2, Math.floor(phase1Teams / 6)));
  const phase1TeamsPerPool = Math.floor(phase1Teams / phase1Pools);
  const phase1QualifiedPerPool = Math.max(2, Math.floor(phase1TeamsPerPool / 2));
  const phase1Qualified = phase1QualifiedPerPool * phase1Pools;

  // Assurer que c'est une puissance de 2
  let adjustedPhase1Qualified = phase1Qualified;
  if (![4, 8, 16].includes(phase1Qualified)) {
    adjustedPhase1Qualified = [4, 8, 16].find(n => n >= phase1Qualified && n <= phase1Teams) || 8;
  }

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 1,
    gameMode: '4v4',
    playersPerTeam: 4,
    teamsPerPool: phase1TeamsPerPool,
    numberOfPools: phase1Pools,
    totalTeams: phase1Teams,
    qualifiedPerPool: phase1QualifiedPerPool,
    totalQualified: adjustedPhase1Qualified,
    fields: Math.min(availableFields, phase1Pools),
    estimatedRounds: calculateKOBRounds(phase1TeamsPerPool),
    setsPerMatch: 1,
    pointsPerSet: 21,
    tieBreakEnabled: false,
  }));

  // Phase 2 : 2v2 (finale)
  phases.push(enrichPhaseWithTimings({
    phaseNumber: 2,
    gameMode: '2v2',
    playersPerTeam: 2,
    teamsPerPool: adjustedPhase1Qualified,
    numberOfPools: 1,
    totalTeams: adjustedPhase1Qualified,
    qualifiedPerPool: 1,
    totalQualified: 1,
    fields: Math.min(availableFields, 2),
    estimatedRounds: calculateKOBRounds(adjustedPhase1Qualified),
    setsPerMatch: 3,
    pointsPerSet: 21,
    tieBreakEnabled: true,
  }));

  return enrichConfigurationWithTotals({
    totalPlayers,
    availableFields,
    phases,
    estimatedDuration: '1-2 jours',
    description: 'Progression rapide (2 phases) : 4v4 → 2v2',
  });
}

/**
 * Progression compacte : 3v3 → 2v2
 * Optimisée pour 12-32 joueurs
 */
function generateCompactProgression(
  totalPlayers: number,
  availableFields: number
): KingConfiguration | null {
  const phases: PhaseConfig[] = [];

  // Phase 1 : 3v3
  const phase1Teams = Math.floor(totalPlayers / 3);
  const phase1Pools = Math.min(availableFields, Math.max(2, Math.floor(phase1Teams / 4)));
  const phase1TeamsPerPool = Math.floor(phase1Teams / phase1Pools);
  const phase1QualifiedPerPool = Math.max(2, Math.floor(phase1TeamsPerPool / 2));
  const phase1Qualified = phase1QualifiedPerPool * phase1Pools;

  // Assurer que c'est une puissance de 2
  let adjustedPhase1Qualified = phase1Qualified;
  if (![4, 8].includes(phase1Qualified)) {
    adjustedPhase1Qualified = [4, 8].find(n => n >= phase1Qualified && n <= phase1Teams) || 4;
  }

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 1,
    gameMode: '3v3',
    playersPerTeam: 3,
    teamsPerPool: phase1TeamsPerPool,
    numberOfPools: phase1Pools,
    totalTeams: phase1Teams,
    qualifiedPerPool: phase1QualifiedPerPool,
    totalQualified: adjustedPhase1Qualified,
    fields: Math.min(availableFields, phase1Pools),
    estimatedRounds: calculateKOBRounds(phase1TeamsPerPool),
    setsPerMatch: 2,
    pointsPerSet: 15,
    tieBreakEnabled: false,
  }));

  // Phase 2 : 2v2 (finale)
  phases.push(enrichPhaseWithTimings({
    phaseNumber: 2,
    gameMode: '2v2',
    playersPerTeam: 2,
    teamsPerPool: adjustedPhase1Qualified,
    numberOfPools: 1,
    totalTeams: adjustedPhase1Qualified,
    qualifiedPerPool: 1,
    totalQualified: 1,
    fields: Math.min(availableFields, 2),
    estimatedRounds: calculateKOBRounds(adjustedPhase1Qualified),
    setsPerMatch: 3,
    pointsPerSet: 21,
    tieBreakEnabled: true,
  }));

  return enrichConfigurationWithTotals({
    totalPlayers,
    availableFields,
    phases,
    estimatedDuration: '1-2 jours',
    description: 'Configuration compacte : 3v3 → 2v2',
  });
}

/**
 * Valide une configuration King personnalisée
 */
export function validateKingConfiguration(config: KingConfiguration): string[] {
  const errors: string[] = [];

  if (config.phases.length < 2) {
    errors.push('Un tournoi King doit avoir au moins 2 phases');
  }

  for (let i = 0; i < config.phases.length; i++) {
    const phase = config.phases[i];

    // Vérifier que les joueurs peuvent former des équipes
    const totalPlayersInPhase = phase.totalTeams * phase.playersPerTeam;
    if (i === 0 && totalPlayersInPhase > config.totalPlayers) {
      errors.push(`Phase ${i + 1}: Pas assez de joueurs (besoin de ${totalPlayersInPhase}, disponible: ${config.totalPlayers})`);
    }

    // Vérifier cohérence des qualifiés
    if (phase.totalQualified > phase.totalTeams) {
      errors.push(`Phase ${i + 1}: Plus de qualifiés que d'équipes`);
    }

    // Vérifier la phase suivante
    if (i < config.phases.length - 1) {
      const nextPhase = config.phases[i + 1];
      if (phase.totalQualified !== nextPhase.totalTeams) {
        errors.push(`Incohérence entre phase ${i + 1} et ${i + 2}: ${phase.totalQualified} qualifiés mais ${nextPhase.totalTeams} équipes attendues`);
      }
    }

    // La dernière phase doit avoir 1 seul qualifié
    if (i === config.phases.length - 1 && phase.totalQualified !== 1) {
      errors.push('La dernière phase doit avoir exactement 1 qualifié (le KING)');
    }
  }

  return errors;
}
