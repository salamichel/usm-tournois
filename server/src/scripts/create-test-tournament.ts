import { adminDb } from '../config/firebase.config';
import { createDummyPlayers } from './create-dummy-players';

type TournamentType = 'king' | 'elimination' | 'pool' | 'standard';
type MatchFormat = 'aller' | 'aller-retour';
type Timing = 'future' | 'past' | 'now';

interface TestTournamentOptions {
  name: string | null;
  type: TournamentType;
  maxTeams: number;
  playersPerTeam: number;
  format: MatchFormat;
  timing: Timing;
  withPlayers: number;
}

/**
 * Affiche l'aide pour l'utilisation du script
 */
function showHelp(): void {
  console.log(`
Usage: npm run test-tournament -- [options]

Options:
  --name <text>         Nom du tournoi (défaut: "Tournoi Test {timestamp}")
  --type <type>         Type de tournoi: king, elimination, pool, standard (défaut: standard)
  --teams <number>      Nombre maximum d'équipes (défaut: 8)
  --players <number>    Joueurs par équipe (défaut: 2)
  --format <format>     Format: aller, aller-retour (défaut: aller)
  --future              Crée un tournoi futur (inscriptions ouvertes)
  --past                Crée un tournoi passé
  --with-players <n>    Crée aussi N joueurs factices
  --help, -h            Affiche cette aide

Exemples:
  npm run test-tournament
  npm run test-tournament -- --name "Mon Tournoi" --teams 16
  npm run test-tournament -- --type king --with-players 20

  # Dans Docker:
  docker exec -it usm-tournois-server npm run test-tournament -- --type king
`);
}

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs(args: string[]): TestTournamentOptions {
  const options: TestTournamentOptions = {
    name: null,
    type: 'standard',
    maxTeams: 8,
    playersPerTeam: 2,
    format: 'aller',
    timing: 'future',
    withPlayers: 0,
  };

  // Vérifier --help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Options
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      options.name = args[i + 1];
    }
    if (args[i] === '--type' && args[i + 1]) {
      options.type = args[i + 1] as TournamentType;
    }
    if (args[i] === '--teams' && args[i + 1]) {
      options.maxTeams = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--players' && args[i + 1]) {
      options.playersPerTeam = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--format' && args[i + 1]) {
      options.format = args[i + 1] as MatchFormat;
    }
    if (args[i] === '--future') {
      options.timing = 'future';
    }
    if (args[i] === '--past') {
      options.timing = 'past';
    }
    if (args[i] === '--with-players' && args[i + 1]) {
      options.withPlayers = parseInt(args[i + 1], 10);
    }
  }

  return options;
}

/**
 * Génère une date selon le timing demandé
 */
function generateDate(timing: Timing): Date {
  const now = new Date();

  switch (timing) {
    case 'past':
      // Il y a 7 jours
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'future':
      // Dans 7 jours
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return now;
  }
}

/**
 * Génère les dates d'inscription
 */
function generateRegistrationDates(timing: Timing, eventDate: Date): { start: Date; end: Date } {
  const now = new Date();

  switch (timing) {
    case 'past':
      // Inscriptions fermées (il y a 10 jours -> il y a 8 jours)
      return {
        start: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      };
    case 'future':
      // Inscriptions ouvertes (maintenant -> 1 jour avant l'événement)
      return {
        start: now,
        end: new Date(eventDate.getTime() - 1 * 24 * 60 * 60 * 1000),
      };
    default:
      // Inscriptions ouvertes (il y a 1 jour -> dans 1 jour)
      return {
        start: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      };
  }
}

/**
 * Crée un tournoi de test
 */
async function createTestTournament(options: TestTournamentOptions): Promise<void> {
  const { name, type, maxTeams, playersPerTeam, format, timing, withPlayers } = options;

  const timestamp = new Date().toISOString().split('T')[0];
  const tournamentName = name || `Tournoi Test ${timestamp}`;

  console.log('\n🏆 Création d\'un tournoi de test...');
  console.log(`   Nom: "${tournamentName}"`);
  console.log(`   Type: ${type}`);
  console.log(`   Équipes: ${maxTeams}`);
  console.log(`   Joueurs/équipe: ${playersPerTeam}`);
  console.log('');

  const eventDate = generateDate(timing);
  const registrationDates = generateRegistrationDates(timing, eventDate);

  // Construction de l'objet tournoi
  const tournament = {
    name: tournamentName,
    description: `Tournoi de test créé automatiquement le ${new Date().toLocaleDateString('fr-FR')}`,
    whatsappGroupLink: null,
    date: eventDate,
    registrationStartDateTime: registrationDates.start,
    registrationEndDateTime: registrationDates.end,
    maxTeams,
    playersPerTeam,
    minPlayersPerTeam: playersPerTeam,
    location: 'Centre Sportif Test',
    type,
    fields: Math.ceil(maxTeams / 4), // 1 terrain pour 4 équipes environ
    fee: 10.0,
    mixity: 'mixed',
    requiresFemalePlayer: false,
    registrationsOpen: timing === 'future',
    isActive: timing !== 'past',
    waitingListEnabled: true,
    waitingListSize: Math.ceil(maxTeams * 0.25), // 25% de la capacité

    // Configuration des poules
    setsPerMatchPool: 1,
    pointsPerSetPool: 21,
    maxTeamsPerPool: 4,
    teamsQualifiedPerPool: 2,

    // Configuration de l'élimination
    eliminationPhaseEnabled: type === 'standard' || type === 'elimination',
    setsPerMatchElimination: type === 'elimination' || type === 'standard' ? 3 : null,
    pointsPerSetElimination: type === 'elimination' || type === 'standard' ? 21 : null,

    tieBreakEnabledPools: true,
    tieBreakEnabledElimination: true,
    matchFormat: format,
    tournamentFormat: type,

    // Métadonnées
    createdAt: new Date(),
    updatedAt: new Date(),
    isTestTournament: true, // Marqueur pour identifier les tournois de test
  };

  try {
    // Créer le tournoi
    const tournamentRef = await adminDb.collection('events').add(tournament);
    const tournamentId = tournamentRef.id;

    console.log(`✅ Tournoi créé avec l'ID: ${tournamentId}`);
    console.log(`   Date: ${eventDate.toLocaleDateString('fr-FR')} ${eventDate.toLocaleTimeString('fr-FR')}`);
    console.log(
      `   Inscriptions: ${registrationDates.start.toLocaleDateString('fr-FR')} -> ${registrationDates.end.toLocaleDateString('fr-FR')}`
    );
    console.log(`   Statut: ${timing === 'future' ? '🔓 Ouvert' : timing === 'past' ? '🔒 Fermé' : '⏱️  En cours'}`);

    // Créer des joueurs factices si demandé
    if (withPlayers > 0) {
      console.log(`\n👥 Création de ${withPlayers} joueurs factices...`);

      try {
        await createDummyPlayers({
          tournamentId,
          numberOfPlayers: withPlayers,
          prefix: 'TestPlayer',
          password: 'password123',
        });
      } catch (error: any) {
        console.error('❌ Erreur lors de la création des joueurs:', error.message);
      }
    }

    console.log('');
    console.log('━'.repeat(50));
    console.log(`✨ Tournoi de test créé avec succès!`);
    console.log(`   ID: ${tournamentId}`);
    console.log('━'.repeat(50));
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erreur lors de la création du tournoi:', error);
    process.exit(1);
  }
}

// Point d'entrée
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  createTestTournament(options).catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { createTestTournament };
