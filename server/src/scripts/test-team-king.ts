import { adminDb } from '../config/firebase.config';
import * as teamKingService from '../services/team-king.service';

type GameMode = '6v6' | '5v5' | '4v4' | '3v3' | '2v2';

interface TestTeamKingOptions {
  name: string | null;
  gameMode: GameMode;
  numberOfTeams: number;
  playersPerTeam: number;
  withScores: boolean;
  autoComplete: boolean;
}

/**
 * Affiche l'aide pour l'utilisation du script
 */
function showHelp(): void {
  console.log(`
Usage: npm run test-team-king -- [options]

Options:
  --name <text>         Nom du tournoi (défaut: "Tournoi Team King Test {timestamp}")
  --mode <mode>         Format de jeu: 6v6, 5v5, 4v4, 3v3, 2v2 (défaut: 4v4)
  --teams <number>      Nombre d'équipes (défaut: 16)
  --players <number>    Joueurs par équipe (défaut: 4)
  --with-scores         Génère des scores aléatoires pour tous les matchs
  --auto-complete       Complète automatiquement toutes les phases
  --help, -h            Affiche cette aide

Exemples:
  npm run test-team-king
  npm run test-team-king -- --name "Beach King" --mode 4v4 --teams 16
  npm run test-team-king -- --mode 4v4 --teams 16 --with-scores
  npm run test-team-king -- --mode 4v4 --teams 16 --with-scores --auto-complete

  # Dans Docker:
  docker exec -it usm-tournois-server npm run test-team-king -- --with-scores
`);
}

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs(args: string[]): TestTeamKingOptions {
  const options: TestTeamKingOptions = {
    name: null,
    gameMode: '4v4',
    numberOfTeams: 16,
    playersPerTeam: 4,
    withScores: false,
    autoComplete: false,
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
    if (args[i] === '--mode' && args[i + 1]) {
      options.gameMode = args[i + 1] as GameMode;
    }
    if (args[i] === '--teams' && args[i + 1]) {
      options.numberOfTeams = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--players' && args[i + 1]) {
      options.playersPerTeam = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--with-scores') {
      options.withScores = true;
    }
    if (args[i] === '--auto-complete') {
      options.autoComplete = true;
    }
  }

  return options;
}

/**
 * Génère des phases Team King selon le nombre d'équipes
 */
function generatePhases(numberOfTeams: number) {
  const phases = [];
  let currentTeams = numberOfTeams;
  let phaseNumber = 1;

  while (currentTeams > 1) {
    const numberOfPools = Math.max(1, Math.floor(currentTeams / 4));
    const teamsPerPool = Math.ceil(currentTeams / numberOfPools);
    const qualifiedPerPool = Math.ceil(teamsPerPool / 2);
    const totalQualified = qualifiedPerPool * numberOfPools;

    phases.push({
      phaseNumber,
      totalTeams: currentTeams,
      numberOfPools,
      teamsPerPool,
      qualifiedPerPool,
      totalQualified: Math.max(1, totalQualified),
      estimatedRounds: teamsPerPool <= 4 ? 5 : 7,
      scheduledDate: new Date(Date.now() + phaseNumber * 24 * 60 * 60 * 1000).toISOString(),
      phaseLabel: phaseNumber === 1 ? 'Journée 1' : phaseNumber === 2 ? 'Journée 2' : 'Finale',
    });

    currentTeams = totalQualified;
    phaseNumber++;

    // Limite de sécurité
    if (phaseNumber > 10) break;
  }

  return phases;
}

/**
 * Crée un tournoi Team King de test complet
 */
