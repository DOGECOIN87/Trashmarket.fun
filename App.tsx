import React, { useMemo } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { AnchorContextProvider } from './contexts/AnchorContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { WalletProvider } from './contexts/WalletContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Collection from './pages/Collection';
import Launchpad from './pages/Launchpad';
import Docs from './pages/Docs';
import Gorid from './pages/Gorid';
import Bridge from './pages/Bridge';

const RPC_URL = 'https://rpc.trashscan.io';

const App: React.FC = () => {
  const wallets = useMemo(() => [new BackpackWalletAdapter()], []);

  return (
    <NetworkProvider>
      <WalletProvider>
        <ConnectionProvider endpoint={RPC_URL}>
          <SolanaWalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <AnchorContextProvider>
                <Router>
                  <div className="flex flex-col min-h-screen bg-magic-dark text-white font-mono antialiased selection:bg-magic-green selection:text-black">
                    <Navbar />
                    <main className="flex-grow">
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/collection/:id" element={<Collection />} />
                        <Route path="/launchpad" element={<Launchpad />} />
                        <Route path="/gorid" element={<Gorid />} />
                        <Route path="/docs" element={<Docs />} />
                        <Route path="/bridge" element={<Bridge />} />
                      </Routes>
                    </main>
                    <Footer />
                  </div>
                </Router>
              </AnchorContextProvider>
            </WalletModalProvider>
          </SolanaWalletProvider>
        </ConnectionProvider>
      </WalletProvider>
    </NetworkProvider>
  );
};

export default App;
