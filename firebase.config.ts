import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration placeholder
// Replace these values with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "trashmarket-gorbagana.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "trashmarket-gorbagana",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "trashmarket-gorbagana.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

// Admin wallet addresses (update with actual admin wallets)
export const ADMIN_WALLETS = [
  "5A7YzDzk9MmA1wQNy7K8KQpgG2xEJz7e2q7LQ9mJn2v", // Replace with actual admin wallet
  "9YcB8K7PxW2nF5jH4mQ8TzLb6rV3dX1e8pG5yT6uA2fC", // Replace with actual admin wallet
];

// Admin password (should be stored securely, preferably in environment)
export const ADMIN_PASSWORD = process.env.VITE_ADMIN_PASSWORD || "TRASHMARKET2025!";

// Firebase security rules notes:
// 1. Firestore: Allow read to authenticated users, limit submissions to 3 per wallet
// 2. Storage: Allow read to all, write to authenticated with 5MB limit
// 3. Admin operations: Restricted to specific wallet addresses
