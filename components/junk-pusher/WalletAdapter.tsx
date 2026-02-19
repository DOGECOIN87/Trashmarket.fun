/**
 * Adapter that maps the root WalletContext interface to what the game components expect.
 * This eliminates the need for the game's standalone wallet/solana service.
 */
import { useWallet as useRootWallet } from '../../contexts/WalletContext';

export interface GameWalletState {
    publicKey: string | null;
    isConnected: boolean;
    isLoading: boolean;
    balance: number | null;
    hasWalletExtension: boolean;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    refreshBalance: () => Promise<void>;
}

export function useGameWallet(): GameWalletState {
    const rootWallet = useRootWallet();

    return {
        publicKey: rootWallet.address,
        isConnected: rootWallet.connected,
        isLoading: rootWallet.isConnecting,
        balance: rootWallet.balance,
        hasWalletExtension: rootWallet.availableWallets.some(w => w.installed),
        connectWallet: async () => {
            // Connect with the first available installed wallet
            const installed = rootWallet.availableWallets.find(w => w.installed);
            if (installed) {
                await rootWallet.connect(installed.id);
            } else {
                // Try backpack as default
                await rootWallet.connect('backpack');
            }
        },
        disconnectWallet: () => rootWallet.disconnect(),
        refreshBalance: async () => {
            // Root wallet auto-refreshes balance on connect; no-op here
        },
    };
}
