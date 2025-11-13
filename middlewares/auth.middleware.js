// Middleware pour vérifier si l'utilisateur est authentifié
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next(); // L'utilisateur est authentifié, on continue
    } else {
        req.session.flashMessage = { type: 'error', message: 'Vous devez être connecté pour accéder à cette page.' };
        res.redirect('/login'); // Rediriger vers la page de connexion
    }
};

// Middleware pour vérifier si l'utilisateur est un administrateur
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next(); // L'utilisateur est un administrateur, on continue
    } else {
        // Si c'est une requête AJAX (par exemple, via fetch), renvoyer une réponse JSON
        // Si c'est une requête AJAX (détectée par req.xhr), renvoyer une réponse JSON
        if (req.xhr) {
            return res.status(403).json({ success: false, message: 'Accès refusé. Vous n\'avez pas les permissions d\'administrateur.' });
        } else {
            // Sinon (requête de navigation normale), rediriger l'utilisateur
            req.session.flashMessage = { type: 'error', message: 'Accès refusé. Vous n\'avez pas les permissions d\'administrateur.' };
            res.redirect('/'); // Rediriger vers la page d'accueil ou une page d'erreur
        }
    }
};

module.exports = {
    isAuthenticated,
    isAdmin
};
