import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import * as SolanaService from '../services/solanaService';

interface WalletContextType {
  publicKey: string | null;
  isConnected: boolean;
  isLoading: boolean;
  balance: number | null;
  hasWalletExtension: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: React.ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [hasWalletExtension, setHasWalletExtension] = useState(false);

  // Initialize Solana service on mount
  useEffect(() => {
    try {
      const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const programId = import.meta.env.VITE_SOLANA_PROGRAM_ID || '11111111111111111111111111111111';
      const cluster = (import.meta.env.VITE_SOLANA_CLUSTER || 'devnet') as 'devnet' | 'testnet' | 'mainnet' | 'gorbagana';

      SolanaService.initializeSolana({ rpcUrl, programId, cluster });

      // Detect wallet extension after a short delay (extensions inject after page load)
      setTimeout(() => {
        const provider = SolanaService.detectWalletProvider();
        setHasWalletExtension(!!provider);

        // Auto-reconnect if previously connected
        if (provider?.isConnected && provider?.publicKey) {
          const pk = new PublicKey(provider.publicKey.toString());
          setPublicKey(pk.toBase58());
          setIsConnected(true);
          refreshBalance(pk);
        }
      }, 500);
    } catch (error) {
      console.error('Failed to initialize Solana service:', error);
    }
  }, []);

  const refreshBalance = useCallback(async (pubkey?: PublicKey) => {
    try {
      const target = pubkey || (publicKey ? new PublicKey(publicKey) : null);
      if (!target) return;

      const balanceLamports = await SolanaService.getBalance(target);
      // Convert lamports to SOL/GOR (1 SOL = 1,000,000,000 lamports)
      setBalance(balanceLamports / 1e9);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    }
  }, [publicKey]);

  const connectWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      const state = await SolanaService.connectWallet();

      if (state.publicKey && state.isConnected) {
        const pkString = state.publicKey.toBase58();
        setPublicKey(pkString);
        setIsConnected(true);

        // Refresh balance after connection
        await refreshBalance(state.publicKey);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);

      // If no wallet extension, provide helpful message
      if ((error as Error).message?.includes('No Solana wallet found')) {
        alert('No Solana wallet detected.\n\nPlease install Phantom (phantom.app) or another Solana-compatible wallet extension.');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [refreshBalance]);

  const disconnectWallet = useCallback(() => {
    SolanaService.disconnectWallet();
    setPublicKey(null);
    setIsConnected(false);
    setBalance(null);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        isConnected,
        isLoading,
        balance,
        hasWalletExtension,
        connectWallet,
        disconnectWallet,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export default WalletProvider;
