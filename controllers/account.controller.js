// controllers/account.controller.js

const { db, adminAuth } = require('../services/firebase'); // Importez adminAuth
const { collection, getDocs, query, where, doc, getDoc, updateDoc } = require('firebase/firestore');

/*
 * =============================================
 * Contrôleur pour la gestion du compte utilisateur
 * =============================================
 */

/**
 * Affiche la page du tableau de bord de l'utilisateur.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.showAccountPage = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Rediriger si non connecté
    }

    const userId = req.session.user.uid;
    let userTeams = [];
    let userRegistrations = [];

    try {
        // Récupérer tous les événements
        const eventsSnapshot = await getDocs(collection(db, 'events'));
        const allEvents = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- Récupérer les équipes dont l'utilisateur est capitaine ---
        // Cette partie est plus complexe car les équipes sont des sous-collections.
        // Nous devons parcourir tous les événements pour trouver les équipes.
        const captainTeamsPromises = allEvents.map(async (event) => {
            const teamsSnapshot = await getDocs(query(collection(db, `events/${event.id}/teams`), where('captainId', '==', userId)));
            return teamsSnapshot.docs.map(teamDoc => ({
                id: teamDoc.id,
                ...teamDoc.data(),
                tournamentId: event.id,
                tournamentName: event.name,
                maxMembers: event.playersPerTeam // Assumons que maxMembers est playersPerTeam de l'événement
            }));
        });
        const captainTeamsArrays = await Promise.all(captainTeamsPromises);
        userTeams = captainTeamsArrays.flat(); // Aplatir le tableau de tableaux

        // --- Récupérer les inscriptions de l'utilisateur (joueur libre ou membre d'équipe) ---
        const registrationsPromises = allEvents.map(async (event) => {
            const eventRegistrations = [];

            // Vérifier si l'utilisateur est un joueur libre dans cet événement
            const unassignedPlayerDoc = await getDoc(doc(db, `events/${event.id}/unassignedPlayers`, userId));
            if (unassignedPlayerDoc.exists()) {
                eventRegistrations.push({
                    type: 'free-player',
                    tournamentName: event.name,
                    tournamentId: event.id,
                    status: 'Joueur Libre'
                });
            }

            // Vérifier si l'utilisateur est membre d'une équipe dans cet événement
            const teamsSnapshot = await getDocs(query(collection(db, `events/${event.id}/teams`), where('members', 'array-contains', { userId: userId })));
            teamsSnapshot.forEach(teamDoc => {
                const teamData = teamDoc.data();
                const member = teamData.members.find(m => m.userId === userId);
                if (member) {
                eventRegistrations.push({
                    type: 'team',
                    teamName: teamData.name,
                    tournamentName: event.name,
                    tournamentId: event.id,
                        status: `Membre (${member.level})`
                });
                }
            });
            return eventRegistrations;
        });

        const allRegistrationsArrays = await Promise.all(registrationsPromises);
        userRegistrations = allRegistrationsArrays.flat();

        res.render('pages/mon-compte', { 
            title: 'Mon Tableau de Bord', 
            path: req.path,
            currentUser: req.session.user, // Passer l'objet utilisateur complet
            userTeams: userTeams,
            userRegistrations: userRegistrations
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des données du compte:", error);
        res.status(500).send("Erreur serveur.");
    }
};

/**
 * Gère la mise à jour du profil utilisateur (pseudo et niveau).
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.updateProfile = async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }

    const userId = req.session.user.uid;
    const { pseudo, level } = req.body;

    console.log(`[DEBUG - updateProfile] userId from session: ${userId}`);
    console.log(`[DEBUG - updateProfile] pseudo from body: ${pseudo}`);
    console.log(`[DEBUG - updateProfile] level from body: ${level}`);

    if (!pseudo || !level) {
        return res.status(400).json({ success: false, message: "Pseudo et niveau sont requis." });
    }

    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            pseudo: pseudo,
            level: level // Assurez-vous que le niveau est un nombre
        });

        // Mettre à jour la session utilisateur
        req.session.user.pseudo = pseudo;
        req.session.user.level = level;

        res.json({ success: true, message: "Profil mis à jour avec succès." });

    } catch (error) {
        console.error("Erreur lors de la mise à jour du profil:", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la mise à jour du profil." });
    }
};

/**
 * Affiche la page de modification du profil utilisateur.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.showProfilePage = (req, res, title = 'Mon Profil') => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('pages/mon-profil', {
        title: title,
        path: req.path,
        currentUser: req.session.user
    });
};

/**
 * Affiche la page de changement de mot de passe.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.showChangePasswordPage = (req, res, title = 'Changer le mot de passe') => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('pages/changer-mot-de-passe', {
        title: title,
        path: req.path,
        currentUser: req.session.user
    });
};

/**
 * Gère le changement de mot de passe de l'utilisateur.
 * NOTE: La logique réelle de changement de mot de passe avec Firebase Admin SDK
 * est complexe et nécessite des privilèges d'administrateur ou une interaction
 * côté client avec Firebase Authentication. Pour cet exemple, nous allons
 * simuler une réussite.
 * @param {Object} req - L'objet de requête Express.
 * @param {Object} res - L'objet de réponse Express.
 */
exports.changePassword = async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Non authentifié." });
    }

    const userId = req.session.user.uid; // Déclarer userId
    const { newPassword, confirmNewPassword } = req.body;

    if (!newPassword || newPassword !== confirmNewPassword) {
        return res.status(400).json({ success: false, message: 'Les nouveaux mots de passe ne correspondent pas.' });
    }

    // NOTE: Pour une sécurité optimale, il faudrait d'abord réauthentifier l'utilisateur
    // avec son mot de passe actuel avant de permettre le changement.
    // Le SDK Admin ne vérifie pas le mot de passe actuel directement.
    // Pour cet exemple, nous allons simplement mettre à jour le mot de passe.

    try {
        await adminAuth.updateUser(userId, {
            password: newPassword
        });

        return res.json({ success: true, message: 'Votre mot de passe a été mis à jour avec succès.', redirect: '/mon-profil' });

    } catch (error) {
        console.error("Erreur lors du changement de mot de passe:", error);
        // Gérer les erreurs spécifiques de Firebase Admin SDK si nécessaire
        return res.status(500).json({ success: false, message: "Erreur serveur lors du changement de mot de passe." });
    }
};
