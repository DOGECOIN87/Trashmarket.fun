import React, { useMemo } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { NetworkProvider } from './contexts/NetworkContext';
import { WalletProvider } from './contexts/WalletContext';
import { DynamicConnectionProvider } from './contexts/DynamicConnectionProvider';
import Navbar from './components/Navbar';
import PriceTicker, { ActivityTicker } from './components/PriceTicker';
import Footer from './components/Footer';
import Home from './pages/Home';
import Collection from './pages/Collection';
import Docs from './pages/Docs';
import Gorid from './pages/Gorid';
import Bridge from './pages/Bridge';
import JunkPusherPage from './pages/JunkPusher';
import Dex from './pages/Dex';
import VanityGenerator from './pages/VanityGenerator';
import Submit from './pages/Submit';
import Notifications from './components/Notifications';

const App: React.FC = () => {
  // Use empty array - Standard Wallets (Phantom, Backpack, Solflare, etc.) are auto-detected
  const wallets = useMemo(() => [], []);

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
                    <Route path="/gorid" element={<Gorid />} />
                    <Route path="/docs" element={<Docs />} />
                    <Route path="/bridge" element={<Bridge />} />
                    <Route path="/junk-pusher" element={<JunkPusherPage />} />
                    <Route path="/dex" element={<Dex />} />
                    <Route path="/vanity" element={<VanityGenerator />} />
                    <Route path="/submit" element={<Submit />} />
                  </Routes>
                </main>
                <ActivityTicker />
                <Footer />
                <Notifications />
              </div>
            </Router>
          </WalletModalProvider>
        </DynamicConnectionProvider>
      </WalletProvider>
    </NetworkProvider>
  );
};

export default App;
