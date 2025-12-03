import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, X, Wallet, Trash2, Activity, Zap, RefreshCw } from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [tps, setTps] = useState<number>(3842);
  const location = useLocation();
  const { network, toggleNetwork, networkName, tpsLabel, accentColor } = useNetwork();

  // Simulate Live Network Data
  useEffect(() => {
    const interval = setInterval(() => {
        setTps(prev => {
            const fluctuation = Math.floor(Math.random() * 400) - 200;
            let next = prev + fluctuation;
            
            // Gorbagana is faster (because it's trash)
            if (network === 'GRB') {
                if (next > 9500) next = 9000;
                if (next < 6000) next = 6500;
                return Math.max(6000, next);
            } else {
                // Solana
                if (next > 4500) next = 4400;
                if (next < 2200) next = 2300;
                return next;
            }
        });
    }, 800);
    return () => clearInterval(interval);
  }, [network]);

  const getNetworkStatus = (currentTps: number) => {
      // Different thresholds for Gorbagana (Now Green Theme)
      if (network === 'GRB') {
          if (currentTps > 8000) return { label: 'DUMPING', color: 'text-magic-green', bg: 'bg-magic-green' };
          return { label: 'CLOGGED', color: 'text-magic-red', bg: 'bg-magic-red' };
      }

      // Solana (Now Purple Theme)
      if (currentTps > 3500) return { label: 'OPTIMAL', color: 'text-magic-purple', bg: 'bg-magic-purple' };
      if (currentTps > 2800) return { label: 'CONGESTED', color: 'text-yellow-500', bg: 'bg-yellow-500' };
      return { label: 'DEGRADED', color: 'text-magic-red', bg: 'bg-magic-red' };
  };

  const status = getNetworkStatus(tps);

  const handleConnect = () => {
    // Simulate connection
    if (!walletAddress) {
      setWalletAddress('5G...zX');
    } else {
      setWalletAddress(null);
    }
  };

  const navLinks = [
    { name: 'Collections', path: '/' },
    { name: 'Launchpad', path: '/launchpad' },
    { name: 'Docs / Brand', path: '/docs' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-magic-dark border-b border-white/20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 group">
              <div className={`${network === 'GRB' ? 'bg-magic-green' : 'bg-magic-purple'} text-black p-1 transition-colors duration-500`}>
                 <Trash2 className="h-6 w-6" />
              </div>
              <span className={`text-xl font-bold text-white tracking-tighter group-hover:${accentColor} transition-colors`}>
                TRASHMARKET<span className={`${accentColor} transition-colors duration-500`}>.FUN</span>
              </span>
            </Link>
          </div>

          {/* Desktop Search */}
          <div className="hidden lg:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className={`h-4 w-4 text-gray-500 group-hover:${accentColor}`} />
              </div>
              <input
                type="text"
                className={`block w-full pl-10 pr-3 py-2 border border-white/20 leading-5 bg-black text-white placeholder-gray-600 focus:outline-none focus:border-current focus:ring-1 focus:ring-current sm:text-sm transition-all duration-150 font-mono uppercase ${network === 'GRB' ? 'focus:text-magic-green' : 'focus:text-magic-purple'}`}
                placeholder="SEARCH_TRASH..."
              />
            </div>
          </div>

          {/* Desktop Menu & Network Status */}
          <div className="hidden md:flex items-center gap-6">
            <div className="hidden xl:flex items-center gap-6 mr-4">
                {navLinks.map((link) => (
                <Link
                    key={link.name}
                    to={link.path}
                    className={`text-sm font-bold uppercase tracking-wide transition-colors hover:${accentColor} ${
                    location.pathname === link.path ? `${accentColor} underline decoration-2 underline-offset-4` : 'text-gray-400'
                    }`}
                >
                    {link.name}
                </Link>
                ))}
            </div>
            
            {/* Network Indicator (Interactive Switcher) */}
            <div 
                onClick={toggleNetwork}
                className="hidden lg:flex items-center gap-3 px-4 py-1 border-l border-r border-white/10 cursor-pointer hover:bg-white/5 transition-colors group relative select-none"
                title="Click to Switch Network"
            >
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <RefreshCw className={`w-3 h-3 ${accentColor}`} />
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-0.5 group-hover:text-white transition-colors">{networkName}</span>
                    <div className="flex items-center gap-2">
                         <span className={`w-1.5 h-1.5 rounded-full ${status.bg} animate-pulse`}></span>
                         <span className={`text-[10px] font-bold ${status.color} font-mono`}>{status.label}</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono mb-0.5">{tpsLabel}</div>
                    <div className="text-xs font-bold text-white font-mono flex items-center gap-1">
                        {tps.toLocaleString()} <Activity className="w-3 h-3 text-gray-600" />
                    </div>
                </div>
            </div>

            <button
              onClick={handleConnect}
              className={`flex items-center gap-2 px-6 py-2 border font-bold text-sm transition-all duration-200 uppercase tracking-wider ${
                walletAddress 
                ? `bg-black border-${network === 'GRB' ? 'magic-green' : 'magic-purple'} ${accentColor} hover:bg-white/10` 
                : network === 'GRB'
                    ? 'bg-magic-green border-magic-green text-black hover:bg-black hover:text-magic-green'
                    : 'bg-magic-purple border-magic-purple text-white hover:bg-black hover:text-magic-purple'
              }`}
            >
              <Wallet className="w-4 h-4" />
              {walletAddress ? walletAddress : 'CONNECT'}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`inline-flex items-center justify-center p-2 ${accentColor} hover:text-white hover:bg-white/10 focus:outline-none`}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-black border-b border-white/20 animate-in slide-in-from-top-5 duration-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
             {/* Mobile Network Status */}
            <div 
                onClick={toggleNetwork}
                className="flex items-center justify-between px-3 py-3 border-b border-white/10 mb-2 bg-white/5 active:bg-white/10"
            >
                <div className="flex items-center gap-2">
                     <Zap className="w-4 h-4 text-gray-400" />
                     <div className="flex flex-col">
                        <span className="text-xs font-mono text-gray-400 uppercase">Network Status</span>
                        <span className={`text-[10px] font-bold uppercase ${accentColor}`}>Switch: {network === 'SOL' ? 'GORBAGANA' : 'SOLANA'}</span>
                     </div>
                </div>
                <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${status.bg} animate-pulse`}></span>
                        <span className={`text-xs font-bold ${status.color} font-mono`}>{status.label}</span>
                     </div>
                     <span className="text-xs font-bold text-white font-mono border-l border-white/20 pl-3">
                        {tps.toLocaleString()} {tpsLabel}
                     </span>
                </div>
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMenuOpen(false)}
                className={`block px-3 py-2 text-base font-bold text-gray-300 hover:${accentColor} hover:bg-white/5 uppercase font-mono`}
              >
                {link.name}
              </Link>
            ))}
            <button
              onClick={handleConnect}
              className={`w-full text-left mt-4 block px-3 py-2 text-base font-bold ${network === 'GRB' ? 'bg-magic-green text-black' : 'bg-magic-purple text-white'} uppercase font-mono`}
            >
              {walletAddress ? walletAddress : 'Connect Wallet'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;