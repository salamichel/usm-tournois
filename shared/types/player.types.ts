/**
 * Player-related TypeScript types
 * Shared between client and server
 */

import type { UserLevel } from './user.types';

export interface UnassignedPlayer {
  id: string;
  userId: string;
  pseudo: string;
  level: UserLevel;
  clubId?: string;
  registeredAt?: Date;
}

export interface RegisterPlayerDto {
  tournamentId: string;
  userId: string;
  pseudo: string;
  level: UserLevel;
}

export interface UnassignedPlayerWithAvailability extends UnassignedPlayer {
  canJoinTeam: boolean;
  reason?: string;
}
