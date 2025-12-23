import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { MOCK_COLLECTIONS, MOCK_NFTS, generateChartData, generateActivity } from '../constants';
import NFTCard from '../components/NFTCard';
import PriceChart from '../components/PriceChart';
import { Filter, Search, Zap, Activity as ActivityIcon, ShoppingCart, RefreshCw, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';
import { getGorbagioCollectionWithNFTs } from '../services/gorbagioService';
import { Collection as CollectionType, NFT } from '../types';

const Collection: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'items' | 'activity'>('items');
  const [sweepCount, setSweepCount] = useState<number>(0);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const { currency, accentColor } = useNetwork();

  const [collection, setCollection] = useState<CollectionType | null>(() => {
    return id ? MOCK_COLLECTIONS.find((item) => item.id === id) || null : null;
  });
  const [nfts, setNfts] = useState<NFT[]>(() => {
    return id ? MOCK_NFTS[id] || [] : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fallbackCollection = MOCK_COLLECTIONS.find((item) => item.id === id) || null;
    const fallbackNfts = id ? MOCK_NFTS[id] || [] : [];

    setCollection(fallbackCollection);
    setNfts(fallbackNfts);
    setApiError(null);

    if (id !== 'gorbagios') {
      setIsSyncing(false);
      return;
    }

    let isMounted = true;
    setIsSyncing(true);

    getGorbagioCollectionWithNFTs({
      collectionFallback: fallbackCollection || undefined,
      defaultPrice: fallbackCollection?.floorPrice ?? 0,
      limit: 120,
    })
      .then(({ collection: liveCollection, nfts: liveNfts }) => {
        if (!isMounted) return;
        setCollection(liveCollection);
        setNfts(liveNfts);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Error fetching Gorbagios:', error);
        setApiError('Failed to load Gorbagios. Using fallback data.');
      })
      .finally(() => {
        if (!isMounted) return;
        setIsSyncing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Memoized data
  const chartData = useMemo(() => collection ? generateChartData(collection.floorPrice) : [], [collection]);
  const activityData = useMemo(() => (id ? generateActivity(id) : []), [id]);

  // Filter Logic
  const filteredNfts = nfts?.filter(nft => 
    nft.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sweep Logic
  const selectedNfts = useMemo(() => {
    if (sweepCount === 0) return new Set<string>();
    return new Set(filteredNfts?.slice(0, sweepCount).map(n => n.id));
  }, [sweepCount, filteredNfts]);

  const totalPrice = useMemo(() => {
    let total = 0;
    filteredNfts?.slice(0, sweepCount).forEach(n => total += n.price);
    return total.toFixed(2);
  }, [sweepCount, filteredNfts]);

  // Styling maps
  const btnPrimary = accentColor === 'text-magic-purple' ? 'bg-magic-purple text-white hover:bg-white hover:text-magic-purple' : 'bg-magic-green text-black hover:bg-white hover:text-black';
  const borderFocus = accentColor === 'text-magic-purple' ? 'focus:border-magic-purple' : 'focus:border-magic-green';

  if (!collection) {
    return <div className="p-20 text-center font-mono text-red-500 uppercase">Error: Collection_Not_Found</div>;
  }

  // Reusable Filter Content
  const FilterContent = () => (
    <div className="space-y-6">
        <div>
        <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Status</div>
        <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                <div className={`w-4 h-4 border border-white/40 flex items-center justify-center group-hover:border-${accentColor === 'text-magic-purple' ? 'magic-purple' : 'magic-green'}`}>
                    <div className={`w-2 h-2 ${accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green'} opacity-100`}></div>
                </div>
                <span className="group-hover:text-white">Buy Now</span>
            </label>
                <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                <div className={`w-4 h-4 border border-white/40 flex items-center justify-center group-hover:border-${accentColor === 'text-magic-purple' ? 'magic-purple' : 'magic-green'}`}>
                    {/* unchecked */}
                </div>
                <span className="group-hover:text-white">Auction</span>
            </label>
        </div>
        </div>
        <div>
        <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Price Range ({currency})</div>
        <div className="flex gap-2">
            <input type="number" placeholder="Min" className={`w-1/2 bg-black border border-white/20 p-2 text-sm text-white font-mono placeholder-gray-700 ${borderFocus} outline-none`} />
            <input type="number" placeholder="Max" className={`w-1/2 bg-black border border-white/20 p-2 text-sm text-white font-mono placeholder-gray-700 ${borderFocus} outline-none`} />
        </div>
        </div>
        
        <div>
            <div className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Attributes</div>
            {['Background', 'Skin', 'Clothing', 'Eyes', 'Mouth', 'Headwear'].map(attr => (
                <div key={attr} className="py-2 border-t border-white/10 flex justify-between items-center text-sm text-gray-400 cursor-pointer hover:text-white group">
                    <span className={`group-hover:${accentColor} transition-colors`}>{attr}</span>
                    <span className="text-xs text-gray-600">+</span>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">

      {/* API Error Banner */}
      {apiError && (
        <div className="bg-yellow-500/20 border-b border-yellow-500/40 px-4 py-2 text-center">
          <p className="text-yellow-500 text-xs font-mono uppercase">{apiError}</p>
        </div>
      )}

      {/* Mobile Filter Drawer Overlay */}
      {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileFilterOpen(false)} />
              <div className="relative w-[85%] max-w-sm bg-black border-r border-white/20 h-full flex flex-col animate-in slide-in-from-left duration-200">
                  <div className="p-4 border-b border-white/20 flex items-center justify-between">
                      <div className={`flex items-center gap-2 ${accentColor} font-bold uppercase tracking-wider`}>
                          <Filter className="w-4 h-4" /> Filters
                      </div>
                      <button onClick={() => setIsMobileFilterOpen(false)} className="text-gray-400 hover:text-white">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                      <FilterContent />
                  </div>
                  <div className="p-4 border-t border-white/20 bg-magic-card">
                      <button 
                          onClick={() => setIsMobileFilterOpen(false)}
                          className={`w-full ${btnPrimary} font-bold py-3 uppercase tracking-widest transition-colors`}
                      >
                          Show Results
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Top Bar: Collection Summary & Chart */}
      <div className="bg-black border-b border-white/20">
        <div className="max-w-[1600px] mx-auto">
            <div className="flex flex-col lg:flex-row border-l border-r border-white/20">
                {/* Collection Info */}
                <div className="lg:w-1/3 p-4 md:p-6 border-b lg:border-b-0 lg:border-r border-white/20">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-900 border-2 border-white grayscale flex-shrink-0">
                            <img src={collection.image} className="w-full h-full object-cover" alt={collection.name} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 uppercase tracking-tight truncate">
                                {collection.name}
                                {collection.isVerified && <Zap className={`w-4 h-4 md:w-5 md:h-5 ${accentColor} fill-current flex-shrink-0`} />}
                            </h1>
                            <p className="text-gray-500 text-[10px] md:text-xs font-mono mt-1 line-clamp-2">{collection.description}</p>
                            {isSyncing && (
                                <div className="text-[9px] font-mono uppercase tracking-widest text-gray-600 mt-2">
                                    Syncing Gorbagio API...
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-px bg-white/20 border border-white/20">
                        <div className="bg-black p-2 md:p-3 hover:bg-white/5 transition-colors">
                            <div className="text-gray-500 text-[9px] md:text-[10px] uppercase font-bold mb-1">Floor</div>
                            <div className={`${accentColor} font-mono font-bold text-base md:text-lg`}>{currency} {collection.floorPrice}</div>
                        </div>
                        <div className="bg-black p-2 md:p-3 hover:bg-white/5 transition-colors">
                            <div className="text-gray-500 text-[9px] md:text-[10px] uppercase font-bold mb-1">Vol (24h)</div>
                            <div className="text-white font-mono font-bold text-base md:text-lg">{(collection.totalVolume/1000).toFixed(1)}k</div>
                        </div>
                         <div className="bg-black p-2 md:p-3 hover:bg-white/5 transition-colors">
                            <div className="text-gray-500 text-[9px] md:text-[10px] uppercase font-bold mb-1">Listed</div>
                            <div className="text-white font-mono font-bold text-base md:text-lg">{collection.listedCount}</div>
                        </div>
                    </div>
                </div>

                {/* Chart Area */}
                <div className="lg:w-2/3 h-[200px] md:h-[250px] bg-black p-4 relative group overflow-hidden">
                     <div className="absolute top-4 left-4 z-10 flex gap-4 text-[10px] md:text-xs font-bold font-mono pointer-events-none">
                        <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 ${accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green'}`}></div>
                             <span className="text-white">FLOOR_PRICE</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                             <div className="w-2 h-2 bg-gray-700"></div>
                             <span>AVG_PRICE</span>
                        </div>
                     </div>
                     <PriceChart data={chartData} color={accentColor === 'text-magic-purple' ? '#9945ff' : '#adff02'} />
                </div>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto border-l border-r border-white/20">
        
        {/* Desktop Sidebar (Filters) */}
        <div className="hidden lg:block w-72 border-r border-white/20 p-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto bg-black">
            <div className="flex items-center justify-between text-white font-bold mb-6 pb-4 border-b border-white/20">
                <span className="flex items-center gap-2 uppercase tracking-wider text-sm"><Filter className={`w-4 h-4 ${accentColor}`} /> Filters</span>
                <ChevronDown className="w-4 h-4" />
            </div>
            <FilterContent />
        </div>

        {/* Center: Grid & Sweep Bar */}
        <div className="flex-1 flex flex-col min-w-0 bg-black">
            
            {/* Sticky Action Bar */}
            <div className="sticky top-16 z-30 bg-black/95 backdrop-blur border-b border-white/20 p-3">
                <div className="flex flex-col gap-3">
                    {/* Top Row: Controls */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {/* Mobile Filter Toggle */}
                            <button 
                                onClick={() => setIsMobileFilterOpen(true)}
                                className={`lg:hidden p-2 text-white border border-white/20 hover:border-current hover:${accentColor} transition-colors`}
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                            </button>

                            {/* View Toggle */}
                            <div className="flex">
                                <button 
                                    onClick={() => setViewMode('items')}
                                    className={`px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold uppercase tracking-widest border transition-colors ${viewMode === 'items' ? 'bg-white text-black border-white' : 'text-gray-400 border-white/10 hover:border-white/40 hover:text-white'}`}
                                >
                                    Items
                                </button>
                                <button 
                                    onClick={() => setViewMode('activity')}
                                    className={`px-3 md:px-4 py-2 text-[10px] md:text-xs font-bold uppercase tracking-widest border border-l-0 transition-colors ${viewMode === 'activity' ? 'bg-white text-black border-white' : 'text-gray-400 border-white/10 hover:border-white/40 hover:text-white'}`}
                                >
                                    Activity
                                </button>
                            </div>

                            <button className={`p-2 text-gray-500 hover:${accentColor} transition-colors hidden sm:block`}>
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search (Desktop) */}
                        <div className="relative hidden md:block">
                            <input 
                                type="text" 
                                placeholder="SEARCH ID" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`bg-black border border-white/20 pl-8 pr-4 py-2 text-xs text-white ${borderFocus} outline-none w-48 placeholder-gray-700 font-mono transition-all`}
                            />
                            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-600 w-3 h-3" />
                        </div>
                    </div>

                    {/* Bottom Row: Sweep & Mobile Search */}
                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Sweep Slider - Full width on mobile */}
                        <div className="flex-1 flex items-center gap-2 md:gap-3 bg-white/5 px-3 py-2 border border-white/10">
                            <span className={`text-[10px] md:text-xs font-bold ${accentColor} whitespace-nowrap uppercase tracking-wider`}>SWEEP</span>
                            <input 
                                type="range" 
                                min="0" 
                                max="10" 
                                step="1"
                                value={sweepCount}
                                onChange={(e) => setSweepCount(parseInt(e.target.value))}
                                className={`w-full h-1 bg-gray-800 rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white`}
                            />
                            <span className="text-xs md:text-sm font-mono font-bold w-6 text-center text-white">{sweepCount}</span>
                        </div>
                        
                         {/* Mobile Search Icon Toggle could go here, for now using just input if space permits or hidden */}
                         <div className="relative md:hidden w-1/3">
                            <input 
                                type="text" 
                                placeholder="ID#" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full bg-black border border-white/20 px-2 py-2 text-xs text-white ${borderFocus} outline-none placeholder-gray-700 font-mono text-center`}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="p-2 md:p-4 bg-black min-h-screen">
                {viewMode === 'items' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-4">
                        {filteredNfts?.map(nft => (
                            <NFTCard 
                                key={nft.id} 
                                nft={nft} 
                                collectionName={collection.name}
                                isSelected={selectedNfts.has(nft.id)}
                                onToggle={() => {
                                    // Logic handled by parent or context in real app
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    // Activity View
                    <div className="border border-white/20 bg-black overflow-x-auto">
                        <table className="w-full text-left min-w-[500px]">
                            <thead className="bg-white/5 text-gray-500 font-mono text-xs uppercase">
                                <tr>
                                    <th className="p-3">Item</th>
                                    <th className="p-3 text-right">Price</th>
                                    <th className="p-3 text-right">From</th>
                                    <th className="p-3 text-right">To</th>
                                    <th className="p-3 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10 font-mono text-xs md:text-sm">
                                {activityData.map(item => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-3 flex items-center gap-3">
                                            <img src={item.image} className="w-8 h-8 object-cover border border-white/20" alt="" />
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white">{item.name}</span>
                                                <span className={`text-[9px] w-fit px-1 border ${item.type === 'sale' ? `${accentColor} border-current` : 'border-blue-500 text-blue-500'} uppercase`}>
                                                    {item.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right text-white font-bold">{currency} {item.price}</td>
                                        <td className="p-3 text-right text-gray-400 truncate max-w-[80px]">{item.from}</td>
                                        <td className="p-3 text-right text-gray-500 truncate max-w-[80px]">{item.to || '-'}</td>
                                        <td className="p-3 text-right text-gray-600">{item.time}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>

        {/* Right Sidebar (Recent Activity - Desktop Only) */}
        <div className="hidden xl:block w-80 border-l border-white/20 p-0 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto bg-black">
            <div className="p-4 border-b border-white/20 bg-white/5">
                 <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <ActivityIcon className={`w-3 h-3 ${accentColor}`} /> Live Feed
                </h3>
            </div>
           
            <div className="divide-y divide-white/10">
                {activityData.filter(a => a.type === 'sale').map(item => (
                    <div key={item.id} className="p-3 flex gap-3 items-start hover:bg-white/5 transition-colors group cursor-pointer">
                        <div className="w-10 h-10 bg-gray-800 border border-white/20 flex-shrink-0">
                            <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0" alt="" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                                <span className="text-xs font-bold text-white truncate">{item.name}</span>
                                <span className={`text-sm font-mono ${accentColor}`}>{currency}{item.price}</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                <span>{item.time}</span>
                                <span className="text-gray-600">SALE</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>

      {/* Sweep Cart Floating Action Bar */}
      {sweepCount > 0 && (
          <div className={`fixed bottom-0 left-0 w-full ${accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green'} text-black border-t-2 border-white z-50 animate-slide-up shadow-[0_-5px_20px_rgba(0,0,0,0.5)]`}>
              <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-8 w-full sm:w-auto justify-between sm:justify-start">
                      <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-bold text-black/60 tracking-widest">Quantity</span>
                          <span className="text-lg md:text-xl font-black">{sweepCount} ITEMS</span>
                      </div>
                      <div className="w-px h-8 bg-black/20 hidden sm:block"></div>
                      <div className="flex flex-col text-right sm:text-left">
                          <span className="text-[9px] uppercase font-bold text-black/60 tracking-widest">Total</span>
                          <span className="text-lg md:text-xl font-black font-mono">{currency} {totalPrice}</span>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button onClick={() => setSweepCount(0)} className="flex-1 sm:flex-none px-4 py-3 font-bold uppercase hover:bg-black/10 transition-colors text-xs border border-black/10">
                          Cancel
                      </button>
                      <button className="flex-[2] sm:flex-none bg-black text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-white hover:text-black border border-black transition-colors flex items-center justify-center gap-2 text-xs md:text-sm">
                          <ShoppingCart className="w-4 h-4" />
                          <span className="truncate">Buy Now</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Collection;
