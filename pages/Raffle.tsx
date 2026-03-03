import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { RaffleService, Raffle as RaffleType, formatGGOR, formatFeeBps } from '../services/raffleService';
import { PublicKey } from '@solana/web3.js';
import { TicketIcon } from '../components/TicketIcon';
import { Loader2, AlertCircle, CheckCircle2, X, Search, ChevronLeft, ExternalLink, Copy, Clock, Users, ArrowLeft } from 'lucide-react';
import { BN } from '@coral-xyz/anchor';
import { RPC_ENDPOINTS, EXPLORER_URLS } from '../lib/rpcConfig';

interface UserNFT {
  id: string;
  mint: string;
  name: string;
  image: string;
  collection?: string;
}

const Raffle: React.FC = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [raffles, setRaffles] = useState<RaffleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      loadRaffles();
    }
  }, [wallet.connected, wallet.publicKey]);

  const loadRaffles = async () => {
    if (!wallet.publicKey) return;
    
    try {
      setLoading(true);
      const service = new RaffleService(connection, wallet);
      const allRaffles = await service.fetchAllRaffles();
      
      // Sort by end time (newest first)
      const sorted = allRaffles.sort((a, b) => b.endTime - a.endTime);
      setRaffles(sorted);
    } catch (error) {
      console.error('Error loading raffles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-magic-green';
      case 'drawing': return 'text-yellow-400';
      case 'completed': return 'text-blue-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getTimeRemaining = (endTime: number) => {
    const now = Date.now();
    const diff = endTime - now;
    
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  if (!wallet.connected) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <TicketIcon size={120} className="opacity-20" />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-magic-green">NFT RAFFLES</h1>
          <p className="text-gray-400 mb-8">
            Win NFTs by purchasing Tickets
          </p>
          <div className="flex justify-center">
            <WalletMultiButton className="!bg-magic-green !text-black hover:!bg-magic-green/80" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30 pointer-events-none"
        src="/gorbagio-video-robotaxi.mp4"
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <TicketIcon size={48} />
          <div>
            <h1 className="text-4xl font-bold text-magic-green mb-2">NFT RAFFLES</h1>
            <p className="text-gray-400">Win NFTs by purchasing Tickets</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-magic-green text-black font-bold hover:bg-magic-green/80 transition-colors whitespace-nowrap"
        >
          CREATE RAFFLE
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-black/50 border border-magic-green/20 p-4">
          <div className="text-gray-400 text-sm mb-1">TOTAL RAFFLES</div>
          <div className="text-2xl font-bold text-magic-green">{raffles.length}</div>
        </div>
        <div className="bg-black/50 border border-magic-green/20 p-4">
          <div className="text-gray-400 text-sm mb-1">ACTIVE</div>
          <div className="text-2xl font-bold text-magic-green">
            {raffles.filter(r => r.status === 'active').length}
          </div>
        </div>
        <div className="bg-black/50 border border-magic-green/20 p-4">
          <div className="text-gray-400 text-sm mb-1">COMPLETED</div>
          <div className="text-2xl font-bold text-blue-400">
            {raffles.filter(r => r.status === 'completed').length}
          </div>
        </div>
        <div className="bg-black/50 border border-magic-green/20 p-4">
          <div className="text-gray-400 text-sm mb-1">YOUR RAFFLES</div>
          <div className="text-2xl font-bold text-magic-green">
            {raffles.filter(r => r.creator === wallet.publicKey?.toString()).length}
          </div>
        </div>
      </div>

      {/* Raffle List */}
      {loading ? (
        <div className="text-center py-16">
          <div className="text-magic-green text-xl">Loading raffles...</div>
        </div>
      ) : raffles.length === 0 ? (
        <div className="text-center py-16">
          <div className="flex justify-center mb-6">
            <TicketIcon size={80} className="opacity-30" />
          </div>
          <div className="text-gray-400 text-xl mb-4">No raffles yet</div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-magic-green text-black font-bold hover:bg-magic-green/80 transition-colors"
          >
            CREATE FIRST RAFFLE
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {raffles.map((raffle) => (
            <RaffleCard key={raffle.publicKey} raffle={raffle} onUpdate={loadRaffles} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateRaffleModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadRaffles();
          }}
        />
      )}
    </div>
  );
};

// Raffle Card Component
const RaffleCard: React.FC<{ raffle: RaffleType; onUpdate: () => void }> = ({ raffle, onUpdate }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [showDetail, setShowDetail] = useState(false);
  const [nftMetadata, setNftMetadata] = useState<any>(null);

  useEffect(() => {
    loadNFTMetadata();
  }, [raffle.nftMint]);

  const loadNFTMetadata = async () => {
    try {
      // Derive Metaplex metadata PDA
      const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), new PublicKey(raffle.nftMint).toBuffer()],
        METADATA_PROGRAM_ID
      );

      const response = await fetch(RPC_ENDPOINTS.GORBAGANA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getAccountInfo',
          params: [pda.toString(), { encoding: 'base64', commitment: 'confirmed' }],
        }),
      });
      const data = await response.json();
      const accountData = data.result?.value?.data?.[0];
      if (!accountData) return;

      const buf = Buffer.from(accountData, 'base64');
      // Parse name + uri from Metaplex metadata
      let offset = 1 + 32 + 32;
      const nameLen = buf.readUInt32LE(offset); offset += 4;
      const name = buf.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '').trim();
      offset += nameLen;
      const symbolLen = buf.readUInt32LE(offset); offset += 4 + symbolLen;
      const uriLen = buf.readUInt32LE(offset); offset += 4;
      const uri = buf.slice(offset, offset + uriLen).toString('utf8').replace(/\0/g, '').trim();

      let image = '';
      if (uri && uri.startsWith('http')) {
        try {
          const jsonRes = await fetch(uri);
          if (jsonRes.ok) {
            const jsonMeta = await jsonRes.json();
            image = jsonMeta.image || jsonMeta.icon || '';
          }
        } catch { /* skip */ }
      }

      setNftMetadata({ content: { metadata: { name }, links: { image } } });
    } catch (error) {
      console.error('Error loading NFT metadata:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-magic-green';
      case 'drawing': return 'text-yellow-400';
      case 'completed': return 'text-blue-400';
      case 'cancelled': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getTimeRemaining = (endTime: number) => {
    const now = Date.now();
    const diff = endTime - now;
    
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const progress = (raffle.ticketsSold / raffle.totalTickets) * 100;

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="bg-black/50 border border-magic-green/20 hover:border-magic-green/40 transition-colors cursor-pointer group"
      >
        {/* NFT Image */}
        <div className="aspect-square bg-black/30 relative overflow-hidden">
          {nftMetadata?.content?.links?.image ? (
            <img
              src={nftMetadata.content.links.image}
              alt={nftMetadata.content?.metadata?.name || 'NFT'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              Loading...
            </div>
          )}
          <div className={`absolute top-2 right-2 px-2 py-1 bg-black/80 text-xs font-bold ${getStatusColor(raffle.status)}`}>
            {raffle.status.toUpperCase()}
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="text-lg font-bold text-magic-green mb-2 truncate">
            {nftMetadata?.content?.metadata?.name || `Raffle #${raffle.raffleId}`}
          </h3>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Ticket Price:</span>
              <span className="text-magic-green font-bold">{raffle.ticketPrice.toFixed(2)} GGOR</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tickets:</span>
              <div className="flex items-center gap-1">
                <TicketIcon size={16} />
                <span className="text-white">{raffle.ticketsSold} / {raffle.totalTickets}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Ends:</span>
              <span className="text-white">{getTimeRemaining(raffle.endTime)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-black/50 h-2 mb-4">
            <div
              className="bg-magic-green h-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Action indicator */}
          <div className="w-full px-4 py-2 border border-magic-green/30 text-magic-green font-bold text-center text-sm group-hover:bg-magic-green group-hover:text-black transition-colors flex items-center justify-center gap-2">
            <TicketIcon size={16} />
            VIEW RAFFLE
          </div>
        </div>
      </div>

      {/* Detail View */}
      {showDetail && (
        <RaffleDetailView
          raffle={raffle}
          nftMetadata={nftMetadata}
          onClose={() => setShowDetail(false)}
          onUpdate={() => {
            onUpdate();
          }}
        />
      )}
    </>
  );
};

// Create Raffle Modal
const CreateRaffleModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select-nft' | 'configure'>('select-nft');
  const [userNfts, setUserNfts] = useState<UserNFT[]>([]);
  const [nftsLoading, setNftsLoading] = useState(true);
  const [nftSearch, setNftSearch] = useState('');
  const [selectedNft, setSelectedNft] = useState<UserNFT | null>(null);
  const [formData, setFormData] = useState({
    ticketPrice: '',
    totalTickets: '',
    durationHours: '24'
  });

  // Derive Metaplex metadata PDA for a given mint
  const getMetadataPDA = (mint: string): string => {
    const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        METADATA_PROGRAM_ID.toBuffer(),
        new PublicKey(mint).toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );
    return pda.toString();
  };

  // Parse on-chain Metaplex metadata account data
  const parseMetaplexMetadata = (data: Buffer): { name: string; uri: string } => {
    // Metaplex metadata layout: key(1) + updateAuth(32) + mint(32) + name(4+32) + symbol(4+10) + uri(4+200)
    let offset = 1 + 32 + 32;
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '').trim();
    offset += nameLen;
    const symbolLen = data.readUInt32LE(offset);
    offset += 4 + symbolLen;
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString('utf8').replace(/\0/g, '').trim();
    return { name, uri };
  };

  const fetchUserNFTs = useCallback(async () => {
    if (!wallet.publicKey) return;

    try {
      setNftsLoading(true);

      // Fetch all token accounts owned by the wallet via Gorbagana RPC
      const response = await fetch(RPC_ENDPOINTS.GORBAGANA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            wallet.publicKey.toString(),
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed', commitment: 'confirmed' },
          ],
        }),
      });

      const data = await response.json();

      if (data.result?.value) {
        // Filter for NFTs: amount === "1" and decimals === 0
        const nftMints = data.result.value
          .filter((account: any) => {
            const info = account.account.data.parsed.info;
            return info.tokenAmount.amount === '1' && info.tokenAmount.decimals === 0;
          })
          .map((account: any) => account.account.data.parsed.info.mint);

        // Batch fetch metadata PDAs from chain
        const metadataPDAs = nftMints.map((mint: string) => getMetadataPDA(mint));
        const metaResponse = await fetch(RPC_ENDPOINTS.GORBAGANA, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'getMultipleAccounts',
            params: [metadataPDAs, { encoding: 'base64', commitment: 'confirmed' }],
          }),
        });
        const metaData = await metaResponse.json();
        const metaAccounts = metaData.result?.value || [];

        const nfts: UserNFT[] = [];
        for (let i = 0; i < nftMints.length; i++) {
          const mint = nftMints[i];
          const account = metaAccounts[i];
          let name = `NFT ${mint.slice(0, 6)}...`;
          let image = '';

          if (account?.data?.[0]) {
            try {
              const buf = Buffer.from(account.data[0], 'base64');
              const parsed = parseMetaplexMetadata(buf);
              name = parsed.name || name;

              // Fetch off-chain JSON metadata for the image
              if (parsed.uri && parsed.uri.startsWith('http')) {
                try {
                  const jsonRes = await fetch(parsed.uri);
                  if (jsonRes.ok) {
                    const jsonMeta = await jsonRes.json();
                    image = jsonMeta.image || jsonMeta.icon || '';
                  }
                } catch { /* skip image fetch failures */ }
              }
            } catch { /* skip parse failures */ }
          }

          nfts.push({ id: mint, mint, name, image });
        }

        setUserNfts(nfts);
      }
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
    } finally {
      setNftsLoading(false);
    }
  }, [wallet.publicKey]);

  useEffect(() => {
    fetchUserNFTs();
  }, [fetchUserNFTs]);

  const filteredNfts = userNfts.filter(nft =>
    nft.name.toLowerCase().includes(nftSearch.toLowerCase())
  );

  const handleSelectNft = (nft: UserNFT) => {
    setSelectedNft(nft);
    setStep('configure');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey || !selectedNft) return;

    try {
      setLoading(true);
      const service = new RaffleService(connection, wallet);
      await service.createRaffle(
        new PublicKey(selectedNft.mint),
        parseFloat(formData.ticketPrice),
        parseInt(formData.totalTickets),
        parseInt(formData.durationHours)
      );
      onSuccess();
    } catch (error: any) {
      const msg = error?.message || error?.toString() || 'Unknown error';
      const logs = error?.logs?.join('\n') || '';
      console.error('Error creating raffle:', error);
      console.error('Error message:', msg);
      if (logs) console.error('Program logs:', logs);
      alert(`Failed to create raffle:\n${msg}${logs ? '\n\nLogs:\n' + logs : ''}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-magic-dark border border-magic-green/30 max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40 shrink-0">
          <div className="flex items-center gap-2">
            {step === 'configure' && (
              <button
                onClick={() => setStep('select-nft')}
                className="text-gray-500 hover:text-magic-green transition-colors mr-1"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <TicketIcon size={24} />
            <h2 className="text-sm font-bold text-white tracking-widest uppercase font-pusia">
              {step === 'select-nft' ? 'SELECT NFT' : 'CREATE RAFFLE'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'select-nft' ? (
          <div className="flex flex-col overflow-hidden flex-1">
            {/* Search */}
            <div className="p-4 border-b border-white/5 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  className="w-full bg-black border border-white/10 pl-10 pr-3 py-2.5 text-sm font-mono focus:border-magic-green outline-none transition-colors"
                  placeholder="Search your NFTs..."
                  value={nftSearch}
                  onChange={(e) => setNftSearch(e.target.value)}
                />
              </div>
            </div>

            {/* NFT Grid */}
            <div className="overflow-y-auto flex-1 p-4">
              {nftsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-magic-green" />
                  <p className="text-gray-500 text-sm">Loading your NFTs...</p>
                </div>
              ) : filteredNfts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <AlertCircle className="w-8 h-8 text-gray-600" />
                  <p className="text-gray-500 text-sm">
                    {nftSearch ? 'No NFTs match your search' : 'No NFTs found in your wallet'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filteredNfts.map((nft) => (
                    <button
                      key={nft.id}
                      onClick={() => handleSelectNft(nft)}
                      className="group bg-black/40 border border-white/5 hover:border-magic-green/60 transition-all overflow-hidden text-left"
                    >
                      <div className="aspect-square bg-black/60 overflow-hidden">
                        {nft.image ? (
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-700">
                            <TicketIcon size={32} />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-white truncate group-hover:text-magic-green transition-colors">
                          {nft.name}
                        </p>
                        {nft.collection && (
                          <p className="text-[10px] text-gray-600 truncate">{nft.collection}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer count */}
            <div className="p-3 border-t border-white/5 shrink-0">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest text-center">
                {userNfts.length} NFT{userNfts.length !== 1 ? 'S' : ''} IN WALLET
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {/* Selected NFT preview */}
            {selectedNft && (
              <div className="flex items-center gap-3 bg-black/40 p-3 border border-magic-green/20">
                <div className="w-14 h-14 bg-black/60 overflow-hidden shrink-0">
                  {selectedNft.image ? (
                    <img src={selectedNft.image} alt={selectedNft.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <TicketIcon size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-magic-green truncate">{selectedNft.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono truncate">{selectedNft.mint}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Ticket Price (GGOR)</label>
                <input
                  type="number"
                  required
                  step="0.1"
                  className="w-full bg-black border border-white/10 p-3 text-sm font-mono focus:border-magic-green outline-none transition-colors"
                  placeholder="1.0"
                  value={formData.ticketPrice}
                  onChange={(e) => setFormData({...formData, ticketPrice: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Tickets</label>
                <input
                  type="number"
                  required
                  className="w-full bg-black border border-white/10 p-3 text-sm font-mono focus:border-magic-green outline-none transition-colors"
                  placeholder="100"
                  value={formData.totalTickets}
                  onChange={(e) => setFormData({...formData, totalTickets: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Duration (Hours)</label>
              <select
                className="w-full bg-black border border-white/10 p-3 text-sm font-mono focus:border-magic-green outline-none transition-colors"
                value={formData.durationHours}
                onChange={(e) => setFormData({...formData, durationHours: e.target.value})}
              >
                <option value="6">6 Hours (2.5% Fee)</option>
                <option value="24">24 Hours (5.0% Fee)</option>
                <option value="48">48 Hours (7.5% Fee)</option>
                <option value="168">1 Week (10.0% Fee)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedNft}
              className="w-full py-4 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-magic-green/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'LAUNCH RAFFLE'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// Raffle Detail View (full-page overlay)
const RaffleDetailView: React.FC<{
  raffle: RaffleType;
  nftMetadata: any;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ raffle, nftMetadata, onClose, onUpdate }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'transactions' | 'terms'>('participants');
  const [countdown, setCountdown] = useState('');
  const [copied, setCopied] = useState(false);

  // Live countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = raffle.endTime - now;
      if (diff <= 0) {
        setCountdown('ENDED');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [raffle.endTime]);

  const handleBuyTicket = async () => {
    if (!wallet.publicKey) return;
    try {
      setLoading(true);
      const service = new RaffleService(connection, wallet);
      await service.buyTickets(raffle.raffleId, 1);
      onUpdate();
    } catch (error) {
      console.error('Error buying ticket:', error);
      alert('Failed to buy ticket. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  const progress = (raffle.ticketsSold / raffle.totalTickets) * 100;
  const ticketsRemaining = raffle.totalTickets - raffle.ticketsSold;
  const isActive = raffle.status === 'active' && raffle.endTime > Date.now();
  const isSoldOut = raffle.ticketsSold >= raffle.totalTickets;
  const nftName = nftMetadata?.content?.metadata?.name || `Raffle #${raffle.raffleId}`;
  const nftImage = nftMetadata?.content?.links?.image;

  const tabs = [
    { id: 'participants' as const, label: 'PARTICIPANTS', icon: Users },
    { id: 'transactions' as const, label: 'TRANSACTIONS', icon: ExternalLink },
    { id: 'terms' as const, label: 'TERMS', icon: AlertCircle },
  ];

  return (
    <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back button */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-400 hover:text-magic-green transition-colors mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-bold uppercase tracking-widest">BACK TO RAFFLES</span>
        </button>

        {/* Main content: Image left, Info right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left: NFT Image */}
          <div className="bg-black/50 border border-magic-green/20 overflow-hidden">
            <div className="aspect-square relative">
              {nftImage ? (
                <img
                  src={nftImage}
                  alt={nftName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/30">
                  <TicketIcon size={120} className="opacity-20" />
                </div>
              )}
              {/* Status badge */}
              <div className={`absolute top-4 right-4 px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                raffle.status === 'active' ? 'bg-magic-green text-black' :
                raffle.status === 'completed' ? 'bg-blue-500 text-white' :
                raffle.status === 'cancelled' ? 'bg-red-500 text-white' :
                'bg-yellow-500 text-black'
              }`}>
                {raffle.status}
              </div>
            </div>
          </div>

          {/* Right: Raffle Info */}
          <div className="flex flex-col gap-6">
            {/* Prize header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TicketIcon size={20} />
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">RAFFLE PRIZE &middot; 1 WINNER</span>
              </div>
              <h1 className="text-3xl font-bold text-magic-green font-pusia">{nftName}</h1>
              <p className="text-xs text-gray-500 font-mono mt-1">{raffle.nftMint}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/50 border border-magic-green/20 p-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">TICKET PRICE</div>
                <div className="text-xl font-bold text-magic-green font-mono">{raffle.ticketPrice.toFixed(2)} GGOR</div>
              </div>
              <div className="bg-black/50 border border-magic-green/20 p-4">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">PLATFORM FEE</div>
                <div className="text-xl font-bold text-magic-green font-mono">{formatFeeBps(raffle.platformFeeBps)}</div>
              </div>
            </div>

            {/* Tickets remaining */}
            <div className="bg-black/50 border border-magic-green/20 p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">TICKETS REMAINING</div>
                <div className="flex items-center gap-1.5">
                  <TicketIcon size={16} />
                  <span className="text-white font-mono font-bold">{ticketsRemaining} of {raffle.totalTickets}</span>
                </div>
              </div>
              <div className="w-full bg-black h-3 border border-white/5">
                <div
                  className="bg-magic-green h-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-right mt-1">
                <span className="text-[10px] text-gray-600 font-mono">{raffle.ticketsSold} sold</span>
              </div>
            </div>

            {/* Countdown */}
            <div className="bg-black/50 border border-magic-green/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                  {raffle.endTime > Date.now() ? 'ENDS IN' : 'ENDED'}
                </span>
              </div>
              <div className={`text-2xl font-bold font-mono ${countdown === 'ENDED' ? 'text-red-400' : 'text-magic-green'}`}>
                {countdown}
              </div>
            </div>

            {/* Raffler / Creator info */}
            <div className="bg-black/50 border border-magic-green/20 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">RAFFLER</div>
              <div className="flex items-center justify-between">
                <span className="text-white font-mono text-sm">{shortenAddress(raffle.creator)}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyAddress(raffle.creator)}
                    className="text-gray-500 hover:text-magic-green transition-colors"
                    title="Copy address"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-magic-green" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`${EXPLORER_URLS.GORBAGANA}/address/${raffle.creator}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-magic-green transition-colors"
                    title="View on TrashScan"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Buy Button */}
            {isActive && !isSoldOut ? (
              <button
                onClick={handleBuyTicket}
                disabled={loading || !wallet.connected}
                className="w-full py-5 bg-magic-green text-black font-bold uppercase tracking-widest text-lg hover:bg-magic-green/80 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : !wallet.connected ? (
                  'CONNECT WALLET'
                ) : (
                  <>
                    <TicketIcon size={24} />
                    BUY TICKET &middot; {raffle.ticketPrice.toFixed(2)} GGOR
                  </>
                )}
              </button>
            ) : isSoldOut ? (
              <div className="w-full py-5 bg-gray-800 text-gray-400 font-bold uppercase tracking-widest text-lg text-center">
                SOLD OUT
              </div>
            ) : raffle.status === 'completed' && raffle.winner ? (
              <div className="w-full py-5 bg-blue-500/10 border border-blue-500/30 text-center">
                <div className="text-[10px] text-blue-400 uppercase tracking-widest mb-1">WINNER</div>
                <div className="text-blue-400 font-mono font-bold">{shortenAddress(raffle.winner)}</div>
              </div>
            ) : (
              <div className="w-full py-5 bg-gray-800 text-gray-400 font-bold uppercase tracking-widest text-lg text-center">
                {raffle.status === 'cancelled' ? 'CANCELLED' : 'ENDED'}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-magic-green/20 mb-6">
          <div className="flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-magic-green border-magic-green'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-black/50 border border-magic-green/20 min-h-[300px]">
          {activeTab === 'participants' && (
            <ParticipantsTab raffle={raffle} />
          )}
          {activeTab === 'transactions' && (
            <TransactionsTab raffle={raffle} />
          )}
          {activeTab === 'terms' && (
            <TermsTab raffle={raffle} />
          )}
        </div>
      </div>
    </div>
  );
};

