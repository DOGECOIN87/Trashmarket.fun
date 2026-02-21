/**
 * Adapter that maps the @solana/wallet-adapter-react interface to what the game components expect.
 * This eliminates the need for the game's standalone wallet/solana service.
 */
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useState, useCallback, useEffect } from 'react';

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
    const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
    const { setVisible } = useWalletModal();
    const { connection } = useConnection();
    const [balance, setBalance] = useState<number | null>(null);

    const refreshBalance = useCallback(async () => {
        if (!publicKey) {
            setBalance(null);
            return;
        }
        try {
            const bal = await connection.getBalance(publicKey);
            setBalance(bal / LAMPORTS_PER_SOL);
        } catch {
            // silently fail
        }
    }, [publicKey, connection]);

    useEffect(() => {
        if (connected && publicKey) {
            refreshBalance();
        } else {
            setBalance(null);
        }
    }, [connected, publicKey, refreshBalance]);

    return {
        publicKey: publicKey?.toBase58() ?? null,
        isConnected: connected,
        isLoading: connecting,
        balance,
        hasWalletExtension: !!wallet,
        connectWallet: async () => {
            setVisible(true);
        },
        disconnectWallet: () => disconnect(),
        refreshBalance,
    };
}
