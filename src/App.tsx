import React, { useMemo, lazy, Suspense, useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { NetworkProvider } from './contexts/NetworkContext';
import { WalletProvider } from './contexts/WalletContext';
import { DynamicConnectionProvider } from './contexts/DynamicConnectionProvider';
import Navbar from './components/Navbar';
import PriceTicker, { ActivityTicker } from './components/PriceTicker';
import Footer from './components/Footer';
import Notifications from './components/Notifications';
import PageTransition from './components/PageTransition';
import ScratchTicket from './components/ScratchTicket';

const Home = lazy(() => import('./pages/Home'));
const Docs = lazy(() => import('./pages/Docs'));
const OfficialDocs = lazy(() => import('./pages/OfficialDocs'));
const GorbagioMarket = lazy(() => import('./pages/GorbagioMarket'));
const Gorid = lazy(() => import('./pages/Gorid'));
const Bridge = lazy(() => import('./pages/Bridge'));
const JunkPusherPage = lazy(() => import('./pages/JunkPusher'));
const SlotsPage = lazy(() => import('./pages/Slots'));
const Swap = lazy(() => import('./pages/Swap'));
const VanityGenerator = lazy(() => import('./pages/VanityGenerator'));
const Submit = lazy(() => import('./pages/Submit'));
const Raffle = lazy(() => import('./pages/Raffle'));
const GorbagioMigration = lazy(() => import('./pages/GorbagioMigration'));
const Airdrop = lazy(() => import('./pages/Airdrop'));
const Admin = lazy(() => import('./pages/Admin'));
const Launchpad = lazy(() => import('./pages/Launchpad'));
const JustAliensMint = lazy(() => import('./pages/JustAliensMint'));

// Inner component so we can access wallet context
const AppInner: React.FC = () => {
  const { connected } = useWallet();
  const [showTicket, setShowTicket] = useState(false);
  const shownThisSession = useRef(false);
  const connectTime = useRef<number | null>(null);

  // Track when wallet connects
  useEffect(() => {
    if (connected && connectTime.current === null) {
      connectTime.current = Date.now();
    }
    if (!connected) {
      connectTime.current = null;
    }
  }, [connected]);

  // Listen for navbar scratch ticket button
  useEffect(() => {
    const handler = () => setShowTicket(true);
    window.addEventListener('open-scratch-ticket', handler);
    return () => window.removeEventListener('open-scratch-ticket', handler);
  }, []);

  // Periodically check if we should pop the ticket
  useEffect(() => {
    if (!connected || shownThisSession.current) return;

    // Random delay between 5–10 minutes after connecting
    const delayMs = (5 + Math.random() * 5) * 60 * 1000;

    const timer = setTimeout(() => {
      if (connected && !shownThisSession.current) {
        shownThisSession.current = true;
        setShowTicket(true);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [connected]);

  return (
    <div
      className="flex flex-col min-h-screen text-white font-mono antialiased selection:bg-magic-blue selection:text-black"
      style={{
        backgroundImage: 'url(/slow_spinning_cookies.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      <PageTransition />
      <Navbar />
      <PriceTicker />
      <main className="flex-grow">
        <Suspense fallback={<div className="flex-grow" />}>
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
            <Route path="/admin" element={<Admin />} />
            <Route path="/launchpad" element={<Launchpad />} />
            <Route path="/launchpad/just-aliens" element={<JustAliensMint />} />
          </Routes>
        </Suspense>
      </main>
      <ActivityTicker />
      <Footer onOpenScratchTicket={() => setShowTicket(true)} />
      <Notifications />
      {showTicket && <ScratchTicket onClose={() => setShowTicket(false)} />}
    </div>
  );
};

const App: React.FC = () => {
  const wallets = useMemo(() => [], []);

  return (
    <NetworkProvider>
      <WalletProvider>
        <DynamicConnectionProvider wallets={wallets}>
          <WalletModalProvider>
            <Router>
              <AppInner />
            </Router>
          </WalletModalProvider>
        </DynamicConnectionProvider>
      </WalletProvider>
    </NetworkProvider>
  );
};

export default App;
