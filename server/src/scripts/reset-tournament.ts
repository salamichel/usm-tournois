import { adminDb } from '../config/firebase.config';

interface ResetOptions {
  tournamentId: string;
  teams: boolean;
  matches: boolean;
  players: boolean;
  all: boolean;
  dryRun: boolean;
}

/**
 * Affiche l'aide
 */
function showHelp(): void {
  console.log(`
Usage: npm run reset-tournament -- <tournamentId> [options]

Arguments:
  tournamentId          ID du tournoi à réinitialiser

Options:
  --all                 Réinitialise tout (équipes, matchs, joueurs)
  --teams               Supprime uniquement les équipes
  --matches             Supprime uniquement les matchs
  --players             Supprime uniquement les joueurs libres
  --dry-run            Mode simulation
  --help, -h           Affiche cette aide

Exemples:
  npm run reset-tournament -- tournament123 --all --dry-run
  npm run reset-tournament -- tournament123 --all
  npm run reset-tournament -- tournament123 --teams --matches

  # Dans Docker:
  docker exec -it usm-tournois-server npm run reset-tournament -- tournament123 --all
`);
}

/**
 * Parse les arguments
 */
function parseArgs(args: string[]): ResetOptions {
  const options: ResetOptions = {
    tournamentId: '',
    teams: false,
    matches: false,
    players: false,
    all: false,
    dryRun: false,
  };

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Premier argument est l'ID du tournoi
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
  options.tournamentId = positionalArgs[0] || '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all') {
      options.all = true;
      options.teams = true;
      options.matches = true;
      options.players = true;
    }
    if (args[i] === '--teams') {
      options.teams = true;
    }
    if (args[i] === '--matches') {
      options.matches = true;
    }
    if (args[i] === '--players') {
      options.players = true;
    }
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }

  if (!options.tournamentId) {
    console.error('❌ Erreur: L\'ID du tournoi est requis.');
    showHelp();
    process.exit(1);
  }

  if (!options.teams && !options.matches && !options.players) {
    console.error('❌ Erreur: Vous devez spécifier --all, --teams, --matches ou --players');
    showHelp();
    process.exit(1);
  }

  return options;
}

/**
 * Vérifie que le tournoi existe
 */
async function checkTournamentExists(tournamentId: string): Promise<boolean> {
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  return tournamentDoc.exists;
}

/**
 * Supprime les équipes
 */
async function deleteTeams(tournamentId: string, dryRun: boolean): Promise<number> {
  const teamsRef = adminDb.collection('events').doc(tournamentId).collection('teams');
  const snapshot = await teamsRef.get();

  if (snapshot.empty) {
    return 0;
  }

  console.log(`   📋 ${snapshot.size} équipe(s) trouvée(s)`);

  if (!dryRun) {
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
  }

  return snapshot.size;
}

/**
 * Supprime les poules et leurs matchs
 */
async function deletePoolsAndMatches(tournamentId: string, dryRun: boolean): Promise<number> {
  const poolsRef = adminDb.collection('events').doc(tournamentId).collection('pools');
  const poolsSnapshot = await poolsRef.get();

  let totalDeleted = 0;

  if (!poolsSnapshot.empty) {
    console.log(`   📋 ${poolsSnapshot.size} poule(s) trouvée(s)`);

    if (!dryRun) {
      for (const poolDoc of poolsSnapshot.docs) {
        // Supprimer les matchs de la poule
        const matchesSnapshot = await poolDoc.ref.collection('matches').get();
        for (const matchDoc of matchesSnapshot.docs) {
          await matchDoc.ref.delete();
          totalDeleted++;
        }
        // Supprimer la poule
        await poolDoc.ref.delete();
        totalDeleted++;
      }
    } else {
      for (const poolDoc of poolsSnapshot.docs) {
        const matchesSnapshot = await poolDoc.ref.collection('matches').get();
        totalDeleted += matchesSnapshot.size + 1; // matchs + poule
      }
    }
  }

  // Supprimer les matchs d'élimination
  const eliminationMatchesRef = adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('eliminationMatches');
  const eliminationSnapshot = await eliminationMatchesRef.get();

  if (!eliminationSnapshot.empty) {
    console.log(`   📋 ${eliminationSnapshot.size} match(s) d'élimination trouvé(s)`);

    if (!dryRun) {
      for (const doc of eliminationSnapshot.docs) {
        await doc.ref.delete();
        totalDeleted++;
      }
    } else {
      totalDeleted += eliminationSnapshot.size;
    }
  }

  return totalDeleted;
}

