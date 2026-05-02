import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Loader,
  AlertCircle,
  Tag,
  ShoppingCart,
  X,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  ArrowUpDown,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { audioManager } from '../lib/audioManager';
import {
  fetchAllListings,
  fetchWalletNFTs,
  fetchNftMetadata,
  buildListNftTransaction,
  buildBuyNftTransaction,
  buildCancelListingTransaction,
  buildUpdatePriceTransaction,
  calculateMarketplaceFees,
  lamportsToGor,
  formatGorPrice,
  getExplorerTxLink,
  type NftListingInfo,
  type WalletNft,
} from '../services/nftMarketplaceService';

type Tab = 'browse' | 'my-nfts' | 'my-listings';
type TxStatus = 'idle' | 'signing' | 'confirming' | 'success' | 'error';
type CollectionFilter = 'all' | 'gorbagio' | 'gorigins';

const GORBAGIO_PREVIEW = 'https://plum-far-bobcat-940.mypinata.cloud/ipfs/bafybeihkdrontwttwgcaqlpifsav2pvyzyi2m4otl2jeklp4dbdzasdcu4/42.png';
const GORIGINS_PREVIEW = 'https://gateway.pinata.cloud/ipfs/QmUskKfXWNg7m1vNjjtzHMk5c6XLRnLTkiZ1vKEVkrAyoA';

