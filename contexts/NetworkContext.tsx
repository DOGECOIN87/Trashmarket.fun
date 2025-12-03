import React, { createContext, useContext, useState } from 'react';

type Network = 'SOL' | 'GRB';

interface NetworkContextType {
  network: Network;
  toggleNetwork: () => void;
  currency: string;
  networkName: string;
  tpsLabel: string;
  accentColor: string; // 'text-magic-green' | 'text-magic-purple'
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [network, setNetwork] = useState<Network>('SOL');

  const toggleNetwork = () => {
    setNetwork(prev => prev === 'SOL' ? 'GRB' : 'SOL');
  };

  const currency = network === 'SOL' ? '◎' : 'G';
  const networkName = network === 'SOL' ? 'Solana_Mainnet' : 'Gorbagana_L2';
  const tpsLabel = network === 'SOL' ? 'TPS' : 'GPS';
  // Swapped: SOL is Purple, GRB is Green
  const accentColor = network === 'SOL' ? 'text-magic-purple' : 'text-magic-green';

  return (
    <NetworkContext.Provider value={{ network, toggleNetwork, currency, networkName, tpsLabel, accentColor }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork must be used within NetworkProvider');
  return context;
};