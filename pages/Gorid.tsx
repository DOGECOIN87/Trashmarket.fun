import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Tag, Activity, ShoppingCart, ExternalLink, ArrowRight, Clock, TrendingUp, User, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  getListedDomains,
  getRecentSales,
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
import {
  buildPurchaseTransaction,
  confirmPurchase,
  createListingViaAPI,
  cancelListing,
} from '../services/marketplace-service';
import { calculateFeesFromHuman, TRADING_CONFIG } from '../lib/trading-config';

const Gorid: React.FC = () => {
  const { currency, accentColor, getExplorerLink } = useNetwork();
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
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

  // Trading state
  const [isBuying, setIsBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);
  const [useNativeForBuy, setUseNativeForBuy] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [listingDomain, setListingDomain] = useState<GoridName | null>(null);
  const [listingPrice, setListingPrice] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [listedDomainsMap, setListedDomainsMap] = useState<Map<string, GoridListing>>(new Map());

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
        // Create a map for quick lookup of listed domains
        const domainsMap = new Map(listedDomains.map(d => [d.domainKey, d]));
        setListedDomainsMap(domainsMap);
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

  // Handle buy domain
  const handleBuy = useCallback(async (listing: GoridListing, useNative: boolean = false) => {
    if (!connected || !publicKey || !signTransaction) {
      setBuyError('Please connect your wallet first');
      return;
    }

    setIsBuying(true);
    setBuyError(null);
    setBuySuccess(null);

    try {
      // Build the purchase transaction
      const transaction = await buildPurchaseTransaction(publicKey, {
        id: listing.listingId || listing.domainKey,
        domainName: listing.name,
        domainMint: listing.domainMint || listing.domainKey,
        seller: listing.owner,
        price: listing.price,
        priceRaw: BigInt(0), // Will be calculated from price
        listedAt: listing.listedAt,
      }, useNative);

      // Request wallet signature
      const signedTx = await signTransaction(transaction);

      // Send and confirm transaction
      const txSignature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txSignature, 'confirmed');

      // Notify trading API of completed purchase
      await confirmPurchase(
        listing.listingId || listing.domainKey,
        publicKey.toBase58(),
        txSignature,
      );

      setBuySuccess(txSignature);
      setSelectedDomain(null);

      // Refresh data
      const [updatedListings, updatedSales] = await Promise.all([
        getListedDomains(),
        getRecentSales(),
      ]);
      setListings(updatedListings);
      setRecentSales(updatedSales);

      if (address) {
        getDomainsOwnedBy(address).then(setMyDomains).catch(console.error);
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      setBuyError(error.message || 'Transaction failed');
    } finally {
      setIsBuying(false);
    }
  }, [connected, publicKey, signTransaction, connection, address]);

  // Handle list domain for sale
  const handleListForSale = useCallback(async () => {
    if (!connected || !address || !listingDomain || !listingPrice) return;

    const price = parseFloat(listingPrice);
    if (isNaN(price) || price < TRADING_CONFIG.MIN_PRICE || price > TRADING_CONFIG.MAX_PRICE) {
      setListError(`Price must be between ${TRADING_CONFIG.MIN_PRICE} and ${TRADING_CONFIG.MAX_PRICE.toLocaleString()} GOR`);
      return;
    }

    setIsListing(true);
    setListError(null);

    try {
      const { transaction, listingId } = await createListingViaAPI(
        publicKey,
        new PublicKey(listingDomain.mint || listingDomain.domainKey),
        listingDomain.name,
        price,
      );

      // Sign and send the transaction
      const signedTx = await signTransaction(transaction);
      const txSignature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txSignature, 'confirmed');

      // Update UI after successful on-chain listing
      // No need to explicitly add to local storage anymore, as it's on-chain
      // The fetchListings will pick it up



      // Close modal and refresh
      setListingDomain(null);
      setListingPrice('');

      const [updatedListings, updatedSales] = await Promise.all([
        getListedDomains(),
        getRecentSales(),
      ]);
      setListings(updatedListings);
      setRecentSales(updatedSales);
      const domainsMap = new Map(updatedListings.map(d => [d.domainKey, d]));
      setListedDomainsMap(domainsMap);

      if (address) {
        getDomainsOwnedBy(address).then(setMyDomains).catch(console.error);
      }
    } catch (error: any) {
      console.error('Listing error:', error);
      setListError(error.message || 'Failed to create listing');
    } finally {
      setIsListing(false);
    }
  }, [connected, address, listingDomain, listingPrice]);

  // Fee preview for listing
  const feePreview = useMemo(() => {
    const price = parseFloat(listingPrice);
    if (isNaN(price) || price <= 0) return null;
    return calculateFeesFromHuman(price);
  }, [listingPrice]);

  // Handle cancel listing
  const handleCancelListing = useCallback(async (domain: GoridName) => {
    if (!connected || !address) return;

    setIsCanceling(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      const listedDomain = listedDomainsMap.get(domain.domainKey);
      if (!listedDomain) {
        throw new Error('Domain is not listed for sale');
      }

      const { transaction } = await cancelListing(
        listedDomain.listingId || listedDomain.domainKey,
        publicKey
      );
      // Sign and send the transaction
      const signedTx = await signTransaction(transaction);
      const txSignature = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txSignature, 'confirmed');

      // After successful on-chain cancellation, refresh data
      const [updatedListings, updatedSales] = await Promise.all([
        getListedDomains(),
        getRecentSales(),
      ]);
      setListings(updatedListings);
      setRecentSales(updatedSales);
      const domainsMap = new Map(updatedListings.map(d => [d.domainKey, d]));
      setListedDomainsMap(domainsMap);

      if (address) {
        getDomainsOwnedBy(address).then(setMyDomains).catch(console.error);
      }
      setCancelSuccess(domain.name + ' listing cancelled');




    } catch (error: any) {
      console.error('Cancel listing error:', error);
      setCancelError(error.message || 'Failed to cancel listing');
    } finally {
      setIsCanceling(false);
    }
  }, [connected, address, listedDomainsMap]);

  // Styling
  const btnPrimary = 'bg-magic-green text-black hover:bg-white hover:text-black';
  const borderFocus = 'focus:border-magic-green';

  return (
    <div className="min-h-screen">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30 pointer-events-none"
        src="/gorbagio-video-fence.mp4"
      />

      {/* Success Toast */}
      {buySuccess && (
        <div className="fixed top-20 right-4 z-50 bg-magic-green text-black p-4 border border-magic-green max-w-sm animate-in slide-in-from-right">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4" />
            <span className="font-bold uppercase text-sm">Purchase Successful!</span>
          </div>
          <a
            href={getExplorerLink('tx', buySuccess)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono underline"
          >
            View on TrashScan
          </a>
          <button
            onClick={() => setBuySuccess(null)}
            className="absolute top-2 right-2 text-black/60 hover:text-black"
          >
            &times;
          </button>
        </div>
      )}

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
                  {floorPrice > 0 ? `${currency} ${floorPrice}` : '—'}
                </div>
              </div>
              <div className="bg-black p-4 hover:bg-white/5 transition-colors">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Volume</div>
                <div className="text-white font-mono font-bold text-lg md:text-xl">
                  {totalVolume > 0 ? `${currency} ${totalVolume.toLocaleString()}` : '—'}
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
                name="domainLookup"
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
                      name="domainSearch"
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
                      <p className="text-gray-500 font-mono">
                        {listings.length === 0 ? 'No domains listed yet — marketplace launching soon' : 'No domains found'}
                      </p>
                    </div>
                  )}
                </div>
              ) : viewMode === 'activity' ? (
                /* Activity Table */
                <div className="border border-white/20 bg-black overflow-x-auto">
                  {recentSales.length > 0 ? (
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
                        {recentSales.map((sale) => (
                          <tr key={sale.txSignature} className="hover:bg-white/5 transition-colors">
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
                  ) : (
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-500 font-mono">No recent activity</p>
                    </div>
                  )}
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
                            {listedDomainsMap.has(domain.domainKey) ? (
                              <button
                                onClick={() => handleCancelListing(domain)}
                                disabled={isCanceling}
                                className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-2 text-xs font-bold uppercase hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {isCanceling ? 'Canceling...' : 'Cancel Listing'}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setListingDomain(domain);
                                  setListingPrice('');
                                  setListError(null);
                                }}
                                className="flex-1 bg-white/10 text-white px-3 py-2 text-xs font-bold uppercase hover:bg-white/20 transition-colors"
                              >
                                List for Sale
                              </button>
                            )}
                            <a
                              href={`https://gorid.com/${domain.name.replace('.gor', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 border border-white/20 text-gray-400 px-3 py-2 text-xs font-bold uppercase hover:border-white/40 hover:text-white transition-colors text-center"
                            >
                              Manage
                            </a>
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
                {recentSales.length > 0 ? (
                  recentSales.map((sale) => (
                    <div key={sale.txSignature} className="p-3 hover:bg-white/5 transition-colors cursor-pointer">
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
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-gray-600 text-xs font-mono">No recent sales</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Detail / Buy Modal */}
      {selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => { setSelectedDomain(null); setBuyError(null); }}
          />
          <div className="relative bg-magic-dark border border-magic-green/30 p-6 max-w-md w-full animate-in zoom-in-95">
            <button
              onClick={() => { setSelectedDomain(null); setBuyError(null); }}
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

              {/* Fee breakdown */}
              {(() => {
                const fees = calculateFeesFromHuman(selectedDomain.price);
                return (
                  <div className="py-3 border-b border-white/10">
                    <div className="text-gray-500 text-sm uppercase mb-2">Fee Breakdown</div>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Platform Fee (2.5%)</span>
                        <span className="text-gray-400">{currency} {fees.platformFee.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Creator Royalty (5%)</span>
                        <span className="text-gray-400">{currency} {fees.creatorRoyalty.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
                        <span className="text-gray-400">Total</span>
                        <span className="text-white">{currency} {fees.total.toFixed(3)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Error display */}
            {buyError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{buyError}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Native GOR Toggle */}
              <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 mb-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white uppercase">Pay with Native GOR</span>
                  <span className="text-[10px] text-gray-500 font-mono">Uses 6 decimals (Gas Token)</span>
                </div>
                <button
                  onClick={() => setUseNativeForBuy(!useNativeForBuy)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${useNativeForBuy ? 'bg-magic-green' : 'bg-white/20'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${useNativeForBuy ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <button
                onClick={() => handleBuy(selectedDomain, useNativeForBuy)}
                disabled={isBuying || !connected}
                className={`w-full ${btnPrimary} py-3 font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isBuying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
                    Confirming...
                  </>
                ) : !connected ? (
                  'Connect Wallet to Buy'
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" /> Buy Now — {useNativeForBuy ? 'GOR' : 'wGOR'} {selectedDomain.price}
                  </>
                )}
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

      {/* List for Sale Modal */}
      {listingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => { setListingDomain(null); setListError(null); }}
          />
          <div className="relative bg-magic-dark border border-magic-green/30 p-6 max-w-md w-full animate-in zoom-in-95">
            <button
              onClick={() => { setListingDomain(null); setListError(null); }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white text-2xl"
            >
              &times;
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-magic-green text-black p-2">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">{listingDomain.name}</h2>
                <p className="text-gray-500 text-sm font-mono">List for Sale</p>
              </div>
            </div>

            {/* Price Input */}
            <div className="mb-4">
              <label className="text-gray-500 text-xs uppercase font-bold mb-2 block">
                Sale Price (Wrapped GOR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="listingPrice"
                  value={listingPrice}
                  onChange={(e) => setListingPrice(e.target.value)}
                  placeholder="0.00"
                  min={TRADING_CONFIG.MIN_PRICE}
                  max={TRADING_CONFIG.MAX_PRICE}
                  step="0.001"
                  className={`w-full bg-black border border-white/20 px-4 py-3 text-white ${borderFocus} outline-none font-mono text-lg`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">
                  {currency}
                </span>
              </div>
            </div>

            {/* Fee preview */}
            {feePreview && (
              <div className="mb-4 p-3 bg-white/5 border border-white/10">
                <div className="text-gray-500 text-xs uppercase font-bold mb-2">You will receive</div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sale Price</span>
                    <span className="text-white">{currency} {feePreview.total.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform Fee (2.5%)</span>
                    <span className="text-red-400">-{currency} {feePreview.platformFee.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Creator Royalty (5%)</span>
                    <span className="text-red-400">-{currency} {feePreview.creatorRoyalty.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                    <span className="text-gray-400 font-bold">Net Proceeds</span>
                    <span className="text-magic-green font-bold">{currency} {feePreview.sellerReceives.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {listError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{listError}</span>
              </div>
            )}

            <button
              onClick={handleListForSale}
              disabled={isListing || !listingPrice || parseFloat(listingPrice) <= 0}
              className={`w-full ${btnPrimary} py-3 font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isListing ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin" />
                  Creating Listing...
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4" /> List for Sale
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gorid;
