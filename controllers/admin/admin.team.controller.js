const { adminDb } = require('../../services/firebase');
const { getDocById, getAllUsers, getUserPseudo } = require('../../services/admin.firestore.utils');
const { sendFlashAndRedirect } = require('../../services/response.utils');

// Définir getPseudo globalement pour le contrôleur
let allUsersCache = []; // Cache pour stocker tous les utilisateurs
const getPseudo = (userId) => getUserPseudo(userId, allUsersCache);

// Liste les équipes (soit toutes, soit celles d'un tournoi spécifique)
exports.listTeams = async (req, res) => {
    const { tournamentId } = req.params; // tournamentId est optionnel
    try {
        let teams = [];
        let pageTitle = 'Gestion des Équipes';
        let eventName = '';

        // Récupérer tous les utilisateurs pour enrichir les données des membres et mettre à jour le cache
        allUsersCache = await getAllUsers();
        // const getPseudo = (userId) => getUserPseudo(userId, allUsersCache); // Cette ligne n'est plus nécessaire ici

        if (tournamentId) {
            const event = await getDocById('events', tournamentId);
            if (!event) {
                return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
            }
            eventName = event.name;
            pageTitle = `Équipes du Tournoi: ${eventName}`;

            const teamsSnapshot = await adminDb.collection('events').doc(tournamentId).collection('teams').get();
            teams = teamsSnapshot.docs.map(doc => {
                const teamData = doc.data();
                const captainPseudo = getPseudo(teamData.captainId);
                // Utiliser member.userId pour récupérer le pseudo
                const memberPseudos = teamData.members ? teamData.members.map(member => getPseudo(member.userId)) : [];
                return {
                    id: doc.id,
                    tournamentId: tournamentId,
                    ...teamData,
                    captainPseudo,
                    memberPseudos
                };
            });
        } else {
            const eventsSnapshot = await adminDb.collection('events').get(); // Récupérer tous les événements
            for (const event of eventsSnapshot.docs) {
                const teamsSnapshot = await adminDb.collection('events').doc(event.id).collection('teams').get();
                const eventTeams = teamsSnapshot.docs.map(doc => {
                    const teamData = doc.data();
                    const captainPseudo = getPseudo(teamData.captainId);
                    // Utiliser member.userId pour récupérer le pseudo
                    const memberPseudos = teamData.members ? teamData.members.map(member => getPseudo(member.userId)) : [];
                    return {
                        id: doc.id,
                        tournamentId: event.id,
                        ...teamData,
                        captainPseudo,
                        memberPseudos
                    };
                });
                teams = teams.concat(eventTeams);
            }
        }

        console.log('Équipes récupérées pour l\'admin:', JSON.stringify(teams, null, 2)); // Log détaillé
        res.render('admin/teams/list', { pageTitle, teams, tournamentId, eventName, title: pageTitle });
    } catch (error) {
        console.error('Erreur lors de la récupération des équipes:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération des équipes.', '/admin/dashboard');
    }
};

// Affiche le formulaire de création d'équipe pour un tournoi spécifique
exports.showCreateTeamForm = async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const event = await getDocById('events', tournamentId);
        if (!event) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }
        allUsersCache = await getAllUsers(); // Mettre à jour le cache des utilisateurs
        res.render('admin/teams/form', { pageTitle: 'Créer une Équipe', team: null, tournamentId, allUsers: allUsersCache, title: 'Créer une Équipe' });
    } catch (error) {
        console.error('Erreur lors de l\'affichage du formulaire de création d\'équipe:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de l\'affichage du formulaire.', '/admin/tournaments');
    }
};

// Crée une nouvelle équipe pour un tournoi spécifique
exports.createTeam = async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const { name, captainId } = req.body;
        const eventRef = adminDb.collection('events').doc(tournamentId);
        await eventRef.collection('teams').add({
            name,
            captainId,
            members: [{ userId: captainId, pseudo: getPseudo(captainId), level: 'Débutant' }], // Stocker le capitaine avec userId, pseudo et level
            createdAt: new Date(),
            updatedAt: new Date()
        });
        sendFlashAndRedirect(req, res, 'success', 'Équipe créée avec succès pour ce tournoi.', `/admin/tournaments/${tournamentId}/teams`);
    } catch (error) {
        console.error('Erreur lors de la création de l\'équipe pour le tournoi:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la création de l\'équipe.', `/admin/tournaments/${tournamentId}/teams/new`);
    }
};

