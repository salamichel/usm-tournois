const { adminAuth, adminDb } = require('../services/firebase');
const { addPlayerToCollection } = require('../services/admin.firestore.utils');

async function createDummyPlayers(tournamentId, numberOfPlayers) {
    if (!tournamentId) {
        console.error('Erreur: L\'ID du tournoi est requis.');
        process.exit(1);
    }
    if (isNaN(numberOfPlayers) || numberOfPlayers <= 0) {
        console.error('Erreur: Le nombre de joueurs doit être un nombre positif.');
        process.exit(1);
    }

    console.log(`Création de ${numberOfPlayers} joueurs factices pour le tournoi ${tournamentId}...`);

    const levels = ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert'];
    const unassignedPlayersRef = adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers');

    for (let i = 0; i < numberOfPlayers; i++) {
        const pseudo = `JoueurFactice${Date.now()}${i}`;
        const email = `joueurfactice${Date.now()}${i}@example.com`;
        const level = levels[Math.floor(Math.random() * levels.length)];

        try {
            // 1. Créer l'utilisateur dans Firebase Authentication
            const userRecord = await adminAuth.createUser({
                email: email,
                password: 'password123', // Mot de passe temporaire
                displayName: pseudo,
            });
            const userId = userRecord.uid;

            // 2. Ajouter les données de l'utilisateur à Firestore
            await adminDb.collection('users').doc(userId).set({
                pseudo: pseudo,
                level: level,
                email: email,
                createdAt: new Date(),
            });

            // 3. Ajouter le joueur à la liste des joueurs libres du tournoi
            const added = await addPlayerToCollection(unassignedPlayersRef, userId, pseudo, level);

            if (added) {
                console.log(`Joueur factice créé et ajouté: ${pseudo} (ID: ${userId}, Niveau: ${level})`);
            } else {
                console.log(`Joueur factice créé mais déjà présent comme joueur libre: ${pseudo} (ID: ${userId})`);
            }

        } catch (error) {
            if (error.code === 'auth/email-already-exists') {
                console.warn(`L'email ${email} existe déjà. Tentative de création d'un autre.`);
                // On pourrait réessayer avec un autre email ou ignorer
            } else {
                console.error(`Erreur lors de la création du joueur factice ${pseudo}:`, error);
            }
        }
    }

    console.log('Création des joueurs factices terminée.');
    process.exit(0);
}

// Récupérer les arguments de la ligne de commande
const args = process.argv.slice(2);
const tournamentIdArg = args[0];
const numberOfPlayersArg = parseInt(args[1], 10);

createDummyPlayers(tournamentIdArg, numberOfPlayersArg);
