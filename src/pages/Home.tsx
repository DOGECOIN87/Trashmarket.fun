import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGorbagioCollection, getGorbagioNFTs } from '../services/gorbagioService';
import { getTokens, type Token } from '../services/tokenService';
import { Collection, NFT } from '../types';
import { TOKEN_CONFIG } from '../lib/tokenConfig';
import { Connection, PublicKey } from '@solana/web3.js';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';

import { Terminal, ArrowRight, ArrowUpRight, ArrowDownRight, Activity, Zap, Radio, Volume2, VolumeX, Users, Coins, TrendingUp, ExternalLink } from 'lucide-react';
import DebrisShowcase from '../components/DebrisShowcase';

import { useNetwork } from '../contexts/NetworkContext';

// --- SIMPLE MARQUEE COMPONENT FOR ARTWORK CAROUSEL ---
const Marquee = ({ children, reverse = false, className = "" }: { children?: React.ReactNode, reverse?: boolean, className?: string }) => {
  return (
    <div className={`flex overflow-hidden relative w-full select-none ${className}`}>
      <div className={`flex shrink-0 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'} min-w-full items-center gap-0`}>
        {children}
      </div>
      <div className={`flex shrink-0 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'} min-w-full items-center gap-0`}>
        {children}
      </div>
    </div>
  );
};

interface TokenHolder {
  wallet: string;
  tokenAccount: string;
  amount: number;
}

const DEBRIS_MINT = TOKEN_CONFIG.DEBRIS.address;
const DEBRIS_LOGO = 'https://raw.githubusercontent.com/DOGECOIN87/Trashmarket.fun/main/public/assets/logo-circle-transparent.png';

