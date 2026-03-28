import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getCountFromServer,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, twitterProvider, db } from '../firebase.config';

export interface AirdropRegistration {
  twitterUid: string;
  twitterHandle: string;
  walletAddress: string;
  registeredAt: Date;
}

/**
 * Sign in with Twitter/X via Firebase Auth popup
 */
export async function signInWithTwitter(): Promise<{
  user: User;
  twitterHandle: string;
}> {
  const result = await signInWithPopup(auth, twitterProvider);
  const twitterData = result.user.providerData.find(
    (p) => p.providerId === 'twitter.com'
  );
  const twitterHandle = twitterData?.displayName || result.user.displayName || 'unknown';
  return { user: result.user, twitterHandle };
}

/**
 * Sign out from Firebase Auth
 */
export async function signOutTwitter(): Promise<void> {
  await signOut(auth);
}

/**
 * Listen for auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Check if a Twitter UID already has a registration
 */
export async function getRegistration(
  twitterUid: string
): Promise<AirdropRegistration | null> {
  const docRef = doc(db, 'airdrop_registrations', twitterUid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    twitterUid: data.twitterUid,
    twitterHandle: data.twitterHandle,
    walletAddress: data.walletAddress,
    registeredAt: data.registeredAt?.toDate?.() || new Date(),
  };
}

/**
 * Register a wallet address for the airdrop (one per Twitter account)
 */
export async function registerForAirdrop(
  twitterUid: string,
  twitterHandle: string,
  walletAddress: string
): Promise<void> {
  const docRef = doc(db, 'airdrop_registrations', twitterUid);
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    throw new Error('This X account has already registered for the airdrop.');
  }
  await setDoc(docRef, {
    twitterUid,
    twitterHandle,
    walletAddress: walletAddress.trim(),
    registeredAt: serverTimestamp(),
  });
}

/**
 * Get total registration count
 */
export async function getRegistrationCount(): Promise<number> {
  const colRef = collection(db, 'airdrop_registrations');
  const snapshot = await getCountFromServer(colRef);
  return snapshot.data().count;
}
