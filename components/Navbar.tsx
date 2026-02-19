import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, X, Wallet, Trash2, Activity, ExternalLink, Globe, ChevronDown } from 'lucide-react';
import { useNetwork, GORBAGANA_CONFIG, NetworkType } from '../contexts/NetworkContext';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Detect which network the RPC is connected to
type DetectedNetwork = 'gorbagana' | 'solana' | 'unknown';

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNetworkMenuOpen, setIsNetworkMenuOpen] = useState(false);
  const [gps, setGps] = useState<number>(7842);
  const [balance, setBalance] = useState<number | null>(null);
  const [detectedNetwork, setDetectedNetwork] = useState<DetectedNetwork>('unknown');
  const location = useLocation();
  const { networkName, tpsLabel, accentColor, explorerUrl, currentNetwork, setNetwork, isDevnet } = useNetwork();
  const { connected, publicKey, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  // Format address for display
  const formatAddress = (addr: string): string => {
    if (!addr || addr.length < 8) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const address = publicKey?.toBase58() || null;

  // Fetch balance when connected
  useEffect(() => {
    if (!publicKey || !connection) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    const fetchBal = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        if (!cancelled) {
          setBalance(lamports / LAMPORTS_PER_SOL);
        }
      } catch (err) {
        console.error('Failed to fetch balance:', err);
        if (!cancelled) setBalance(null);
      }
    };
    fetchBal();
    const interval = setInterval(fetchBal, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [publicKey, connection]);

  // Detect network from RPC endpoint
  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    const detect = async () => {
      try {
        // Compare the connected RPC endpoint with the Gorbagana RPC endpoint
        if (connection.rpcEndpoint === GORBAGANA_CONFIG.rpcEndpoint) {
          if (!cancelled) setDetectedNetwork('gorbagana');
        } else {
          // Assume any other RPC endpoint is Solana
          if (!cancelled) setDetectedNetwork('solana');
        }
      } catch (err) {
        console.error('Failed to detect network:', err);
        if (!cancelled) setDetectedNetwork('unknown');
      }
    };
    detect();
    return () => { cancelled = true; };
  }, [connection]);

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
      setVisible(true);
    }
  };

  const navLinks = [
    { name: 'Collections', path: '/' },
    { name: 'GorID', path: '/gorid' },
    { name: 'Bridge', path: '/bridge' },
    { name: 'JUNKPUSHER', path: '/junk-pusher' },
    { name: 'DEX', path: '/dex' },
    { name: 'Vanity', path: '/vanity' },
    { name: 'Docs', path: '/docs' },
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
                    className={`text-sm font-bold uppercase tracking-wide transition-colors hover:text-magic-green ${location.pathname === link.path ? 'text-magic-green underline decoration-2 underline-offset-4' : 'text-gray-400'
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

              {/* Devnet Warning Badge (Prominent) */}
              {isDevnet && (
                <div className="flex items-center gap-2 px-3 py-1.5 border border-blue-500 bg-blue-500/10 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 font-mono">
                    ⚠️ DEVNET MODE
                  </span>
                </div>
              )}

              {/* Network Switcher Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsNetworkMenuOpen(!isNetworkMenuOpen)}
                  className={`flex items-center gap-2 px-4 py-2 border transition-colors ${isDevnet
                      ? 'border-blue-500 bg-blue-500/10 hover:bg-blue-500/20'
                      : 'border-white/20 bg-black hover:bg-white/5'
                    }`}
                >
                  <Globe className="w-4 h-4" />
                  <span className={`text-xs font-bold uppercase tracking-wider font-mono ${currentNetwork === 'GORBAGANA' ? 'text-magic-green' :
                    isDevnet ? 'text-blue-400' : 'text-purple-400'
                    }`}>
                    {currentNetwork === 'GORBAGANA' ? '🗑️ GOR' :
                      isDevnet ? '◎ SOL-DEV' : '◎ SOL'}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${isNetworkMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isNetworkMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-magic-dark border border-white/20 shadow-lg z-50">
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setNetwork('GORBAGANA');
                          setIsNetworkMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors ${currentNetwork === 'GORBAGANA' ? 'bg-magic-green/10 border border-magic-green/30' : 'border border-transparent'
                          }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-magic-green font-bold">🗑️</span>
                          <span className="text-white font-mono">Gorbagana</span>
                        </span>
                        {currentNetwork === 'GORBAGANA' && (
                          <span className="w-2 h-2 rounded-full bg-magic-green animate-pulse"></span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setNetwork('SOLANA_DEVNET');
                          setIsNetworkMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors ${currentNetwork === 'SOLANA_DEVNET' ? 'bg-blue-500/10 border border-blue-500/30' : 'border border-transparent'
                          }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-blue-400 font-bold">◎</span>
                          <span className="text-white font-mono">Solana Devnet</span>
                          <span className="text-[9px] text-blue-400 bg-blue-500/20 px-1 py-0.5 uppercase">test</span>
                        </span>
                        {currentNetwork === 'SOLANA_DEVNET' && (
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          alert('Solana mainnet bridge requires deployment (2 SOL). Currently testing on devnet.');
                          setIsNetworkMenuOpen(false);
                        }}
                        disabled
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm opacity-50 cursor-not-allowed border border-transparent"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-purple-400 font-bold">◎</span>
                          <span className="text-gray-400 font-mono">Solana Mainnet</span>
                          <span className="text-[9px] text-yellow-500 bg-yellow-500/20 px-1 py-0.5 uppercase">soon</span>
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Connected Network Badge */}
              {connected && (
                <div className="flex items-center gap-1.5 px-3 py-1 border border-white/10 bg-black/50">
                  <Globe className="w-3 h-3" />
                  <span className={`text-[10px] font-bold uppercase tracking-widest font-mono ${detectedNetwork === 'gorbagana' ? 'text-magic-green' :
                    detectedNetwork === 'solana' ? 'text-purple-400' :
                      'text-gray-500'
                    }`}>
                    {detectedNetwork === 'gorbagana' ? '🗑️ GORBAGANA' :
                      detectedNetwork === 'solana' ? '◎ SOLANA' :
                        'DETECTING...'}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${detectedNetwork === 'gorbagana' ? 'bg-magic-green' :
                    detectedNetwork === 'solana' ? 'bg-purple-400' :
                      'bg-gray-500'
                    }`}></span>
                </div>
              )}

              {/* Wallet Button */}
              <button
                onClick={handleWalletClick}
                className={`flex items-center gap-2 px-6 py-2 border font-bold text-sm transition-all duration-200 uppercase tracking-wider ${connected
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
              {/* Mobile Connected Network Badge */}
              {connected && (
                <div className="flex items-center gap-2 px-3 py-2 bg-black border border-white/10 mt-2">
                  <Globe className="w-4 h-4" />
                  <span className={`text-xs font-bold uppercase tracking-widest font-mono ${detectedNetwork === 'gorbagana' ? 'text-magic-green' :
                    detectedNetwork === 'solana' ? 'text-purple-400' : 'text-gray-500'
                    }`}>
                    {detectedNetwork === 'gorbagana' ? '🗑️ GORBAGANA' :
                      detectedNetwork === 'solana' ? '◎ SOLANA' : 'DETECTING...'}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${detectedNetwork === 'gorbagana' ? 'bg-magic-green' :
                    detectedNetwork === 'solana' ? 'bg-purple-400' : 'bg-gray-500'
                    }`}></span>
                </div>
              )}

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

    </>
  );
};

export default Navbar;