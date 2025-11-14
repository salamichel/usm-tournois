const { adminDb } = require('../../services/firebase');
const { getDocById, getAllUsers, getUserDetails, addPlayerToCollection } = require('../../services/admin.firestore.utils'); // Mise à jour
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

        // Récupérer les joueurs libres directement de la sous-collection 'unassignedPlayers'
        const unassignedPlayersSnapshot = await adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers').get();
        const unassignedPlayers = unassignedPlayersSnapshot.docs.map(doc => {
            const data = doc.data();
            // Utiliser les données stockées dans le document unassignedPlayer, qui incluent pseudo et level
            return {
                id: doc.id,
                pseudo: data.pseudo || 'N/A', // Utiliser le pseudo stocké
                level: data.level || 'N/A',   // Utiliser le level stocké
                userId: data.userId
            };
        });

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

// Affiche le formulaire pour ajouter un joueur libre à un tournoi
exports.getAddUnassignedPlayerForm = async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const event = await getDocById('events', tournamentId);
        if (!event) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }
        const eventName = event.name;

        const allUsers = await getAllUsers(); // Récupérer tous les utilisateurs

        res.render('admin/unassigned-players/add-form', {
            pageTitle: `Ajouter un joueur libre au tournoi: ${eventName}`,
            tournamentId,
            eventName,
            users: allUsers, // Passer tous les utilisateurs à la vue
            title: `Ajouter un joueur libre au tournoi: ${eventName}`
        });

    } catch (error) {
        console.error('Erreur lors de l\'affichage du formulaire d\'ajout de joueur libre:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de l\'affichage du formulaire.', `/admin/tournaments/${tournamentId}/unassigned-players`);
    }
};

// Ajoute un ou plusieurs joueurs libres à un tournoi
exports.postAddUnassignedPlayer = async (req, res) => {
    const { tournamentId } = req.params;
    let { userIds } = req.body; // Tableau d'IDs d'utilisateurs sélectionnés depuis le formulaire

    try {
        if (!userIds || (Array.isArray(userIds) && userIds.length === 0)) {
            return sendFlashAndRedirect(req, res, 'error', 'Veuillez sélectionner au moins un joueur.', `/admin/tournaments/${tournamentId}/unassigned-players/add`);
        }

        // S'assurer que userIds est toujours un tableau
        if (!Array.isArray(userIds)) {
            userIds = [userIds];
        }

        const eventRef = adminDb.collection('events').doc(tournamentId);
        const unassignedPlayersRef = eventRef.collection('unassignedPlayers');
        let addedCount = 0;
        let alreadyExistsCount = 0;
        const allUsers = await getAllUsers(); // Récupérer tous les utilisateurs une seule fois

        for (const userId of userIds) {
            const userDetails = getUserDetails(userId, allUsers);
            if (userDetails) {
                const { pseudo, level } = userDetails;
                const added = await addPlayerToCollection(unassignedPlayersRef, userId, pseudo, level);
                if (added) {
                    addedCount++;
                } else {
                    alreadyExistsCount++;
                }
            } else {
                console.warn(`postAddUnassignedPlayer: Utilisateur avec l'ID ${userId} non trouvé.`);
                // Optionnel: ajouter un message d'erreur pour les utilisateurs non trouvés
            }
        }

        let successMessage = '';
        if (addedCount > 0) {
            successMessage += `${addedCount} joueur(s) libre(s) ajouté(s) avec succès.`;
        }
        if (alreadyExistsCount > 0) {
            if (successMessage) successMessage += ' ';
            successMessage += `${alreadyExistsCount} joueur(s) déjà présent(s).`;
        }

        sendFlashAndRedirect(req, res, 'success', successMessage || 'Aucun joueur ajouté.', `/admin/tournaments/${tournamentId}/unassigned-players`);

    } catch (error) {
        console.error('Erreur lors de l\'ajout des joueurs libres:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de l\'ajout des joueurs libres.', `/admin/tournaments/${tournamentId}/unassigned-players/add`);
    }
};

// Supprime un joueur libre d'un tournoi
exports.deleteUnassignedPlayer = async (req, res) => {
    const { tournamentId, registrationId } = req.params;
    try {
        const eventRef = adminDb.collection('events').doc(tournamentId);
        await eventRef.collection('unassignedPlayers').doc(registrationId).delete();
        sendFlashAndRedirect(req, res, 'success', 'Joueur libre supprimé avec succès du tournoi.', `/admin/tournaments/${tournamentId}/unassigned-players`);
    } catch (error) {
        console.error('Erreur lors de la suppression du joueur libre:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la suppression du joueur libre.', `/admin/tournaments/${tournamentId}/unassigned-players`);
    }
};