// Participants Tab
const ParticipantsTab: React.FC<{ raffle: RaffleType }> = ({ raffle }) => {
  // In production this would fetch actual ticket accounts from on-chain data
  // For now we show a placeholder if no tickets sold, or mock structure
  if (raffle.ticketsSold === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Users className="w-10 h-10 text-gray-600" />
        <p className="text-gray-500 text-sm">No participants yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left px-6 py-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">USER</th>
            <th className="text-center px-6 py-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">TICKETS BOUGHT</th>
            <th className="text-right px-6 py-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">CURRENT CHANCE</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-white/5">
            <td className="px-6 py-4" colSpan={3}>
              <p className="text-gray-500 text-sm text-center">
                Participant data loads from on-chain ticket accounts
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Transactions Tab
const TransactionsTab: React.FC<{ raffle: RaffleType }> = ({ raffle }) => {
  if (raffle.ticketsSold === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <ExternalLink className="w-10 h-10 text-gray-600" />
        <p className="text-gray-500 text-sm">No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left px-6 py-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">TX HASH</th>
            <th className="text-left px-6 py-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">BUYER</th>
            <th className="text-left px-6 py-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">DATE & TIME</th>
            <th className="text-right px-6 py-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">TICKETS</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-white/5">
            <td className="px-6 py-4" colSpan={4}>
              <p className="text-gray-500 text-sm text-center">
                Transaction history loads from on-chain data
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Terms & Conditions Tab
const TermsTab: React.FC<{ raffle: RaffleType }> = ({ raffle }) => {
  const terms = [
    'Each ticket purchase is final and non-refundable.',
    'One ticket is purchased per transaction at the listed GGOR price.',
    `A platform fee of ${formatFeeBps(raffle.platformFeeBps)} is applied to the total ticket sales and deducted upon raffle completion.`,
    'The winner is selected randomly on-chain when the raffle ends or all tickets are sold.',
    'The NFT prize is held in escrow by the smart contract until the winner is drawn.',
    'If no tickets are sold, the raffle creator may cancel and reclaim their NFT.',
    'The winning ticket holder will receive the NFT directly to their wallet.',
    'The raffle creator receives the ticket sale proceeds minus the platform fee.',
    'All transactions are recorded on the Gorbagana blockchain and are publicly verifiable.',
    'By participating, you agree to abide by these terms and accept the outcome of the on-chain randomness.',
  ];

  return (
    <div className="p-6">
      <ol className="space-y-4">
        {terms.map((term, i) => (
          <li key={i} className="flex gap-4">
            <span className="text-magic-green font-mono font-bold text-sm shrink-0">{i + 1}.</span>
            <span className="text-gray-300 text-sm leading-relaxed">{term}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default Raffle;
