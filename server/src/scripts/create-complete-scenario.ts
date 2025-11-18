import { adminAuth, adminDb } from '../config/firebase.config';

type TournamentType = 'king' | 'elimination' | 'pool' | 'classic';

interface ScenarioOptions {
  name: string | null;
  type: TournamentType;
  numTeams: number;
  playersPerTeam: number;
  withMatches: boolean;
  simulate: boolean;
}

interface TeamData {
  id: string;
  name: string;
  captainId: string;
  members: string[];
}

/**
 * Affiche l'aide
 */
function showHelp(): void {
  console.log(`
Usage: npm run scenario -- [options]

Options:
  --name <text>         Nom du tournoi (défaut: "Scénario Complet {date}")
  --type <type>         Type: king, elimination, pool, classic (défaut: classic)
  --teams <number>      Nombre d'équipes (défaut: 8)
  --players <number>    Joueurs par équipe (défaut: 2)
  --with-matches        Créer les matchs de poules
  --simulate            Simuler les résultats des matchs
  --help, -h            Affiche cette aide

Exemples:
  npm run scenario
  npm run scenario -- --type classic --teams 8 --with-matches
  npm run scenario -- --type king --teams 12 --simulate
  npm run scenario -- --name "Test Complet" --teams 16 --players 4 --simulate

  # Dans Docker:
  docker exec -it usm-tournois-server npm run scenario -- --simulate
`);
}

/**
 * Parse les arguments
 */
function parseArgs(args: string[]): ScenarioOptions {
  const options: ScenarioOptions = {
    name: null,
    type: 'classic',
    numTeams: 8,
    playersPerTeam: 2,
    withMatches: false,
    simulate: false,
  };

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      options.name = args[i + 1];
    }
    if (args[i] === '--type' && args[i + 1]) {
      options.type = args[i + 1] as TournamentType;
    }
    if (args[i] === '--teams' && args[i + 1]) {
      options.numTeams = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--players' && args[i + 1]) {
      options.playersPerTeam = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--with-matches') {
      options.withMatches = true;
    }
    if (args[i] === '--simulate') {
      options.simulate = true;
      options.withMatches = true; // simulate implique with-matches
    }
  }

  return options;
}

/**
 * Crée un tournoi
 */
async function createTournament(options: ScenarioOptions): Promise<string> {
  const { name, type, numTeams, playersPerTeam } = options;

  const now = new Date();
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tournamentName = name || `Scénario Complet ${now.toISOString().split('T')[0]}`;

  const tournament = {
    name: tournamentName,
    description: 'Scénario de test complet avec équipes et matchs',
    whatsappGroupLink: null,
    date: futureDate,
    registrationStartDateTime: now,
    registrationEndDateTime: new Date(futureDate.getTime() - 1 * 24 * 60 * 60 * 1000),
    maxTeams: numTeams,
    playersPerTeam,
    minPlayersPerTeam: playersPerTeam,
    location: 'Centre Sportif Test',
    type,
    fields: Math.ceil(numTeams / 4),
    fee: 10.0,
    mixity: 'mixed',
    requiresFemalePlayer: false,
    registrationsOpen: false, // Fermé car on crée tout automatiquement
    isActive: true,
    waitingListEnabled: false,
    waitingListSize: 0,
    setsPerMatchPool: 1,
    pointsPerSetPool: 21,
    maxTeamsPerPool: 4,
    teamsQualifiedPerPool: 2,
    eliminationPhaseEnabled: type === 'classic' || type === 'elimination',
    setsPerMatchElimination: type === 'elimination' || type === 'classic' ? 3 : null,
    pointsPerSetElimination: type === 'elimination' || type === 'classic' ? 21 : null,
    tieBreakEnabledPools: true,
    tieBreakEnabledElimination: true,
    matchFormat: 'aller',
    tournamentFormat: type,
    createdAt: new Date(),
    updatedAt: new Date(),
    isTestTournament: true,
  };

  const tournamentRef = await adminDb.collection('events').add(tournament);
  return tournamentRef.id;
}

/**
 * Crée des joueurs pour le scénario
 */
async function createPlayers(numPlayers: number): Promise<string[]> {
  const playerIds: string[] = [];
  const levels = ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert'];

  for (let i = 0; i < numPlayers; i++) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const pseudo = `Player${timestamp}${random}`;
    const email = `player${timestamp}${random}@scenario.test`;
    const level = levels[Math.floor(Math.random() * levels.length)];

    try {
      const userRecord = await adminAuth.createUser({
        email,
        password: 'scenario123',
        displayName: pseudo,
      });

      await adminDb.collection('users').doc(userRecord.uid).set({
        pseudo,
        level,
        email,
        createdAt: new Date(),
        isDummy: true,
      });

      playerIds.push(userRecord.uid);
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error: any) {
      console.error(`Erreur création joueur ${pseudo}:`, error.message);
    }
  }

  return playerIds;
}

/**
 * Crée des équipes avec les joueurs
 */
