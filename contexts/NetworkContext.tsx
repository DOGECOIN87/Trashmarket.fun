import React, { createContext, useContext } from 'react';

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
};

interface NetworkContextType {
  network: 'GOR';
  currency: string;
  networkName: string;
  tpsLabel: string;
  accentColor: string;
  rpcEndpoint: string;
  explorerUrl: string;
  getExplorerLink: (type: 'tx' | 'address' | 'token', value: string) => string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const network = 'GOR' as const;
  const currency = GORBAGANA_CONFIG.currency.displaySymbol;
  const networkName = GORBAGANA_CONFIG.networkLabel;
  const tpsLabel = GORBAGANA_CONFIG.tpsLabel;
  const accentColor = 'text-magic-green';
  const rpcEndpoint = GORBAGANA_CONFIG.rpcEndpoint;
  const explorerUrl = GORBAGANA_CONFIG.explorerUrl;

  const getExplorerLink = (type: 'tx' | 'address' | 'token', value: string): string => {
    const baseUrl = GORBAGANA_CONFIG.explorerUrl;
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
  };

  return (
    <NetworkContext.Provider value={{ 
      network, 
      currency, 
      networkName, 
      tpsLabel, 
      accentColor,
      rpcEndpoint,
      explorerUrl,
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
