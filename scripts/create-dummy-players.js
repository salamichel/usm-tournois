const { adminAuth, adminDb } = require('../services/firebase');
const { addPlayerToCollection } = require('../services/admin.firestore.utils');

/**
 * Affiche l'aide pour l'utilisation du script
 */
function showHelp() {
    console.log(`
Usage: node scripts/create-dummy-players.js <tournamentId> <numberOfPlayers> [options]

Arguments:
  tournamentId      ID du tournoi dans lequel ajouter les joueurs
  numberOfPlayers   Nombre de joueurs factices à créer

Options:
  --prefix <text>   Préfixe pour les noms des joueurs (défaut: "JoueurFactice")
  --password <pwd>  Mot de passe pour les comptes (défaut: "password123")
  --help, -h        Affiche cette aide

Exemples:
  node scripts/create-dummy-players.js tournament123 10
  node scripts/create-dummy-players.js tournament123 5 --prefix "TestPlayer"
  npm run dummy-players -- tournament123 10 --prefix "Test"
`);
}

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs(args) {
    const options = {
        tournamentId: null,
        numberOfPlayers: null,
        prefix: 'JoueurFactice',
        password: 'password123'
    };

    // Vérifier --help
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    // Arguments positionnels
    const positionalArgs = args.filter(arg => !arg.startsWith('--'));
    options.tournamentId = positionalArgs[0];
    options.numberOfPlayers = parseInt(positionalArgs[1], 10);

    // Options
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--prefix' && args[i + 1]) {
            options.prefix = args[i + 1];
        }
        if (args[i] === '--password' && args[i + 1]) {
            options.password = args[i + 1];
        }
    }

    return options;
}

/**
 * Crée des joueurs factices pour un tournoi
 */
async function createDummyPlayers(options) {
    const { tournamentId, numberOfPlayers, prefix, password } = options;

    // Validation
    if (!tournamentId) {
        console.error('❌ Erreur: L\'ID du tournoi est requis.');
        showHelp();
        process.exit(1);
    }
    if (isNaN(numberOfPlayers) || numberOfPlayers <= 0) {
        console.error('❌ Erreur: Le nombre de joueurs doit être un nombre positif.');
        showHelp();
        process.exit(1);
    }

    console.log(`\n🎮 Création de ${numberOfPlayers} joueurs factices pour le tournoi ${tournamentId}...`);
    console.log(`   Préfixe: "${prefix}"`);
    console.log('');

    const levels = ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert'];
    const unassignedPlayersRef = adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < numberOfPlayers; i++) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const pseudo = `${prefix}${timestamp}${random}`;
        const email = `${prefix.toLowerCase()}${timestamp}${random}@dummy.example.com`;
        const level = levels[Math.floor(Math.random() * levels.length)];

        try {
            // 1. Créer l'utilisateur dans Firebase Authentication
            const userRecord = await adminAuth.createUser({
                email: email,
                password: password,
                displayName: pseudo,
            });
            const userId = userRecord.uid;

            // 2. Ajouter les données de l'utilisateur à Firestore
            await adminDb.collection('users').doc(userId).set({
                pseudo: pseudo,
                level: level,
                email: email,
                createdAt: new Date(),
                isDummy: true, // Marqueur pour identifier les joueurs factices
            });

            // 3. Ajouter le joueur à la liste des joueurs libres du tournoi
            const added = await addPlayerToCollection(unassignedPlayersRef, userId, pseudo, level);

            if (added) {
                console.log(`✅ ${pseudo} (Niveau: ${level})`);
                successCount++;
            } else {
                console.log(`⚠️  ${pseudo} créé mais déjà présent dans le tournoi`);
                successCount++;
            }

            // Petit délai pour éviter les conflits de timestamp
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            errorCount++;
            if (error.code === 'auth/email-already-exists') {
                console.error(`❌ Email déjà existant: ${email}`);
            } else {
                console.error(`❌ Erreur pour ${pseudo}:`, error.message);
            }
        }
    }

    console.log('');
    console.log('━'.repeat(50));
    console.log(`✨ Création terminée!`);
    console.log(`   ✅ Succès: ${successCount}/${numberOfPlayers}`);
    if (errorCount > 0) {
        console.log(`   ❌ Erreurs: ${errorCount}/${numberOfPlayers}`);
    }
    console.log('━'.repeat(50));
    console.log('');

    process.exit(errorCount > 0 ? 1 : 0);
}

// Point d'entrée
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = parseArgs(args);
    createDummyPlayers(options).catch(error => {
        console.error('❌ Erreur fatale:', error);
        process.exit(1);
    });
}

module.exports = { createDummyPlayers };
