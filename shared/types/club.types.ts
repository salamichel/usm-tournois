/**
 * Club types for USM Tournois
 */

/**
 * Represents a club in the system
 */
export interface Club {
  id: string;
  name: string;
  logo?: string; // URL to the logo file
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating a new club
 */
export interface CreateClubDto {
  name: string;
  logo?: File;
}

/**
 * DTO for updating a club
 */
export interface UpdateClubDto {
  name?: string;
  logo?: File;
}

/**
 * Club with additional stats for admin view
 */
export interface ClubWithStats extends Club {
  playerCount: number;
}
