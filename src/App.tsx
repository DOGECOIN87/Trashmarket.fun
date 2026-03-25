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
import Docs from './pages/Docs';
import OfficialDocs from './pages/OfficialDocs';
import GorbagioMarket from './pages/GorbagioMarket';
import Gorid from './pages/Gorid';
import Bridge from './pages/Bridge';
import JunkPusherPage from './pages/JunkPusher';
import SlotsPage from './pages/Slots';
import Swap from './pages/Swap';
import VanityGenerator from './pages/VanityGenerator';
import Submit from './pages/Submit';
import Raffle from './pages/Raffle';
import GorbagioMigration from './pages/GorbagioMigration';
import Airdrop from './pages/Airdrop';
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
              <div
                className="flex flex-col min-h-screen text-white font-mono antialiased selection:bg-magic-green selection:text-black"
                style={{
                  backgroundImage: 'url(/images/Junk-background.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'top center',
                  backgroundRepeat: 'no-repeat',
                  backgroundAttachment: 'fixed'
                }}
              >
                <Navbar />
                <PriceTicker />
                <main className="flex-grow">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/nft" element={<GorbagioMarket />} />
                    <Route path="/collection/:id" element={<GorbagioMarket />} />
                    <Route path="/gorid" element={<Gorid />} />
                    <Route path="/docs" element={<Docs />} />
                    <Route path="/official-docs" element={<OfficialDocs />} />

                    <Route path="/bridge" element={<Bridge />} />
                    <Route path="/junk-pusher" element={<JunkPusherPage />} />
                    <Route path="/slots" element={<SlotsPage />} />
                    <Route path="/dex" element={<Swap />} />
                    <Route path="/vanity" element={<VanityGenerator />} />
                    <Route path="/submit" element={<Submit />} />
                    <Route path="/raffle" element={<Raffle />} />
                    <Route path="/migrate" element={<GorbagioMigration />} />
                    <Route path="/airdrop" element={<Airdrop />} />
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
