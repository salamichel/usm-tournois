// Fichier /app/services/firebase.js final

const path = require('path'); // Importez le module path
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");

const { initializeApp: initializeClientApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } = require("firebase/auth");
const { getFirestore, doc, setDoc, getDoc, collection, getDocs, query } = require("firebase/firestore");

// Configuration pour le SDK client (utilisé côté navigateur)
const firebaseClientConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

// Initialisation de Firebase pour le SDK client
const clientApp = initializeClientApp(firebaseClientConfig);
console.log('[Firebase Service] Client App initialized.');
const clientAuth = getAuth(clientApp);
console.log('[Firebase Service] Client Auth initialized.');

// Firestore pour le client. Si process.env.FIREBASE_DB_FIRESTORE est défini, il tente de se connecter à une base de données nommée.
// Sinon, il se connecte à la base de données par défaut.
const db = process.env.FIREBASE_DB_FIRESTORE 
    ? getFirestore(clientApp, process.env.FIREBASE_DB_FIRESTORE) 
    : getFirestore(clientApp);
console.log(`[Firebase Service] Client Firestore DB initialized. Using DB: ${process.env.FIREBASE_DB_FIRESTORE || 'default'}`);


// Configuration pour le SDK Admin (utilisé côté serveur)
// Assurez-vous que la variable d'environnement GOOGLE_APPLICATION_CREDENTIALS est définie
// ou que vous passez un objet de configuration de service account directement.
// Configuration pour le SDK Admin (utilisé côté serveur)
// IMPORTANT : Pour que Firebase Admin fonctionne, vous devez télécharger un fichier de clé de compte de service
// depuis la console Firebase (Paramètres du projet -> Comptes de service).
// Placez ce fichier (par exemple, serviceAccountKey.json) à la racine de votre projet
// ou dans un emplacement sécurisé et mettez à jour le chemin ci-dessous.
let serviceAccount;
try {
    // Utilisez path.join pour construire un chemin absolu robuste
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    serviceAccount = require(serviceAccountPath);
    console.log('[Firebase Service] serviceAccountKey.json loaded successfully.');
} catch (error) {
    console.error("Erreur: Le fichier serviceAccountKey.json est introuvable ou invalide. Veuillez le télécharger depuis la console Firebase et le placer à la racine du projet.");
    console.error(error); // Log l'erreur complète pour le débogage
    process.exit(1); // Arrête l'application si la clé de service est manquante
}

const adminApp = initializeApp(cert(serviceAccount));
console.log('[Firebase Service] Admin App initialized.');
const adminAuth = getAdminAuth(adminApp);
console.log('[Firebase Service] Admin Auth initialized.');
// Firestore pour l'admin. Si process.env.FIREBASE_DB_FIRESTORE est défini, il tente de se connecter à une base de données nommée.
// Sinon, il se connecte à la base de données par défaut.
const adminDb = process.env.FIREBASE_DB_FIRESTORE 
    ? getAdminFirestore(adminApp, process.env.FIREBASE_DB_FIRESTORE) 
    : getAdminFirestore(adminApp);
console.log(`[Firebase Service] Admin Firestore DB initialized. Using DB: ${process.env.FIREBASE_DB_FIRESTORE || 'default'}`);

module.exports = { 
    app: clientApp, 
    auth: clientAuth, 
    db, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    doc, 
    setDoc, 
    getDoc,
    adminAuth, // Exportez l'instance d'authentification Admin
    adminDb // Exportez l'instance Firestore Admin si vous en avez besoin séparément
};
