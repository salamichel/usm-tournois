const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middlewares/auth.middleware');

// Importer les contrôleurs d'administration
const adminTournamentController = require('../controllers/admin/admin.tournament.controller');
const adminTeamController = require('../controllers/admin/admin.team.controller');
const adminUserController = require('../controllers/admin/admin.user.controller');
const adminDashboardController = require('../controllers/admin/admin.dashboard.controller');
const adminUnassignedPlayerController = require('../controllers/admin/admin.unassignedPlayer.controller'); // Nouveau contrôleur
const adminPoolController = require('../controllers/admin/admin.pool.controller'); // Nouveau contrôleur pour les poules
const upload = require('../middlewares/upload.middleware'); // Importer le middleware d'upload

// Importer le middleware de gestion des tournois
const { getTournament } = require('../middlewares/tournament.middleware');

// Toutes les routes d'administration utiliseront le middleware isAdmin
router.use(isAdmin);

// Routes du tableau de bord de l'administration
router.get('/dashboard', adminDashboardController.showDashboard);

// Routes CRUD pour les tournois
router.get('/tournaments', adminTournamentController.listTournaments);
router.get('/tournaments/new', adminTournamentController.showCreateTournamentForm);
router.post('/tournaments', upload.single('coverImage'), adminTournamentController.createTournament);
router.get('/tournaments/:id/edit', adminTournamentController.showEditTournamentForm);
router.post('/tournaments/:id', upload.single('coverImage'), adminTournamentController.updateTournament);
router.post('/tournaments/:id/delete', adminTournamentController.deleteTournament); // Utilisation de POST pour la suppression via formulaire
router.post('/tournaments/:id/clone', adminTournamentController.cloneTournament);
router.get('/tournaments/:tournamentId/guaranteed-matches', getTournament, adminTournamentController.showGuaranteedMatches);

// Routes pour la gestion des poules et matchs d'un tournoi
router.get('/tournaments/:tournamentId/pools', getTournament, adminPoolController.showPoolsManagement);
router.post('/tournaments/:tournamentId/pools', getTournament, adminPoolController.createPool);
router.post('/tournaments/:tournamentId/pools/:poolId/update-name', getTournament, adminPoolController.updatePoolName); // Nouvelle route pour mettre à jour le nom de la poule
router.post('/tournaments/:tournamentId/pools/:poolId/assign-teams', getTournament, adminPoolController.assignTeamsToPool);
router.post('/tournaments/:tournamentId/pools/:poolId/generate-matches', getTournament, adminPoolController.generatePoolMatches);
router.post('/tournaments/:tournamentId/pools/:poolId/matches/:matchId/update-score', getTournament, adminPoolController.updateMatchScore);
router.post('/tournaments/:tournamentId/pools/:poolId/delete', getTournament, adminPoolController.deletePool);
router.post('/tournaments/:tournamentId/generate-elimination-matches', getTournament, adminPoolController.generateEliminationMatches); // Nouvelle route pour les matchs d'élimination
router.get('/tournaments/:tournamentId/elimination', getTournament, adminTournamentController.showEliminationMatches); // Nouvelle route pour afficher les matchs à élimination
router.get('/tournaments/:tournamentId/elimination/matches/:matchId', getTournament, adminTournamentController.showMatchSheet); // Nouvelle route pour la feuille de match
router.post('/tournaments/:tournamentId/elimination-matches/:matchId/update-score', getTournament, adminPoolController.updateEliminationMatchScore); // Nouvelle route pour mettre à jour le score d'un match d'élimination
router.post('/tournaments/:tournamentId/freeze-ranking', getTournament, adminTournamentController.freezeFinalRanking); // Nouvelle route pour figer le classement final

// Nouvelle route pour configurer les équipes des tours d'élimination (Demi-finale, Finale)
console.log('adminTournamentController.setupEliminationRound:', adminTournamentController.setupEliminationRound);
router.post('/tournaments/:tournamentId/elimination/setup-round/:roundName', getTournament, adminTournamentController.setupEliminationRound);


// Routes CRUD pour les équipes d'un tournoi spécifique
router.get('/tournaments/:tournamentId/teams', getTournament, adminTeamController.listTeams);
router.get('/tournaments/:tournamentId/teams/new', getTournament, adminTeamController.showCreateTeamForm);
router.post('/tournaments/:tournamentId/teams', getTournament, adminTeamController.createTeam);
router.get('/tournaments/:tournamentId/teams/:teamId/edit', getTournament, adminTeamController.showEditTeamForm);
router.post('/tournaments/:tournamentId/teams/:teamId', getTournament, adminTeamController.updateTeam);
router.post('/tournaments/:tournamentId/teams/:teamId/delete', getTournament, adminTeamController.deleteTeam);

// Routes CRUD pour les joueurs libres d'un tournoi spécifique
router.get('/tournaments/:tournamentId/unassigned-players', getTournament, adminUnassignedPlayerController.listUnassignedPlayers);
router.post('/tournaments/:tournamentId/unassigned-players/:registrationId/delete', getTournament, adminUnassignedPlayerController.deleteUnassignedPlayer);

// Routes CRUD pour les équipes (globales, si toujours nécessaires)
router.get('/teams', adminTeamController.listTeams);
router.get('/teams/new', adminTeamController.showCreateTeamForm);
router.post('/teams', adminTeamController.createTeam);
router.get('/teams/:id/edit', adminTeamController.showEditTeamForm);
router.post('/teams/:id', adminTeamController.updateTeam);
router.post('/teams/:id/delete', adminTeamController.deleteTeam);

// Routes CRUD pour les utilisateurs
router.get('/users', adminUserController.listUsers);
router.get('/users/new', adminUserController.showCreateUserForm);
router.post('/users', adminUserController.createUser);
router.get('/users/:id/edit', adminUserController.showEditUserForm);
router.post('/users/:id', adminUserController.updateUser);
router.post('/users/:id/delete', adminUserController.deleteUser);

module.exports = router;
