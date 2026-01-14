/**
 * Player-related TypeScript types
 * Shared between client and server
 */

import type { UserLevel } from './user.types';
import type { QuestionResponse } from './tournament.types';

export interface UnassignedPlayer {
  id: string;
  userId: string;
  pseudo: string;
  level: UserLevel;
  clubId?: string;
  registeredAt?: Date;
  questionResponses?: QuestionResponse[];
}

export interface RegisterPlayerDto {
  tournamentId: string;
  userId: string;
  pseudo: string;
  level: UserLevel;
  questionResponses?: QuestionResponse[];
}

export interface UnassignedPlayerWithAvailability extends UnassignedPlayer {
  canJoinTeam: boolean;
  reason?: string;
}
