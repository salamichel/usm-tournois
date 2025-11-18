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
  totalTeamsCount: number
): TournamentStatusResult => {
  const now = new Date();
  const registrationStarts = tournament.registrationStartDateTime
    ? new Date(tournament.registrationStartDateTime)
    : new Date(0);
  const registrationEnds = tournament.registrationEndDateTime
    ? new Date(tournament.registrationEndDateTime)
    : new Date(8640000000000000);
  const tournamentDate = tournament.date ? new Date(tournament.date) : new Date(8640000000000000);

  const registrationsAreOpen = now >= registrationStarts && now <= registrationEnds;
  const isFullByCompleteTeams = completeTeamsCount >= tournament.maxTeams;
  const isFullByTotalTeams = totalTeamsCount >= tournament.maxTeams;

  let status: TournamentStatus = 'Ouvert';
  let message = '';

  // Order: Terminé > Inscriptions à venir > Inscriptions fermées > Ouvert/Complet
  if (now > tournamentDate) {
    status = 'Terminé';
    message = 'Ce tournoi est terminé.';
  } else if (now < registrationStarts) {
    // For display purposes on homepage, we'll show as "Ouvert" if not yet started
    // The detailed status will be shown on the detail page
    status = 'Ouvert';
    message = `Les inscriptions ouvriront le ${registrationStarts.toLocaleDateString('fr-FR')}`;
  } else if (now > registrationEnds) {
    status = 'Complet';
    message = 'Les inscriptions sont fermées.';
  } else if (registrationsAreOpen) {
    if (isFullByCompleteTeams) {
      if (tournament.waitingListEnabled && tournament.waitingListSize > 0 && !isFullByTotalTeams) {
        status = "Liste d'attente";
        message = "Le tournoi est complet, liste d'attente disponible.";
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
    registrationsAreOpen,
    isFullByCompleteTeams,
  };
};
