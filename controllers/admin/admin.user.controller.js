const { adminDb, adminAuth } = require('../../services/firebase');
const { getDocById } = require('../../services/admin.firestore.utils');
const { sendFlashAndRedirect } = require('../../services/response.utils');

// Liste tous les utilisateurs
exports.listUsers = async (req, res) => {
    try {
        const users = [];
        // Récupérer les utilisateurs de Firebase Authentication
        const listUsersResult = await adminAuth.listUsers(1000); // Limite à 1000 utilisateurs
        for (const userRecord of listUsersResult.users) {
            // Récupérer les données supplémentaires de Firestore si nécessaire
            const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
            users.push({
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                level: userDoc.exists ? userDoc.data().level : 'Débutant', // Niveau par défaut pour le joueur
                role: userDoc.exists ? userDoc.data().role : 'player', // Rôle par défaut
                ...userDoc.data() // Ajouter d'autres données de Firestore
            });
        }
        res.render('admin/users/list', { pageTitle: 'Gestion des Utilisateurs', users, title: 'Gestion des Utilisateurs' });
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération des utilisateurs.', '/admin/dashboard');
    }
};

// Affiche le formulaire de création d'utilisateur
exports.showCreateUserForm = (req, res) => {
    res.render('admin/users/form', { pageTitle: 'Créer un Utilisateur', user: null, title: 'Créer un Utilisateur' });
};

// Crée un nouvel utilisateur (Firebase Auth et Firestore)
exports.createUser = async (req, res) => {
    try {
        const { email, password, displayName, level, role } = req.body; // Ajout de 'role'

        // Créer l'utilisateur dans Firebase Authentication
        const userRecord = await adminAuth.createUser({
            email,
            password,
            displayName,
        });

        // Enregistrer les informations supplémentaires dans Firestore
        await adminDb.collection('users').doc(userRecord.uid).set({
            email,
            pseudo: displayName, // Utiliser displayName comme pseudo par défaut
            level: level || 'Débutant', // Niveau du joueur, par défaut 'Débutant'
            role: role || 'player', // Rôle d'accès, par défaut 'player'
            createdAt: new Date(),
            updatedAt: new Date()
        });

        req.session.flashMessage = { type: 'success', message: 'Utilisateur créé avec succès.' };
        sendFlashAndRedirect(req, res, 'success', 'Utilisateur créé avec succès.', '/admin/users');
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        sendFlashAndRedirect(req, res, 'error', `Erreur lors de la création de l\'utilisateur: ${error.message}`, '/admin/users/new');
    }
};

// Affiche le formulaire d'édition d'utilisateur
exports.showEditUserForm = async (req, res) => {
    try {
        const { id } = req.params;
        const userRecord = await adminAuth.getUser(id);
        const userDoc = await adminDb.collection('users').doc(id).get();

        if (!userRecord) {
            return sendFlashAndRedirect(req, res, 'error', 'Utilisateur non trouvé.', '/admin/users');
        }

        const user = {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            level: userDoc.exists ? userDoc.data().level : 'Débutant', // Niveau par défaut pour le joueur
            role: userDoc.exists ? userDoc.data().role : 'player', // Rôle par défaut
            ...userDoc.data()
        };
        res.render('admin/users/form', { pageTitle: 'Modifier l\'Utilisateur', user, title: 'Modifier l\'Utilisateur' });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur pour édition:', error);
        sendFlashAndRedirect(req, res, 'error', 'Erreur lors de la récupération de l\'utilisateur.', '/admin/users');
    }
};

// Met à jour un utilisateur existant (Firebase Auth et Firestore)
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, displayName, level, role, password } = req.body; // Ajout de 'role'

        // Mettre à jour Firebase Authentication
        const updateAuthData = { email, displayName };
        if (password) {
            updateAuthData.password = password;
        }
        await adminAuth.updateUser(id, updateAuthData);

        // Mettre à jour Firestore
        await adminDb.collection('users').doc(id).update({
            email,
            pseudo: displayName,
            level: level || 'Débutant', // Niveau du joueur, par défaut 'Débutant'
            role: role || 'player', // Rôle d'accès, par défaut 'player'
            updatedAt: new Date()
        });

        req.session.flashMessage = { type: 'success', message: 'Utilisateur mis à jour avec succès.' };
        sendFlashAndRedirect(req, res, 'success', 'Utilisateur mis à jour avec succès.', '/admin/users');
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        sendFlashAndRedirect(req, res, 'error', `Erreur lors de la mise à jour de l\'utilisateur: ${error.message}`, `/admin/users/${id}/edit`);
    }
};

// Supprime un utilisateur (Firebase Auth et Firestore)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Supprimer de Firebase Authentication
        await adminAuth.deleteUser(id);

        // Supprimer de Firestore
        await adminDb.collection('users').doc(id).delete();

        req.session.flashMessage = { type: 'success', message: 'Utilisateur supprimé avec succès.' };
        sendFlashAndRedirect(req, res, 'success', 'Utilisateur supprimé avec succès.', '/admin/users');
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', error);
        sendFlashAndRedirect(req, res, 'error', `Erreur lors de la suppression de l\'utilisateur: ${error.message}`, '/admin/users');
    }
};