// Affiche le formulaire d'édition d'équipe pour un tournoi spécifique
exports.showEditTeamForm = async (req, res) => {
    const { tournamentId, teamId } = req.params;
    try {
        const event = await getDocById('events', tournamentId);
        if (!event) {
            return sendFlashAndRedirect(req, res, 'error', 'Tournoi non trouvé.', '/admin/tournaments');
        }
        const team = await getDocById('events', tournamentId, 'teams', teamId);
        if (!team) {
            return sendFlashAndRedirect(req, res, 'error', 'Équipe non trouvée.', `/admin/tournaments/${tournamentId}/teams`);
        }
        allUsersCache = await getAllUsers(); // Mettre à jour le cache des utilisateurs
        res.render('admin/teams/form', { pageTitle: 'Modifier l\'Équipe', team, tournamentId, allUsers: allUsersCache, title: 'Modifier l\'Équipe' });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'équipe pour édition:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération de l\'équipe.', `/admin/tournaments/${tournamentId}/teams`);
    }
};

// Met à jour une équipe existante pour un tournoi spécifique
exports.updateTeam = async (req, res) => {
    const { tournamentId, teamId } = req.params;
    try {
        const { name, captainId, members } = req.body;

        let updatedMembers = [];
        if (members && typeof members === 'string') {
            try {
                // La vue envoie un JSON stringifié d'un tableau d'objets membres
                const parsedMembers = JSON.parse(members);
                // S'assurer que chaque membre a les attributs pseudo et level
                updatedMembers = parsedMembers.map(member => ({
                    userId: member.userId,
                    pseudo: member.pseudo || getPseudo(member.userId), // Utiliser le pseudo existant ou le récupérer
                    level: member.level || 'Débutant' // Utiliser le niveau existant ou un par défaut
                }));
            } catch (e) {
                console.error('Erreur lors du parsing des membres JSON:', e);
                // En cas d'erreur de parsing, revenir à la logique précédente si c'était une chaîne d'IDs
                updatedMembers = members.split(',')
                                       .map(id => id.trim())
                                       .filter(id => id !== '')
                                       .map(id => ({ userId: id, pseudo: getPseudo(id), level: 'Débutant' }));
            }
        } else if (Array.isArray(members)) {
            // Si members est déjà un tableau (par exemple, si le formulaire n'est pas JS-enabled)
            updatedMembers = members.map(member => ({
                userId: member.userId,
                pseudo: member.pseudo || getPseudo(member.userId),
                level: member.level || 'Débutant'
            }));
        }

        // S'assurer que le capitaine est toujours inclus dans les membres
        if (captainId && !updatedMembers.some(member => member.userId === captainId)) {
            updatedMembers.unshift({ userId: captainId, pseudo: getPseudo(captainId), level: 'Débutant' });
        }

        const eventRef = adminDb.collection('events').doc(tournamentId);
        await eventRef.collection('teams').doc(teamId).update({
            name,
            captainId,
            members: updatedMembers,
            updatedAt: new Date()
        });
        sendFlashAndRedirect(req, res, 'success', 'Équipe mise à jour avec succès pour ce tournoi.', `/admin/tournaments/${tournamentId}/teams`);
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'équipe pour le tournoi:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la mise à jour de l\'équipe.', `/admin/tournaments/${tournamentId}/teams/${teamId}/edit`);
    }
};

// Supprime une équipe pour un tournoi spécifique
exports.deleteTeam = async (req, res) => {
    const { tournamentId, teamId } = req.params;
    try {
        const eventRef = adminDb.collection('events').doc(tournamentId);
        await eventRef.collection('teams').doc(teamId).delete();
        sendFlashAndRedirect(req, res, 'success', 'Équipe supprimée avec succès pour ce tournoi.', `/admin/tournaments/${tournamentId}/teams`);
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'équipe pour le tournoi:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la suppression de l\'équipe.', `/admin/tournaments/${tournamentId}/teams`);
    }
};
