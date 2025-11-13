require('dotenv').config();
const express = require('express');
const session = require('express-session'); // Importez express-session
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration des Vues ---
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Middlewares ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Ajout pour parser les corps de requête JSON

// Configuration de express-session
app.use(session({
    secret: process.env.SESSION_SECRET || 'une-cle-secrete-a-changer', // Clé secrète pour signer le cookie de session
    resave: false, // Ne pas sauvegarder la session si elle n'a pas été modifiée
    saveUninitialized: false, // Ne pas créer de session pour les requêtes non initialisées
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // Durée de vie du cookie de session (24 heures)
        httpOnly: true, // Empêche l'accès au cookie via JavaScript côté client
        secure: process.env.NODE_ENV === 'production' // Utiliser des cookies sécurisés en production (HTTPS)
    }
}));

// Middleware pour rendre l'utilisateur courant disponible dans toutes les vues
app.use((req, res, next) => {
    // req.session.user est défini par votre logique d'authentification Firebase
    if (req.session.user) {
        res.locals.currentUser = {
            id: req.session.user.uid,
            pseudo: req.session.user.pseudo,
            email: req.session.user.email,
            level: req.session.user.level, // Le niveau du joueur reste 'level'
            role: req.session.user.role,   // Ajout du rôle pour les permissions
            avatar: req.session.user.avatar || `https://placehold.co/100x100/${Math.floor(Math.random() * 16777215).toString(16)}/white?text=${req.session.user.pseudo ? req.session.user.pseudo.charAt(0).toUpperCase() : '?'}`
        };
    } else {
    res.locals.currentUser = null; // Aucun utilisateur connecté
    }
    res.locals.path = req.path; // Rendre le chemin actuel disponible dans toutes les vues
    res.locals.googleAnalyticsId = process.env.FIREBASE_MEASUREMENT_ID; // Rendre l'ID de mesure Google Analytics disponible
    next();
});

// Middleware pour initialiser les variables pour le layout
app.use((req, res, next) => {
    res.locals.event = null; // Initialiser event à null par défaut
    res.locals.req = req; // Rendre l'objet req disponible dans toutes les vues
    next();
});

const flashMiddleware = require('./middlewares/flash.middleware');
app.use(flashMiddleware);

// --- Routes ---
// Plus tard, vous importerez vos fichiers de routes ici
// Exemple : const indexRoutes = require('./routes/index.routes');
// app.use('/', indexRoutes);

const indexRoutes = require('./routes/index.routes');
const adminRoutes = require('./routes/admin.routes'); // Importer les routes d'administration
app.use('/', indexRoutes);
app.use('/admin', adminRoutes); // Utiliser les routes d'administration sous le préfixe /admin

// Route temporaire pour la page d'accueil
//const tournamentController = require('./controllers/tournament.controller');
//app.get('/', tournamentController.showAllTournaments);

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    console.error('Erreur non capturée:', err);

    // Si c'est une requête AJAX, renvoyer une réponse JSON d'erreur
    if (req.xhr || req.accepts('json')) {
        return res.status(500).json({ success: false, message: 'Une erreur interne du serveur est survenue.', error: err.message });
    } else {
        // Sinon, rendre une page d'erreur HTML
        res.status(500).render('pages/500', { pageTitle: 'Erreur Serveur', error: err });
    }
});

// --- Démarrage du serveur ---
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
