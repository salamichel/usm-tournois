const express = require('express');
const router = express.Router();

// Importer les contrôleurs qui contiennent la logique pour chaque route.
const tournamentController = require('../controllers/tournament.controller');
const authController = require('../controllers/auth.controller');
const accountController = require('../controllers/account.controller');
const teamController = require('../controllers/team.controller');

/*
 * =============================================
 * Définition des routes principales (publiques)
 * =============================================
 * Ce fichier agit comme un aiguillage : il associe une URL à une fonction
 * spécifique d'un contrôleur.
 */

// Route pour la page d'accueil.
// Quand un utilisateur visite '/', on exécute la fonction showAllTournaments.
router.get('/', tournamentController.showAllTournaments);

// Route pour afficher la page de détail d'un tournoi.
// Le `:id` est un paramètre dynamique qui correspondra à l'ID du tournoi.
router.get('/tournoi/:id', tournamentController.showTournamentDetails);

// Route pour afficher la page de connexion et d'inscription.
router.get('/login', (req, res) => authController.showLoginPage(req, res, 'Connexion / Inscription'));
router.post('/auth/login', authController.handleLogin); // Route pour la soumission du formulaire de connexion
router.post('/auth/signup', authController.handleSignup); // Route pour la soumission du formulaire d'inscription
router.post('/auth/logout', authController.handleLogout); // Route pour la déconnexion

// Routes pour la gestion du profil utilisateur
router.get('/mon-profil', (req, res) => accountController.showProfilePage(req, res, 'Mon Profil'));
router.post('/mon-profil', accountController.updateProfile); // Pour soumettre les modifications du profil
router.get('/changer-mot-de-passe', (req, res) => accountController.showChangePasswordPage(req, res, 'Changer le mot de passe'));
router.post('/changer-mot-de-passe', accountController.changePassword); // Pour soumettre le changement de mot de passe

// Route pour afficher la page "Mon Compte" avec les tournois de l'utilisateur.
router.get('/mon-compte', (req, res) => tournamentController.showMyTournaments(req, res, 'Mon Compte'));

// Route pour afficher la page de gestion d'équipe.
router.get('/gestion-equipe/:id', (req, res) => teamController.showTeamManagementPage(req, res, 'Gestion d\'équipe'));

// Routes pour les actions des joueurs sur un tournoi
router.post('/tournoi/:id/register-player', tournamentController.registerFreePlayer);
router.post('/tournoi/:id/leave-tournament', tournamentController.leaveTournament);
router.post('/tournoi/:id/leave-team', teamController.leaveTeam); // Nouvelle route pour qu'un membre quitte une équipe
router.post('/tournoi/:id/rejoindre-equipe', tournamentController.joinTeam); // Nouvelle route pour rejoindre une équipe existante
router.post('/tournoi/:id/join-waiting-list', tournamentController.joinWaitingList); // Nouvelle route pour rejoindre la liste d'attente

// Routes pour l'inscription/désinscription d'équipes aux tournois
router.post('/tournoi/:id/register-team', tournamentController.registerTeam);
router.post('/tournoi/:id/unregister-team', tournamentController.unregisterTeam);

// Routes pour la gestion des équipes
router.post('/tournoi/:id/create-team', teamController.createTeam);
router.post('/gestion-equipe/:id/update-settings', teamController.updateTeamSettings);
router.post('/gestion-equipe/:id/add-member', teamController.addTeamMember);
router.post('/gestion-equipe/:id/remove-member', teamController.removeTeamMember);
router.post('/gestion-equipe/:id/add-virtual-member', teamController.addTeamMemberByCaptain);

// Route pour la soumission des scores d'un match
router.post('/tournaments/:eventId/matches/:matchId/submit-scores', tournamentController.submitMatchScores);

// On exporte le routeur pour qu'il puisse être utilisé dans app.js
module.exports = router;
