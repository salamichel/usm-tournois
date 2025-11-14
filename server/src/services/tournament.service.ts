import type { Tournament, TournamentFormat, TournamentType } from '@shared/types';

/**
 * Interface for tournament form data from request body
 */
interface TournamentFormData {
  name: string;
  description: string;
  whatsappGroupLink?: string;
  date: string;
  time?: string;
  maxTeams: string | number;
  playersPerTeam: string | number;
  minPlayersPerTeam: string | number;
  location: string;
  type: TournamentType;
  fields: string | number;
  fee: string | number;
  mixity: 'male' | 'female' | 'mixed';
  requiresFemalePlayer?: string | boolean;
  registrationsOpen?: string | boolean;
  registrationStartDate: string;
  registrationStartTime?: string;
  registrationEndDate: string;
  registrationEndTime?: string;
  isActive?: string | boolean;
  waitingListSize: string | number;
  setsPerMatchPool: string | number;
  pointsPerSetPool: string | number;
  maxTeamsPerPool: string | number;
  teamsQualifiedPerPool: string | number;
  eliminationPhaseEnabled?: string | boolean;
  setsPerMatchElimination?: string | number;
  pointsPerSetElimination?: string | number;
  tieBreakEnabledPools?: string | boolean;
  tieBreakEnabledElimination?: string | boolean;
  matchFormat?: 'aller' | 'aller-retour';
  tournamentFormat?: TournamentFormat;
}

/**
 * Validates and creates a Date object from a date string
 * @param dateString The date string to validate
 * @returns A valid Date object or null if invalid
 */
function createValidDate(dateString: string): Date | null {
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Builds a tournament object from request body data and uploaded file.
 * Handles parsing of dates, numbers, booleans, and cover image.
 * @param body The request body (req.body)
 * @param file The uploaded file (req.file), can be null
 * @param isNew Indicates if this is a new tournament (for createdAt/updatedAt)
 * @returns The tournament object ready to be saved
 */
export function buildTournamentObject(
  body: TournamentFormData,
  file?: Express.Multer.File | null,
  isNew: boolean = true
): Partial<Tournament> {
  const {
    name,
    description,
    whatsappGroupLink,
    date,
    time,
    maxTeams,
    playersPerTeam,
    minPlayersPerTeam,
    location,
    type,
    fields,
    fee,
    mixity,
    requiresFemalePlayer,
    registrationsOpen,
    registrationStartDate,
    registrationStartTime,
    registrationEndDate,
    registrationEndTime,
    isActive,
    waitingListSize,
    setsPerMatchPool,
    pointsPerSetPool,
    maxTeamsPerPool,
    teamsQualifiedPerPool,
    eliminationPhaseEnabled,
    setsPerMatchElimination,
    pointsPerSetElimination,
    tieBreakEnabledPools,
    tieBreakEnabledElimination,
    matchFormat,
    tournamentFormat,
  } = body;

  const dateTimeString = `${date}T${time || '00:00'}`;
  const registrationStartDateTimeString = `${registrationStartDate}T${registrationStartTime || '00:00'}`;
  const registrationEndDateTimeString = `${registrationEndDate}T${registrationEndTime || '23:59'}`;

  const parsedWaitingListSize = parseInt(String(waitingListSize)) || 0;
  const isEliminationPhaseEnabled = eliminationPhaseEnabled === 'on' || eliminationPhaseEnabled === true;
  const isTieBreakEnabledPools = tieBreakEnabledPools === 'on' || tieBreakEnabledPools === true;
  const isTieBreakEnabledElimination = tieBreakEnabledElimination === 'on' || tieBreakEnabledElimination === true;

  const tournament: Partial<Tournament> = {
    name,
    description,
    whatsappGroupLink: whatsappGroupLink || null,
    date: createValidDate(dateTimeString),
    registrationStartDateTime: createValidDate(registrationStartDateTimeString),
    registrationEndDateTime: createValidDate(registrationEndDateTimeString),
    maxTeams: parseInt(String(maxTeams)),
    playersPerTeam: parseInt(String(playersPerTeam)),
    minPlayersPerTeam: parseInt(String(minPlayersPerTeam)),
    location,
    type,
    fields: parseInt(String(fields)) || 0,
    fee: parseFloat(String(fee)) || 0,
    mixity,
    requiresFemalePlayer: requiresFemalePlayer === 'on' || requiresFemalePlayer === true,
    registrationsOpen: registrationsOpen === 'on' || registrationsOpen === true,
    isActive: isActive === 'on' || isActive === true,
    waitingListEnabled: parsedWaitingListSize > 0,
    waitingListSize: parsedWaitingListSize,

    setsPerMatchPool: parseInt(String(setsPerMatchPool)) || 1,
    pointsPerSetPool: parseInt(String(pointsPerSetPool)) || 21,
    maxTeamsPerPool: parseInt(String(maxTeamsPerPool)) || 4,
    teamsQualifiedPerPool: parseInt(String(teamsQualifiedPerPool)) || 2,
    eliminationPhaseEnabled: isEliminationPhaseEnabled,
    setsPerMatchElimination: isEliminationPhaseEnabled
      ? parseInt(String(setsPerMatchElimination)) || 3
      : null,
    pointsPerSetElimination: isEliminationPhaseEnabled
      ? parseInt(String(pointsPerSetElimination)) || 21
      : null,
    tieBreakEnabledPools: isTieBreakEnabledPools,
    tieBreakEnabledElimination: isTieBreakEnabledElimination,
    matchFormat: matchFormat || 'aller',
    tournamentFormat: tournamentFormat || 'standard',
  };

  if (file) {
    tournament.coverImage = `/uploads/${file.filename}`;
  }

  if (isNew) {
    tournament.createdAt = new Date();
  }
  tournament.updatedAt = new Date();

  return tournament;
}

/**
 * Calculates the guaranteed number of matches for a given tournament.
 * @param tournament The tournament object with all its configurations
 * @returns The total number of guaranteed matches
 */
export function calculateGuaranteedMatches(tournament: Partial<Tournament>): number {
  let totalMatches = 0;

  // Calculate pool phase matches
  if (
    tournament.maxTeams &&
    tournament.maxTeams > 0 &&
    tournament.maxTeamsPerPool &&
    tournament.maxTeamsPerPool > 0
  ) {
    const numberOfPools = Math.ceil(tournament.maxTeams / tournament.maxTeamsPerPool);
    const teamsPerPool = tournament.maxTeamsPerPool;

    // Calculate matches per pool ("aller" format: each team plays once against all others)
    // Formula: n * (n - 1) / 2 where n is the number of teams in the pool
    const matchesPerPool = (teamsPerPool * (teamsPerPool - 1)) / 2;
    totalMatches += numberOfPools * matchesPerPool;
  }

  // Calculate elimination phase matches (if enabled)
  if (
    tournament.eliminationPhaseEnabled &&
    tournament.teamsQualifiedPerPool &&
    tournament.teamsQualifiedPerPool > 0 &&
    tournament.maxTeams &&
    tournament.maxTeamsPerPool
  ) {
    const numberOfPools = Math.ceil(tournament.maxTeams / tournament.maxTeamsPerPool);
    const qualifiedTeamsForElimination = numberOfPools * tournament.teamsQualifiedPerPool;

    // For single-elimination tournament, number of matches is (number of teams - 1)
    if (qualifiedTeamsForElimination > 1) {
      totalMatches += qualifiedTeamsForElimination - 1;
    }
  }

  return totalMatches;
}
