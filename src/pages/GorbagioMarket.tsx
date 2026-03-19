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

const GorbagioMarket: React.FC = () => {
  useEffect(() => audioManager.playOnInteraction('page_gorbagio'), []);

  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  // Tab & search
  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [searchTerm, setSearchTerm] = useState('');

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
          const meta = await fetchNftMetadata(listing.nftMint);
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
    ? listings.filter((l) => l.seller === publicKey.toBase58())
    : [];

  // ─── Filtered Listings ──────────────────────────────────────────────

  const filteredListings = listings.filter(
    (l) =>
      (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.nftMint.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
      const signed = await signTransaction(tx);
      setTxStatus('confirming');

      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
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
      buildListNftTransaction(publicKey, new PublicKey(listingNft.mint), price, connection),
    );
  };

  const handleCancel = (listing: NftListingInfo) => {
    if (!publicKey) return;
    executeTx(() =>
      buildCancelListingTransaction(publicKey, new PublicKey(listing.nftMint), connection),
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
      ),
    );
  };

  // ─── Render Helpers ─────────────────────────────────────────────────

  const TxStatusBanner = () => {
    if (txStatus === 'idle') return null;
    return (
      <div className={`p-3 mb-4 border ${
        txStatus === 'success'
          ? 'border-magic-green/50 bg-magic-green/10'
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
              <span className="text-magic-green">Transaction confirmed!</span>
              <a
                href={getExplorerTxLink(txSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-magic-green underline flex items-center gap-1"
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
    const handleError = () => {
      // Try alternative IPFS gateways before falling back to placeholder
      const ipfsMatch = imgSrc.match(/\/ipfs\/(.+)$/);
      if (ipfsMatch) {
        const cid = ipfsMatch[1];
        const gateways = [
          `https://gateway.pinata.cloud/ipfs/${cid}`,
          `https://cloudflare-ipfs.com/ipfs/${cid}`,
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
    <div className="min-h-screen bg-black text-white p-4 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading">GORBAGIO NFT MARKET</h1>
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
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-900 border border-magic-green/30 text-white placeholder-gray-500 focus:outline-none focus:border-magic-green"
              />
            </div>
            <button
              onClick={() => loadListings()}
              className="p-2 border border-magic-green/30 hover:bg-magic-green/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-magic-green" />
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
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-magic-green text-magic-green'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {tab === 'my-listings' && myListings.length > 0 && (
                <span className="ml-1 text-xs bg-magic-green/20 text-magic-green px-1.5 py-0.5">
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
                  <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-magic-green" />
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
                        className="bg-gray-900 border border-magic-green/20 overflow-hidden hover:border-magic-green/60 transition-all group cursor-pointer"
                      >
                        <div className="relative overflow-hidden bg-black aspect-square">
                          <NftImage src={listing.image || '/assets/nft-placeholder.svg'} alt={listing.name || ''} />
                        </div>
                        <div className="p-2">
                          <h3 className="font-bold text-xs truncate">{listing.name}</h3>
                          <p className="text-magic-green text-sm font-bold mt-1">
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
                  {walletNfts.length} unlisted NFT{walletNfts.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {walletNfts.length > 0 ? (
                    walletNfts.map((nft) => (
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
                            className="mt-2 w-full py-1.5 text-xs font-bold bg-magic-green text-black hover:bg-magic-green/80 transition-colors"
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
                    className="bg-gray-900 border border-magic-green/20 overflow-hidden"
                  >
                    <div className="relative overflow-hidden bg-black aspect-square">
                      <NftImage src={listing.image || '/assets/nft-placeholder.svg'} alt={listing.name || ''} />
                    </div>
                    <div className="p-2">
                      <h3 className="font-bold text-xs truncate">{listing.name}</h3>
                      <p className="text-magic-green text-sm font-bold mt-1">
                        {listing.price.toFixed(2)} GOR
                      </p>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => handleUpdatePrice(listing)}
                          className="flex-1 py-1 text-[10px] font-bold border border-magic-green/30 text-magic-green hover:bg-magic-green/10 transition-colors"
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
                  className="mt-3 text-sm text-magic-green hover:underline"
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
            <div className="bg-gray-900 border border-magic-green/30 w-full max-w-md">
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
                              <span className="text-magic-green">{fees.sellerProceeds.toFixed(4)} GOR</span>
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
                    className="mt-4 w-full py-3 font-bold text-sm bg-magic-green text-black hover:bg-magic-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <div className="bg-gray-900 border border-magic-green/30 w-full max-w-md">
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
                    className="w-full px-3 py-2 text-sm bg-black border border-magic-green/30 text-white placeholder-gray-600 focus:outline-none focus:border-magic-green"
                  />
                  {listPrice && parseFloat(listPrice) > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      Marketplace fee (2.5%):{' '}
                      <span className="text-gray-300">
                        {calculateMarketplaceFees(parseFloat(listPrice)).marketplaceFee.toFixed(4)} GOR
                      </span>
                      {' '}— You receive:{' '}
                      <span className="text-magic-green">
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
                    className="mt-4 w-full py-3 font-bold text-sm bg-magic-green text-black hover:bg-magic-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <div className="bg-gray-900 border border-magic-green/30 w-full max-w-sm">
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
                  className="w-full px-3 py-2 text-sm bg-black border border-magic-green/30 text-white placeholder-gray-600 focus:outline-none focus:border-magic-green"
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
                    className="mt-4 w-full py-3 font-bold text-sm bg-magic-green text-black hover:bg-magic-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="mt-8 bg-gray-900/50 border border-magic-green/20 p-4">
          <h2 className="font-bold text-sm mb-2 font-heading">HOW IT WORKS</h2>
          <ul className="space-y-1.5 text-gray-300 text-xs">
            <li className="flex gap-3">
              <span className="text-magic-green font-bold">1.</span>
              <span>Migrate your legacy Gorbagios to Metaplex standard on Gorbagana</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-green font-bold">2.</span>
              <span>List your NFTs for sale — they are securely escrowed on-chain</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-green font-bold">3.</span>
              <span>Buyers pay in native GOR — 2.5% marketplace fee applies</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-green font-bold">4.</span>
              <span>Cancel listings anytime to get your NFT back instantly</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GorbagioMarket;
