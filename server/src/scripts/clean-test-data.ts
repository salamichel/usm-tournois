import { adminAuth, adminDb } from '../config/firebase.config';

interface CleanOptions {
  tournaments: boolean;
  players: boolean;
  all: boolean;
  dryRun: boolean;
  olderThan?: number; // jours
}

interface TournamentInfo {
  id: string;
  name: string;
  date: Date;
  isTestTournament: boolean;
}

interface PlayerInfo {
  uid: string;
  pseudo: string;
  email: string;
  createdAt: Date;
}

/**
 * Affiche l'aide pour l'utilisation du script
 */
function showHelp(): void {
  console.log(`
Usage: npm run clean-test -- [options]

Options:
  --all                 Nettoie TOUT (tournois de test + joueurs factices)
  --tournaments         Nettoie uniquement les tournois de test
  --players             Nettoie uniquement les joueurs factices
  --older-than <days>   Nettoie uniquement les données plus vieilles que N jours
  --dry-run            Mode simulation (affiche ce qui serait supprimé)
  --help, -h           Affiche cette aide

Exemples:
  npm run clean-test -- --all --dry-run
  npm run clean-test -- --all
  npm run clean-test -- --tournaments --older-than 7
  npm run clean-test -- --players

  # Dans Docker:
  docker exec -it usm-tournois-server npm run clean-test -- --all --dry-run
`);
}

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs(args: string[]): CleanOptions {
  const options: CleanOptions = {
    tournaments: false,
    players: false,
    all: false,
    dryRun: false,
  };

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all') {
      options.all = true;
      options.tournaments = true;
      options.players = true;
    }
    if (args[i] === '--tournaments') {
      options.tournaments = true;
    }
    if (args[i] === '--players') {
      options.players = true;
    }
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
    if (args[i] === '--older-than' && args[i + 1]) {
      options.olderThan = parseInt(args[i + 1], 10);
    }
  }

  if (!options.tournaments && !options.players) {
    console.error('❌ Erreur: Vous devez spécifier --all, --tournaments ou --players');
    showHelp();
    process.exit(1);
  }

  return options;
}

/**
 * Récupère les tournois de test
 */
async function getTestTournaments(olderThan?: number): Promise<TournamentInfo[]> {
  const tournaments: TournamentInfo[] = [];
  const snapshot = await adminDb.collection('events').where('isTestTournament', '==', true).get();

  const cutoffDate = olderThan ? new Date(Date.now() - olderThan * 24 * 60 * 60 * 1000) : null;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const tournamentDate = data.createdAt?.toDate() || new Date();

    if (!cutoffDate || tournamentDate < cutoffDate) {
      tournaments.push({
        id: doc.id,
        name: data.name || 'N/A',
        date: tournamentDate,
        isTestTournament: data.isTestTournament || false,
      });
    }
  });

  return tournaments;
}

/**
 * Récupère les joueurs factices
 */
async function getDummyPlayers(olderThan?: number): Promise<PlayerInfo[]> {
  const players: PlayerInfo[] = [];
  const snapshot = await adminDb.collection('users').where('isDummy', '==', true).get();

  const cutoffDate = olderThan ? new Date(Date.now() - olderThan * 24 * 60 * 60 * 1000) : null;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate() || new Date();

    if (!cutoffDate || createdAt < cutoffDate) {
      players.push({
        uid: doc.id,
        pseudo: data.pseudo || 'N/A',
        email: data.email || 'N/A',
        createdAt,
      });
    }
  });

  return players;
}

/**
 * Supprime un tournoi et toutes ses sous-collections
 */
async function deleteTournament(tournamentId: string, dryRun: boolean = false): Promise<boolean> {
  if (dryRun) {
    return true;
  }

  try {
    const tournamentRef = adminDb.collection('events').doc(tournamentId);

    // Supprimer les sous-collections
    const subCollections = ['teams', 'unassignedPlayers', 'pools', 'eliminationMatches', 'finalRanking'];

    for (const collectionName of subCollections) {
      const snapshot = await tournamentRef.collection(collectionName).get();
      for (const doc of snapshot.docs) {
        // Supprimer les sous-sous-collections si nécessaire (ex: matches dans pools)
        if (collectionName === 'pools') {
          const matchesSnapshot = await doc.ref.collection('matches').get();
          for (const matchDoc of matchesSnapshot.docs) {
            await matchDoc.ref.delete();
          }
        }
        await doc.ref.delete();
      }
    }

    // Supprimer le tournoi principal
    await tournamentRef.delete();
    return true;
  } catch (error: any) {
    console.error(`   Erreur: ${error.message}`);
    return false;
  }
}

