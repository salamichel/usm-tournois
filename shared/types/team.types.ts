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
  tournamentId?: string; // Tournament this team belongs to
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
  tournamentId: string;
  teamName?: string;
  recruitmentOpen?: boolean;
}

export interface AddTeamMemberDto {
  tournamentId: string;
  memberId: string; // User ID of the member to add
}

export interface AddVirtualMemberDto {
  tournamentId: string;
  pseudo: string;
  level: UserLevel;
  email?: string;
}

export interface RemoveTeamMemberDto {
  tournamentId: string;
  memberId: string;
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
