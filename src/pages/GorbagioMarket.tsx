import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Loader, AlertCircle } from 'lucide-react';

interface Gorbagio {
  id: string;
  name: string;
  image: string;
  owner: string;
  mint: string;
}

const GorbagioMarket: React.FC = () => {
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
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 font-heading">GORBAGIO MARKET</h1>
        <p className="text-gray-400">Trade Gorbagio NFTs on Solana via Tensor</p>
      </div>

      {/* Search Bar */}
      <div className="mb-8 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search Gorbagios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-magic-green/30 rounded text-white placeholder-gray-500 focus:outline-none focus:border-magic-green"
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
          <p className="text-gray-400 mb-6">
            Found {filteredNFTs.length} Gorbagio{filteredNFTs.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredNFTs.length > 0 ? (
              filteredNFTs.map((nft) => (
                <div
                  key={nft.id}
                  className="bg-gray-900 border border-magic-green/20 rounded-lg overflow-hidden hover:border-magic-green/60 transition-all group"
                >
                  {/* Image */}
                  <div className="relative overflow-hidden bg-black h-64">
                    <img
                      src={nft.image}
                      alt={nft.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://via.placeholder.com/300?text=Gorbagio';
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2 truncate">{nft.name}</h3>
                    <p className="text-xs text-gray-500 mb-4 truncate">
                      {nft.owner.slice(0, 8)}...{nft.owner.slice(-4)}
                    </p>

                    {/* Buy on Tensor Button */}
                    <a
                      href={getTensorUrl(nft.mint)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-magic-green text-black font-bold py-2 rounded flex items-center justify-center gap-2 hover:bg-magic-green/80 transition-colors"
                    >
                      <span>Buy on Tensor</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
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
      <div className="mt-12 bg-gray-900/50 border border-magic-green/20 rounded-lg p-6">
        <h2 className="font-bold text-lg mb-4 font-heading">HOW IT WORKS</h2>
        <ul className="space-y-3 text-gray-300 text-sm">
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
