/**
 * Team-related TypeScript types
 * Shared between client and server
 */

import type { UserLevel } from './user.types';

export interface TeamMember {
  userId: string;
  pseudo: string;
  level: UserLevel;
  isVirtual?: boolean; // For virtual/placeholder members
}

export interface Team {
  id: string;
  name: string;
  captainId: string;
  captainPseudo?: string;
  members: TeamMember[];
  recruitmentOpen: boolean;
  registeredAt: string; // ISO date string
  poolId?: string;
  poolName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTeamDto {
  name: string;
  tournamentId: string;
  captainId: string;
  recruitmentOpen?: boolean;
}

export interface UpdateTeamDto {
  name?: string;
  recruitmentOpen?: boolean;
}

export interface AddTeamMemberDto {
  userId: string;
  pseudo: string;
  level: UserLevel;
  isVirtual?: boolean;
}

export interface RemoveTeamMemberDto {
  userId: string;
}

export interface TeamWithStats extends Team {
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  setsDifferential: number;
  pointsDifferential: number;
  rank?: number;
}

export interface TeamRegistrationDto {
  teamId: string;
  tournamentId: string;
}

export interface JoinTeamDto {
  teamId: string;
  tournamentId: string;
  userId: string;
}
