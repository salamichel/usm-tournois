/**
 * Algorithme de suggestion de configurations optimales pour le mode King
 * Supporte des configurations flexibles multi-jours avec différents modes de jeu
 */

export type GameMode = '6v6' | '5v5' | '4v4' | '3v3' | '2v2' | '1v1';

export type PhaseFormat = 'round-robin' | 'kob';

export interface PhaseConfig {
  phaseNumber: number;
  gameMode: GameMode;
  phaseFormat: PhaseFormat; // Format de la phase (Round Robin ou KOB)
  playersPerTeam: number;
  teamsPerPool: number; // Moyenne d'équipes par poule (pour compatibilité)
  numberOfPools: number;
  totalTeams: number;
  qualifiedPerPool: number; // JOUEURS qualifiés par poule (moyenne, pour compatibilité)
  totalQualified: number; // TOTAL de JOUEURS qualifiés pour la phase suivante
  fields: number; // nombre de terrains utilisés
  estimatedRounds: number; // nombre de rounds KOB nécessaires
  totalMatches: number; // nombre total de matchs dans la phase
  // Support des poules déséquilibrées (optionnel)
  poolDistribution?: number[]; // ex: [3, 3, 4] = 3 poules avec 3, 3 et 4 équipes
  qualifiedPerPoolDistribution?: number[]; // ex: [4, 4, 4] = 4 JOUEURS qualifiés par poule
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
 * Contraintes pour les poules
 */
export const MIN_TEAMS_PER_POOL = 2; // Minimum 2 équipes par poule
export const MAX_TEAMS_PER_POOL = 8; // Maximum 8 équipes par poule
export const MIN_POOLS = 1; // Minimum 1 poule (finale)

/**
 * Répartit un nombre d'équipes en poules de manière équilibrée
 * Exemple: 10 équipes en 3 poules → [4, 3, 3] (la plus équilibrée possible)
 */
export function distributeTeamsInPools(totalTeams: number, numberOfPools: number): number[] {
  if (numberOfPools <= 0 || totalTeams < numberOfPools) {
    throw new Error('Nombre de poules invalide');
  }

  const baseTeamsPerPool = Math.floor(totalTeams / numberOfPools);
  const remainder = totalTeams % numberOfPools;

  const distribution: number[] = [];

  // Distribue les équipes en commençant par les poules avec un peu plus d'équipes
  for (let i = 0; i < numberOfPools; i++) {
    if (i < remainder) {
      distribution.push(baseTeamsPerPool + 1);
    } else {
      distribution.push(baseTeamsPerPool);
    }
  }

  return distribution;
}

/**
 * Valide si une répartition de poules respecte les contraintes
 */
export function validatePoolDistribution(distribution: number[]): { valid: boolean; error?: string } {
  if (distribution.length === 0) {
    return { valid: false, error: 'Aucune poule définie' };
  }

  for (let i = 0; i < distribution.length; i++) {
    const teams = distribution[i];
    if (teams < MIN_TEAMS_PER_POOL) {
      return { valid: false, error: `Poule ${i + 1} a ${teams} équipes (min: ${MIN_TEAMS_PER_POOL})` };
    }
    if (teams > MAX_TEAMS_PER_POOL) {
      return { valid: false, error: `Poule ${i + 1} a ${teams} équipes (max: ${MAX_TEAMS_PER_POOL})` };
    }
  }

  return { valid: true };
}

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
 * Supporte à la fois les poules équilibrées (legacy) et déséquilibrées (via distribution)
 */
function calculateTotalMatches(
  phaseFormat: PhaseFormat,
  teamsPerPool: number,
  numberOfPools: number,
  estimatedRounds: number,
  poolDistribution?: number[]
): number {
  // Si une distribution est fournie, l'utiliser pour un calcul précis
  if (poolDistribution && poolDistribution.length > 0) {
    let totalMatches = 0;

    for (const teamsInPool of poolDistribution) {
      if (phaseFormat === 'round-robin') {
        // Round Robin : C(N,2) matchs par round
        const matchesPerRound = (teamsInPool * (teamsInPool - 1)) / 2;
        totalMatches += matchesPerRound * estimatedRounds;
      } else {
        // KOB : floor(N/2) matchs par round
        const matchesPerRound = Math.floor(teamsInPool / 2);
        totalMatches += matchesPerRound * estimatedRounds;
      }
    }

    return totalMatches;
  }

  // Sinon, utiliser le calcul legacy (toutes les poules ont le même nombre d'équipes)
  if (phaseFormat === 'round-robin') {
    // Round Robin : chaque round génère C(N,2) matchs
    // où C(N,2) = N×(N-1)/2 (combinaisons de 2 équipes parmi N)
    const matchesPerRoundPerPool = (teamsPerPool * (teamsPerPool - 1)) / 2;
    return matchesPerRoundPerPool * estimatedRounds * numberOfPools;
  } else {
    // KOB : chaque round génère floor(N/2) matchs par poule
    // (les équipes se regroupent en paires, ex: 4 équipes → 2 matchs)
    const matchesPerRoundPerPool = Math.floor(teamsPerPool / 2);
    return matchesPerRoundPerPool * estimatedRounds * numberOfPools;
  }
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
    phase.phaseFormat!,
    phase.teamsPerPool!,
    phase.numberOfPools!,
    phase.estimatedRounds!,
    phase.poolDistribution // Support des poules déséquilibrées
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
 * Recalcule une phase avec un nombre de poules personnalisé
 * Retourne une nouvelle phase avec la distribution mise à jour
 */
export function customizePhaseWithPools(
  phase: PhaseConfig,
  numberOfPools: number
): PhaseConfig {
  // Valider le nombre de poules
  if (numberOfPools < MIN_POOLS) {
    throw new Error(`Le nombre de poules doit être au moins ${MIN_POOLS}`);
  }

  if (numberOfPools > phase.totalTeams) {
    throw new Error(`Le nombre de poules (${numberOfPools}) ne peut pas dépasser le nombre d'équipes (${phase.totalTeams})`);
  }

  // Calculer la distribution des équipes
  const poolDistribution = distributeTeamsInPools(phase.totalTeams, numberOfPools);

  // Valider la distribution
  const validation = validatePoolDistribution(poolDistribution);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Calculer les JOUEURS qualifiés par poule (proportionnel)
  // totalQualified = nombre de JOUEURS à qualifier au total
  const totalQualifiedPlayers = phase.totalQualified;
  const qualifiedPerPoolDistribution: number[] = [];
  let remainingQualified = totalQualifiedPlayers;

  for (let i = 0; i < poolDistribution.length; i++) {
    const teamsInPool = poolDistribution[i];
    const playersInPool = teamsInPool * phase.playersPerTeam;
    const poolsLeft = poolDistribution.length - i;

    // Répartir proportionnellement
    const qualifiedInPool = Math.floor(remainingQualified / poolsLeft);

    // Ne pas qualifier plus que le nombre de joueurs dans la poule - playersPerTeam
    // (il faut au moins une équipe non qualifiée)
    const maxQualifiedInPool = playersInPool - phase.playersPerTeam;
    const finalQualified = Math.min(qualifiedInPool, maxQualifiedInPool);

    qualifiedPerPoolDistribution.push(finalQualified);
    remainingQualified -= finalQualified;
  }

  // Si des qualifiés restants, les ajouter aux premières poules
  let i = 0;
  while (remainingQualified > 0 && i < qualifiedPerPoolDistribution.length) {
    const teamsInPool = poolDistribution[i];
    const playersInPool = teamsInPool * phase.playersPerTeam;
    const maxQualifiedInPool = playersInPool - phase.playersPerTeam;

    if (qualifiedPerPoolDistribution[i] < maxQualifiedInPool) {
      qualifiedPerPoolDistribution[i]++;
      remainingQualified--;
    }
    i++;
  }

  // Recalculer avec la nouvelle distribution
  const newPhase: Partial<PhaseConfig> = {
    ...phase,
    numberOfPools,
    poolDistribution,
    qualifiedPerPoolDistribution,
    teamsPerPool: Math.floor(phase.totalTeams / numberOfPools), // Moyenne
    qualifiedPerPool: Math.floor(totalQualifiedPlayers / numberOfPools), // Moyenne JOUEURS
  };

  return enrichPhaseWithTimings(newPhase);
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
  const phase1QualifiedPlayersPerPool = Math.max(4, Math.floor(phase1TeamsPerPool * 4 / 3)); // JOUEURS qualifiés par poule
  const phase1QualifiedPlayers = phase1QualifiedPlayersPerPool * phase1Pools; // Total JOUEURS qualifiés

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 1,
    gameMode: '4v4',
    phaseFormat: 'round-robin', // Phase 1 utilise Round Robin
    playersPerTeam: 4,
    teamsPerPool: phase1TeamsPerPool,
    numberOfPools: phase1Pools,
    totalTeams: phase1Teams,
    qualifiedPerPool: phase1QualifiedPlayersPerPool, // JOUEURS
    totalQualified: phase1QualifiedPlayers, // JOUEURS
    fields: Math.min(availableFields, phase1Pools),
    estimatedRounds: 3, // Phase 1: toujours 3 rounds en Round Robin
    setsPerMatch: 1,
    pointsPerSet: 21,
    tieBreakEnabled: false,
  }));

  // Phase 2 : 3v3
  const phase2Players = phase1QualifiedPlayers; // JOUEURS de la phase 1
  const phase2Teams = Math.floor(phase2Players / 3); // Convertir en équipes de 3
  const phase2Pools = Math.min(availableFields, Math.max(2, Math.floor(phase2Teams / 4)));
  const phase2TeamsPerPool = Math.floor(phase2Teams / phase2Pools);
  const phase2QualifiedPlayersPerPool = Math.max(3, Math.floor(phase2TeamsPerPool * 3 / 2)); // JOUEURS qualifiés par poule
  const phase2QualifiedPlayers = phase2QualifiedPlayersPerPool * phase2Pools; // Total JOUEURS

  // Assurer que phase2QualifiedPlayers permet de former des équipes de 2 (nombre pair)
  let adjustedPhase2QualifiedPlayers = phase2QualifiedPlayers;
  if (phase2QualifiedPlayers % 2 !== 0) {
    adjustedPhase2QualifiedPlayers = phase2QualifiedPlayers - 1; // Arrondir au nombre pair inférieur
  }
  // Et vérifier que ça donne une puissance de 2 en équipes
  const phase3Teams = Math.floor(adjustedPhase2QualifiedPlayers / 2);
  if (![2, 4, 8, 16].includes(phase3Teams)) {
    const targetTeams = [2, 4, 8, 16].find(n => n >= phase3Teams && n <= phase2Teams) || 4;
    adjustedPhase2QualifiedPlayers = targetTeams * 2; // Convertir en joueurs
  }

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 2,
    gameMode: '3v3',
    phaseFormat: 'kob', // Phase 2 utilise KOB
    playersPerTeam: 3,
    teamsPerPool: phase2TeamsPerPool,
    numberOfPools: phase2Pools,
    totalTeams: phase2Teams,
    qualifiedPerPool: phase2QualifiedPlayersPerPool, // JOUEURS
    totalQualified: adjustedPhase2QualifiedPlayers, // JOUEURS
    fields: Math.min(availableFields, phase2Pools),
    estimatedRounds: calculateKOBRounds(phase2TeamsPerPool),
    setsPerMatch: 2,
    pointsPerSet: 15,
    tieBreakEnabled: true,
  }));

  // Phase 3 : 2v2 (finale)
  const phase3Players = adjustedPhase2QualifiedPlayers; // JOUEURS de la phase 2
  const phase3Teams = Math.floor(phase3Players / 2); // Convertir en équipes de 2
  phases.push(enrichPhaseWithTimings({
    phaseNumber: 3,
    gameMode: '2v2',
    phaseFormat: 'kob', // Phase 3 utilise KOB
    playersPerTeam: 2,
    teamsPerPool: phase3Teams,
    numberOfPools: 1,
    totalTeams: phase3Teams,
    qualifiedPerPool: 2, // 2 JOUEURS (l'équipe gagnante)
    totalQualified: 2, // 2 JOUEURS (le KING et son partenaire)
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
  const phase1QualifiedPlayersPerPool = Math.max(6, Math.floor(phase1TeamsPerPool * 6 / 3)); // JOUEURS qualifiés par poule
  const phase1QualifiedPlayers = phase1QualifiedPlayersPerPool * phase1Pools; // Total JOUEURS

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 1,
    gameMode: '6v6',
    phaseFormat: 'round-robin', // Phase 1 utilise Round Robin
    playersPerTeam: 6,
    teamsPerPool: phase1TeamsPerPool,
    numberOfPools: phase1Pools,
    totalTeams: phase1Teams,
    qualifiedPerPool: phase1QualifiedPlayersPerPool, // JOUEURS
    totalQualified: phase1QualifiedPlayers, // JOUEURS
    fields: Math.min(availableFields, phase1Pools),
    estimatedRounds: 3, // Phase 1: toujours 3 rounds en Round Robin
    setsPerMatch: 1,
    pointsPerSet: 21,
    tieBreakEnabled: false,
  }));

  // Phase 2 : 4v4
  const phase2Players = phase1QualifiedPlayers; // JOUEURS de la phase 1
  const phase2Teams = Math.floor(phase2Players / 4); // Convertir en équipes de 4
  const phase2Pools = Math.min(availableFields, Math.max(2, Math.floor(phase2Teams / 4)));
  const phase2TeamsPerPool = Math.floor(phase2Teams / phase2Pools);
  const phase2QualifiedPlayersPerPool = Math.max(4, Math.floor(phase2TeamsPerPool * 4 / 2)); // JOUEURS qualifiés par poule
  const phase2QualifiedPlayers = phase2QualifiedPlayersPerPool * phase2Pools; // Total JOUEURS
  // Arrondir pour phase 2v2 (nombre pair)
  const adjustedPhase2QualifiedPlayers = phase2QualifiedPlayers % 2 === 0 ? phase2QualifiedPlayers : phase2QualifiedPlayers - 1;

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 2,
    gameMode: '4v4',
    phaseFormat: 'kob', // Phase 2 utilise KOB
    playersPerTeam: 4,
    teamsPerPool: phase2TeamsPerPool,
    numberOfPools: phase2Pools,
    totalTeams: phase2Teams,
    qualifiedPerPool: phase2QualifiedPlayersPerPool, // JOUEURS
    totalQualified: adjustedPhase2QualifiedPlayers, // JOUEURS
    fields: Math.min(availableFields, phase2Pools),
    estimatedRounds: calculateKOBRounds(phase2TeamsPerPool),
    setsPerMatch: 2,
    pointsPerSet: 21,
    tieBreakEnabled: true,
  }));

  // Phase 3 : 2v2 (finale)
  const phase3Players = adjustedPhase2QualifiedPlayers; // JOUEURS de la phase 2
  const phase3Teams = Math.floor(phase3Players / 2); // Convertir en équipes de 2
  phases.push(enrichPhaseWithTimings({
    phaseNumber: 3,
    gameMode: '2v2',
    phaseFormat: 'kob', // Phase 3 utilise KOB
    playersPerTeam: 2,
    teamsPerPool: phase3Teams,
    numberOfPools: 1,
    totalTeams: phase3Teams,
    qualifiedPerPool: 2, // 2 JOUEURS (l'équipe gagnante)
    totalQualified: 2, // 2 JOUEURS (le KING et son partenaire)
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
  const phase1QualifiedPlayersPerPool = Math.max(4, Math.floor(phase1TeamsPerPool * 4 / 2)); // JOUEURS qualifiés par poule
  const phase1QualifiedPlayers = phase1QualifiedPlayersPerPool * phase1Pools; // Total JOUEURS

  // Assurer que phase1QualifiedPlayers permet de former des équipes de 2 (multiple de 2)
  // et que ça donne une puissance de 2 en nombre d'équipes
  let adjustedPhase1QualifiedPlayers = phase1QualifiedPlayers;
  if (adjustedPhase1QualifiedPlayers % 2 !== 0) {
    adjustedPhase1QualifiedPlayers -= 1;
  }
  const phase2Teams = Math.floor(adjustedPhase1QualifiedPlayers / 2);
  if (![4, 8, 16].includes(phase2Teams)) {
    const targetTeams = [4, 8, 16].find(n => n >= phase2Teams && n <= phase1Teams) || 8;
    adjustedPhase1QualifiedPlayers = targetTeams * 2; // Convertir en joueurs
  }

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 1,
    gameMode: '4v4',
    phaseFormat: 'round-robin', // Phase 1 utilise Round Robin
    playersPerTeam: 4,
    teamsPerPool: phase1TeamsPerPool,
    numberOfPools: phase1Pools,
    totalTeams: phase1Teams,
    qualifiedPerPool: phase1QualifiedPlayersPerPool, // JOUEURS
    totalQualified: adjustedPhase1QualifiedPlayers, // JOUEURS
    fields: Math.min(availableFields, phase1Pools),
    estimatedRounds: 3, // Phase 1: toujours 3 rounds en Round Robin
    setsPerMatch: 1,
    pointsPerSet: 21,
    tieBreakEnabled: false,
  }));

  // Phase 2 : 2v2 (finale)
  const phase2Players = adjustedPhase1QualifiedPlayers; // JOUEURS de la phase 1
  const phase2FinalTeams = Math.floor(phase2Players / 2); // Convertir en équipes de 2
  phases.push(enrichPhaseWithTimings({
    phaseNumber: 2,
    gameMode: '2v2',
    phaseFormat: 'kob', // Phase 2 utilise KOB
    playersPerTeam: 2,
    teamsPerPool: phase2FinalTeams,
    numberOfPools: 1,
    totalTeams: phase2FinalTeams,
    qualifiedPerPool: 2, // 2 JOUEURS (l'équipe gagnante)
    totalQualified: 2, // 2 JOUEURS (le KING et son partenaire)
    fields: Math.min(availableFields, 2),
    estimatedRounds: calculateKOBRounds(phase2FinalTeams),
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
  const phase1QualifiedPlayersPerPool = Math.max(3, Math.floor(phase1TeamsPerPool * 3 / 2)); // JOUEURS qualifiés par poule
  const phase1QualifiedPlayers = phase1QualifiedPlayersPerPool * phase1Pools; // Total JOUEURS

  // Assurer que phase1QualifiedPlayers permet de former des équipes de 2 (multiple de 2)
  // et que ça donne une puissance de 2 en nombre d'équipes
  let adjustedPhase1QualifiedPlayers = phase1QualifiedPlayers;
  if (adjustedPhase1QualifiedPlayers % 2 !== 0) {
    adjustedPhase1QualifiedPlayers -= 1;
  }
  const phase2Teams = Math.floor(adjustedPhase1QualifiedPlayers / 2);
  if (![4, 8].includes(phase2Teams)) {
    const targetTeams = [4, 8].find(n => n >= phase2Teams && n <= phase1Teams) || 4;
    adjustedPhase1QualifiedPlayers = targetTeams * 2; // Convertir en joueurs
  }

  phases.push(enrichPhaseWithTimings({
    phaseNumber: 1,
    gameMode: '3v3',
    phaseFormat: 'round-robin', // Phase 1 utilise Round Robin
    playersPerTeam: 3,
    teamsPerPool: phase1TeamsPerPool,
    numberOfPools: phase1Pools,
    totalTeams: phase1Teams,
    qualifiedPerPool: phase1QualifiedPlayersPerPool, // JOUEURS
    totalQualified: adjustedPhase1QualifiedPlayers, // JOUEURS
    fields: Math.min(availableFields, phase1Pools),
    estimatedRounds: 3, // Phase 1: toujours 3 rounds en Round Robin
    setsPerMatch: 2,
    pointsPerSet: 15,
    tieBreakEnabled: false,
  }));

  // Phase 2 : 2v2 (finale)
  const phase2Players = adjustedPhase1QualifiedPlayers; // JOUEURS de la phase 1
  const phase2FinalTeams = Math.floor(phase2Players / 2); // Convertir en équipes de 2
  phases.push(enrichPhaseWithTimings({
    phaseNumber: 2,
    gameMode: '2v2',
    phaseFormat: 'kob', // Phase 2 utilise KOB
    playersPerTeam: 2,
    teamsPerPool: phase2FinalTeams,
    numberOfPools: 1,
    totalTeams: phase2FinalTeams,
    qualifiedPerPool: 2, // 2 JOUEURS (l'équipe gagnante)
    totalQualified: 2, // 2 JOUEURS (le KING et son partenaire)
    fields: Math.min(availableFields, 2),
    estimatedRounds: calculateKOBRounds(phase2FinalTeams),
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

    // Vérifier cohérence des qualifiés (totalQualified = JOUEURS)
    if (phase.totalQualified > totalPlayersInPhase) {
      errors.push(`Phase ${i + 1}: Plus de qualifiés (${phase.totalQualified} joueurs) que de joueurs dans la phase (${totalPlayersInPhase})`);
    }

    // Vérifier la phase suivante
    if (i < config.phases.length - 1) {
      const nextPhase = config.phases[i + 1];
      const nextPhaseExpectedPlayers = nextPhase.totalTeams * nextPhase.playersPerTeam;
      if (phase.totalQualified !== nextPhaseExpectedPlayers) {
        errors.push(
          `Incohérence entre phase ${i + 1} et ${i + 2}: ` +
          `${phase.totalQualified} joueurs qualifiés mais ${nextPhaseExpectedPlayers} joueurs nécessaires ` +
          `pour former ${nextPhase.totalTeams} équipes de ${nextPhase.playersPerTeam}`
        );
      }
    }

    // La dernière phase doit avoir 2 qualifiés (le KING et son partenaire)
    if (i === config.phases.length - 1 && phase.totalQualified !== 2) {
      errors.push('La dernière phase doit avoir exactement 2 qualifiés (le KING et son partenaire)');
    }
  }

  return errors;
}
