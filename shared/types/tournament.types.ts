/**
 * Tournament-related TypeScript types
 * Shared between client and server
 */

export type TournamentStatus = 'Ouvert' | 'Complet' | 'Liste d\'attente' | 'Terminé';

export type TournamentType = 'Beach Volleyball' | 'Indoor Volleyball' | 'Mixed';

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
  maxTeams: number;
  coverImage?: string;
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
