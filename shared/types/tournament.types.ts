/**
 * Tournament-related TypeScript types
 * Shared between client and server
 */

export type TournamentStatus = 'Avenir' | 'Ouvert' | 'Complet' | 'Liste d\'attente' | 'En cours' | 'Terminé';

export type TournamentType = 'Beach Volleyball' | 'Indoor Volleyball' | 'Mixed';

export type TournamentFormat = 'standard' | 'king';

export type RegistrationMode = 'teams' | 'random';

export type MixityType = 'Mixed' | 'Male Only' | 'Female Only' | 'mixed' | 'male' | 'female';

// Signup questions types
export interface TournamentQuestionOption {
  id: string;
  label: string;
}

export interface TournamentQuestion {
  id: string;
  question: string;
  options: TournamentQuestionOption[];
  required: boolean;
}

export interface QuestionResponse {
  questionId: string;
  selectedOptionId: string;
  selectedOptionLabel?: string;
}

export interface ParticipantResponses {
  userId: string;
  pseudo: string;
  responses: QuestionResponse[];
  respondedAt: Date;
}

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
  bracketType?: BracketType; // 'single' (default) or 'double' (main + consolation)

  // Waiting list configuration (size > 0 = enabled)
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

  // Additional fields that may be returned by API
  registrationEndDateTime?: Date;
  price?: number; // Alias for fee
  minLevel?: string;
  maxLevel?: string;
  matchFormat?: string;

  // Signup questions for registration
  signupQuestions?: TournamentQuestion[];
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
  bracketType?: BracketType;
  waitingListSize: number;
  coverImage?: string;
  isClubInternal?: boolean;
  signupQuestions?: TournamentQuestion[];
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
  waitingList?: Team[]; // Alias for waitingListTeams
  pools: Pool[];
  eliminationMatches: EliminationMatch[];
  finalRanking: FinalRanking[];
  status: TournamentStatus;
  guaranteedMatches: number;
  registrationDeadline?: Date; // Alias for registrationEndDateTime
}

// Import types from other files (will be defined)
import type { Team } from './team.types';
import type { UnassignedPlayer } from './player.types';
import type { Pool, EliminationMatch, FinalRanking, BracketType } from './match.types';

// Re-export BracketType for backwards compatibility
export type { BracketType };
