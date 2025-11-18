const { adminAuth, adminDb } = require('../services/firebase');

/**
 * Affiche l'aide pour l'utilisation du script
 */
function showHelp() {
    console.log(`
Usage: node scripts/delete-dummy-players.js [options]

Options:
  --all                 Supprime TOUS les joueurs factices (isDummy: true)
  --prefix <text>       Supprime uniquement les joueurs avec ce préfixe
  --tournament <id>     Supprime les joueurs d'un tournoi spécifique
  --dry-run            Mode simulation (affiche ce qui serait supprimé sans supprimer)
  --help, -h           Affiche cette aide

Exemples:
  node scripts/delete-dummy-players.js --all
  node scripts/delete-dummy-players.js --prefix "JoueurFactice"
  node scripts/delete-dummy-players.js --tournament tournament123
  node scripts/delete-dummy-players.js --all --dry-run
  npm run delete-dummy -- --all
`);
}

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs(args) {
    const options = {
        all: false,
        prefix: null,
        tournamentId: null,
        dryRun: false
    };

    // Vérifier --help
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    // Options
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--all') {
            options.all = true;
        }
        if (args[i] === '--prefix' && args[i + 1]) {
            options.prefix = args[i + 1];
        }
        if (args[i] === '--tournament' && args[i + 1]) {
            options.tournamentId = args[i + 1];
        }
        if (args[i] === '--dry-run') {
            options.dryRun = true;
        }
    }

    return options;
}

/**
 * Récupère les joueurs factices à supprimer
 */
async function getDummyPlayers(options) {
    const { all, prefix, tournamentId } = options;
    const users = [];

    if (tournamentId) {
        // Récupérer les joueurs d'un tournoi spécifique
        console.log(`🔍 Recherche des joueurs dans le tournoi ${tournamentId}...`);
        const unassignedPlayersSnapshot = await adminDb
            .collection('events')
            .doc(tournamentId)
            .collection('unassignedPlayers')
            .get();

        for (const doc of unassignedPlayersSnapshot.docs) {
            const userId = doc.id;
            const userDoc = await adminDb.collection('users').doc(userId).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                users.push({
                    uid: userId,
                    pseudo: userData.pseudo,
                    email: userData.email,
                    isDummy: userData.isDummy || false
                });
            }
        }
    } else {
        // Récupérer tous les joueurs factices ou par préfixe
        console.log('🔍 Recherche des joueurs factices...');
        let query = adminDb.collection('users');

        if (all) {
            query = query.where('isDummy', '==', true);
        } else if (prefix) {
            // Firestore ne supporte pas les recherches LIKE, on doit tout récupérer et filtrer
            const allUsersSnapshot = await query.get();
            allUsersSnapshot.docs.forEach(doc => {
                const userData = doc.data();
                if (userData.pseudo && userData.pseudo.startsWith(prefix)) {
                    users.push({
                        uid: doc.id,
                        pseudo: userData.pseudo,
                        email: userData.email,
                        isDummy: userData.isDummy || false
                    });
                }
            });
            return users;
        } else {
            console.error('❌ Erreur: Vous devez spécifier --all, --prefix ou --tournament');
            showHelp();
            process.exit(1);
        }

        const snapshot = await query.get();
        snapshot.docs.forEach(doc => {
            const userData = doc.data();
            users.push({
                uid: doc.id,
                pseudo: userData.pseudo,
                email: userData.email,
                isDummy: userData.isDummy || false
            });
        });
    }

    return users;
}

/**
 * Supprime un joueur de Firebase Auth et Firestore
 */
async function deletePlayer(uid, dryRun = false) {
    if (dryRun) {
        return true;
    }

    try {
        // Supprimer de Firebase Auth
        await adminAuth.deleteUser(uid);

        // Supprimer de Firestore
        await adminDb.collection('users').doc(uid).delete();

        // Supprimer des tournois (unassignedPlayers et autres collections)
        const eventsSnapshot = await adminDb.collection('events').get();
        for (const eventDoc of eventsSnapshot.docs) {
            const unassignedPlayerRef = eventDoc.ref.collection('unassignedPlayers').doc(uid);
            const unassignedPlayerDoc = await unassignedPlayerRef.get();
            if (unassignedPlayerDoc.exists) {
                await unassignedPlayerRef.delete();
            }
        }

        return true;
    } catch (error) {
        console.error(`   Erreur: ${error.message}`);
        return false;
    }
}

/**
 * Supprime les joueurs factices
 */
async function deleteDummyPlayers(options) {
    const { dryRun } = options;

    if (dryRun) {
        console.log('🔍 MODE SIMULATION (aucune suppression réelle)\n');
    }

    // Récupérer les joueurs à supprimer
    const players = await getDummyPlayers(options);

    if (players.length === 0) {
        console.log('✅ Aucun joueur factice trouvé.');
        process.exit(0);
    }

    console.log(`\n📋 ${players.length} joueur(s) factice(s) trouvé(s):\n`);
    players.forEach((player, index) => {
        const dummyTag = player.isDummy ? '🏷️  [DUMMY]' : '';
        console.log(`   ${index + 1}. ${player.pseudo} (${player.email}) ${dummyTag}`);
    });

    if (!dryRun) {
        console.log(`\n⚠️  ATTENTION: Ces joueurs vont être DÉFINITIVEMENT supprimés!`);
        console.log('   Appuyez sur Ctrl+C pour annuler...\n');

        // Attendre 3 secondes avant de continuer
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n🗑️  Suppression en cours...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const player of players) {
        const success = await deletePlayer(player.uid, dryRun);
        if (success) {
            console.log(`✅ ${player.pseudo}`);
            successCount++;
        } else {
            console.log(`❌ ${player.pseudo}`);
            errorCount++;
        }
    }

    console.log('');
    console.log('━'.repeat(50));
    if (dryRun) {
        console.log(`🔍 Simulation terminée!`);
        console.log(`   ${players.length} joueur(s) seraient supprimés`);
    } else {
        console.log(`✨ Suppression terminée!`);
        console.log(`   ✅ Succès: ${successCount}/${players.length}`);
        if (errorCount > 0) {
            console.log(`   ❌ Erreurs: ${errorCount}/${players.length}`);
        }
    }
    console.log('━'.repeat(50));
    console.log('');

    process.exit(errorCount > 0 ? 1 : 0);
}

// Point d'entrée
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = parseArgs(args);
    deleteDummyPlayers(options).catch(error => {
        console.error('❌ Erreur fatale:', error);
        process.exit(1);
    });
}

module.exports = { deleteDummyPlayers };
