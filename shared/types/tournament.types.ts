/**
 * Tournament-related TypeScript types
 * Shared between client and server
 */

export type TournamentStatus = 'Ouvert' | 'Complet' | 'Liste d\'attente' | 'Terminé';

export type TournamentType = 'Beach Volleyball' | 'Indoor Volleyball' | 'Mixed';

export type TournamentFormat = 'standard' | 'king';

export type RegistrationMode = 'teams' | 'random';

export type MixityType = 'Mixed' | 'Male Only' | 'Female Only';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  date: Date;
  location: string;
  type: TournamentType;
  fields: number;
  fee: number;
  mixity: MixityType;
  requiresFemalePlayer: boolean;
  whatsappGroupLink?: string;
  registrationsOpen: boolean;
  registrationStartDateTime: Date;
  isActive: boolean;

  // Team configuration
  maxTeams: number;
  playersPerTeam: number;
  minPlayersPerTeam: number;

  // Pool phase configuration
  setsPerMatchPool: number;
  pointsPerSetPool: number;
  maxTeamsPerPool: number;
  teamsQualifiedPerPool: number;
  tieBreakEnabledPools: boolean;

  // Elimination phase configuration
  eliminationPhaseEnabled: boolean;
  setsPerMatchElimination: number;
  pointsPerSetElimination: number;
  tieBreakEnabledElimination: boolean;

  // Waiting list configuration
  waitingListEnabled: boolean;
  waitingListSize: number;

  // Tournament format
  tournamentFormat?: TournamentFormat; // 'standard' or 'king'

  // Registration mode
  registrationMode: RegistrationMode; // 'teams' or 'random'

  // Club-specific field
  isClubInternal?: boolean; // If true, club logos won't be displayed for this tournament

  // King format specific fields
  king?: boolean; // Flag to indicate if this is a King tournament
  currentKingPhase?: number; // 0, 1, 2, or 3
  isKingPhaseCompleted?: boolean;
  kingStatus?: string; // 'not-started', 'phase1-in-progress', etc.

  // Media
  coverImage?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTournamentDto {
  name: string;
  description: string;
  date: Date;
  location: string;
  type: TournamentType;
  fields: number;
  fee: number;
  mixity: MixityType;
  requiresFemalePlayer: boolean;
  whatsappGroupLink?: string;
  registrationStartDateTime: Date;
  registrationMode: RegistrationMode;
  maxTeams: number;
  playersPerTeam: number;
  minPlayersPerTeam: number;
  setsPerMatchPool: number;
  pointsPerSetPool: number;
  maxTeamsPerPool: number;
  teamsQualifiedPerPool: number;
  tieBreakEnabledPools: boolean;
  eliminationPhaseEnabled: boolean;
  setsPerMatchElimination: number;
  pointsPerSetElimination: number;
  tieBreakEnabledElimination: boolean;
  waitingListEnabled: boolean;
  waitingListSize: number;
  coverImage?: string;
  isClubInternal?: boolean;
}

export interface UpdateTournamentDto extends Partial<CreateTournamentDto> {
  registrationsOpen?: boolean;
  isActive?: boolean;
}

export interface TournamentSummary {
  id: string;
  name: string;
  date: Date;
  location: string;
  status: TournamentStatus;
  registeredTeamsCount: number;
  completeTeamsCount: number;
  maxTeams: number;
  playersPerTeam: number;
  coverImage?: string;
  // User registration status (optional, only if user is authenticated)
  userRegistered?: boolean;
  userTeamName?: string;
  userRegistrationType?: 'team' | 'freeAgent';
}

export interface TournamentDetails extends Tournament {
  teams: Team[];
  unassignedPlayers: UnassignedPlayer[];
  waitingListTeams: Team[];
  pools: Pool[];
  eliminationMatches: EliminationMatch[];
  finalRanking: FinalRanking[];
  status: TournamentStatus;
  guaranteedMatches: number;
}

// Import types from other files (will be defined)
import type { Team } from './team.types';
import type { UnassignedPlayer } from './player.types';
import type { Pool, EliminationMatch, FinalRanking } from './match.types';
