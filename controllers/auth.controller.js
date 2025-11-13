// Ce contrôleur gère la logique pour la connexion, l'inscription et la déconnexion.

const { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, doc, setDoc, getDoc } = require('../services/firebase');

// Affiche la page de connexion
exports.showLoginPage = (req, res, title = 'Connexion') => {
    // Le paramètre 'error' vient d'une redirection en cas d'échec de connexion
    res.render('pages/login', {
        title: title,
        user: null, // L'utilisateur sera géré par res.locals.currentUser via le middleware
        error: req.query.error,
        path: req.path // Passe le chemin actuel pour la navigation active
    });
};

// Gère la soumission du formulaire de connexion
exports.handleLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Récupérer les informations supplémentaires de l'utilisateur depuis Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            // Si l'authentification réussit, on stocke les infos dans la session
            req.session.user = {
                uid: user.uid,
                email: user.email,
                pseudo: userData.pseudo,
                level: userData.level,
                role: userData.role,
            };
            // Rediriger l'utilisateur vers l'URL stockée dans la session ou vers le tableau de bord par défaut
            const redirectTo = req.session.redirectTo || '/mon-compte';
            delete req.session.redirectTo; // Nettoyer la session
            res.redirect(redirectTo);
        } else {
            console.error("Erreur de connexion: Données utilisateur introuvables dans Firestore.");
            res.redirect(`/login?error=${encodeURIComponent("Données utilisateur introuvables.")}`);
        }
    } catch (error) {
        console.error("Erreur de connexion Firebase:", error.message);
        let errorMessage = "Email ou mot de passe incorrect.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = "Email ou mot de passe incorrect.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Format d'email invalide.";
        }
        res.redirect(`/login?error=${encodeURIComponent(errorMessage)}`);
    }
};

// Gère la soumission du formulaire d'inscription
exports.handleSignup = async (req, res) => {
const { pseudo, email, password, level } = req.body;
    const defaultRole = 'player'; // Rôle par défaut pour un nouvel utilisateur

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Sauvegarder les informations supplémentaires de l'utilisateur dans Firestore
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
            pseudo: pseudo,
            email: email,
            level: level, // Utiliser le niveau textuel du formulaire
            role: defaultRole // Utiliser le rôle par défaut
        });

        // Stocker les informations de l'utilisateur dans la session
        req.session.user = {
            uid: user.uid,
            email: email,
            pseudo: pseudo,
            level: level,
            role: defaultRole
        };
        res.redirect('/mon-compte');
    } catch (error) {
        console.error("Erreur d'inscription Firebase:", error.message);
        let errorMessage = "Erreur lors de l'inscription.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Cet email est déjà utilisé.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Format d'email invalide.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Le mot de passe doit contenir au moins 6 caractères.";
        }
        res.redirect(`/login?error=${encodeURIComponent(errorMessage)}`);
    }
};

// Gère la déconnexion
exports.handleLogout = async (req, res) => {
    try {
        await signOut(auth);
        // Détruire la session côté serveur avec express-session
        req.session.destroy(err => {
            if (err) {
                console.error("Erreur lors de la destruction de la session:", err);
                return res.redirect('/mon-compte?error=Erreur lors de la déconnexion');
            }
            res.clearCookie('connect.sid'); // Effacer le cookie de session côté client
            res.redirect('/');
        });
    } catch (error) {
        console.error("Erreur de déconnexion Firebase:", error.message);
        res.redirect('/mon-compte?error=Erreur lors de la déconnexion');
    }
};
