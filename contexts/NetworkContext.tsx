import React, { createContext, useContext, useState } from 'react';

// Network type
export type NetworkType = 'GORBAGANA' | 'SOLANA_MAINNET' | 'SOLANA_DEVNET';

// Gorbagana Network Configuration
export const GORBAGANA_CONFIG = {
  name: 'Gorbagana',
  chainId: 'gorbagana-mainnet',
  rpcEndpoint: 'https://rpc.gorbagana.wtf',
  explorerUrl: 'https://trashscan.io',
  currency: {
    symbol: 'GOR',
    decimals: 9,
    displaySymbol: 'G',
  },
  networkLabel: 'Gorbagana_L2',
  tpsLabel: 'GPS', // Gorbagana Per Second
  programId: 'FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq', // Bridge program on Gorbagana
};

// Solana Mainnet Configuration
export const SOLANA_MAINNET_CONFIG = {
  name: 'Solana',
  chainId: 'solana-mainnet',
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
  explorerUrl: 'https://explorer.solana.com',
  currency: {
    symbol: 'SOL',
    decimals: 9,
    displaySymbol: 'SOL',
  },
  networkLabel: 'Solana_Mainnet',
  tpsLabel: 'TPS',
  programId: null, // Not deployed yet (needs 2 SOL)
  sgorMint: '71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg',
};

// Solana Devnet Configuration
export const SOLANA_DEVNET_CONFIG = {
  name: 'Solana Devnet',
  chainId: 'solana-devnet',
  rpcEndpoint: 'https://api.devnet.solana.com',
  explorerUrl: 'https://explorer.solana.com',
  currency: {
    symbol: 'SOL',
    decimals: 9,
    displaySymbol: 'SOL',
  },
  networkLabel: 'Solana_Devnet',
  tpsLabel: 'TPS',
  programId: '66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M', // Deployed for testing
  sgorMint: '5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk', // Test sGOR token on devnet (6 decimals)
  testTokenAccount: 'B7HJE8XsmZmvAAts7yvFoeEuTP2T5LJVg7cMWYVZKtCB', // Test token account
};

interface NetworkContextType {
  // Current network
  currentNetwork: NetworkType;
  network: string;
  currency: string;
  networkName: string;
  tpsLabel: string;
  accentColor: string;
  rpcEndpoint: string;
  explorerUrl: string;
  programId: string | null;

  // Network switching
  setNetwork: (network: NetworkType) => void;
  isGorbagana: boolean;
  isSolana: boolean;
  isDevnet: boolean;

  // Helper functions
  getExplorerLink: (type: 'tx' | 'address' | 'token', value: string) => string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to Gorbagana for main site experience
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>('GORBAGANA');

  // Get current config based on selected network
  const getConfig = () => {
    switch (currentNetwork) {
      case 'SOLANA_MAINNET':
        return SOLANA_MAINNET_CONFIG;
      case 'SOLANA_DEVNET':
        return SOLANA_DEVNET_CONFIG;
      case 'GORBAGANA':
      default:
        return GORBAGANA_CONFIG;
    }
  };

  const config = getConfig();

  const network = currentNetwork === 'GORBAGANA' ? 'GOR' : 'SOL';
  const currency = config.currency.displaySymbol;
  const networkName = config.networkLabel;
  const tpsLabel = config.tpsLabel;
  const accentColor = currentNetwork === 'GORBAGANA' ? 'text-magic-green' : 'text-purple-400';
  const rpcEndpoint = config.rpcEndpoint;
  const explorerUrl = config.explorerUrl;
  const programId = config.programId;

  // Network checks
  const isGorbagana = currentNetwork === 'GORBAGANA';
  const isSolana = currentNetwork === 'SOLANA_MAINNET' || currentNetwork === 'SOLANA_DEVNET';
  const isDevnet = currentNetwork === 'SOLANA_DEVNET';

  const getExplorerLink = (type: 'tx' | 'address' | 'token', value: string): string => {
    const baseUrl = config.explorerUrl;

    if (currentNetwork === 'GORBAGANA') {
      // Gorbagana explorer format
      switch (type) {
        case 'tx':
          return `${baseUrl}/tx/${value}`;
        case 'address':
          return `${baseUrl}/address/${value}`;
        case 'token':
          return `${baseUrl}/token/${value}`;
        default:
          return baseUrl;
      }
    } else {
      // Solana explorer format
      const cluster = isDevnet ? '?cluster=devnet' : '';
      switch (type) {
        case 'tx':
          return `${baseUrl}/tx/${value}${cluster}`;
        case 'address':
          return `${baseUrl}/address/${value}${cluster}`;
        case 'token':
          return `${baseUrl}/token/${value}${cluster}`;
        default:
          return baseUrl;
      }
    }
  };

  return (
    <NetworkContext.Provider value={{
      currentNetwork,
      network,
      currency,
      networkName,
      tpsLabel,
      accentColor,
      rpcEndpoint,
      explorerUrl,
      programId,
      setNetwork: setCurrentNetwork,
      isGorbagana,
      isSolana,
      isDevnet,
      getExplorerLink
    }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork must be used within NetworkProvider');
  return context;
};
