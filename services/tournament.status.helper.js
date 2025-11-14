const getTournamentStatus = (event, userStatus, completeTeamsCount, totalTeamsCount) => {
    const now = new Date();
    const registrationStarts = event.registrationStartDateTime ? event.registrationStartDateTime.toDate() : new Date(0);
    const registrationEnds = event.registrationEndDateTime ? event.registrationEndDateTime.toDate() : new Date(8640000000000000);
    const tournamentEnds = event.date ? event.date.toDate() : new Date(8640000000000000); // Ajout de la date de fin du tournoi

    // Calculer registrationsAreOpen directement dans le helper pour la cohérence
    const registrationsAreOpen = now >= registrationStarts && now <= registrationEnds;
    const isFullByCompleteTeams = completeTeamsCount >= event.maxTeams;
    const isFullByTotalTeams = totalTeamsCount >= event.maxTeams; // Utile pour la liste d'attente

    let status = '';
    let action = '';
    let message = '';
    let showRegisterButton = false;
    let showJoinWaitingListButton = false;
    let showUnregisterButton = false;
    let showLeaveWaitingListButton = false;
    let showCreateTeamButton = false;
    let showRegisterPlayerButton = false;
    let showJoinTeamForm = false;

    // Ordre des conditions : Terminé > Inscrit/Liste d'attente > Inscriptions à venir > Inscriptions fermées > Ouvert/Complet
    if (now > tournamentEnds) {
        status = 'Terminé';
        message = 'Ce tournoi est terminé.';
    } else if (userStatus.isRegistered) {
        status = 'Inscrit';
        message = `Vous êtes inscrit avec l'équipe: ${userStatus.teamName}`;
        showUnregisterButton = true; // Pour quitter l'équipe ou le tournoi
    } else if (userStatus.isOnWaitingList) {
        status = "Liste d'attente";
        message = "Votre équipe est en liste d'attente.";
        showLeaveWaitingListButton = true;
    } else if (now < registrationStarts) { // Inscriptions à venir
        status = 'Inscriptions à venir';
        message = `Les inscriptions ouvriront le ${registrationStarts.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${registrationStarts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (now > registrationEnds) { // Inscriptions fermées (après la période)
        status = 'Inscriptions fermées';
        message = `Les inscriptions pour ce tournoi sont fermées depuis le ${registrationEnds.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${registrationEnds.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (registrationsAreOpen) { // Inscriptions ouvertes
        if (isFullByCompleteTeams) {
            if (event.waitingListEnabled && event.waitingListSize > 0 && !isFullByTotalTeams) {
                status = "Liste d'attente disponible";
                message = "Le tournoi est complet, mais vous pouvez rejoindre la liste d'attente.";
                showJoinWaitingListButton = true;
            } else {
                status = 'Complet';
                message = 'Le tournoi est complet.';
            }
        } else {
            status = 'Ouvert';
            message = 'Les inscriptions sont ouvertes.';
            showRegisterPlayerButton = true;
            showCreateTeamButton = true;
            showJoinTeamForm = true;
        }
    } else { // Cas par défaut si registrationsAreOpen est false pour une autre raison (devrait être couvert par les conditions précédentes)
        status = 'Inscriptions fermées';
        message = 'Les inscriptions pour ce tournoi sont fermées.';
    }

    return {
        status,
        message,
        showRegisterButton, // Pour les équipes dans mon-compte.ejs
        showJoinWaitingListButton, // Pour les équipes dans mon-compte.ejs et joueur libre dans tournament-detail.ejs
        showUnregisterButton, // Pour les équipes dans mon-compte.ejs et joueur libre dans tournament-detail.ejs
        showLeaveWaitingListButton, // Pour les équipes dans mon-compte.ejs et joueur libre dans tournament-detail.ejs
        showCreateTeamButton, // Pour joueur libre dans tournament-detail.ejs
        showRegisterPlayerButton, // Pour joueur libre dans tournament-detail.ejs
        showJoinTeamForm, // Pour joueur libre dans tournament-detail.ejs
        registrationStarts,
        registrationEnds,
        registrationsAreOpen,
        isFullByCompleteTeams,
        isFullByTotalTeams
    };
};

module.exports = {
    getTournamentStatus
};
