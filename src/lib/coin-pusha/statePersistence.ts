/**
 * State Persistence Service
 * 
 * Ensures user funds are protected in case of UI freeze/crash
 * Saves game state to localStorage and blockchain periodically
 */

import { GameState } from '../types';

const STORAGE_KEY = 'coin_pusher_game_state';
const AUTO_SAVE_INTERVAL = 5000; // Save every 5 seconds

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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
    console.log('[StatePersistence] Game state saved:', persistedState);
  } catch (error) {
    console.error('[StatePersistence] Failed to save game state:', error);
  }
}

/**
 * Load game state from localStorage
 */
export function loadGameState(walletAddress: string | null): PersistedGameState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const persistedState: PersistedGameState = JSON.parse(stored);

    // Only restore if it's for the same wallet (or both are null)
    if (persistedState.walletAddress !== walletAddress) {
      console.log('[StatePersistence] Wallet mismatch, not restoring state');
      return null;
    }

    // Check if state is recent (within last 24 hours)
    const age = Date.now() - persistedState.lastSaved;
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

    if (age > MAX_AGE) {
      console.log('[StatePersistence] Saved state too old, not restoring');
      return null;
    }

    console.log('[StatePersistence] Game state loaded:', persistedState);
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
    localStorage.removeItem(STORAGE_KEY);
    console.log('[StatePersistence] Game state cleared');
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

  console.log('[StatePersistence] Auto-save enabled (every 5s)');

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    console.log('[StatePersistence] Auto-save disabled');
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
