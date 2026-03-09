/**
 * Zustand App Store
 *
 * Centralized state management for the Trashmarket.fun dApp.
 * Replaces scattered useState/useEffect patterns with a single,
 * predictable store that can be accessed from any component.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

// ─── Types ──────────────────────────────────────────────────────────────────

export type NetworkType = 'GORBAGANA' | 'SOLANA_MAINNET' | 'SOLANA_DEVNET';

export interface TokenBalance {
  symbol: string;
  amount: number;
  decimals: number;
  mint?: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: number;
  txSignature?: string;
}

// ─── Store Slices ───────────────────────────────────────────────────────────

interface NetworkSlice {
  /** Currently selected network */
  currentNetwork: NetworkType;
  /** Set the active network */
  setNetwork: (network: NetworkType) => void;
  /** Derived: is Gorbagana selected */
  isGorbagana: () => boolean;
  /** Derived: is any Solana network selected */
  isSolana: () => boolean;
  /** Derived: is devnet selected */
  isDevnet: () => boolean;
}

interface WalletSlice {
  /** Whether the Gorbagana-specific wallet is connected (Backpack/Gorbag) */
  gorbaganaConnected: boolean;
  /** Gorbagana wallet address */
  gorbaganaAddress: string | null;
  /** Gorbagana native balance (GOR) */
  gorbaganaBalance: number | null;
  /** Token balances (JUNK, TRASHCOIN, sGOR, etc.) */
  tokenBalances: TokenBalance[];
  /** Set Gorbagana wallet state */
  setGorbaganaWallet: (connected: boolean, address: string | null, balance: number | null) => void;
  /** Update token balances */
  setTokenBalances: (balances: TokenBalance[]) => void;
  /** Clear all wallet state */
  clearWallet: () => void;
}

interface UISlice {
  /** Notifications queue */
  notifications: Notification[];
  /** Add a notification */
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  /** Remove a notification by ID */
  removeNotification: (id: string) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
  /** Global loading state for overlay */
  isGlobalLoading: boolean;
  /** Global loading message */
  globalLoadingMessage: string | null;
  /** Set global loading state */
  setGlobalLoading: (loading: boolean, message?: string) => void;
}

interface MarketplaceSlice {
  /** Number of active Gorbagio listings */
  activeListingsCount: number;
  /** Set active listings count */
  setActiveListingsCount: (count: number) => void;
  /** Last data refresh timestamp */
  lastRefresh: number | null;
  /** Set last refresh */
  setLastRefresh: (timestamp: number) => void;
}

// ─── Combined Store ─────────────────────────────────────────────────────────

type AppStore = NetworkSlice & WalletSlice & UISlice & MarketplaceSlice;

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ─── Network Slice ────────────────────────────────────────────
        currentNetwork: 'GORBAGANA' as NetworkType,
        setNetwork: (network) => set({ currentNetwork: network }, false, 'setNetwork'),
        isGorbagana: () => get().currentNetwork === 'GORBAGANA',
        isSolana: () => get().currentNetwork === 'SOLANA_MAINNET' || get().currentNetwork === 'SOLANA_DEVNET',
        isDevnet: () => get().currentNetwork === 'SOLANA_DEVNET',

        // ─── Wallet Slice ─────────────────────────────────────────────
        gorbaganaConnected: false,
        gorbaganaAddress: null,
        gorbaganaBalance: null,
        tokenBalances: [],
        setGorbaganaWallet: (connected, address, balance) =>
          set({ gorbaganaConnected: connected, gorbaganaAddress: address, gorbaganaBalance: balance }, false, 'setGorbaganaWallet'),
        setTokenBalances: (balances) => set({ tokenBalances: balances }, false, 'setTokenBalances'),
        clearWallet: () =>
          set({
            gorbaganaConnected: false,
            gorbaganaAddress: null,
            gorbaganaBalance: null,
            tokenBalances: [],
          }, false, 'clearWallet'),

        // ─── UI Slice ─────────────────────────────────────────────────
        notifications: [],
        addNotification: (notification) => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const newNotification: Notification = {
            ...notification,
            id,
            timestamp: Date.now(),
          };
          set(
            (state) => ({
              notifications: [...state.notifications.slice(-9), newNotification], // Keep max 10
            }),
            false,
            'addNotification',
          );

          // Auto-remove after 8 seconds
          setTimeout(() => {
            set(
              (state) => ({
                notifications: state.notifications.filter((n) => n.id !== id),
              }),
              false,
              'autoRemoveNotification',
            );
          }, 8000);
        },
        removeNotification: (id) =>
          set(
            (state) => ({
              notifications: state.notifications.filter((n) => n.id !== id),
            }),
            false,
            'removeNotification',
          ),
        clearNotifications: () => set({ notifications: [] }, false, 'clearNotifications'),
        isGlobalLoading: false,
        globalLoadingMessage: null,
        setGlobalLoading: (loading, message) =>
          set({ isGlobalLoading: loading, globalLoadingMessage: message || null }, false, 'setGlobalLoading'),

        // ─── Marketplace Slice ────────────────────────────────────────
        activeListingsCount: 0,
        setActiveListingsCount: (count) => set({ activeListingsCount: count }, false, 'setActiveListingsCount'),
        lastRefresh: null,
        setLastRefresh: (timestamp) => set({ lastRefresh: timestamp }, false, 'setLastRefresh'),
      }),
      {
        name: 'trashmarket-store',
        // Only persist network preference, not wallet state (security)
        partialize: (state) => ({
          currentNetwork: state.currentNetwork,
        }),
      },
    ),
    { name: 'TrashmarketStore' },
  ),
);

// ─── Selector Hooks (for performance) ───────────────────────────────────────

/** Select only network-related state */
export const useNetworkStore = () =>
  useAppStore(useShallow((state) => ({
    currentNetwork: state.currentNetwork,
    setNetwork: state.setNetwork,
    isGorbagana: state.isGorbagana,
    isSolana: state.isSolana,
    isDevnet: state.isDevnet,
  })));

/** Select only notification state */
export const useNotificationStore = () =>
  useAppStore(useShallow((state) => ({
    notifications: state.notifications,
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
    clearNotifications: state.clearNotifications,
  })));

/** Select only wallet state */
export const useWalletStore = () =>
  useAppStore(useShallow((state) => ({
    gorbaganaConnected: state.gorbaganaConnected,
    gorbaganaAddress: state.gorbaganaAddress,
    gorbaganaBalance: state.gorbaganaBalance,
    tokenBalances: state.tokenBalances,
    setGorbaganaWallet: state.setGorbaganaWallet,
    setTokenBalances: state.setTokenBalances,
    clearWallet: state.clearWallet,
  })));