/**
 * Supprime un joueur de Firebase Auth et Firestore
 */
async function deletePlayer(uid: string, dryRun: boolean = false): Promise<boolean> {
  if (dryRun) {
    return true;
  }

  try {
    // Supprimer de Firebase Auth
    await adminAuth.deleteUser(uid);

    // Supprimer de Firestore
    await adminDb.collection('users').doc(uid).delete();

    // Supprimer des tournois
    const eventsSnapshot = await adminDb.collection('events').get();
    for (const eventDoc of eventsSnapshot.docs) {
      const unassignedPlayerRef = eventDoc.ref.collection('unassignedPlayers').doc(uid);
      const doc = await unassignedPlayerRef.get();
      if (doc.exists) {
        await unassignedPlayerRef.delete();
      }
    }

    return true;
  } catch (error: any) {
    console.error(`   Erreur: ${error.message}`);
    return false;
  }
}

/**
 * Nettoie les données de test
 */
async function cleanTestData(options: CleanOptions): Promise<void> {
  const { tournaments, players, dryRun, olderThan } = options;

  console.log('\n🧹 Nettoyage des données de test\n');

  if (dryRun) {
    console.log('🔍 MODE SIMULATION (aucune suppression réelle)\n');
  }

  if (olderThan) {
    console.log(`📅 Filtrage: données plus vieilles que ${olderThan} jour(s)\n`);
  }

  let totalDeleted = 0;
  let totalErrors = 0;

  // Nettoyer les tournois de test
  if (tournaments) {
    console.log('🏆 Recherche des tournois de test...');
    const testTournaments = await getTestTournaments(olderThan);

    if (testTournaments.length === 0) {
      console.log('   ✅ Aucun tournoi de test trouvé.\n');
    } else {
      console.log(`   📋 ${testTournaments.length} tournoi(s) de test trouvé(s):\n`);
      testTournaments.forEach((tournament, index) => {
        const age = Math.floor((Date.now() - tournament.date.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   ${index + 1}. ${tournament.name} (ID: ${tournament.id}, Age: ${age}j)`);
      });

      if (!dryRun) {
        console.log('\n   ⚠️  Suppression en cours...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.log('');
      for (const tournament of testTournaments) {
        const success = await deleteTournament(tournament.id, dryRun);
        if (success) {
          console.log(`   ✅ ${tournament.name}`);
          totalDeleted++;
        } else {
          console.log(`   ❌ ${tournament.name}`);
          totalErrors++;
        }
      }
      console.log('');
    }
  }

  // Nettoyer les joueurs factices
  if (players) {
    console.log('👥 Recherche des joueurs factices...');
    const dummyPlayers = await getDummyPlayers(olderThan);

    if (dummyPlayers.length === 0) {
      console.log('   ✅ Aucun joueur factice trouvé.\n');
    } else {
      console.log(`   📋 ${dummyPlayers.length} joueur(s) factice(s) trouvé(s):\n`);
      dummyPlayers.forEach((player, index) => {
        const age = Math.floor((Date.now() - player.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   ${index + 1}. ${player.pseudo} (${player.email}, Age: ${age}j)`);
      });

      if (!dryRun) {
        console.log('\n   ⚠️  Suppression en cours...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.log('');
      for (const player of dummyPlayers) {
        const success = await deletePlayer(player.uid, dryRun);
        if (success) {
          console.log(`   ✅ ${player.pseudo}`);
          totalDeleted++;
        } else {
          console.log(`   ❌ ${player.pseudo}`);
          totalErrors++;
        }
      }
      console.log('');
    }
  }

  // Résumé
  console.log('━'.repeat(50));
  if (dryRun) {
    console.log(`🔍 Simulation terminée!`);
    console.log(`   ${totalDeleted} élément(s) seraient supprimés`);
  } else {
    console.log(`✨ Nettoyage terminé!`);
    console.log(`   ✅ Succès: ${totalDeleted}`);
    if (totalErrors > 0) {
      console.log(`   ❌ Erreurs: ${totalErrors}`);
    }
  }
  console.log('━'.repeat(50));
  console.log('');

  process.exit(totalErrors > 0 ? 1 : 0);
}

// Point d'entrée
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  cleanTestData(options).catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { cleanTestData };
