/**
 * Construit un objet tournoi à partir des données du corps de la requête et du fichier uploadé.
 * Gère le parsing des dates, des nombres, des booléens et l'image de couverture.
 * @param {object} body Le corps de la requête (req.body).
 * @param {object} file Le fichier uploadé (req.file), peut être null.
 * @param {boolean} isNew Indique si c'est un nouveau tournoi (pour createdAt/updatedAt).
 * @returns {object} L'objet tournoi prêt à être sauvegardé.
 */
function buildTournamentObject(body, file, isNew = true) {
    const {
        name, description, whatsappGroupLink, date, time, maxTeams, playersPerTeam, minPlayersPerTeam,
        location, type, fields, fee, mixity, requiresFemalePlayer, registrationsOpen,
        registrationStartDate, registrationStartTime, isActive, waitingListSize,
        setsPerMatchPool, pointsPerSetPool, maxTeamsPerPool, teamsQualifiedPerPool, eliminationPhaseEnabled,
        setsPerMatchElimination, pointsPerSetElimination, tieBreakEnabledPools, tieBreakEnabledElimination, matchFormat
    } = body;

    const dateTimeString = `${date}T${time || '00:00'}`;
    const registrationDateTimeString = `${registrationStartDate}T${registrationStartTime || '00:00'}`;

    const parsedWaitingListSize = parseInt(waitingListSize) || 0;
    const isEliminationPhaseEnabled = eliminationPhaseEnabled === 'on';
    const isTieBreakEnabledPools = tieBreakEnabledPools === 'on';
    const isTieBreakEnabledElimination = tieBreakEnabledElimination === 'on';

    // Fonction utilitaire pour valider et créer un objet Date
    const createValidDate = (dateString) => {
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? null : d;
    };

    const tournament = {
        name,
        description,
        whatsappGroupLink: whatsappGroupLink || null,
        date: createValidDate(dateTimeString), // Utiliser la fonction de validation
        registrationStartDateTime: createValidDate(registrationDateTimeString), // Utiliser la fonction de validation
        maxTeams: parseInt(maxTeams),
        playersPerTeam: parseInt(playersPerTeam),
        minPlayersPerTeam: parseInt(minPlayersPerTeam),
        location,
        type,
        fields: parseInt(fields) || 0,
        fee: parseFloat(fee) || 0,
        mixity,
        requiresFemalePlayer: requiresFemalePlayer === 'on',
        registrationsOpen: registrationsOpen === 'on',
        isActive: isActive === 'on',
        waitingListEnabled: parsedWaitingListSize > 0,
        waitingListSize: parsedWaitingListSize,

        setsPerMatchPool: parseInt(setsPerMatchPool) || 1,
        pointsPerSetPool: parseInt(pointsPerSetPool) || 21,
        maxTeamsPerPool: parseInt(maxTeamsPerPool) || 4,
        teamsQualifiedPerPool: parseInt(teamsQualifiedPerPool) || 2,
        eliminationPhaseEnabled: isEliminationPhaseEnabled,
        setsPerMatchElimination: isEliminationPhaseEnabled ? (parseInt(setsPerMatchElimination) || 3) : null,
        pointsPerSetElimination: isEliminationPhaseEnabled ? (parseInt(pointsPerSetElimination) || 21) : null,
        tieBreakEnabledPools: isTieBreakEnabledPools,
        tieBreakEnabledElimination: isTieBreakEnabledElimination,
        matchFormat: matchFormat || 'aller',
    };

    if (file) {
        tournament.coverImage = `/uploads/${file.filename}`;
    }

    if (isNew) {
        tournament.createdAt = new Date();
    }
    tournament.updatedAt = new Date();

    return tournament;
}

/**
 * Calcule le nombre garanti de matchs pour un tournoi donné.
 * @param {object} tournament L'objet tournoi avec toutes ses configurations.
 * @returns {number} Le nombre total de matchs garantis.
 */
function calculateGuaranteedMatches(tournament) {
    let totalMatches = 0;

    // Calcul pour la phase de poules
    if (tournament.maxTeams > 0 && tournament.maxTeamsPerPool > 0) {
        const numberOfPools = Math.ceil(tournament.maxTeams / tournament.maxTeamsPerPool);
        const teamsPerPool = tournament.maxTeamsPerPool; // Supposons que toutes les poules ont le même nombre max d'équipes

        // Calcul des matchs par poule (format "aller" : chaque équipe joue une fois contre toutes les autres)
        // Formule: n * (n - 1) / 2 où n est le nombre d'équipes dans la poule
        const matchesPerPool = (teamsPerPool * (teamsPerPool - 1)) / 2;
        totalMatches += numberOfPools * matchesPerPool;
    }

    // Calcul pour la phase d'élimination (si activée)
    if (tournament.eliminationPhaseEnabled && tournament.teamsQualifiedPerPool > 0) {
        const numberOfPools = Math.ceil(tournament.maxTeams / tournament.maxTeamsPerPool);
        const qualifiedTeamsForElimination = numberOfPools * tournament.teamsQualifiedPerPool;

        // Pour un tournoi à élimination directe, le nombre de matchs est (nombre d'équipes - 1)
        if (qualifiedTeamsForElimination > 1) {
            totalMatches += qualifiedTeamsForElimination - 1;
        }
    }

    return totalMatches;
}

module.exports = {
    buildTournamentObject,
    calculateGuaranteedMatches
};
