import { adminAuth, adminDb } from '../config/firebase.config';
import type { CollectionReference } from 'firebase-admin/firestore';

interface DummyPlayerOptions {
  tournamentId: string;
  numberOfPlayers: number;
  prefix?: string;
  password?: string;
}

/**
 * Affiche l'aide pour l'utilisation du script
 */
function showHelp(): void {
  console.log(`
Usage: npm run dummy-players -- <tournamentId> <numberOfPlayers> [options]

Arguments:
  tournamentId      ID du tournoi dans lequel ajouter les joueurs
  numberOfPlayers   Nombre de joueurs factices à créer

Options:
  --prefix <text>   Préfixe pour les noms des joueurs (défaut: "JoueurFactice")
  --password <pwd>  Mot de passe pour les comptes (défaut: "password123")
  --help, -h        Affiche cette aide

Exemples:
  npm run dummy-players -- tournament123 10
  npm run dummy-players -- tournament123 5 --prefix "TestPlayer"

  # Dans Docker:
  docker exec -it usm-tournois-server npm run dummy-players -- tournament123 10
`);
}

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs(args: string[]): DummyPlayerOptions | null {
  const options: DummyPlayerOptions = {
    tournamentId: '',
    numberOfPlayers: 0,
    prefix: 'JoueurFactice',
    password: 'password123',
  };

  // Vérifier --help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Arguments positionnels
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
  options.tournamentId = positionalArgs[0] || '';
  options.numberOfPlayers = parseInt(positionalArgs[1], 10) || 0;

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
 * Ajoute un joueur à une collection avec gestion des doublons
 */
async function addPlayerToCollection(
  collectionRef: CollectionReference,
  userId: string,
  pseudo: string,
  level: string
): Promise<boolean> {
  // Vérifier si le joueur est déjà présent
  const existingPlayer = await collectionRef.where('userId', '==', userId).limit(1).get();
  if (!existingPlayer.empty) {
    return false; // Le joueur existe déjà
  }

  // Ajouter le joueur à la collection
  await collectionRef.add({
    userId,
    pseudo,
    level,
    addedAt: new Date(),
  });

  return true;
}

/**
 * Crée des joueurs factices pour un tournoi
 */
async function createDummyPlayers(options: DummyPlayerOptions): Promise<void> {
  const { tournamentId, numberOfPlayers, prefix = 'JoueurFactice', password = 'password123' } = options;

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

  const levels = ['Débutant', 'Intermédiaire', 'Confirmé'];
  const unassignedPlayersRef = adminDb
    .collection('events')
    .doc(tournamentId)
    .collection('unassignedPlayers');

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
        email,
        password,
        displayName: pseudo,
      });
      const userId = userRecord.uid;

      // 2. Ajouter les données de l'utilisateur à Firestore
      await adminDb.collection('users').doc(userId).set({
        pseudo,
        level,
        email,
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
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error: any) {
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
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options) {
    createDummyPlayers(options).catch((error) => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
  }
}

export { createDummyPlayers };
