import React, { useMemo } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { NetworkProvider } from './contexts/NetworkContext';
import { WalletProvider } from './contexts/WalletContext';
import { DynamicConnectionProvider } from './contexts/DynamicConnectionProvider';
import Navbar from './components/Navbar';
import PriceTicker from './components/PriceTicker';
import Footer from './components/Footer';
import Home from './pages/Home';
import Collection from './pages/Collection';
import Launchpad from './pages/Launchpad';
import Docs from './pages/Docs';
import Gorid from './pages/Gorid';
import Bridge from './pages/Bridge';
import Faucet from './pages/Faucet';
import CoinPushaPage from './src/pages/coin-pusha/CoinPushaPage';

const App: React.FC = () => {
  const wallets = useMemo(() => [new BackpackWalletAdapter()], []);

  return (
    <NetworkProvider>
      <WalletProvider>
        <DynamicConnectionProvider wallets={wallets}>
          <WalletModalProvider>
            <Router>
              <div className="flex flex-col min-h-screen bg-magic-dark text-white font-mono antialiased selection:bg-magic-green selection:text-black">
                <Navbar />
                <PriceTicker />
                <main className="flex-grow">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/collection/:id" element={<Collection />} />
                    <Route path="/launchpad" element={<Launchpad />} />
                    <Route path="/gorid" element={<Gorid />} />
                    <Route path="/docs" element={<Docs />} />
                    <Route path="/bridge" element={<Bridge />} />
                    <Route path="/faucet" element={<Faucet />} />
                    <Route path="/coin-pusha" element={<CoinPushaPage />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </Router>
          </WalletModalProvider>
        </DynamicConnectionProvider>
      </WalletProvider>
    </NetworkProvider>
  );
};

export default App;
