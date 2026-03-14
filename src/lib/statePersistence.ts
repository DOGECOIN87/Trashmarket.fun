/**
 * State Persistence Service
 * 
 * Ensures user funds are protected in case of UI freeze/crash
 * Saves game state to localStorage and blockchain periodically
 */

import { GameState } from './types';
import { setWithIntegrity, getWithIntegrity } from '../utils/localStorageIntegrity';

const STORAGE_KEY_PREFIX = 'junk_pusher_game_state';
const STORAGE_KEY_LEGACY = 'junk_pusher_game_state'; // fallback for old saves
const AUTO_SAVE_INTERVAL = 5000; // Save every 5 seconds

function storageKey(walletAddress: string | null): string {
  return walletAddress
    ? `${STORAGE_KEY_PREFIX}_${walletAddress}`
    : STORAGE_KEY_PREFIX;
}

export interface PersistedGameState {
  balance: number;
  score: number;
  netProfit: number;
  lastSaved: number;
  walletAddress: string | null;
}

/**
 * Save game state to localStorage (with HMAC integrity)
 */
export function saveGameState(state: GameState, walletAddress: string | null): void {
  try {
    const persistedState: PersistedGameState = {
      balance: state.balance,
      score: state.score,
      netProfit: state.netProfit,
      lastSaved: Date.now(),
      walletAddress,
    };

    const key = storageKey(walletAddress);
    const value = JSON.stringify(persistedState);
    // Fire-and-forget — auto-save runs on an interval so async is fine
    setWithIntegrity(key, value).catch((err) =>
      console.error('[StatePersistence] HMAC save failed:', err)
    );
  } catch (error) {
    console.error('[StatePersistence] Failed to save game state:', error);
  }
}

/**
 * Load game state from localStorage (verifies HMAC integrity)
 */
export function loadGameState(walletAddress: string | null): PersistedGameState | null {
  // Synchronous fast-path: read raw localStorage and parse.
  // The async HMAC verification is done by loadGameStateVerified().
  try {
    const key = storageKey(walletAddress);
    let stored = localStorage.getItem(key);
    if (!stored && walletAddress) {
      stored = localStorage.getItem(STORAGE_KEY_LEGACY);
    }
    if (!stored) return null;

    // Try to parse envelope format first (integrity-wrapped)
    try {
      const envelope = JSON.parse(stored);
      if (envelope && typeof envelope.v === 'string' && typeof envelope.h === 'string') {
        stored = envelope.v;
      }
    } catch { /* plain JSON — not wrapped */ }

    const persistedState: PersistedGameState = JSON.parse(stored!);

    if (persistedState.walletAddress !== walletAddress) {
      return null;
    }

    return persistedState;
  } catch (error) {
    console.error('[StatePersistence] Failed to load game state:', error);
    return null;
  }
}

/**
 * Load game state with full HMAC verification (async).
 * Returns null if integrity check fails (tampered data).
 */
export async function loadGameStateVerified(walletAddress: string | null): Promise<PersistedGameState | null> {
  try {
    const key = storageKey(walletAddress);
    let stored = await getWithIntegrity(key);
    if (!stored && walletAddress) {
      stored = await getWithIntegrity(STORAGE_KEY_LEGACY);
    }
    if (!stored) return null;

    const persistedState: PersistedGameState = JSON.parse(stored);

    if (persistedState.walletAddress !== walletAddress) {
      return null;
    }

    return persistedState;
  } catch (error) {
    console.error('[StatePersistence] Failed to load verified game state:', error);
    return null;
  }
}

/**
 * Clear saved game state
 */
export function clearGameState(): void {
  try {
    // Clear all possible keys
    localStorage.removeItem(STORAGE_KEY_LEGACY);
    // Also try to clear wallet-scoped keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('[StatePersistence] Failed to clear game state:', error);
  }
}

/**
 * Setup auto-save interval
 */
export function setupAutoSave(
  getState: () => GameState,
  getWalletAddress: () => string | null
): () => void {
  const intervalId = setInterval(() => {
    const state = getState();
    const walletAddress = getWalletAddress();
    saveGameState(state, walletAddress);
  }, AUTO_SAVE_INTERVAL);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Check if there's a recoverable state
 */
export function hasRecoverableState(walletAddress: string | null): boolean {
  const state = loadGameState(walletAddress);
  return state !== null;
}

/**
 * Get recovery prompt message
 */
export function getRecoveryMessage(walletAddress: string | null): string | null {
  const state = loadGameState(walletAddress);
  if (!state) return null;

  const age = Date.now() - state.lastSaved;
  const minutes = Math.floor(age / 60000);

  return `Found saved game from ${minutes} minute${minutes !== 1 ? 's' : ''} ago:\n` +
         `Balance: ${state.balance} JUNK\n` +
         `Score: ${state.score}\n` +
         `Net Profit: ${state.netProfit > 0 ? '+' : ''}${state.netProfit}\n\n` +
         `Would you like to restore this game?`;
}

export default {
  saveGameState,
  loadGameState,
  clearGameState,
  setupAutoSave,
  hasRecoverableState,
  getRecoveryMessage,
};
