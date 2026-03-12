/**
 * State Persistence Service
 * 
 * Ensures user funds are protected in case of UI freeze/crash
 * Saves game state to localStorage and blockchain periodically
 */

import { GameState } from '../types/types';

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
 * Save game state to localStorage
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

    localStorage.setItem(storageKey(walletAddress), JSON.stringify(persistedState));
  } catch (error) {
    console.error('[StatePersistence] Failed to save game state:', error);
  }
}

/**
 * Load game state from localStorage
 */
export function loadGameState(walletAddress: string | null): PersistedGameState | null {
  try {
    // Try wallet-scoped key first, then legacy key as fallback
    let stored = localStorage.getItem(storageKey(walletAddress));
    if (!stored && walletAddress) {
      stored = localStorage.getItem(STORAGE_KEY_LEGACY);
    }
    if (!stored) return null;

    const persistedState: PersistedGameState = JSON.parse(stored);

    // Only restore if it's for the same wallet (or both are null)
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
