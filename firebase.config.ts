import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration - uses Vite environment variables (import.meta.env)
// Set these in your .env file with the VITE_ prefix
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trashmarket-gorbagana.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trashmarket-gorbagana",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trashmarket-gorbagana.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

// Admin authentication is now handled server-side via the Trashmarket API backend.
// See services/adminAuthService.ts for the secure wallet-signature-based auth flow.
// ADMIN_WALLETS and ADMIN_PASSWORD have been removed from the client bundle.
