import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Collection from './pages/Collection';
import Launchpad from './pages/Launchpad';
import Docs from './pages/Docs';
import { NetworkProvider } from './contexts/NetworkContext';

const App: React.FC = () => {
  return (
    <NetworkProvider>
      <Router>
        <div className="flex flex-col min-h-screen bg-magic-dark text-white font-mono antialiased selection:bg-magic-green selection:text-black">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/collection/:id" element={<Collection />} />
              <Route path="/launchpad" element={<Launchpad />} />
              <Route path="/docs" element={<Docs />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </NetworkProvider>
  );
};

export default App;