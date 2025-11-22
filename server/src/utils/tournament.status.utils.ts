import type { TournamentStatus } from '@shared/types';

interface TournamentStatusResult {
  status: TournamentStatus;
  message: string;
  registrationsAreOpen: boolean;
  isFullByCompleteTeams: boolean;
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
  isRankingFrozen: boolean = false
): TournamentStatusResult => {
  const now = new Date();
  const tournamentDate = tournament.date ? new Date(tournament.date) : new Date(8640000000000000);

  // Si pas de dates d'inscription définies, considérer comme ouvert par défaut
  const hasRegistrationDates =
    tournament.registrationStartDateTime || tournament.registrationEndDateTime;

  const registrationStarts = tournament.registrationStartDateTime
    ? new Date(tournament.registrationStartDateTime)
    : new Date(0); // Date très ancienne = toujours démarré
  const registrationEnds = tournament.registrationEndDateTime
    ? new Date(tournament.registrationEndDateTime)
    : new Date(8640000000000000); // Date très lointaine = jamais fermé

  const registrationsAreOpen = now >= registrationStarts && now <= registrationEnds;
  const isFullByCompleteTeams = completeTeamsCount >= tournament.maxTeams;
  const isFullByTotalTeams = totalTeamsCount >= tournament.maxTeams;

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
    status = 'Ouvert';
    message = 'Inscriptions à venir.';
  } else if (hasRegistrationDates && now > registrationEnds) {
    status = 'Complet';
    message = 'Les inscriptions sont fermées.';
  } else if (registrationsAreOpen || !hasRegistrationDates) {
    // Si pas de dates définies, on considère comme ouvert
    if (isFullByCompleteTeams) {
      if (tournament.waitingListEnabled && tournament.waitingListSize > 0 && !isFullByTotalTeams) {
        status = "Liste d'attente";
        message = 'Tournoi complet, liste d\'attente disponible.';
      } else {
        status = 'Complet';
        message = 'Le tournoi est complet.';
      }
    } else {
      status = 'Ouvert';
      message = 'Les inscriptions sont ouvertes.';
    }
  } else {
    status = 'Complet';
    message = 'Les inscriptions sont fermées.';
  }

  return {
    status,
    message,
    registrationsAreOpen: registrationsAreOpen || !hasRegistrationDates,
    isFullByCompleteTeams,
  };
};
