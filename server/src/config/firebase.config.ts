import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration for Firebase Admin SDK
let serviceAccount: any;

try {
  // Load service account key
  const serviceAccountPath = path.join(__dirname, '../../../serviceAccountKey.json');
  const serviceAccountModule = await import(serviceAccountPath, {
    assert: { type: 'json' }
  });
  serviceAccount = serviceAccountModule.default;
  console.log('[Firebase Config] ✅ serviceAccountKey.json loaded successfully.');
} catch (error) {
  console.error(
    '❌ Error: serviceAccountKey.json not found or invalid. Please download it from Firebase Console and place it at the project root.'
  );
  console.error(error);
  process.exit(1);
}

// Initialize Firebase Admin App
const adminApp: App = initializeApp({
  credential: cert(serviceAccount),
});
console.log('[Firebase Config] ✅ Admin App initialized.');

// Get Admin Auth instance
const adminAuth: Auth = getAuth(adminApp);
console.log('[Firebase Config] ✅ Admin Auth initialized.');

// Get Admin Firestore instance
const adminDb: Firestore = process.env.FIREBASE_DB_FIRESTORE
  ? getFirestore(adminApp, process.env.FIREBASE_DB_FIRESTORE)
  : getFirestore(adminApp);

console.log(
  `[Firebase Config] ✅ Admin Firestore DB initialized. Using DB: ${
    process.env.FIREBASE_DB_FIRESTORE || 'default'
  }`
);

// Export instances
export { adminApp, adminAuth, adminDb };
export default { adminApp, adminAuth, adminDb };
