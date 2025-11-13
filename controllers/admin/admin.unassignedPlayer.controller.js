const { adminDb } = require('../../services/firebase');
const { getDocById, getAllUsers, getUserPseudo } = require('../../services/admin.firestore.utils');
const { sendFlashAndRedirect } = require('../../services/response.utils');

// Liste les joueurs libres pour un tournoi spécifique
exports.listUnassignedPlayers = async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const event = await getDocById('events', tournamentId);
        if (!event) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }
        const eventName = event.name;

        // Récupérer tous les utilisateurs
        const allUsers = await getAllUsers();

        // Récupérer les inscriptions au tournoi
        const registrationsSnapshot = await adminDb.collection('events').doc(tournamentId).collection('registrations').get();
        const registrations = registrationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Récupérer les équipes du tournoi et leurs membres
        const teamsSnapshot = await adminDb.collection('events').doc(tournamentId).collection('teams').get();
        let assignedPlayerIds = new Set();
        teamsSnapshot.docs.forEach(teamDoc => {
            const teamData = teamDoc.data();
            if (teamData.members) {
                // Assurez-vous que member.userId est utilisé ici
                teamData.members.forEach(member => assignedPlayerIds.add(member.userId));
            }
        });

        // Filtrer les joueurs inscrits qui ne sont pas dans une équipe
        const unassignedPlayers = registrations
            .filter(reg => reg.type === 'player' && !assignedPlayerIds.has(reg.userId))
            .map(reg => {
                const user = getUserPseudo(reg.userId, allUsers); // Utiliser getUserPseudo
                return user !== 'N/A' ? { id: reg.userId, pseudo: user, registrationId: reg.id } : null;
            })
            .filter(player => player !== null);

        res.render('admin/unassigned-players/list', {
            pageTitle: `Joueurs Libres du Tournoi: ${eventName}`,
            unassignedPlayers,
            tournamentId,
            eventName,
            title: `Joueurs Libres du Tournoi: ${eventName}`
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des joueurs libres:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération des joueurs libres.', `/admin/tournaments/${tournamentId}/teams`);
    }
};

// Supprime un joueur libre d'un tournoi
exports.deleteUnassignedPlayer = async (req, res) => {
    const { tournamentId, registrationId } = req.params;
    try {
        const eventRef = adminDb.collection('events').doc(tournamentId);
        await eventRef.collection('registrations').doc(registrationId).delete();
        sendFlashAndRedirect(req, res, 'success', 'Joueur libre supprimé avec succès du tournoi.', `/admin/tournaments/${tournamentId}/unassigned-players`);
    } catch (error) {
        console.error('Erreur lors de la suppression du joueur libre:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la suppression du joueur libre.', `/admin/tournaments/${tournamentId}/unassigned-players`);
    }
};
