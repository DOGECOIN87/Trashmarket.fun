import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GORBAGANA_CONFIG } from './NetworkContext';

// Wallet Types
type WalletType = 'backpack' | 'gorbag' | null;

interface WalletState {
  connected: boolean;
  address: string | null;
  walletType: WalletType;
  balance: number | null;
}

interface WalletContextType extends WalletState {
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  error: string | null;
  formatAddress: (address: string) => string;
  availableWallets: { id: WalletType; name: string; icon: string; installed: boolean }[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Check if wallet extensions are installed
const checkWalletInstalled = (walletType: WalletType): boolean => {
  if (typeof window === 'undefined') return false;
  
  switch (walletType) {
    case 'backpack':
      return !!(window as any).backpack?.gorbagana || !!(window as any).backpack;
    case 'gorbag':
      return !!(window as any).gorbag || !!(window as any).gorbagWallet;
    default:
      return false;
  }
};

// Get wallet provider
const getWalletProvider = (walletType: WalletType) => {
  if (typeof window === 'undefined') return null;
  
  switch (walletType) {
    case 'backpack':
      return (window as any).backpack?.gorbagana || (window as any).backpack;
    case 'gorbag':
      return (window as any).gorbag || (window as any).gorbagWallet;
    default:
      return null;
  }
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    address: null,
    walletType: null,
    balance: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available wallets configuration
  const availableWallets: WalletContextType['availableWallets'] = [
    {
      id: 'backpack',
      name: 'Backpack',
      icon: '🎒',
      installed: checkWalletInstalled('backpack'),
    },
    {
      id: 'gorbag',
      name: 'Gorbag Wallet',
      icon: '🗑️',
      installed: checkWalletInstalled('gorbag'),
    },
  ];

  // Format address for display (e.g., "5Gh7...xZ9k")
  const formatAddress = useCallback((address: string): string => {
    if (!address || address.length < 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, []);

  // Fetch balance from RPC
  const fetchBalance = useCallback(async (address: string): Promise<number | null> => {
    try {
      const response = await fetch(GORBAGANA_CONFIG.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      });
      
      const data = await response.json();
      if (data.result?.value !== undefined) {
        // Convert from lamports to GOR (assuming 9 decimals like Solana)
        return data.result.value / Math.pow(10, GORBAGANA_CONFIG.currency.decimals);
      }
      return null;
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      return null;
    }
  }, []);

  // Connect wallet
  const connect = useCallback(async (walletType: WalletType) => {
    if (!walletType) return;
    
    setIsConnecting(true);
    setError(null);

    try {
      const provider = getWalletProvider(walletType);
      
      if (!provider) {
        // Wallet not installed - provide install links
        const installUrls: Record<string, string> = {
          backpack: 'https://www.backpack.app/',
          gorbag: 'https://gorbagana.wtf/wallet', // Placeholder URL
        };
        
        throw new Error(`${walletType === 'backpack' ? 'Backpack' : 'Gorbag Wallet'} not detected. Please install it from ${installUrls[walletType]}`);
      }

      // Request connection
      const response = await provider.connect();
      const address = response?.publicKey?.toString() || response?.address || response;
      
      if (!address) {
        throw new Error('Failed to get wallet address');
      }

      // Fetch balance
      const balance = await fetchBalance(address);

      setWalletState({
        connected: true,
        address,
        walletType,
        balance,
      });

      // Store last used wallet
      localStorage.setItem('gorbagana_last_wallet', walletType);
      
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
      setWalletState({
        connected: false,
        address: null,
        walletType: null,
        balance: null,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [fetchBalance]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    const provider = getWalletProvider(walletState.walletType);
    
    if (provider?.disconnect) {
      try {
        provider.disconnect();
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
    }

    setWalletState({
      connected: false,
      address: null,
      walletType: null,
      balance: null,
    });
    
    localStorage.removeItem('gorbagana_last_wallet');
    setError(null);
  }, [walletState.walletType]);

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    const lastWallet = localStorage.getItem('gorbagana_last_wallet') as WalletType;
    if (lastWallet && checkWalletInstalled(lastWallet)) {
      // Small delay to ensure wallet extension is loaded
      const timer = setTimeout(() => {
        connect(lastWallet);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [connect]);

  // Listen for account changes
  useEffect(() => {
    const provider = getWalletProvider(walletState.walletType);
    
    if (provider && walletState.connected) {
      const handleAccountChange = () => {
        // Reconnect to get new address
        connect(walletState.walletType);
      };

      const handleDisconnect = () => {
        disconnect();
      };

      provider.on?.('accountChanged', handleAccountChange);
      provider.on?.('disconnect', handleDisconnect);

      return () => {
        provider.off?.('accountChanged', handleAccountChange);
        provider.off?.('disconnect', handleDisconnect);
      };
    }
  }, [walletState.walletType, walletState.connected, connect, disconnect]);

  return (
    <WalletContext.Provider
      value={{
        ...walletState,
        connect,
        disconnect,
        isConnecting,
        error,
        formatAddress,
        availableWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
