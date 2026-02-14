import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { AnchorContextProvider } from './AnchorContext';
import { useNetwork } from './NetworkContext';
import type { Adapter } from '@solana/wallet-adapter-base';

interface DynamicConnectionProviderProps {
  children: React.ReactNode;
  wallets: Adapter[];
}

/**
 * DynamicConnectionProvider wraps ConnectionProvider and updates the RPC endpoint
 * dynamically based on the selected network from NetworkContext.
 *
 * This ensures the wallet connects to the correct network based on user selection.
 */
export const DynamicConnectionProvider: React.FC<DynamicConnectionProviderProps> = ({ children, wallets }) => {
  const { rpcEndpoint, currentNetwork } = useNetwork();

  // Memoize to prevent unnecessary re-renders
  const endpoint = useMemo(() => rpcEndpoint, [rpcEndpoint]);

  // Determine Solana wallet adapter network (for wallet compatibility)
  const network = useMemo(() => {
    switch (currentNetwork) {
      case 'SOLANA_DEVNET':
        return WalletAdapterNetwork.Devnet;
      case 'SOLANA_MAINNET':
        return WalletAdapterNetwork.Mainnet;
      case 'GORBAGANA':
      default:
        // Gorbagana uses a custom RPC, treat as mainnet for wallet compatibility
        return WalletAdapterNetwork.Mainnet;
    }
  }, [currentNetwork]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <AnchorContextProvider>
          {children}
        </AnchorContextProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