const GorbagioMarket: React.FC = () => {
  useEffect(() => audioManager.playOnInteraction('page_gorbagio'), []);

  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  // Tab & search
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');

  // Data
  const [listings, setListings] = useState<NftListingInfo[]>([]);
  const [walletNfts, setWalletNfts] = useState<WalletNft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transaction state
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Modals
  const [selectedListing, setSelectedListing] = useState<NftListingInfo | null>(null);
  const [listingNft, setListingNft] = useState<WalletNft | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [updatePriceTarget, setUpdatePriceTarget] = useState<NftListingInfo | null>(null);
  const [newPrice, setNewPrice] = useState('');

  // ─── Data Loading ───────────────────────────────────────────────────

  const loadListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allListings = await fetchAllListings(connection);

      // Enrich with metadata
      const enriched = await Promise.all(
        allListings.map(async (listing) => {
          const meta = await fetchNftMetadata(listing.nftMint, connection);
          return {
            ...listing,
            name: meta?.name || `Gorbagio #${listing.nftMint.slice(-4)}`,
            image: meta?.image || '/assets/nft-placeholder.svg',
          };
        }),
      );

      setListings(enriched);
    } catch (err) {
      console.error('Error loading listings:', err);
      setError('Failed to load marketplace listings.');
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const loadWalletNfts = useCallback(async () => {
    if (!publicKey) return;
    try {
      const nfts = await fetchWalletNFTs(publicKey.toBase58(), connection);

      // Filter out NFTs already listed
      const listedMints = new Set(listings.map((l) => l.nftMint));
      const unlisted = nfts.filter((n) => !listedMints.has(n.mint));
      setWalletNfts(unlisted);
    } catch (err) {
      console.error('Error loading wallet NFTs:', err);
    }
  }, [publicKey, connection, listings]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  useEffect(() => {
    if (connected && publicKey && (activeTab === 'my-nfts' || activeTab === 'my-listings')) {
      loadWalletNfts();
    }
  }, [connected, publicKey, activeTab, loadWalletNfts]);

  // ─── My Listings (filtered from all listings) ───────────────────────

  const myListings = publicKey
    ? listings.filter((l) => {
        if (l.seller !== publicKey.toBase58()) return false;
        const name = (l.name || '').toLowerCase();
        if (collectionFilter === 'gorbagio' && !name.includes('gorbagio')) return false;
        if (collectionFilter === 'gorigins' && !name.includes('gorigin')) return false;
        return true;
      })
    : [];

  // ─── Filtered Listings ──────────────────────────────────────────────

  const filteredListings = listings.filter((l) => {
    const name = (l.name || '').toLowerCase();
    if (collectionFilter === 'gorbagio' && !name.includes('gorbagio')) return false;
    if (collectionFilter === 'gorigins' && !name.includes('gorigin')) return false;
    return name.includes(searchTerm.toLowerCase()) || l.nftMint.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredWalletNfts = walletNfts.filter((n) => {
    const name = n.name.toLowerCase();
    if (collectionFilter === 'gorbagio' && !name.includes('gorbagio')) return false;
    if (collectionFilter === 'gorigins' && !name.includes('gorigin')) return false;
    return true;
  });

  // ─── Transaction Helpers ────────────────────────────────────────────

  const resetTxState = () => {
    setTxStatus('idle');
    setTxSignature(null);
    setTxError(null);
  };

  const executeTx = async (buildFn: () => Promise<any>) => {
    if (!signTransaction) return;
    resetTxState();
    setTxStatus('signing');

    try {
      const tx = await buildFn();

      // Refresh blockhash immediately before signing so it's fresh when sent
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;

      const signed = await signTransaction(tx);
      setTxStatus('confirming');

      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });

      const { confirmTransaction } = await import('../utils/confirmTx');
      await confirmTransaction(connection, sig);

      setTxSignature(sig);
      setTxStatus('success');

      // Reload data after 2s
      setTimeout(() => {
        loadListings();
        if (publicKey) loadWalletNfts();
      }, 2000);
    } catch (err: any) {
      console.error('Transaction failed:', err);
      setTxError(err?.message || 'Transaction failed');
      setTxStatus('error');
    }
  };

  // ─── Actions ────────────────────────────────────────────────────────

  const handleBuy = (listing: NftListingInfo) => {
    if (!publicKey || !signTransaction) return;
    setSelectedListing(listing);
    resetTxState();
  };

  const confirmBuy = () => {
    if (!selectedListing || !publicKey) return;
    executeTx(() =>
      buildBuyNftTransaction(publicKey, selectedListing, connection),
    );
  };

  const handleList = (nft: WalletNft) => {
    setListingNft(nft);
    setListPrice('');
    resetTxState();
  };

  const confirmList = () => {
    if (!listingNft || !publicKey || !listPrice) return;
    const price = parseFloat(listPrice);
    if (isNaN(price) || price <= 0) return;
    executeTx(() =>
      buildListNftTransaction(publicKey, new PublicKey(listingNft.mint), price, connection, listingNft.name),
    );
  };

  const handleCancel = (listing: NftListingInfo) => {
    if (!publicKey) return;
    executeTx(() =>
      buildCancelListingTransaction(publicKey, new PublicKey(listing.nftMint), connection, listing.programId),
    );
  };

  const handleUpdatePrice = (listing: NftListingInfo) => {
    setUpdatePriceTarget(listing);
    setNewPrice(listing.price.toString());
    resetTxState();
  };

  const confirmUpdatePrice = () => {
    if (!updatePriceTarget || !publicKey || !newPrice) return;
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;
    executeTx(() =>
      buildUpdatePriceTransaction(
        publicKey,
        new PublicKey(updatePriceTarget.nftMint),
        price,
        connection,
        updatePriceTarget.programId,
      ),
    );
  };

  // ─── Render Helpers ─────────────────────────────────────────────────

  const TxStatusBanner = () => {
    if (txStatus === 'idle') return null;
    return (
      <div className={`p-3 mb-4 border ${txStatus === 'success'
          ? 'border-magic-blue/50 bg-magic-blue/10'
          : txStatus === 'error'
            ? 'border-red-500/50 bg-red-900/20'
            : 'border-yellow-500/50 bg-yellow-900/20'
        }`}>
        <div className="flex items-center gap-2 text-sm">
          {txStatus === 'signing' && (
            <>
              <Loader className="w-4 h-4 animate-spin text-yellow-400" />
              <span className="text-yellow-400">Waiting for wallet signature...</span>
            </>
          )}
          {txStatus === 'confirming' && (
            <>
              <Loader className="w-4 h-4 animate-spin text-yellow-400" />
              <span className="text-yellow-400">Confirming transaction...</span>
            </>
          )}
          {txStatus === 'success' && txSignature && (
            <>
              <span className="text-magic-blue">Transaction confirmed!</span>
              <a
                href={getExplorerTxLink(txSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-magic-blue underline flex items-center gap-1"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
          {txStatus === 'error' && (
            <>
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400">{txError || 'Transaction failed'}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  const NftImage = ({ src, alt }: { src: string; alt: string }) => {
    const [imgSrc, setImgSrc] = useState(src);
    const triedRef = useRef(new Set<string>());
    useEffect(() => {
      setImgSrc(src);
      triedRef.current = new Set<string>();
    }, [src]);
    const handleError = () => {
      // Try alternative IPFS gateways before falling back to placeholder
      const ipfsMatch = imgSrc.match(/\/ipfs\/(.+)$/);
      if (ipfsMatch) {
        const cid = ipfsMatch[1];
        const gateways = [
          `https://gateway.pinata.cloud/ipfs/${cid}`,
          `https://ipfs.io/ipfs/${cid}`,
          `https://4everland.io/ipfs/${cid}`,
        ];
        const next = gateways.find((g) => !triedRef.current.has(g) && g !== imgSrc);
        if (next) {
          triedRef.current.add(next);
          setImgSrc(next);
          return;
        }
      }
      setImgSrc('/assets/nft-placeholder.svg');
    };
    return (
      <img
        src={imgSrc}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={handleError}
      />
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div 
      className="min-h-screen text-white p-4 overflow-x-hidden"
    >
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-bold font-heading">NFT MARKET</h1>
              <p className="text-gray-400 text-sm">Trade Gorbagio &amp; Gorigin NFTs on Gorbagana</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search NFTs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-900 border border-magic-blue/30 text-white placeholder-gray-500 focus:outline-none focus:border-magic-blue"
                />
              </div>
              <button
                onClick={() => loadListings()}
                className="p-2 border border-magic-blue/30 hover:bg-magic-blue/10 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-magic-blue" />
              </button>
            </div>
          </div>

          {/* Collection Picker */}
          <div className="grid grid-cols-3 gap-3">
            {/* All */}
            <button
              onClick={() => setCollectionFilter('all')}
              className={`relative overflow-hidden border transition-all duration-200 group ${
                collectionFilter === 'all'
                  ? 'border-magic-blue bg-magic-blue/10'
                  : 'border-white/10 bg-gray-900/50 hover:border-white/30'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3 sm:py-4">
                <div className="text-left">
                  <div className={`text-xs font-mono uppercase tracking-widest mb-0.5 ${collectionFilter === 'all' ? 'text-magic-blue' : 'text-gray-500'}`}>
                    Filter
                  </div>
                  <div className="text-base sm:text-lg font-black uppercase tracking-tight">All Collections</div>
                  <div className="text-xs text-gray-400 mt-0.5">{listings.length} listings</div>
                </div>
                <div className="flex -space-x-3 ml-2">
                  <img src={GORBAGIO_PREVIEW} alt="Gorbagio" className="w-10 h-10 sm:w-12 sm:h-12 object-cover border-2 border-black rounded-full" />
                  <img src={GORIGINS_PREVIEW} alt="Gorigins" className="w-10 h-10 sm:w-12 sm:h-12 object-cover border-2 border-black rounded-full" />
                </div>
              </div>
              {collectionFilter === 'all' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-magic-blue" />
              )}
            </button>

            {/* Gorbagio */}
            <button
              onClick={() => setCollectionFilter(collectionFilter === 'gorbagio' ? 'all' : 'gorbagio')}
              className={`relative overflow-hidden border transition-all duration-200 group ${
                collectionFilter === 'gorbagio'
                  ? 'border-magic-blue bg-magic-blue/10'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-10 group-hover:opacity-15 transition-opacity"
                style={{ backgroundImage: `url(${GORBAGIO_PREVIEW})` }}
              />
              <div className="relative flex items-center justify-between px-4 py-3 sm:py-4">
                <div className="text-left">
                  <div className={`text-xs font-mono uppercase tracking-widest mb-0.5 ${collectionFilter === 'gorbagio' ? 'text-magic-blue' : 'text-gray-500'}`}>
                    Collection
                  </div>
                  <div className="text-base sm:text-lg font-black uppercase tracking-tight">Gorbagio</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {listings.filter(l => (l.name || '').toLowerCase().includes('gorbagio')).length} listed
                  </div>
                </div>
                <img src={GORBAGIO_PREVIEW} alt="Gorbagio" className="w-12 h-12 sm:w-16 sm:h-16 object-cover border border-white/10 rounded" />
              </div>
              {collectionFilter === 'gorbagio' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-magic-blue" />
              )}
            </button>

            {/* Gorigins */}
            <button
              onClick={() => setCollectionFilter(collectionFilter === 'gorigins' ? 'all' : 'gorigins')}
              className={`relative overflow-hidden border transition-all duration-200 group ${
                collectionFilter === 'gorigins'
                  ? 'border-magic-blue bg-magic-blue/10'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-10 group-hover:opacity-15 transition-opacity"
                style={{ backgroundImage: `url(${GORIGINS_PREVIEW})` }}
              />
              <div className="relative flex items-center justify-between px-4 py-3 sm:py-4">
                <div className="text-left">
                  <div className={`text-xs font-mono uppercase tracking-widest mb-0.5 ${collectionFilter === 'gorigins' ? 'text-magic-blue' : 'text-gray-500'}`}>
                    Collection
                  </div>
                  <div className="text-base sm:text-lg font-black uppercase tracking-tight">Gorigins</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {listings.filter(l => (l.name || '').toLowerCase().includes('gorigin')).length} listed
                  </div>
                </div>
                <img src={GORIGINS_PREVIEW} alt="Gorigins" className="w-12 h-12 sm:w-16 sm:h-16 object-cover border border-white/10 rounded" />
              </div>
              {collectionFilter === 'gorigins' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-magic-blue" />
              )}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-4">
          {([
            ['browse', 'Browse', ShoppingCart],
            ['my-nfts', 'My NFTs', ImageIcon],
            ['my-listings', 'My Listings', Tag],
          ] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as Tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                  ? 'border-magic-blue text-magic-blue'
                  : 'border-transparent text-gray-400 hover:text-white'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {tab === 'my-listings' && myListings.length > 0 && (
                <span className="ml-1 text-xs bg-magic-blue/20 text-magic-blue px-1.5 py-0.5">
                  {myListings.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <TxStatusBanner />

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <>
            {loading && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-magic-blue" />
                  <p className="text-gray-400">Loading listings...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 p-4 mb-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-300">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <>
                <p className="text-gray-400 text-sm mb-3">
                  {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredListings.length > 0 ? (
                    filteredListings.map((listing) => (
                      <div
                        key={listing.listingAddress}
                        onClick={() => handleBuy(listing)}
                        className="bg-gray-900 border border-magic-blue/20 overflow-hidden hover:border-magic-blue/60 transition-all group cursor-pointer"
                      >
                        <div className="relative overflow-hidden bg-black aspect-square">
                          <NftImage src={listing.image || '/assets/nft-placeholder.svg'} alt={listing.name || ''} />
                        </div>
                        <div className="p-2">
                          <h3 className="font-bold text-xs truncate">{listing.name}</h3>
                          <p className="text-magic-blue text-sm font-bold mt-1">
                            {listing.price.toFixed(2)} GOR
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                      <p className="text-gray-400">No listings found.</p>
                      <p className="text-gray-500 text-sm mt-1">
                        {connected ? 'List your Gorbagio NFTs in the "My NFTs" tab.' : 'Connect wallet to list NFTs.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* My NFTs Tab */}
        {activeTab === 'my-nfts' && (
          <>
            {!connected ? (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">Connect your wallet to see your Gorbagio NFTs.</p>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-3">
                  {filteredWalletNfts.length} unlisted NFT{filteredWalletNfts.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredWalletNfts.length > 0 ? (
                    filteredWalletNfts.map((nft) => (
                      <div
                        key={nft.mint}
                        className="bg-gray-900 border border-white/10 overflow-hidden"
                      >
                        <div className="relative overflow-hidden bg-black aspect-square">
                          <NftImage src={nft.image} alt={nft.name} />
                        </div>
                        <div className="p-2">
                          <h3 className="font-bold text-xs truncate">{nft.name}</h3>
                          <button
                            onClick={() => handleList(nft)}
                            className="mt-2 w-full py-1.5 text-xs font-bold bg-magic-blue text-black hover:bg-magic-blue/80 transition-colors"
                          >
                            LIST FOR SALE
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                      <p className="text-gray-400">No unlisted Gorbagio NFTs found.</p>
                      <p className="text-gray-500 text-sm mt-1">
                        Migrate your legacy Gorbagios first, or check "My Listings" for already-listed ones.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* My Listings Tab */}
        {activeTab === 'my-listings' && (
          <>
            {!connected ? (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">Connect your wallet to manage your listings.</p>
              </div>
            ) : myListings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {myListings.map((listing) => (
                  <div
                    key={listing.listingAddress}
                    className="bg-gray-900 border border-magic-blue/20 overflow-hidden"
                  >
                    <div className="relative overflow-hidden bg-black aspect-square">
                      <NftImage src={listing.image || '/assets/nft-placeholder.svg'} alt={listing.name || ''} />
                    </div>
                    <div className="p-2">
                      <h3 className="font-bold text-xs truncate">{listing.name}</h3>
                      <p className="text-magic-blue text-sm font-bold mt-1">
                        {listing.price.toFixed(2)} GOR
                      </p>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => handleUpdatePrice(listing)}
                          className="flex-1 py-1 text-[10px] font-bold border border-magic-blue/30 text-magic-blue hover:bg-magic-blue/10 transition-colors"
                        >
                          UPDATE
                        </button>
                        <button
                          onClick={() => handleCancel(listing)}
                          className="flex-1 py-1 text-[10px] font-bold border border-red-500/30 text-red-400 hover:bg-red-900/20 transition-colors"
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Tag className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">You have no active listings.</p>
                <button
                  onClick={() => setActiveTab('my-nfts')}
                  className="mt-3 text-sm text-magic-blue hover:underline"
                >
                  List an NFT &rarr;
                </button>
              </div>
            )}
          </>
        )}

        {/* ─── Buy Modal ─── */}
        {selectedListing && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-gray-900 border border-magic-blue/30 w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="font-bold text-sm">BUY NFT</h2>
                <button onClick={() => { setSelectedListing(null); resetTxState(); }}>
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>
              <div className="p-4">
                <div className="flex gap-4">
                  <div className="w-32 h-32 bg-black overflow-hidden flex-shrink-0">
                    <NftImage
                      src={selectedListing.image || '/assets/nft-placeholder.svg'}
                      alt={selectedListing.name || ''}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{selectedListing.name}</h3>
                    <p className="text-gray-400 text-xs mt-1">
                      Seller: {selectedListing.seller.slice(0, 8)}...{selectedListing.seller.slice(-4)}
                    </p>
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price</span>
                        <span className="text-white font-bold">{selectedListing.price.toFixed(4)} GOR</span>
                      </div>
                      {(() => {
                        const fees = calculateMarketplaceFees(selectedListing.price);
                        return (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Fee (2.5%)</span>
                              <span className="text-gray-300">{fees.marketplaceFee.toFixed(4)} GOR</span>
                            </div>
                            <div className="flex justify-between border-t border-white/10 pt-1">
                              <span className="text-gray-400">Seller receives</span>
                              <span className="text-magic-blue">{fees.sellerProceeds.toFixed(4)} GOR</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {txStatus !== 'idle' && (
                  <div className="mt-4">
                    <TxStatusBanner />
                  </div>
                )}

                {txStatus !== 'success' && (
                  <button
                    onClick={confirmBuy}
                    disabled={txStatus === 'signing' || txStatus === 'confirming' || !connected}
                    className="mt-4 w-full py-3 font-bold text-sm bg-magic-blue text-black hover:bg-magic-blue/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {!connected
                      ? 'CONNECT WALLET'
                      : txStatus === 'signing'
                        ? 'SIGNING...'
                        : txStatus === 'confirming'
                          ? 'CONFIRMING...'
                          : `BUY FOR ${selectedListing.price.toFixed(2)} GOR`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── List Modal ─── */}
        {listingNft && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-gray-900 border border-magic-blue/30 w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="font-bold text-sm">LIST NFT FOR SALE</h2>
                <button onClick={() => { setListingNft(null); resetTxState(); }}>
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>
              <div className="p-4">
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-black overflow-hidden flex-shrink-0">
                    <NftImage src={listingNft.image} alt={listingNft.name} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm truncate">{listingNft.name}</h3>
                    <p className="text-gray-500 text-[10px] mt-1 truncate">
                      {listingNft.mint}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs text-gray-400 block mb-1">Price (GOR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm bg-black border border-magic-blue/30 text-white placeholder-gray-600 focus:outline-none focus:border-magic-blue"
                  />
                  {listPrice && parseFloat(listPrice) > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      Marketplace fee (2.5%):{' '}
                      <span className="text-gray-300">
                        {calculateMarketplaceFees(parseFloat(listPrice)).marketplaceFee.toFixed(4)} GOR
                      </span>
                      {' '}— You receive:{' '}
                      <span className="text-magic-blue">
                        {calculateMarketplaceFees(parseFloat(listPrice)).sellerProceeds.toFixed(4)} GOR
                      </span>
                    </div>
                  )}
                </div>

                {txStatus !== 'idle' && (
                  <div className="mt-4">
                    <TxStatusBanner />
                  </div>
                )}

                {txStatus !== 'success' && (
                  <button
                    onClick={confirmList}
                    disabled={
                      txStatus === 'signing' ||
                      txStatus === 'confirming' ||
                      !listPrice ||
                      parseFloat(listPrice) <= 0
                    }
                    className="mt-4 w-full py-3 font-bold text-sm bg-magic-blue text-black hover:bg-magic-blue/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {txStatus === 'signing'
                      ? 'SIGNING...'
                      : txStatus === 'confirming'
                        ? 'CONFIRMING...'
                        : 'LIST NFT'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Update Price Modal ─── */}
        {updatePriceTarget && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-gray-900 border border-magic-blue/30 w-full max-w-sm">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="font-bold text-sm">UPDATE PRICE</h2>
                <button onClick={() => { setUpdatePriceTarget(null); resetTxState(); }}>
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-400 mb-2">
                  {updatePriceTarget.name} — Current: {updatePriceTarget.price.toFixed(2)} GOR
                </p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="New price in GOR"
                  className="w-full px-3 py-2 text-sm bg-black border border-magic-blue/30 text-white placeholder-gray-600 focus:outline-none focus:border-magic-blue"
                />

                {txStatus !== 'idle' && (
                  <div className="mt-4">
                    <TxStatusBanner />
                  </div>
                )}

                {txStatus !== 'success' && (
                  <button
                    onClick={confirmUpdatePrice}
                    disabled={
                      txStatus === 'signing' ||
                      txStatus === 'confirming' ||
                      !newPrice ||
                      parseFloat(newPrice) <= 0
                    }
                    className="mt-4 w-full py-3 font-bold text-sm bg-magic-blue text-black hover:bg-magic-blue/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {txStatus === 'signing'
                      ? 'SIGNING...'
                      : txStatus === 'confirming'
                        ? 'CONFIRMING...'
                        : 'UPDATE PRICE'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 bg-gray-900/50 border border-magic-blue/20 p-4">
          <h2 className="font-bold text-sm mb-2 font-heading">HOW IT WORKS</h2>
          <ul className="space-y-1.5 text-gray-300 text-xs">
            <li className="flex gap-3">
              <span className="text-magic-blue font-bold">1.</span>
              <span>Migrate your legacy Gorbagios to Metaplex standard on Gorbagana</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-blue font-bold">2.</span>
              <span>List your NFTs for sale — they are securely escrowed on-chain</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-blue font-bold">3.</span>
              <span>Buyers pay in native GOR — 2.5% marketplace fee applies</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-blue font-bold">4.</span>
              <span>Cancel listings anytime to get your NFT back instantly</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GorbagioMarket;
