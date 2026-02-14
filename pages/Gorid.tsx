import React, { useState, useEffect, useMemo } from 'react';
import { Search, Tag, Activity, ShoppingCart, ExternalLink, ArrowRight, Clock, TrendingUp, User, Zap } from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  getListedDomains,
  getRecentSales,
  searchDomains,
  getDomainsOwnedBy,
  resolveGoridName,
  formatTimeAgo,
  getFloorPrice,
  getTotalVolume,
  GoridListing,
  GoridSale,
  GoridName,
  GORID_CONFIG,
} from '../services/goridService';

const Gorid: React.FC = () => {
  const { currency, accentColor, getExplorerLink } = useNetwork();
  const { connected, publicKey } = useWallet();
  const address = publicKey?.toBase58() || null;

  // State
  const [listings, setListings] = useState<GoridListing[]>([]);
  const [recentSales, setRecentSales] = useState<GoridSale[]>([]);
  const [myDomains, setMyDomains] = useState<GoridName[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'marketplace' | 'activity' | 'my-domains'>('marketplace');
  const [selectedDomain, setSelectedDomain] = useState<GoridListing | null>(null);
  const [lookupAddress, setLookupAddress] = useState('');
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Stats
  const [floorPrice, setFloorPrice] = useState<number>(0);
  const [totalVolume, setTotalVolume] = useState<number>(0);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [listedDomains, sales, floor, volume] = await Promise.all([
          getListedDomains(),
          getRecentSales(),
          getFloorPrice(),
          getTotalVolume(),
        ]);
        setListings(listedDomains);
        setRecentSales(sales);
        setFloorPrice(floor);
        setTotalVolume(volume);
      } catch (error) {
        console.error('Error loading gorid data:', error);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Load user's domains when connected
  useEffect(() => {
    if (connected && address) {
      getDomainsOwnedBy(address).then(setMyDomains).catch(console.error);
    } else {
      setMyDomains([]);
    }
  }, [connected, address]);

  // Filtered listings
  const filteredListings = useMemo(() => {
    if (!searchTerm) return listings;
    return listings.filter(l =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase().replace(/\.gor$/i, ''))
    );
  }, [listings, searchTerm]);

  // Handle domain lookup
  const handleLookup = async () => {
    if (!lookupAddress) return;
    setIsLookingUp(true);
    setLookupResult(null);
    try {
      const result = await resolveGoridName(lookupAddress);
      setLookupResult(result || 'Not found');
    } catch {
      setLookupResult('Error looking up domain');
    }
    setIsLookingUp(false);
  };

  // Styling
  const btnPrimary = 'bg-magic-green text-black hover:bg-white hover:text-black';
  const borderFocus = 'focus:border-magic-green';

  return (
    <div className="min-h-screen bg-black">
      {/* Under Construction Banner */}
      <div className="bg-yellow-500/20 border-b border-yellow-500/50">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-3">
            <Tag className="w-5 h-5 text-yellow-500" />
            <p className="text-yellow-500 text-sm font-bold uppercase tracking-wider">
              ⚠️ UNDER CONSTRUCTION — GorID marketplace integration in progress
            </p>
            <Tag className="w-5 h-5 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="border-b border-white/20 bg-gradient-to-b from-magic-green/5 to-transparent">
        <div className="max-w-[1600px] mx-auto px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-magic-green text-black p-2">
                  <Tag className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
                  GorID<span className="text-magic-green">.gor</span>
                </h1>
              </div>
              <p className="text-gray-400 text-sm md:text-base font-mono max-w-xl">
                Trade and manage your Gorbagana identity. Own your .gor domain and turn your wallet into a memorable name.
              </p>
              <a
                href="https://gorid.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-magic-green text-sm font-bold mt-3 hover:text-white transition-colors"
              >
                Register at GorID.com <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-px bg-white/20 border border-white/20 w-full md:w-auto">
              <div className="bg-black p-4 hover:bg-white/5 transition-colors">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Floor</div>
                <div className="text-magic-green font-mono font-bold text-lg md:text-xl">
                  {currency} {floorPrice}
                </div>
              </div>
              <div className="bg-black p-4 hover:bg-white/5 transition-colors">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Volume</div>
                <div className="text-white font-mono font-bold text-lg md:text-xl">
                  {currency} {totalVolume.toLocaleString()}
                </div>
              </div>
              <div className="bg-black p-4 hover:bg-white/5 transition-colors">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Listed</div>
                <div className="text-white font-mono font-bold text-lg md:text-xl">
                  {listings.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Lookup Tool */}
      <div className="border-b border-white/20 bg-white/5">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={lookupAddress}
                onChange={(e) => setLookupAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="Enter domain name to resolve (e.g. trash.gor)"
                className={`w-full bg-black border border-white/20 px-4 py-3 text-sm text-white ${borderFocus} outline-none placeholder-gray-600 font-mono`}
              />
            </div>
            <button
              onClick={handleLookup}
              disabled={isLookingUp || !lookupAddress}
              className={`${btnPrimary} px-6 py-3 font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {isLookingUp ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" /> Resolve
                </>
              )}
            </button>
          </div>
          {lookupResult && (
            <div className="mt-3 p-3 bg-black border border-white/20 font-mono text-sm">
              <span className="text-gray-500">Result: </span>
              <span className={lookupResult === 'Not found' || lookupResult === 'Error looking up domain' ? 'text-red-400' : 'text-magic-green'}>
                {lookupResult}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row border-l border-r border-white/20">
          {/* Main Area */}
          <div className="flex-1 min-w-0">
            {/* Tab Bar */}
            <div className="sticky top-16 z-30 bg-black/95 backdrop-blur border-b border-white/20 p-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* View Toggle */}
                <div className="flex">
                  <button
                    onClick={() => setViewMode('marketplace')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-colors ${viewMode === 'marketplace'
                      ? 'bg-white text-black border-white'
                      : 'text-gray-400 border-white/10 hover:border-white/40 hover:text-white'
                      }`}
                  >
                    <ShoppingCart className="w-3 h-3 inline mr-2" />
                    Marketplace
                  </button>
                  <button
                    onClick={() => setViewMode('activity')}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border border-l-0 transition-colors ${viewMode === 'activity'
                      ? 'bg-white text-black border-white'
                      : 'text-gray-400 border-white/10 hover:border-white/40 hover:text-white'
                      }`}
                  >
                    <Activity className="w-3 h-3 inline mr-2" />
                    Activity
                  </button>
                  {connected && (
                    <button
                      onClick={() => setViewMode('my-domains')}
                      className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border border-l-0 transition-colors ${viewMode === 'my-domains'
                        ? 'bg-white text-black border-white'
                        : 'text-gray-400 border-white/10 hover:border-white/40 hover:text-white'
                        }`}
                    >
                      <User className="w-3 h-3 inline mr-2" />
                      My Domains
                    </button>
                  )}
                </div>

                {/* Search */}
                {viewMode === 'marketplace' && (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="SEARCH DOMAINS..."
                      className={`bg-black border border-white/20 pl-8 pr-4 py-2 text-xs text-white ${borderFocus} outline-none w-full sm:w-48 placeholder-gray-700 font-mono`}
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 w-3 h-3" />
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-magic-green border-t-transparent animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-mono text-sm uppercase">Loading domains...</p>
                  </div>
                </div>
              ) : viewMode === 'marketplace' ? (
                /* Marketplace Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredListings.map((listing) => (
                    <div
                      key={listing.domainKey}
                      onClick={() => setSelectedDomain(listing)}
                      className="bg-magic-card border border-white/10 hover:border-magic-green/50 transition-all cursor-pointer group"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="bg-magic-green/10 text-magic-green px-2 py-1 text-[10px] font-bold uppercase">
                            {GORID_CONFIG.tld}
                          </div>
                          <Zap className="w-4 h-4 text-gray-600 group-hover:text-magic-green transition-colors" />
                        </div>
                        <h3 className="text-xl font-black text-white mb-2 group-hover:text-magic-green transition-colors">
                          {listing.name}
                        </h3>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold">Price</div>
                            <div className="text-magic-green font-mono font-bold">
                              {currency} {listing.price}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-gray-500 uppercase font-bold">Owner</div>
                            <div className="text-gray-400 font-mono text-sm">{listing.owner}</div>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-white/10 p-3 bg-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-mono">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatTimeAgo(listing.listedAt)}
                        </span>
                        <button className="text-magic-green text-xs font-bold uppercase hover:text-white transition-colors flex items-center gap-1">
                          Buy <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredListings.length === 0 && (
                    <div className="col-span-full text-center py-12">
                      <Tag className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-500 font-mono">No domains found</p>
                    </div>
                  )}
                </div>
              ) : viewMode === 'activity' ? (
                /* Activity Table */
                <div className="border border-white/20 bg-black overflow-x-auto">
                  <table className="w-full text-left min-w-[500px]">
                    <thead className="bg-white/5 text-gray-500 font-mono text-xs uppercase">
                      <tr>
                        <th className="p-3">Domain</th>
                        <th className="p-3 text-right">Price</th>
                        <th className="p-3 text-right">From</th>
                        <th className="p-3 text-right">To</th>
                        <th className="p-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 font-mono text-sm">
                      {recentSales.map((sale, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-magic-green/10 border border-magic-green/30 flex items-center justify-center">
                                <Tag className="w-4 h-4 text-magic-green" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-white">{sale.name}</span>
                                <span className="text-[9px] w-fit px-1 border border-magic-green text-magic-green uppercase">
                                  sale
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right text-magic-green font-bold">
                            {currency} {sale.price}
                          </td>
                          <td className="p-3 text-right text-gray-400">{sale.from}</td>
                          <td className="p-3 text-right text-gray-500">{sale.to}</td>
                          <td className="p-3 text-right text-gray-600">{formatTimeAgo(sale.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* My Domains */
                <div>
                  {!connected ? (
                    <div className="text-center py-12">
                      <User className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-500 font-mono mb-4">Connect wallet to view your domains</p>
                    </div>
                  ) : myDomains.length === 0 ? (
                    <div className="text-center py-12">
                      <Tag className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-500 font-mono mb-4">You don't own any .gor domains yet</p>
                      <a
                        href="https://gorid.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 ${btnPrimary} px-6 py-3 font-bold uppercase tracking-wider text-sm`}
                      >
                        Register at GorID.com <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {myDomains.map((domain) => (
                        <div
                          key={domain.domainKey}
                          className="bg-magic-card border border-magic-green/30 p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="bg-magic-green/10 text-magic-green px-2 py-1 text-[10px] font-bold uppercase">
                              owned
                            </div>
                            <Zap className="w-4 h-4 text-magic-green" />
                          </div>
                          <h3 className="text-xl font-black text-white mb-4">{domain.name}</h3>
                          <div className="flex gap-2">
                            <button className="flex-1 bg-white/10 text-white px-3 py-2 text-xs font-bold uppercase hover:bg-white/20 transition-colors">
                              List for Sale
                            </button>
                            <button className="flex-1 border border-white/20 text-gray-400 px-3 py-2 text-xs font-bold uppercase hover:border-white/40 hover:text-white transition-colors">
                              Transfer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Recent Activity */}
          <div className="hidden xl:block w-80 border-l border-white/20 bg-black">
            <div className="sticky top-16">
              <div className="p-4 border-b border-white/20 bg-white/5">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-magic-green" /> Recent Sales
                </h3>
              </div>
              <div className="divide-y divide-white/10 max-h-[calc(100vh-8rem)] overflow-y-auto">
                {recentSales.map((sale, idx) => (
                  <div key={idx} className="p-3 hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-magic-green/10 border border-magic-green/30 flex items-center justify-center flex-shrink-0">
                        <Tag className="w-4 h-4 text-magic-green" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-sm font-bold text-white truncate">{sale.name}</span>
                          <span className="text-magic-green font-mono text-sm">
                            {currency}{sale.price}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                          <span>{formatTimeAgo(sale.timestamp)}</span>
                          <span className="text-gray-600">SALE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Detail Modal */}
      {selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedDomain(null)}
          />
          <div className="relative bg-magic-dark border border-magic-green/30 p-6 max-w-md w-full animate-in zoom-in-95">
            <button
              onClick={() => setSelectedDomain(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl"
            >
              &times;
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-magic-green text-black p-2">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">{selectedDomain.name}</h2>
                <p className="text-gray-500 text-sm font-mono">Gorbagana Name Service</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-500 text-sm uppercase">Price</span>
                <span className="text-magic-green font-mono font-bold text-xl">
                  {currency} {selectedDomain.price}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-500 text-sm uppercase">Owner</span>
                <span className="text-white font-mono text-sm">{selectedDomain.owner}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-gray-500 text-sm uppercase">Listed</span>
                <span className="text-gray-400 font-mono text-sm">{formatTimeAgo(selectedDomain.listedAt)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                className={`w-full ${btnPrimary} py-3 font-bold uppercase tracking-widest flex items-center justify-center gap-2`}
              >
                <ShoppingCart className="w-4 h-4" /> Buy Now
              </button>
              <button className="w-full border border-white/20 text-gray-400 py-3 font-bold uppercase tracking-widest hover:border-white/40 hover:text-white transition-colors">
                Make Offer
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <a
                href={`https://gorid.com/${selectedDomain.name.replace('.gor', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-magic-green text-xs font-bold hover:text-white transition-colors inline-flex items-center gap-1"
              >
                View on GorID.com <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gorid;