async function createTeams(
  tournamentId: string,
  playerIds: string[],
  playersPerTeam: number
): Promise<TeamData[]> {
  const teams: TeamData[] = [];
  const teamNames = [
    'Les Aigles', 'Les Lions', 'Les Tigres', 'Les Panthères',
    'Les Faucons', 'Les Requins', 'Les Loups', 'Les Dragons',
    'Les Cobras', 'Les Jaguars', 'Les Ours', 'Les Renards',
    'Les Lynx', 'Les Guépards', 'Les Vautours', 'Les Scorpions',
  ];

  let playerIndex = 0;

  for (let i = 0; i < Math.ceil(playerIds.length / playersPerTeam); i++) {
    const teamPlayerIds = playerIds.slice(playerIndex, playerIndex + playersPerTeam);

    if (teamPlayerIds.length === 0) break;

    const captainId = teamPlayerIds[0];
    const teamName = teamNames[i % teamNames.length] + ` ${i + 1}`;

    // Récupérer les pseudos pour l'affichage
    const membersData = await Promise.all(
      teamPlayerIds.map(async (uid) => {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        return {
          userId: uid,
          pseudo: userDoc.data()?.pseudo || 'N/A',
          level: userDoc.data()?.level || 'N/A',
        };
      })
    );

    const teamData = {
      name: teamName,
      captainId,
      members: teamPlayerIds,
      membersData,
      recruitmentOpen: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const teamRef = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('teams')
      .add(teamData);

    teams.push({
      id: teamRef.id,
      name: teamName,
      captainId,
      members: teamPlayerIds,
    });

    playerIndex += playersPerTeam;
  }

  return teams;
}

/**
 * Crée les poules et les matchs
 */
async function createPoolsAndMatches(
  tournamentId: string,
  teams: TeamData[],
  simulate: boolean
): Promise<void> {
  const maxTeamsPerPool = 4;
  const numPools = Math.ceil(teams.length / maxTeamsPerPool);

  for (let poolIndex = 0; poolIndex < numPools; poolIndex++) {
    const poolTeams = teams.slice(poolIndex * maxTeamsPerPool, (poolIndex + 1) * maxTeamsPerPool);

    if (poolTeams.length === 0) continue;

    // Créer la poule
    const poolData = {
      name: `Poule ${String.fromCharCode(65 + poolIndex)}`, // A, B, C, etc.
      teams: poolTeams.map((t) => t.id),
      createdAt: new Date(),
    };

    const poolRef = await adminDb
      .collection('events')
      .doc(tournamentId)
      .collection('pools')
      .add(poolData);

    // Créer les matchs de poule (round-robin)
    let matchNumber = 1;
    for (let i = 0; i < poolTeams.length; i++) {
      for (let j = i + 1; j < poolTeams.length; j++) {
        const team1 = poolTeams[i];
        const team2 = poolTeams[j];

        const matchData: any = {
          matchNumber,
          team1Id: team1.id,
          team2Id: team2.id,
          team1Name: team1.name,
          team2Name: team2.name,
          team1Score: 0,
          team2Score: 0,
          isFinished: false,
          sets: [],
          createdAt: new Date(),
        };

        // Simuler le résultat si demandé
        if (simulate) {
          const winner = Math.random() > 0.5 ? 1 : 2;
          matchData.team1Score = winner === 1 ? 21 : Math.floor(Math.random() * 19) + 10;
          matchData.team2Score = winner === 2 ? 21 : Math.floor(Math.random() * 19) + 10;
          matchData.isFinished = true;
          matchData.sets = [
            {
              setNumber: 1,
              team1Score: matchData.team1Score,
              team2Score: matchData.team2Score,
            },
          ];
        }

        await poolRef.collection('matches').add(matchData);
        matchNumber++;
      }
    }
  }
}

/**
 * Crée un scénario complet
 */
async function createCompleteScenario(options: ScenarioOptions): Promise<void> {
  const { numTeams, playersPerTeam, withMatches, simulate } = options;

  console.log('\n🎬 Création d\'un scénario complet...\n');

  // 1. Créer le tournoi
  console.log('🏆 Étape 1/4: Création du tournoi...');
  const tournamentId = await createTournament(options);
  console.log(`   ✅ Tournoi créé (ID: ${tournamentId})\n`);

  // 2. Créer les joueurs
  const totalPlayers = numTeams * playersPerTeam;
  console.log(`👥 Étape 2/4: Création de ${totalPlayers} joueurs...`);
  const playerIds = await createPlayers(totalPlayers);
  console.log(`   ✅ ${playerIds.length} joueurs créés\n`);

  // 3. Créer les équipes
  console.log(`🏅 Étape 3/4: Création de ${numTeams} équipes...`);
  const teams = await createTeams(tournamentId, playerIds, playersPerTeam);
  console.log(`   ✅ ${teams.length} équipes créées\n`);
  teams.forEach((team, index) => {
    console.log(`   ${index + 1}. ${team.name} (${team.members.length} joueurs)`);
  });

  // 4. Créer les poules et matchs si demandé
  if (withMatches) {
    console.log(`\n⚽ Étape 4/4: Création des poules et matchs...`);
    await createPoolsAndMatches(tournamentId, teams, simulate);
    const statusText = simulate ? 'avec résultats simulés' : 'sans résultats';
    console.log(`   ✅ Poules et matchs créés ${statusText}\n`);
  } else {
    console.log('\n⏭️  Étape 4/4: Poules et matchs ignorés (utilisez --with-matches)\n');
  }

  // Résumé
  console.log('━'.repeat(50));
  console.log('✨ Scénario complet créé avec succès!');
  console.log('');
  console.log(`   🏆 Tournoi: ${tournamentId}`);
  console.log(`   👥 Joueurs: ${playerIds.length}`);
  console.log(`   🏅 Équipes: ${teams.length}`);
  if (withMatches) {
    const numPools = Math.ceil(teams.length / 4);
    const matchesPerPool = (teamCount: number) => (teamCount * (teamCount - 1)) / 2;
    let totalMatches = 0;
    for (let i = 0; i < numPools; i++) {
      const poolSize = Math.min(4, teams.length - i * 4);
      totalMatches += matchesPerPool(poolSize);
    }
    console.log(`   ⚽ Matchs: ~${totalMatches} (${simulate ? 'simulés' : 'à jouer'})`);
  }
  console.log('━'.repeat(50));
  console.log('');

  process.exit(0);
}

// Point d'entrée
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  createCompleteScenario(options).catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { createCompleteScenario };