/** Truncate wallet address for display */
function truncateAddr(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

const Home: React.FC = () => {
  const { currency, accentColor } = useNetwork();

  const [featuredCollection, setFeaturedCollection] = useState<Collection | null>(null);
  const [featuredArtworks, setFeaturedArtworks] = useState<NFT[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [debrisHolders, setDebrisHolders] = useState<TokenHolder[]>([]);
  const [debrisSupply, setDebrisSupply] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      const heroArtCount = 18;

      const [featuredResult, artResult, tokensResult] = await Promise.allSettled([
        getGorbagioCollection(),
        getGorbagioNFTs({ limit: heroArtCount, defaultPrice: 0 }),
        getTokens(),
      ]);

      if (!isMounted) return;

      if (featuredResult.status === 'fulfilled') {
        setFeaturedCollection(featuredResult.value);
      }

      if (artResult.status === 'fulfilled') {
        const artItems = artResult.value.filter((item) => item.image);
        setFeaturedArtworks(artItems);
      }

      if (tokensResult.status === 'fulfilled') {
        setTokens(tokensResult.value);
      }

      // Fetch DEBRIS holders from RPC
      try {
        const conn = new Connection(GORBAGANA_CONFIG.rpcEndpoint, 'confirmed');
        const mintPk = new PublicKey(DEBRIS_MINT);

        const [largestAccounts, supplyResult] = await Promise.all([
          conn.getTokenLargestAccounts(mintPk),
          conn.getTokenSupply(mintPk),
        ]);

        if (isMounted) {
          setDebrisSupply(Number(supplyResult.value.amount) / Math.pow(10, TOKEN_CONFIG.DEBRIS.decimals));

          // Resolve owners for accounts with balance > 0
          const holdersWithBalance = largestAccounts.value.filter(a => Number(a.amount) > 0);
          const holders: TokenHolder[] = await Promise.all(
            holdersWithBalance.map(async (acc) => {
              try {
                const info = await conn.getParsedAccountInfo(acc.address);
                const owner = (info.value?.data as any)?.parsed?.info?.owner || acc.address.toBase58();
                return {
                  wallet: owner,
                  tokenAccount: acc.address.toBase58(),
                  amount: Number(acc.amount) / Math.pow(10, TOKEN_CONFIG.DEBRIS.decimals),
                };
              } catch {
                return {
                  wallet: acc.address.toBase58(),
                  tokenAccount: acc.address.toBase58(),
                  amount: Number(acc.amount) / Math.pow(10, TOKEN_CONFIG.DEBRIS.decimals),
                };
              }
            })
          );
          if (isMounted) setDebrisHolders(holders);
        }
      } catch (error) {
        console.error('Error fetching DEBRIS holders:', error);
      }

      setLoading(false);
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const [isHovering, setIsHovering] = useState(false);
  const carouselItems = featuredArtworks.filter((item) => item.image);

  const borderAccent = accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green';
  const bgAccent = accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green';

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-magic-green animate-pulse font-mono uppercase tracking-widest text-2xl">
          LOADING MARKET DATA...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      {/* Hero / Spotlight with Background Video */}
      {featuredCollection ? (
        <div className="relative h-[300px] sm:h-[400px] md:h-[450px] w-full overflow-hidden border-b border-white/20">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="absolute top-0 left-0 w-full h-full object-cover opacity-80"
            src="/Trashmarket-index-background-video.mp4"
          />
          <button
            onClick={toggleMute}
            className="absolute top-4 right-4 z-20 p-2 bg-black/50 border border-white/20 rounded-full hover:bg-black/70 transition-all duration-200 group"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
            ) : (
              <Volume2 className="w-4 h-4 text-magic-green group-hover:text-magic-green/80 transition-colors" />
            )}
          </button>
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.3)_1px,transparent_1px)] bg-[size:40px_40px] opacity-10"></div>
          </div>

          <div className="absolute bottom-0 left-0 w-full p-3 sm:p-6 md:p-12 z-10">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
              <div className="max-w-3xl w-full">
                <div className={`flex items-center justify-between mb-2 w-full border-b ${borderAccent}/30 pb-2`}>
                  <div className={`inline-flex items-center gap-2 ${accentColor} text-xs font-bold uppercase tracking-widest font-mono`}>
                    <Terminal className="w-3 h-3" /> System_Spotlight :: {featuredCollection.id.toUpperCase()}
                  </div>
                  <div className="flex gap-4 items-center">
                    <span className="text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 text-gray-500">
                      <Radio className={`w-3 h-3 ${accentColor} animate-pulse`} />
                      SYSTEM_ONLINE
                    </span>
                  </div>
                </div>

                <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white mb-4 sm:mb-6 tracking-tighter uppercase leading-none">
                  {featuredCollection.name}
                </h1>

                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                  <div className="flex items-center gap-8 text-sm text-gray-400 font-mono">
                    <div className={`flex flex-col border-l-2 ${borderAccent} pl-3`}>
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">Floor_Price</span>
                      <span className="text-white text-xl font-bold">{currency} {featuredCollection.floorPrice}</span>
                    </div>
                    <div className="flex flex-col border-l-2 border-gray-800 pl-3">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">24h_Volume</span>
                      <span className="text-white text-xl font-bold">{currency} {(featuredCollection.totalVolume / 1000).toFixed(1)}k</span>
                    </div>
                  </div>

                  <Link
                    to={`/collection/gorbagio`}
                    className={`group relative px-8 py-3 bg-black border ${borderAccent} ${accentColor} hover:${bgAccent} font-bold uppercase tracking-widest text-xs hover:text-black transition-all duration-200`}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Execute_View <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
              </div>

              {carouselItems.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${accentColor}`}>Gorbagio_Art_Stream</span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Continuous_Carousel</span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
                    <div className="absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
                    <Marquee className="py-2">
                      {carouselItems.map((art, idx) => (
                        <div key={`${art.id}-${idx}`} className="mx-2 md:mx-3">
                          <div className={`w-20 h-20 md:w-24 md:h-24 bg-black border ${borderAccent}/40 overflow-hidden`}>
                            <img
                              src={art.image}
                              alt={art.name}
                              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-300"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      ))}
                    </Marquee>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-[300px] sm:h-[400px] md:h-[450px] w-full overflow-hidden border-b border-white/20 flex items-center justify-center">
          <div className="text-magic-green animate-pulse font-mono uppercase tracking-widest text-xl">
            LOADING SPOTLIGHT...
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-12">
        {/* ─── DEBRIS Token Showcase ─── */}
        <DebrisShowcase 
          debrisSupply={debrisSupply}
          debrisHolders={debrisHolders}
          accentColor={accentColor}
          bgAccent={bgAccent}
          borderAccent={borderAccent}
          truncateAddr={truncateAddr}
        />

        {/* ─── Live Token Feed ─── */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${accentColor}`} />
              <h2 className="text-xl font-bold text-white uppercase tracking-widest font-mono">Token_Feed</h2>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Radio className={`w-3 h-3 ${accentColor} animate-pulse`} /> Live from Gorbagana
            </span>
          </div>

          <div className="border border-white/20 bg-black relative">
            <div className={`absolute -top-1 -left-1 w-2 h-2 border-t border-l ${borderAccent}`}></div>
            <div className={`absolute -bottom-1 -right-1 w-2 h-2 border-b border-r ${borderAccent}`}></div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[8px] sm:text-[10px] text-gray-500 uppercase font-mono tracking-widest bg-white/5">
                    <th className="p-2 sm:p-4 font-bold">Rank / Token</th>
                    <th className="p-2 sm:p-4 font-bold text-right">Price</th>
                    <th className="p-2 sm:p-4 font-bold text-right hidden sm:table-cell">24h %</th>
                    <th className="p-2 sm:p-4 font-bold text-right hidden md:table-cell">Market Cap</th>
                    <th className="p-2 sm:p-4 font-bold text-right hidden lg:table-cell">Holders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-600 font-mono text-xs uppercase">
                        No tokens available
                      </td>
                    </tr>
                  ) : (
                    tokens.slice(0, 15).map((token, idx) => (
                      <tr key={token.contractAddress || token.symbol} className="group hover:bg-white/5 transition-colors">
                        <td className="p-2 sm:p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-700 font-mono text-sm w-5 text-center group-hover:text-white transition-colors">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            {token.logoUrl ? (
                              <div className={`w-8 h-8 min-w-[32px] border border-white/20 overflow-hidden bg-gray-900 group-hover:${borderAccent} transition-colors`}>
                                <img src={token.logoUrl} alt={token.symbol} className="w-8 h-8 object-cover" loading="lazy" />
                              </div>
                            ) : (
                              <div className={`w-8 h-8 min-w-[32px] border border-white/20 bg-gray-900 flex items-center justify-center group-hover:${borderAccent} transition-colors`}>
                                <span className="text-[10px] font-bold text-gray-500">{token.symbol.slice(0, 2)}</span>
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-gray-300 group-hover:text-white uppercase tracking-tight text-sm transition-colors flex items-center gap-1.5">
                                {token.symbol}
                              </div>
                              <div className="text-[10px] text-gray-600 font-mono">{token.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 sm:p-4 text-right font-mono font-bold text-gray-300">
                          {currency} {token.price >= 1 ? token.price.toFixed(2) : token.price >= 0.001 ? token.price.toFixed(4) : token.price.toExponential(2)}
                        </td>
                        <td className={`p-2 sm:p-4 text-right font-mono font-bold text-xs ${token.change24h >= 0 ? 'text-magic-green' : 'text-magic-red'} hidden sm:table-cell`}>
                          <div className="flex items-center justify-end gap-1">
                            {token.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(token.change24h).toFixed(1)}%
                          </div>
                        </td>
                        <td className="p-2 sm:p-4 text-right font-mono text-gray-500 text-xs hidden md:table-cell">
                          {token.marketCap ? `${currency} ${(token.marketCap / 1000).toFixed(1)}k` : '—'}
                        </td>
                        <td className="p-2 sm:p-4 text-right font-mono text-gray-500 text-xs hidden lg:table-cell">
                          {token.holders || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
