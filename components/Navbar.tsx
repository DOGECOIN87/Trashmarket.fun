import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, X, Wallet, Trash2, Activity, ExternalLink } from 'lucide-react';
import { useNetwork, GORBAGANA_CONFIG } from '../contexts/NetworkContext';
import { useWallet } from '../contexts/WalletContext';

// Wallet Selection Modal Component
const WalletModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { connect, isConnecting, error, availableWallets } = useWallet();

  if (!isOpen) return null;

  const handleConnect = async (walletType: 'backpack' | 'gorbag') => {
    await connect(walletType);
    if (!error) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-magic-dark border border-magic-green/30 p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-6 h-6 text-magic-green" />
          <h2 className="text-xl font-bold text-white uppercase tracking-wide">Connect Wallet</h2>
        </div>

        <p className="text-gray-400 text-sm mb-6 font-mono">
          Connect your wallet to start trading trash on Gorbagana
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {availableWallets.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleConnect(wallet.id as 'backpack' | 'gorbag')}
              disabled={isConnecting}
              className={`w-full flex items-center justify-between p-4 border transition-all duration-200 group ${
                wallet.installed
                  ? 'border-white/20 hover:border-magic-green hover:bg-magic-green/5'
                  : 'border-white/10 opacity-60'
              } ${isConnecting ? 'opacity-50 cursor-wait' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wallet.icon}</span>
                <div className="text-left">
                  <div className="text-white font-bold uppercase tracking-wide group-hover:text-magic-green transition-colors">
                    {wallet.name}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {wallet.installed ? 'Detected' : 'Not Installed'}
                  </div>
                </div>
              </div>
              {!wallet.installed && (
                <ExternalLink className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-[10px] text-gray-600 font-mono uppercase text-center">
            Powered by {GORBAGANA_CONFIG.networkLabel}
          </p>
        </div>
      </div>
    </div>
  );
};

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [gps, setGps] = useState<number>(7842);
  const location = useLocation();
  const { networkName, tpsLabel, accentColor, explorerUrl } = useNetwork();
  const { connected, address, disconnect, formatAddress, balance } = useWallet();

  // Simulate Live Network Data (GPS - Gorbagana Per Second)
  useEffect(() => {
    const interval = setInterval(() => {
      setGps(prev => {
        const fluctuation = Math.floor(Math.random() * 400) - 200;
        let next = prev + fluctuation;
        // Gorbagana runs hot
        if (next > 9500) next = 9000;
        if (next < 6000) next = 6500;
        return Math.max(6000, next);
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const getNetworkStatus = (currentGps: number) => {
    if (currentGps > 8000) return { label: 'DUMPING', color: 'text-magic-green', bg: 'bg-magic-green' };
    if (currentGps > 7000) return { label: 'FLOWING', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    return { label: 'CLOGGED', color: 'text-magic-red', bg: 'bg-magic-red' };
  };

  const status = getNetworkStatus(gps);

  const handleWalletClick = () => {
    if (connected) {
      disconnect();
    } else {
      setIsWalletModalOpen(true);
    }
  };

  const navLinks = [
    { name: 'Collections', path: '/' },
    { name: 'Launchpad', path: '/launchpad' },
    { name: 'Docs / Brand', path: '/docs' },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 bg-magic-dark border-b border-white/20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="bg-magic-green text-black p-1 transition-colors duration-500">
                  <Trash2 className="h-6 w-6" />
                </div>
                <span className="text-xl font-bold text-white tracking-tighter group-hover:text-magic-green transition-colors">
                  TRASHMARKET<span className="text-magic-green">.FUN</span>
                </span>
              </Link>
            </div>

            {/* Desktop Search */}
            <div className="hidden lg:flex flex-1 max-w-lg mx-8">
              <div className="relative w-full group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-500 group-hover:text-magic-green" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-white/20 leading-5 bg-black text-white placeholder-gray-600 focus:outline-none focus:border-magic-green focus:ring-1 focus:ring-magic-green sm:text-sm transition-all duration-150 font-mono uppercase focus:text-magic-green"
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
                    className={`text-sm font-bold uppercase tracking-wide transition-colors hover:text-magic-green ${
                      location.pathname === link.path ? 'text-magic-green underline decoration-2 underline-offset-4' : 'text-gray-400'
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
              
              {/* Network Indicator (Gorbagana Only) */}
              <a 
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:flex items-center gap-3 px-4 py-1 border-l border-r border-white/10 cursor-pointer hover:bg-white/5 transition-colors group"
                title="View on Trashscan"
              >
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
                    {gps.toLocaleString()} <Activity className="w-3 h-3 text-gray-600" />
                  </div>
                </div>
              </a>

              {/* Wallet Button */}
              <button
                onClick={handleWalletClick}
                className={`flex items-center gap-2 px-6 py-2 border font-bold text-sm transition-all duration-200 uppercase tracking-wider ${
                  connected 
                    ? 'bg-black border-magic-green text-magic-green hover:bg-white/10' 
                    : 'bg-magic-green border-magic-green text-black hover:bg-black hover:text-magic-green'
                }`}
              >
                <Wallet className="w-4 h-4" />
                {connected && address ? (
                  <span className="flex items-center gap-2">
                    {formatAddress(address)}
                    {balance !== null && (
                      <span className="text-xs opacity-70">({balance.toFixed(2)} G)</span>
                    )}
                  </span>
                ) : (
                  'CONNECT'
                )}
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 text-magic-green hover:text-white hover:bg-white/10 focus:outline-none"
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
              <a 
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-3 border-b border-white/10 mb-2 bg-white/5 active:bg-white/10"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-magic-green" />
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-gray-400 uppercase">Network</span>
                    <span className="text-[10px] font-bold uppercase text-magic-green">{networkName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${status.bg} animate-pulse`}></span>
                    <span className={`text-xs font-bold ${status.color} font-mono`}>{status.label}</span>
                  </div>
                  <span className="text-xs font-bold text-white font-mono border-l border-white/20 pl-3">
                    {gps.toLocaleString()} {tpsLabel}
                  </span>
                </div>
              </a>

              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 text-base font-bold text-gray-300 hover:text-magic-green hover:bg-white/5 uppercase font-mono"
                >
                  {link.name}
                </Link>
              ))}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  handleWalletClick();
                }}
                className="w-full text-left mt-4 block px-3 py-2 text-base font-bold bg-magic-green text-black uppercase font-mono"
              >
                {connected && address ? formatAddress(address) : 'Connect Wallet'}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Wallet Modal */}
      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
      />
    </>
  );
};

export default Navbar;
