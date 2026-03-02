import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { RaffleService, Raffle as RaffleType, formatGGOR, formatFeeBps } from '../services/raffleService';
import { PublicKey } from '@solana/web3.js';
import { TicketIcon } from '../components/TicketIcon';
import { Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { BN } from '@coral-xyz/anchor';

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
            Create raffles for your NFTs or buy tickets to win prizes
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <TicketIcon size={48} />
          <div>
            <h1 className="text-4xl font-bold text-magic-green mb-2">NFT RAFFLES</h1>
            <p className="text-gray-400">Win NFTs with GGOR tickets</p>
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
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [nftMetadata, setNftMetadata] = useState<any>(null);

  useEffect(() => {
    loadNFTMetadata();
  }, [raffle.nftMint]);

  const loadNFTMetadata = async () => {
    try {
      const response = await fetch(`https://gorapi.trashscan.io/v1/nft/${raffle.nftMint}`);
      const data = await response.json();
      setNftMetadata(data);
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
    <div className="bg-black/50 border border-magic-green/20 hover:border-magic-green/40 transition-colors">
      {/* NFT Image */}
      <div className="aspect-square bg-black/30 relative overflow-hidden">
        {nftMetadata?.content?.links?.image ? (
          <img
            src={nftMetadata.content.links.image}
            alt={nftMetadata.content?.metadata?.name || 'NFT'}
            className="w-full h-full object-cover"
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
          <div className="flex justify-between">
            <span className="text-gray-400">Platform Fee:</span>
            <span className="text-magic-green text-xs font-bold">
              {formatFeeBps(raffle.platformFeeBps)}
              {raffle.platformFeeBps === 250 && ' 🚀'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-black/50 h-2 mb-4">
          <div
            className="bg-magic-green h-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Action Button */}
        {raffle.status === 'active' && (
          <button
            onClick={() => setShowBuyModal(true)}
            className="w-full px-4 py-2 bg-magic-green text-black font-bold hover:bg-magic-green/80 transition-colors flex items-center justify-center gap-2"
          >
            <TicketIcon size={20} />
            BUY TICKETS
          </button>
        )}

        {raffle.status === 'completed' && raffle.winner && (
          <div className="text-center text-sm">
            <div className="text-gray-400">Winner:</div>
            <div className="text-magic-green font-mono text-xs">
              {raffle.winner.slice(0, 4)}...{raffle.winner.slice(-4)}
            </div>
          </div>
        )}
      </div>

      {/* Buy Modal */}
      {showBuyModal && (
        <BuyTicketsModal
          raffle={raffle}
          onClose={() => setShowBuyModal(false)}
          onSuccess={() => {
            setShowBuyModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
};

// Create Raffle Modal
const CreateRaffleModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nftMint: '',
    ticketPrice: '',
    totalTickets: '',
    durationHours: '24'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey) return;

    try {
      setLoading(true);
      const service = new RaffleService(connection, wallet);
      await service.createRaffle(
        new PublicKey(formData.nftMint),
        parseFloat(formData.ticketPrice),
        parseInt(formData.totalTickets),
        parseInt(formData.durationHours)
      );
      onSuccess();
    } catch (error) {
      console.error('Error creating raffle:', error);
      alert('Failed to create raffle. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-magic-dark border border-magic-green/30 max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2">
            <TicketIcon size={24} />
            <h2 className="text-sm font-bold text-white tracking-widest uppercase font-pusia">CREATE RAFFLE</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">NFT Mint Address</label>
            <input
              type="text"
              required
              className="w-full bg-black border border-white/10 p-3 text-sm font-mono focus:border-magic-green outline-none transition-colors"
              placeholder="Enter NFT Mint..."
              value={formData.nftMint}
              onChange={(e) => setFormData({...formData, nftMint: e.target.value})}
            />
          </div>
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
            disabled={loading}
            className="w-full py-4 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-magic-green/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'LAUNCH RAFFLE'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Buy Tickets Modal
const BuyTicketsModal: React.FC<{ raffle: RaffleType; onClose: () => void; onSuccess: () => void }> = ({ raffle, onClose, onSuccess }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleBuy = async () => {
    if (!wallet.publicKey) return;

    try {
      setLoading(true);
      const service = new RaffleService(connection, wallet);
      await service.buyTickets(raffle.raffleId, quantity);
      onSuccess();
    } catch (error) {
      console.error('Error buying tickets:', error);
      alert('Failed to buy tickets. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = raffle.ticketPrice * quantity;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-magic-dark border border-magic-green/30 max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2">
            <TicketIcon size={24} />
            <h2 className="text-sm font-bold text-white tracking-widest uppercase font-pusia">BUY TICKETS</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4 bg-black/40 p-4 border border-white/5">
            <div className="w-16 h-16 bg-magic-green/10 flex items-center justify-center">
              <TicketIcon size={32} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Raffle ID</p>
              <p className="text-lg font-bold text-white font-mono">#{raffle.raffleId}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-12 h-12 bg-black border border-white/10 flex items-center justify-center hover:border-magic-green transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  readOnly
                  className="flex-1 bg-black border border-white/10 h-12 text-center font-mono text-lg"
                  value={quantity}
                />
                <button 
                  onClick={() => setQuantity(Math.min(raffle.totalTickets - raffle.ticketsSold, quantity + 1))}
                  className="w-12 h-12 bg-black border border-white/10 flex items-center justify-center hover:border-magic-green transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-magic-green/5 border border-magic-green/20 p-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-magic-green/70 uppercase tracking-widest">Total Price</span>
                <span className="text-xl font-bold text-magic-green font-mono">{totalPrice.toFixed(2)} GGOR</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleBuy}
            disabled={loading || quantity <= 0}
            className="w-full py-4 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-magic-green/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONFIRM PURCHASE'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Raffle;
