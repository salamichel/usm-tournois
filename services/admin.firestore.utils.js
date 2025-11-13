const { adminDb } = require('../services/firebase');

/**
 * Récupère les informations complètes d'une équipe par son ID.
 * @param {string} tournamentId L'ID du tournoi.
 * @param {string} teamId L'ID de l'équipe.
 * @returns {Promise<object|null>} L'objet de l'équipe ou null si non trouvée.
 */
async function getTeamById(tournamentId, teamId) {
    if (!teamId) return null;
    const teamDoc = await adminDb.collection('events').doc(tournamentId).collection('teams').doc(teamId).get();
    return teamDoc.exists ? { id: teamDoc.id, ...teamDoc.data() } : null;
}

/**
 * Récupère le nom d'une équipe par son ID.
 * @param {string} tournamentId L'ID du tournoi.
 * @param {string} teamId L'ID de l'équipe.
 * @returns {Promise<string|null>} Le nom de l'équipe ou null si non trouvée.
 */
async function getTeamNameById(tournamentId, teamId) {
    if (!teamId) return null;
    const teamDoc = await adminDb.collection('events').doc(tournamentId).collection('teams').doc(teamId).get();
    return teamDoc.exists ? teamDoc.data().name : null;
}

/**
 * Récupère un document Firestore par son ID, avec gestion optionnelle des sous-collections.
 * @param {string} collectionName Nom de la collection principale.
 * @param {string} docId ID du document principal.
 * @param {string} [subCollectionName] Nom de la sous-collection (optionnel).
 * @param {string} [subDocId] ID du document dans la sous-collection (optionnel).
 * @returns {Promise<object|null>} Le document avec son ID ou null si non trouvé.
 */
async function getDocById(collectionName, docId, subCollectionName = null, subDocId = null) {
    let docRef = adminDb.collection(collectionName).doc(docId);
    if (subCollectionName && subDocId) {
        docRef = docRef.collection(subCollectionName).doc(subDocId);
    }
    const docSnapshot = await docRef.get();
    return docSnapshot.exists ? { id: docSnapshot.id, ...docSnapshot.data() } : null;
}

/**
 * Récupère tous les utilisateurs de la collection 'users'.
 * @returns {Promise<Array<object>>} Un tableau d'objets utilisateur.
 */
async function getAllUsers() {
    const usersSnapshot = await adminDb.collection('users').get();
    return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Récupère le pseudo d'un utilisateur à partir de son ID et d'une liste d'utilisateurs.
 * @param {string} userId L'ID de l'utilisateur.
 * @param {Array<object>} allUsers La liste de tous les utilisateurs.
 * @returns {string} Le pseudo de l'utilisateur ou 'N/A' si non trouvé.
 */
function getUserPseudo(userId, allUsers) {
    const user = allUsers.find(u => u.id === userId);
    return user ? user.pseudo : 'N/A';
}

module.exports = {
    getTeamById,
    getTeamNameById,
    getDocById,
    getAllUsers,
    getUserPseudo
};
