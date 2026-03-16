import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Loader, AlertCircle } from 'lucide-react';
import { audioManager } from '../lib/audioManager';

interface Gorbagio {
  id: string;
  name: string;
  image: string;
  owner: string;
  mint: string;
}

const GorbagioMarket: React.FC = () => {
  useEffect(() => audioManager.playOnInteraction('page_gorbagio'), []);
  const [nfts, setNfts] = useState<Gorbagio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const GORBAGIO_COLLECTION_MINT = 'B3qkk8psvGWhxuY9aZiVRVDhjoLjVi93Ki3he1xufQ8W';
  const HELIUS_API_KEY = '230af268-7c68-41dc-8569-75c11b883b9d';

  useEffect(() => {
    const fetchGorbagios = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Gorbagio NFTs from Helius DAS API
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'searchAssets',
            params: {
              grouping: ['collection', GORBAGIO_COLLECTION_MINT],
              page: 1,
              limit: 100,
            },
          }),
        });

        const data = await response.json();

        if (data.result && data.result.items) {
          const gorbagios = data.result.items.map((item: any) => ({
            id: item.id,
            name: item.content?.metadata?.name || `Gorbagio #${item.id.slice(-4)}`,
            image: item.content?.links?.image || 'https://via.placeholder.com/300?text=Gorbagio',
            owner: item.ownership?.owner || 'Unknown',
            mint: item.id,
          }));
          setNfts(gorbagios);
        } else {
          setError('Failed to fetch Gorbagio NFTs. Please try again later.');
        }
      } catch (err) {
        console.error('Error fetching Gorbagios:', err);
        setError('Error connecting to Solana. Please ensure you have a valid Helius API key.');
      } finally {
        setLoading(false);
      }
    };

    fetchGorbagios();
  }, []);

  const filteredNFTs = nfts.filter(nft =>
    nft.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTensorUrl = (mint: string) => {
    return `https://www.tensor.trade/item/${mint}`;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 overflow-x-hidden">
      {/* Header + Search */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-full">
        <div>
          <h1 className="text-2xl font-bold font-heading">GORBAGIO MARKET</h1>
          <p className="text-gray-400 text-sm">Trade Gorbagio NFTs on Solana via Tensor</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search Gorbagios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-900 border border-magic-green/30 rounded text-white placeholder-gray-500 focus:outline-none focus:border-magic-green"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-magic-green" />
            <p className="text-gray-400">Fetching Gorbagio NFTs...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded p-4 mb-8 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* NFT Grid */}
      {!loading && !error && (
        <div>
          <p className="text-gray-400 text-sm mb-3">
            {filteredNFTs.length} Gorbagio{filteredNFTs.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-w-full">
            {filteredNFTs.length > 0 ? (
              filteredNFTs.map((nft) => (
                <a
                  key={nft.id}
                  href={getTensorUrl(nft.mint)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-900 border border-magic-green/20 rounded-lg overflow-hidden hover:border-magic-green/60 transition-all group cursor-pointer"
                >
                  {/* Image */}
                  <div className="relative overflow-hidden bg-black aspect-square">
                    <img
                      src={nft.image}
                      alt={nft.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          '/assets/nft-placeholder.svg';
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <h3 className="font-bold text-xs truncate">{nft.name}</h3>
                    <p className="text-[10px] text-gray-500 truncate">
                      {nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}
                    </p>
                  </div>
                </a>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400">No Gorbagios found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 bg-gray-900/50 border border-magic-green/20 rounded-lg p-4">
        <h2 className="font-bold text-sm mb-2 font-heading">HOW IT WORKS</h2>
        <ul className="space-y-1.5 text-gray-300 text-xs">
          <li className="flex gap-3">
            <span className="text-magic-green font-bold">1.</span>
            <span>Browse all Gorbagio NFTs listed on Solana</span>
          </li>
          <li className="flex gap-3">
            <span className="text-magic-green font-bold">2.</span>
            <span>Click "Buy on Tensor" to view the NFT on Tensor's marketplace</span>
          </li>
          <li className="flex gap-3">
            <span className="text-magic-green font-bold">3.</span>
            <span>Complete your purchase directly on Tensor with full liquidity</span>
          </li>
          <li className="flex gap-3">
            <span className="text-magic-green font-bold">4.</span>
            <span>Your Gorbagio will be transferred to your wallet</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default GorbagioMarket;
