import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGorbagioCollection, getGorbagioNFTs } from '../services/gorbagioService';
import { Collection, NFT } from '../types';

import { Terminal, ArrowRight, ArrowUpRight, ArrowDownRight, Activity, Zap, Radio } from 'lucide-react';

import { useNetwork } from '../contexts/NetworkContext';

// --- SIMPLE MARQUEE COMPONENT ---
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

const Home: React.FC = () => {
  const { currency, accentColor } = useNetwork();

  const [featuredCollection, setFeaturedCollection] = useState<Collection | null>(null);
  const [featuredArtworks, setFeaturedArtworks] = useState<NFT[]>([]);
  const [tickerNFTs, setTickerNFTs] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const heroArtCount = 18;
      const tickerCount = 30;

      const [featuredResult, artResult, tickerResult] = await Promise.allSettled([
        getGorbagioCollection(),
        getGorbagioNFTs({ limit: heroArtCount }),
        getGorbagioNFTs({ limit: tickerCount }),
      ]);

      if (!isMounted) return;

      if (featuredResult.status === 'fulfilled') {
        setFeaturedCollection(featuredResult.value);
      } else {
        console.error('Error fetching Gorbagios:', featuredResult.reason);
        setError('Failed to load Gorbagios collection');
      }

      if (artResult.status === 'fulfilled') {
        const artItems = artResult.value.filter((item) => item.image);
        setFeaturedArtworks(artItems);
      } else {
        console.error('Error fetching Gorbagio artwork:', artResult.reason);
      }

      if (tickerResult.status === 'fulfilled') {
        setTickerNFTs(tickerResult.value);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-magic-green animate-pulse font-mono uppercase tracking-widest text-2xl">
          LOADING GORBAGIOS...
        </div>
      </div>
    );
  }

  if (error && !featuredCollection) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center flex-col gap-4">
        <div className="text-red-500 font-mono uppercase tracking-widest text-xl">
          {error}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 border border-magic-green text-magic-green hover:bg-magic-green hover:text-black transition-colors font-mono uppercase text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>

      {/* Hero / Spotlight */}
      {featuredCollection ? (
        <div className="relative h-[450px] w-full overflow-hidden border-b border-white/20">
          <div className="absolute inset-0">
            <img
              src={featuredCollection.banner || featuredCollection.image}
              alt="Hero"
              className="w-full h-full object-cover opacity-20 grayscale contrast-150"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.5)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
          </div>

          <div className="absolute bottom-0 left-0 w-full p-4 md:p-12 z-10">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
              <div className="max-w-3xl w-full">
                <div className={`flex items-center justify-between mb-2 w-full border-b ${accentColor === 'text-magic-purple' ? 'border-magic-purple/30' : 'border-magic-green/30'} pb-2`}>
                     <div className={`inline-flex items-center gap-2 ${accentColor} text-xs font-bold uppercase tracking-widest font-mono`}>
                          <Terminal className="w-3 h-3" /> System_Spotlight :: {featuredCollection.id.toUpperCase()}
                     </div>
                     <div className="flex gap-4 items-center">
                          <span className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 text-gray-500`}>
                              <Radio className={`w-3 h-3 ${accentColor} animate-pulse`} />
                              GORBAGANA_L2
                          </span>
                     </div>
                </div>

                <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter uppercase leading-none">
                  {featuredCollection.name}
                </h1>

                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                    <div className="flex items-center gap-8 text-sm text-gray-400 font-mono">
                       <div className={`flex flex-col border-l-2 ${accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green'} pl-3`}>
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">Floor_Price</span>
                          <span className="text-white text-xl font-bold">{currency} {featuredCollection.floorPrice}</span>
                       </div>
                       <div className="flex flex-col border-l-2 border-gray-800 pl-3">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">24h_Volume</span>
                          <span className="text-white text-xl font-bold">{currency} {(featuredCollection.totalVolume / 1000).toFixed(1)}k</span>
                       </div>
                    </div>

                    <Link
                      to={`/collection/${featuredCollection.id}`}
                      className={`group relative px-8 py-3 bg-black border ${accentColor === 'text-magic-purple' ? 'border-magic-purple text-magic-purple hover:bg-magic-purple' : 'border-magic-green text-magic-green hover:bg-magic-green'} font-bold uppercase tracking-widest text-xs hover:text-black transition-all duration-200`}
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
                          <div className={`w-20 h-20 md:w-24 md:h-24 bg-black border ${accentColor === 'text-magic-purple' ? 'border-magic-purple/40' : 'border-magic-green/40'} overflow-hidden`}>
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
        <div className="relative h-[450px] w-full overflow-hidden border-b border-white/20 flex items-center justify-center">
          <div className="text-magic-green animate-pulse font-mono uppercase tracking-widest text-xl">
            LOADING SPOTLIGHT...
          </div>
        </div>
      )}


      {/* GORBAGIO NFT TICKER */}
      {tickerNFTs.length > 0 && (
        <div className="border-b border-white/20 bg-[#050505] overflow-hidden relative py-2 group">
           {/* Gradient Masks */}
           <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-black to-transparent z-20 pointer-events-none"></div>
           <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-black to-transparent z-20 pointer-events-none"></div>

           <div className="bg-black/50 backdrop-blur-sm relative z-10">
               <Marquee reverse={true}>
                  {tickerNFTs.map((nft, idx) => (
                      <div key={`ticker-${nft.id}-${idx}`} className="flex items-center gap-3 mx-6 py-2 text-xs uppercase tracking-wider font-mono whitespace-nowrap">
                          {nft.image && (
                            <img
                              src={nft.image}
                              alt={nft.name}
                              className="w-6 h-6 object-cover border border-white/20"
                              loading="lazy"
                            />
                          )}
                          <span className={`font-bold ${accentColor}`}>{nft.name}</span>
                          <span className="text-gray-800 ml-2">|</span>
                      </div>
                  ))}
               </Marquee>
           </div>
        </div>
      )}

      {/* Pro Table Section */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
                <Activity className={`w-5 h-5 ${accentColor}`} />
                <h2 className="text-xl font-bold text-white uppercase tracking-widest font-mono">Market_Feed</h2>
            </div>
            <div className="flex gap-px bg-white/10 border border-white/10">
                <button className="px-4 py-1 bg-black text-gray-500 hover:text-white text-[10px] uppercase font-bold tracking-wider hover:bg-white/5">1h</button>
                <button className={`px-4 py-1 ${accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green'} text-black text-[10px] uppercase font-bold tracking-wider`}>24h</button>
                <button className="px-4 py-1 bg-black text-gray-500 hover:text-white text-[10px] uppercase font-bold tracking-wider hover:bg-white/5">7d</button>
            </div>
        </div>

        <div className="border border-white/20 bg-black relative">
            <div className={`absolute -top-1 -left-1 w-2 h-2 border-t border-l ${accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green'}`}></div>
            <div className={`absolute -bottom-1 -right-1 w-2 h-2 border-b border-r ${accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green'}`}></div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-[10px] text-gray-500 uppercase font-mono tracking-widest bg-white/5">
                            <th className="p-4 font-bold">Rank / Collection</th>
                            <th className="p-4 font-bold text-right">Floor</th>
                            <th className="p-4 font-bold text-right">24h %</th>
                            <th className="p-4 font-bold text-right">24h Vol</th>
                            <th className="p-4 font-bold text-right">Sales</th>
                            <th className="p-4 font-bold text-right">Supply</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {featuredCollection && (
                            <tr className="group hover:bg-white/5 transition-colors">

                                <td className="p-4">
                                    <Link to={`/collection/${featuredCollection.id}`} className="flex items-center gap-4">
                                        <span className="text-gray-700 font-mono text-sm w-4 text-center group-hover:text-white transition-colors">01</span>
                                        <div className={`w-8 h-8 border border-white/20 overflow-hidden bg-gray-900 group-hover:border-${accentColor === 'text-magic-purple' ? 'magic-purple' : 'magic-green'} transition-colors`}>
                                            <img src={featuredCollection.image} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-300 group-hover:text-white flex items-center gap-2 uppercase tracking-tight text-sm transition-colors">
                                                {featuredCollection.name}
                                                {featuredCollection.isVerified && <Zap className={`w-3 h-3 ${accentColor} fill-current`} />}
                                            </div>
                                        </div>
                                    </Link>
                                </td>
                                <td className={`p-4 text-right font-mono font-bold text-gray-300 group-hover:${accentColor} transition-colors`}>
                                    {currency} {featuredCollection.floorPrice}
                                </td>
                                <td className={`p-4 text-right font-mono font-bold text-xs ${featuredCollection.change24h >= 0 ? 'text-magic-green' : 'text-magic-red'}`}>
                                    <div className="flex items-center justify-end gap-1">
                                        {featuredCollection.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                        {Math.abs(featuredCollection.change24h)}%
                                    </div>
                                </td>
                                <td className="p-4 text-right font-mono text-gray-500 text-xs">
                                    {currency} {(featuredCollection.totalVolume / 1000).toFixed(1)}k
                                </td>
                                <td className="p-4 text-right font-mono text-gray-500 text-xs">
                                    {featuredCollection.listedCount}
                                </td>
                                <td className="p-4 text-right font-mono text-gray-600 text-xs">
                                    {featuredCollection.supply}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-3 border-t border-white/10 text-center bg-black">
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    [ GORBAGIOS_ONLY_COLLECTION_ON_GORBAGANA ]
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