async function createTestTeamKing(options: TestTeamKingOptions): Promise<void> {
  const { name, gameMode, numberOfTeams, playersPerTeam, withScores, autoComplete } = options;

  const timestamp = new Date().toISOString().split('T')[0];
  const tournamentName = name || `Tournoi Team King Test ${timestamp}`;

  console.log('\n🏆 Création d\'un tournoi Team King de test...');
  console.log(`   Nom: "${tournamentName}"`);
  console.log(`   Format: ${gameMode}`);
  console.log(`   Équipes: ${numberOfTeams}`);
  console.log(`   Joueurs/équipe: ${playersPerTeam}`);
  console.log('');

  const now = new Date();
  const eventDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    // Créer le tournoi
    const tournament = {
      name: tournamentName,
      description: `Tournoi Team King de test créé automatiquement le ${now.toLocaleDateString('fr-FR')}`,
      date: eventDate,
      registrationStartDateTime: now,
      registrationEndDateTime: new Date(eventDate.getTime() - 1 * 24 * 60 * 60 * 1000),
      maxTeams: numberOfTeams,
      playersPerTeam,
      minPlayersPerTeam: playersPerTeam,
      location: 'Centre Sportif Test',
      type: 'Beach Volleyball',
      fields: 2,
      fee: 10.0,
      mixity: 'Mixed',
      requiresFemalePlayer: false,
      registrationsOpen: true,
      isActive: true,
      tournamentFormat: 'team-king',
      registrationMode: 'teams',
      setsPerMatchPool: 2,
      pointsPerSetPool: 21,
      tieBreakEnabledPools: false,
      eliminationPhaseEnabled: false,
      createdAt: now,
      updatedAt: now,
      isTestTournament: true,
    };

    const tournamentRef = await adminDb.collection('events').add(tournament);
    const tournamentId = tournamentRef.id;

    console.log(`✅ Tournoi créé avec l'ID: ${tournamentId}`);

    // Créer des équipes de test
    console.log(`\n👥 Création de ${numberOfTeams} équipes...`);

    const teamIds: string[] = [];
    for (let i = 1; i <= numberOfTeams; i++) {
      const teamName = `Équipe ${i}`;
      const teamRef = await tournamentRef.collection('teams').add({
        name: teamName,
        captainId: `captain${i}`,
        captainPseudo: `Capitaine ${i}`,
        members: Array.from({ length: playersPerTeam }, (_, j) => ({
          userId: `player${i}_${j + 1}`,
          pseudo: `Joueur ${i}.${j + 1}`,
          level: 'Confirmé',
        })),
        recruitmentOpen: false,
        registeredAt: now.toISOString(),
        createdAt: now,
        updatedAt: now,
      });
      teamIds.push(teamRef.id);
    }

    console.log(`✅ ${numberOfTeams} équipes créées`);

    // Générer les phases
    const phases = generatePhases(numberOfTeams);
    console.log(`\n📅 Génération de ${phases.length} phases:`);
    phases.forEach((phase) => {
      console.log(
        `   Phase ${phase.phaseNumber}: ${phase.totalTeams} équipes → ${phase.totalQualified} qualifiées (${phase.numberOfPools} poules)`
      );
    });

    // Initialiser le mode Team King
    console.log(`\n🏐 Initialisation du mode Team King...`);

    const kingData = teamKingService.initializeTeamKingTournament(
      gameMode,
      playersPerTeam,
      2,
      21,
      false
    );

    // Créer les phases
    const teamKingPhases = [];
    for (let i = 0; i < phases.length; i++) {
      const config = phases[i];
      const phaseNumber = i + 1;

      const participatingTeamIds = phaseNumber === 1 ? teamIds.slice(0, config.totalTeams) : [];

      const phase = teamKingService.createTeamKingPhase(
        tournamentId,
        phaseNumber,
        config,
        participatingTeamIds
      );

      teamKingPhases.push(phase);
    }

    kingData.phases = teamKingPhases;

    // Sauvegarder dans Firestore
    const teamKingDocRef = tournamentRef.collection('teamKing').doc('mainData');
    const batch = adminDb.batch();

    batch.set(teamKingDocRef, {
      gameMode: kingData.gameMode,
      playersPerTeam: kingData.playersPerTeam,
      setsPerMatch: kingData.setsPerMatch,
      pointsPerSet: kingData.pointsPerSet,
      tieBreakEnabled: kingData.tieBreakEnabled,
      currentPhaseNumber: null,
      winnerTeam: null,
      createdAt: kingData.createdAt,
      updatedAt: kingData.updatedAt,
    });

    for (const phase of kingData.phases) {
      const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phase.phaseNumber}`);
      batch.set(phaseDocRef, {
        id: phase.id,
        tournamentId,
        phaseNumber: phase.phaseNumber,
        status: phase.status,
        config: phase.config,
        participatingTeamIds: phase.participatingTeamIds,
        qualifiedTeamIds: phase.qualifiedTeamIds,
        eliminatedTeamIds: phase.eliminatedTeamIds,
        createdAt: phase.createdAt,
        configuredAt: phase.configuredAt,
      });
    }

    batch.update(tournamentRef, {
      teamKingInitialized: true,
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log(`✅ Mode Team King initialisé avec ${phases.length} phases`);

    // Démarrer les phases et générer les matchs si demandé
    if (withScores || autoComplete) {
      console.log(`\n⚡ Génération automatique des matchs et scores...`);

      // Récupérer les équipes
      const teamsSnapshot = await tournamentRef.collection('teams').get();
      const teams = teamsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];

      for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
        const phaseNumber = phaseIdx + 1;
        const phase = teamKingPhases[phaseIdx];

        console.log(`\n   Phase ${phaseNumber}:`);

        // Démarrer la phase
        const { pools, matches } = teamKingService.generatePhasePoolsAndMatches(phase, teams);
        console.log(`   ✓ ${matches.length} matchs générés`);

        // Sauvegarder les pools et matchs
        const phaseDocRef = teamKingDocRef.collection('phases').doc(`phase-${phaseNumber}`);
        const phaseBatch = adminDb.batch();

        for (const pool of pools) {
          const poolDocRef = phaseDocRef.collection('pools').doc(pool.id);
          phaseBatch.set(poolDocRef, {
            id: pool.id,
            name: pool.name,
            teams: pool.teams,
            teamCount: pool.teamCount,
            createdAt: pool.createdAt,
          });

          const poolMatches = matches.filter((m) => m.poolId === pool.id);
          for (const match of poolMatches) {
            const matchDocRef = poolDocRef.collection('matches').doc(match.id);

            // Générer des scores aléatoires si demandé
            if (withScores) {
              const team1Wins = Math.random() > 0.5;
              const isSweep = Math.random() > 0.3;
              const setsWonTeam1 = team1Wins ? 2 : isSweep ? 0 : 1;
              const setsWonTeam2 = team1Wins ? (isSweep ? 0 : 1) : 2;

              phaseBatch.set(matchDocRef, {
                ...match,
                setsWonTeam1,
                setsWonTeam2,
                winnerTeamId: team1Wins ? match.team1.id : match.team2.id,
                winnerTeamName: team1Wins ? match.team1.name : match.team2.name,
                status: 'completed',
              });
            } else {
              phaseBatch.set(matchDocRef, match);
            }
          }
        }

        phaseBatch.update(phaseDocRef, {
          status: withScores ? 'completed' : 'in_progress',
          startedAt: new Date(),
          ...(withScores && { completedAt: new Date() }),
        });

        phaseBatch.update(teamKingDocRef, {
          currentPhaseNumber: phaseNumber,
          updatedAt: new Date(),
        });

        await phaseBatch.commit();

        if (withScores) {
          console.log(`   ✓ Scores générés pour tous les matchs`);
        }

        // Calculer les qualifiés si autoComplete
        if (autoComplete && withScores) {
          const rankings = teamKingService.calculateTeamRankings(pools, matches);
          const qualifiedPerPoolDistribution = teamKingService.distributeQualifiedInPools(
            phase.config.totalQualified,
            phase.config.numberOfPools
          );

          const qualifiedTeamIds = teamKingService.calculatePhaseQualifiers(
            pools,
            matches,
            qualifiedPerPoolDistribution
          );

          const eliminatedTeamIds = teamKingService.getEliminatedTeams(
            phase.participatingTeamIds,
            qualifiedTeamIds
          );

          // Mettre à jour la phase avec les qualifiés
          await phaseDocRef.update({
            qualifiedTeamIds,
            eliminatedTeamIds,
          });

          // Si ce n'est pas la dernière phase, mettre à jour la phase suivante
          if (phaseIdx < phases.length - 1) {
            const nextPhaseDocRef = teamKingDocRef
              .collection('phases')
              .doc(`phase-${phaseNumber + 1}`);
            await nextPhaseDocRef.update({
              participatingTeamIds: qualifiedTeamIds,
            });

            // Mettre à jour la référence pour la prochaine itération
            teamKingPhases[phaseIdx + 1].participatingTeamIds = qualifiedTeamIds;
          }

          console.log(`   ✓ ${qualifiedTeamIds.length} équipes qualifiées`);
        }
      }
    }

    console.log('');
    console.log('━'.repeat(50));
    console.log(`✨ Tournoi Team King de test créé avec succès!`);
    console.log(`   ID: ${tournamentId}`);
    console.log(`   Format: ${gameMode}`);
    console.log(`   Équipes: ${numberOfTeams}`);
    console.log(`   Phases: ${phases.length}`);
    if (withScores) {
      console.log(`   Scores: ✓ Générés automatiquement`);
    }
    if (autoComplete) {
      console.log(`   Phases: ✓ Complétées automatiquement`);
    }
    console.log('');
    console.log(`   🔗 Dashboard: /admin/tournaments/${tournamentId}/team-king`);
    console.log('━'.repeat(50));
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erreur lors de la création du tournoi Team King:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Point d'entrée
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  createTestTeamKing(options).catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { createTestTeamKing };