/**
 * Supprime les joueurs libres
 */
async function deleteUnassignedPlayers(tournamentId: string, dryRun: boolean): Promise<number> {
  const playersRef = adminDb.collection('events').doc(tournamentId).collection('unassignedPlayers');
  const snapshot = await playersRef.get();

  if (snapshot.empty) {
    return 0;
  }

  console.log(`   📋 ${snapshot.size} joueur(s) libre(s) trouvé(s)`);

  if (!dryRun) {
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
  }

  return snapshot.size;
}

/**
 * Supprime le classement final
 */
async function deleteFinalRanking(tournamentId: string, dryRun: boolean): Promise<number> {
  const rankingRef = adminDb.collection('events').doc(tournamentId).collection('finalRanking');
  const snapshot = await rankingRef.get();

  if (snapshot.empty) {
    return 0;
  }

  console.log(`   📋 ${snapshot.size} entrée(s) de classement trouvée(s)`);

  if (!dryRun) {
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
  }

  return snapshot.size;
}

/**
 * Réinitialise le tournoi
 */
async function resetTournament(options: ResetOptions): Promise<void> {
  const { tournamentId, teams, matches, players, dryRun } = options;

  console.log(`\n🔄 Réinitialisation du tournoi ${tournamentId}...\n`);

  if (dryRun) {
    console.log('🔍 MODE SIMULATION (aucune suppression réelle)\n');
  }

  // Vérifier que le tournoi existe
  const exists = await checkTournamentExists(tournamentId);
  if (!exists) {
    console.error('❌ Erreur: Tournoi non trouvé');
    process.exit(1);
  }

  // Récupérer les infos du tournoi
  const tournamentDoc = await adminDb.collection('events').doc(tournamentId).get();
  const tournamentData = tournamentDoc.data();
  console.log(`📋 Tournoi: ${tournamentData?.name || 'N/A'}`);
  console.log(`   Type: ${tournamentData?.tournamentFormat || 'N/A'}`);
  console.log(`   Date: ${tournamentData?.date?.toDate().toLocaleDateString('fr-FR') || 'N/A'}`);
  console.log('');

  let totalDeleted = 0;

  // Supprimer les équipes
  if (teams) {
    console.log('🏅 Suppression des équipes...');
    const deleted = await deleteTeams(tournamentId, dryRun);
    totalDeleted += deleted;
    console.log(`   ${dryRun ? '🔍' : '✅'} ${deleted} équipe(s) ${dryRun ? 'à supprimer' : 'supprimée(s)'}\n`);
  }

  // Supprimer les matchs et poules
  if (matches) {
    console.log('⚽ Suppression des matchs et poules...');
    const deleted = await deletePoolsAndMatches(tournamentId, dryRun);
    totalDeleted += deleted;
    console.log(
      `   ${dryRun ? '🔍' : '✅'} ${deleted} élément(s) ${dryRun ? 'à supprimer' : 'supprimé(s)'}\n`
    );

    // Supprimer aussi le classement final
    const rankingDeleted = await deleteFinalRanking(tournamentId, dryRun);
    if (rankingDeleted > 0) {
      totalDeleted += rankingDeleted;
      console.log(
        `   ${dryRun ? '🔍' : '✅'} Classement final ${dryRun ? 'à supprimer' : 'supprimé'}\n`
      );
    }
  }

  // Supprimer les joueurs libres
  if (players) {
    console.log('👥 Suppression des joueurs libres...');
    const deleted = await deleteUnassignedPlayers(tournamentId, dryRun);
    totalDeleted += deleted;
    console.log(
      `   ${dryRun ? '🔍' : '✅'} ${deleted} joueur(s) ${dryRun ? 'à supprimer' : 'supprimé(s)'}\n`
    );
  }

  // Résumé
  console.log('━'.repeat(50));
  if (dryRun) {
    console.log(`🔍 Simulation terminée!`);
    console.log(`   ${totalDeleted} élément(s) seraient supprimés`);
  } else {
    console.log(`✨ Réinitialisation terminée!`);
    console.log(`   ✅ ${totalDeleted} élément(s) supprimés`);
    console.log(`   🏆 Le tournoi ${tournamentId} est prêt à être réutilisé`);
  }
  console.log('━'.repeat(50));
  console.log('');

  process.exit(0);
}

// Point d'entrée
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  resetTournament(options).catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { resetTournament };
