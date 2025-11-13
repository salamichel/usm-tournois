const { db } = require('./firebase');
const { collection, getDocs, query, doc, getDoc, where, orderBy } = require('firebase/firestore');
const { sendFlashAndRedirect } = require('./response.utils'); // Importation mutualisée

/**
 * Calcule le nombre d'équipes complètes et le nombre total de joueurs pour un événement donné.
 * @param {string} eventId L'ID de l'événement.
 * @param {Object} eventData Les données de l'événement.
 * @returns {Promise<{completeTeamsCount: number, totalPlayersInTeams: number, teamsCount: number, unassignedPlayersCount: number, playersCount: number}>}
 */
async function getTeamsAndPlayersCounts(eventId, eventData) {
    const teamsSnapshot = await getDocs(collection(db, `events/${eventId}/teams`));
    const unassignedSnap = await getDocs(collection(db, `events/${eventId}/unassignedPlayers`));

    let completeTeamsCount = 0;
    let totalPlayersInTeams = 0;
    teamsSnapshot.forEach(teamDoc => {
        const teamData = teamDoc.data();
        if (eventData.minPlayersPerTeam && teamData.members && teamData.members.length >= eventData.minPlayersPerTeam) {
            completeTeamsCount++;
        }
        totalPlayersInTeams += teamData.members?.length || 0;
    });

    const teamsCount = teamsSnapshot.size;
    const unassignedPlayersCount = unassignedSnap.size;
    const playersCount = unassignedPlayersCount + totalPlayersInTeams;

    return { completeTeamsCount, totalPlayersInTeams, teamsCount, unassignedPlayersCount, playersCount };
}

/**
 * Détermine le statut d'un tournoi (Ouvert, Complet, Liste d'attente, Terminé).
 * @param {Object} eventData Les données de l'événement.
 * @param {number} completeTeamsCount Le nombre d'équipes complètes.
 * @returns {string} Le statut du tournoi.
 */
function getTournamentStatus(eventData, completeTeamsCount) {
    const now = new Date();
    const eventDate = eventData.date ? new Date(eventData.date) : new Date(0); // Assurez-vous que eventData.date est un format valide

    if (eventDate < now) {
        return 'Terminé';
    } else if (completeTeamsCount >= eventData.maxTeams) {
        if (eventData.waitingListEnabled) {
            return "Liste d'attente";
        } else {
            return 'Complet';
        }
    } else {
        return 'Ouvert';
    }
}

/**
 * Fonction utilitaire pour obtenir le statut d'inscription d'un utilisateur pour un événement donné.
 * @param {string} eventId L'ID de l'événement.
 * @param {string} userId L'ID de l'utilisateur.
 * @returns {Promise<{isRegistered: boolean, registrationType: string|null, teamName: string|null, teamId: string|null, isOnWaitingList: boolean}>}
 */
async function getUserRegistrationStatus(eventId, userId) {
    let status = {
        isRegistered: false,
        registrationType: null,
        teamName: null,
        teamId: null,
        isOnWaitingList: false,
    };

    // 1. Vérifier si l'utilisateur est membre d'une équipe
    const teamsCollectionRef = collection(db, `events/${eventId}/teams`);
    const allTeamsSnapshot = await getDocs(teamsCollectionRef);
    
    for (const teamDoc of allTeamsSnapshot.docs) {
        const teamData = teamDoc.data();
        if (teamData.members && teamData.members.some(member => member.userId === userId)) {
            status.isRegistered = true;
            status.registrationType = 'team';
            status.teamName = teamData.name;
            status.teamId = teamDoc.id;
            break;
        }
    }

    // 2. Vérifier si l'utilisateur est un joueur libre (seulement si pas déjà membre d'une équipe)
    if (!status.isRegistered) {
        const unassignedPlayerDoc = await getDoc(doc(db, `events/${eventId}/unassignedPlayers`, userId));
        if (unassignedPlayerDoc.exists()) {
            status.isRegistered = true;
            status.registrationType = 'free-player';
        }
    }

    // 3. Vérifier si l'utilisateur est dans une équipe en liste d'attente
    if (!status.isRegistered) { // Seulement si pas déjà inscrit (équipe ou joueur libre)
        const waitingListTeamsRef = collection(db, `events/${eventId}/waitingListTeams`);
        const waitingListSnapshot = await getDocs(waitingListTeamsRef);
        for (const teamDoc of waitingListSnapshot.docs) {
            const teamData = teamDoc.data();
            if (teamData.members && teamData.members.some(member => member.userId === userId)) {
                status.isOnWaitingList = true;
                status.teamName = teamData.name; // Nom de l'équipe en attente
                status.teamId = teamDoc.id; // ID de l'équipe en attente
                break;
            }
        }
    }
    return status;
}

module.exports = {
    getTeamsAndPlayersCounts,
    getTournamentStatus,
    getUserRegistrationStatus,
    sendFlashAndRedirect // sendFlashAndRedirect est maintenant importé et exporté
};
