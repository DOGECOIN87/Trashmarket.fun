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

// Admin wallet addresses - loaded from environment for security
// Set VITE_ADMIN_WALLETS as a comma-separated string in .env
export const ADMIN_WALLETS: string[] = (import.meta.env.VITE_ADMIN_WALLETS || "")
  .split(",")
  .map((w: string) => w.trim())
  .filter(Boolean);

// Admin password - MUST be set via environment variable, never hardcoded
export const ADMIN_PASSWORD: string = import.meta.env.VITE_ADMIN_PASSWORD || "";
