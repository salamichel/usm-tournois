import type { TournamentStatus } from '@shared/types';
import { Timestamp } from 'firebase-admin/firestore';

interface TournamentStatusResult {
  status: TournamentStatus;
  message: string;
  registrationsAreOpen: boolean;
  isFullByCompleteTeams: boolean;
  isFullByPlayers: boolean;
}

/**
 * Helper function to convert Firestore Timestamp, Date, or string to Date
 */
function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return null;
}

/**
 * Calculate tournament status for display purposes
 * Simplified version for public listing (no user-specific status)
 */
export const calculateTournamentStatus = (
  tournament: any,
  completeTeamsCount: number,
  totalTeamsCount: number,
  hasMatches: boolean = false,
  isRankingFrozen: boolean = false,
  unassignedPlayersCount: number = 0,
  waitingListCurrentSize: number = 0,
  totalPlayersInTeams: number = 0
): TournamentStatusResult => {
  const now = new Date();
  const tournamentDate = toDate(tournament.date) || new Date(8640000000000000);

  // Si pas de dates d'inscription définies, considérer comme ouvert par défaut
  const hasRegistrationDates =
    tournament.registrationStartDateTime || tournament.registrationEndDateTime;

  const registrationStarts = toDate(tournament.registrationStartDateTime) || new Date(0); // Date très ancienne = toujours démarré
  const registrationEnds = toDate(tournament.registrationEndDateTime) || new Date(8640000000000000); // Date très lointaine = jamais fermé

  const registrationsAreOpen = now >= registrationStarts && now <= registrationEnds;
  const isFullByCompleteTeams = completeTeamsCount >= tournament.maxTeams;
  const isFullByTotalTeams = totalTeamsCount >= tournament.maxTeams;

  // Calculer si le tournoi est complet par nombre de joueurs (pour mode random/individuel)
  const maxTotalPlayers = tournament.maxTeams * (tournament.playersPerTeam || 2);
  const currentTotalPlayers = totalPlayersInTeams + unassignedPlayersCount;
  const isFullByPlayers = currentTotalPlayers >= maxTotalPlayers;

  let status: TournamentStatus = 'Ouvert';
  let message = '';

  // Order: Classement figé > Date dépassée > En cours > Inscriptions à venir > Inscriptions fermées > Ouvert/Complet
  if (isRankingFrozen) {
    // Si le classement est figé, le tournoi est terminé
    status = 'Terminé';
    message = 'Ce tournoi est terminé.';
  } else if (now > tournamentDate) {
    status = 'Terminé';
    message = 'Ce tournoi est terminé.';
  } else if (hasMatches && (!registrationsAreOpen || isFullByCompleteTeams)) {
    // Tournoi en cours : il y a des matchs ET (inscriptions fermées OU complet)
    status = 'En cours';
    message = 'Le tournoi est en cours.';
  } else if (hasRegistrationDates && now < registrationStarts) {
    status = 'Avenir';
    const startDate = registrationStarts.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    message = `Inscriptions à partir du ${startDate}`;
  } else if (registrationsAreOpen || !hasRegistrationDates) {
    // Si pas de dates définies, on considère comme ouvert
    // Le tournoi est complet si toutes les équipes complètes sont atteintes OU si toutes les places d'équipes sont prises OU si tous les joueurs sont inscrits
    if (isFullByCompleteTeams || isFullByTotalTeams || isFullByPlayers) {
      // Liste d'attente disponible si taille > 0 et pas pleine
      const waitingListMaxSize = tournament.waitingListSize || 0;
      const waitingListHasSpace = waitingListCurrentSize < waitingListMaxSize;
      if (waitingListMaxSize > 0 && waitingListHasSpace) {
        status = "Liste d'attente";
        message = 'Tournoi complet, liste d\'attente disponible.';
      } else if (waitingListMaxSize > 0 && !waitingListHasSpace) {
        status = 'Complet';
        message = 'Le tournoi est complet et la liste d\'attente est pleine.';
      } else {
        status = 'Complet';
        message = 'Le tournoi est complet.';
      }
    } else {
      status = 'Ouvert';
      message = 'Les inscriptions sont ouvertes.';
    }
  } else {
    // Inscriptions fermées : vérifier si le tournoi est vraiment complet
    if (isFullByCompleteTeams || isFullByTotalTeams || isFullByPlayers) {
      // Liste d'attente disponible si taille > 0 et pas pleine
      const waitingListMaxSize = tournament.waitingListSize || 0;
      const waitingListHasSpace = waitingListCurrentSize < waitingListMaxSize;
      if (waitingListMaxSize > 0 && waitingListHasSpace) {
        status = "Liste d'attente";
        message = 'Tournoi complet, liste d\'attente disponible.';
      } else if (waitingListMaxSize > 0 && !waitingListHasSpace) {
        status = 'Complet';
        message = 'Le tournoi est complet et la liste d\'attente est pleine.';
      } else {
        status = 'Complet';
        message = 'Le tournoi est complet.';
      }
    } else {
      status = 'Ouvert';
      message = 'Les inscriptions sont fermées.';
    }
  }

  return {
    status,
    message,
    registrationsAreOpen: registrationsAreOpen || !hasRegistrationDates,
    isFullByCompleteTeams,
    isFullByPlayers,
  };
};
