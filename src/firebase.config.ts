import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, TwitterAuthProvider } from 'firebase/auth';

// Firebase configuration - uses Vite environment variables (import.meta.env)
// Set these in your .env file with the VITE_ prefix
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trashmarket.fun",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trashmarket-fun",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trashmarket-fun.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const twitterProvider = new TwitterAuthProvider();

export default app;
