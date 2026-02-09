import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeftRight, 
  ShieldCheck, 
  History, 
  Plus, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  Search,
  Trash2,
  Activity
} from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';
import { useWallet } from '../contexts/WalletContext';

// --- TYPES ---
interface BridgeOrder {
  id: string;
  seller: string;
  sellToken: 'gGOR' | 'sGOR';
  buyToken: 'gGOR' | 'sGOR';
  amount: number;
  status: 'active' | 'pending' | 'completed' | 'cancelled';
  timestamp: number;
  requiredWallet: string;
}

interface EscrowItem {
  id: string;
  orderId: string;
  status: 'locking' | 'verifying' | 'completed';
  step: string;
  timestamp: number;
  amount: number;
  token: string;
}

const Bridge: React.FC = () => {
  const { currency, accentColor, getExplorerLink } = useNetwork();
  const { connected, address, balance, formatAddress } = useWallet();

  // --- STATE ---
  const [viewMode, setViewMode] = useState<'trade' | 'orders' | 'escrow' | 'history'>('trade');
  const [orders, setOrders] = useState<BridgeOrder[]>([]);
  const [escrows, setEscrows] = useState<EscrowItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'gGOR' | 'sGOR'>('all');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<BridgeOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- MOCK DATA INIT ---
  useEffect(() => {
    const mockOrders: BridgeOrder[] = [
      {
        id: '1',
        seller: '7xKXtg...3WpR',
        sellToken: 'gGOR',
        buyToken: 'sGOR',
        amount: 5000,
        status: 'active',
        timestamp: Date.now() - 120000,
        requiredWallet: 'Backpack (Gorbagana)'
      },
      {
        id: '2',
        seller: '9mNBvc...8LkJ',
        sellToken: 'gGOR',
        buyToken: 'sGOR',
        amount: 12500,
        status: 'active',
        timestamp: Date.now() - 300000,
        requiredWallet: 'Backpack (Gorbagana)'
      },
      {
        id: '3',
        seller: '3rTyui...9MnB',
        sellToken: 'sGOR',
        buyToken: 'gGOR',
        amount: 2500,
        status: 'active',
        timestamp: Date.now() - 720000,
        requiredWallet: 'Any Solana Wallet'
      }
    ];
    setOrders(mockOrders);
  }, []);

  // --- LOGIC ---
  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter(o => o.sellToken === filter);
  }, [orders, filter]);

  const handleTradeClick = (order: BridgeOrder) => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    setSelectedOrder(order);
    setIsTradeModalOpen(true);
  };

  const executeTrade = async () => {
    if (!selectedOrder) return;
    setIsProcessing(true);
    
    // Simulate on-chain steps
    try {
      const newEscrow: EscrowItem = {
        id: Math.random().toString(36).substr(2, 9),
        orderId: selectedOrder.id,
        status: 'locking',
        step: 'Locking funds in Solana Escrow...',
        timestamp: Date.now(),
        amount: selectedOrder.amount,
        token: selectedOrder.buyToken
      };
      
      setEscrows(prev => [newEscrow, ...prev]);
      setViewMode('escrow');
      setIsTradeModalOpen(false);

      // Step 1: Lock
      await new Promise(r => setTimeout(r, 2000));
      setEscrows(prev => prev.map(e => e.id === newEscrow.id ? { ...e, status: 'verifying', step: 'Verifying cross-chain proof...' } : e));
      
      // Step 2: Verify
      await new Promise(r => setTimeout(r, 3000));
      setEscrows(prev => prev.map(e => e.id === newEscrow.id ? { ...e, status: 'completed', step: 'Trade Settled' } : e));
      
      // Update History
      setHistory(prev => [{
        id: newEscrow.id,
        type: 'BUY',
        amount: `${selectedOrder.amount} ${selectedOrder.sellToken}`,
        status: 'completed',
        tx: 'TRASH...' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        timestamp: Date.now()
      }, ...prev]);

      // Remove from active orders
      setOrders(prev => prev.filter(o => o.id !== selectedOrder.id));
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
      setSelectedOrder(null);
    }
  };

  // --- STYLING HELPERS ---
  const btnClass = (active: boolean) => `px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-all duration-200 ${
    active ? 'bg-magic-green text-black border-magic-green' : 'text-gray-400 border-white/10 hover:border-white/40 hover:text-white'
  }`;

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Hero / Header */}
      <div className="border-b border-white/20 bg-gradient-to-b from-magic-green/5 to-transparent">
        <div className="max-w-[1600px] mx-auto px-4 py-8 md:py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-magic-green text-black p-2">
                  <ArrowLeftRight className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                  GORBAGANA<span className="text-magic-green">_BRIDGE</span>
                </h1>
              </div>
              <p className="text-gray-400 text-sm md:text-base max-w-xl">
                Secure P2P OTC trading between Solana (sGOR) and Gorbagana (gGOR). 
                100% decentralized escrow system for the trashiest traders.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-px bg-white/20 border border-white/20 w-full md:w-auto">
              <div className="bg-black p-4">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Active_Offers</div>
                <div className="text-magic-green font-bold text-xl">{orders.length}</div>
              </div>
              <div className="bg-black p-4">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Total_Volume</div>
                <div className="text-white font-bold text-xl">1.2M G</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
          <button onClick={() => setViewMode('trade')} className={btnClass(viewMode === 'trade')}>
            <Activity className="w-3 h-3 inline mr-2" /> Market
          </button>
          <button onClick={() => setViewMode('orders')} className={btnClass(viewMode === 'orders')}>
            <Plus className="w-3 h-3 inline mr-2" /> Create_Offer
          </button>
          <button onClick={() => setViewMode('escrow')} className={btnClass(viewMode === 'escrow')}>
            <ShieldCheck className="w-3 h-3 inline mr-2" /> Active_Escrows
          </button>
          <button onClick={() => setViewMode('history')} className={btnClass(viewMode === 'history')}>
            <History className="w-3 h-3 inline mr-2" /> History
          </button>
        </div>

        {/* View: Market */}
        {viewMode === 'trade' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => setFilter('all')} className={`px-3 py-1 text-[10px] border ${filter === 'all' ? 'border-magic-green text-magic-green' : 'border-white/10 text-gray-500'}`}>ALL</button>
                <button onClick={() => setFilter('gGOR')} className={`px-3 py-1 text-[10px] border ${filter === 'gGOR' ? 'border-magic-green text-magic-green' : 'border-white/10 text-gray-500'}`}>gGOR</button>
                <button onClick={() => setFilter('sGOR')} className={`px-3 py-1 text-[10px] border ${filter === 'sGOR' ? 'border-magic-green text-magic-green' : 'border-white/10 text-gray-500'}`}>sGOR</button>
              </div>
              <div className="text-[10px] text-gray-500 uppercase">Live_Market_Feed</div>
            </div>

            <div className="overflow-x-auto border border-white/10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-[10px] uppercase text-gray-500 border-b border-white/10">
                    <th className="p-4 font-bold">Seller</th>
                    <th className="p-4 font-bold">Selling</th>
                    <th className="p-4 font-bold">Amount</th>
                    <th className="p-4 font-bold">Wallet_Req</th>
                    <th className="p-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredOrders.map(order => (
                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-magic-green">{order.seller}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${order.sellToken === 'gGOR' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {order.sellToken}
                        </span>
                      </td>
                      <td className="p-4 font-bold">{order.amount.toLocaleString()} {order.sellToken}</td>
                      <td className="p-4 text-gray-400 text-xs">{order.requiredWallet}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleTradeClick(order)}
                          className="px-4 py-1 bg-magic-green text-black text-xs font-bold hover:bg-white transition-colors"
                        >
                          TRADE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View: Create Offer (Simplified for Demo) */}
        {viewMode === 'orders' && (
          <div className="max-w-xl mx-auto border border-white/10 p-8 bg-white/5">
            <h2 className="text-xl font-bold mb-6 uppercase tracking-widest">Create_OTC_Offer</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">I want to sell</label>
                <select className="w-full bg-black border border-white/20 p-3 text-sm outline-none focus:border-magic-green">
                  <option>gGOR (Gorbagana)</option>
                  <option>sGOR (Solana)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">Amount</label>
                <input type="number" placeholder="0.00" className="w-full bg-black border border-white/20 p-3 text-sm outline-none focus:border-magic-green" />
              </div>
              <div className="p-4 bg-magic-green/10 border border-magic-green/20 rounded">
                <div className="flex gap-2 text-magic-green text-xs">
                  <Info className="w-4 h-4" />
                  <span>Your tokens will be locked in a secure escrow contract until a buyer completes the trade.</span>
                </div>
              </div>
              <button className="w-full py-4 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors">
                POST_OFFER
              </button>
            </div>
          </div>
        )}

        {/* View: Escrow */}
        {viewMode === 'escrow' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {escrows.length === 0 ? (
              <div className="col-span-full text-center py-20 border border-dashed border-white/10 text-gray-500">
                NO_ACTIVE_ESCROWS_FOUND
              </div>
            ) : (
              escrows.map(escrow => (
                <div key={escrow.id} className="border border-white/10 p-6 bg-white/5 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase mb-1">Escrow_ID: {escrow.id}</div>
                      <div className="text-lg font-bold">{escrow.amount.toLocaleString()} {escrow.token}</div>
                    </div>
                    <div className={`px-2 py-1 text-[10px] font-bold ${escrow.status === 'completed' ? 'bg-magic-green text-black' : 'bg-yellow-500/20 text-yellow-500'}`}>
                      {escrow.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {escrow.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-magic-green" /> : <Clock className="w-4 h-4 animate-pulse" />}
                      <span>{escrow.step}</span>
                    </div>
                    <div className="w-full bg-white/10 h-1">
                      <div className={`h-full bg-magic-green transition-all duration-1000 ${escrow.status === 'completed' ? 'w-full' : escrow.status === 'verifying' ? 'w-2/3' : 'w-1/3'}`}></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* View: History */}
        {viewMode === 'history' && (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-[10px] uppercase text-gray-500 border-b border-white/10">
                  <th className="p-4 font-bold">Date</th>
                  <th className="p-4 font-bold">Type</th>
                  <th className="p-4 font-bold">Amount</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-right">TX_Hash</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {history.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-gray-500">NO_HISTORY_AVAILABLE</td></tr>
                ) : (
                  history.map(item => (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="p-4 text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</td>
                      <td className="p-4 font-bold text-magic-green">{item.type}</td>
                      <td className="p-4">{item.amount}</td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-xs">
                          <CheckCircle2 className="w-3 h-3 text-magic-green" /> {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono text-xs text-gray-500">{item.tx}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade Confirmation Modal */}
      {isTradeModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => !isProcessing && setIsTradeModalOpen(false)}></div>
          <div className="relative bg-magic-dark border border-magic-green/30 p-8 max-w-md w-full">
            <h2 className="text-xl font-bold mb-6 uppercase tracking-widest">Confirm_Trade</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">You Send</span>
                <span className="font-bold">{selectedOrder.amount.toLocaleString()} {selectedOrder.buyToken}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">You Receive</span>
                <span className="font-bold text-magic-green">{selectedOrder.amount.toLocaleString()} {selectedOrder.sellToken}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Counterparty</span>
                <span className="text-xs font-mono">{selectedOrder.seller}</span>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 mb-8 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
              <p className="text-[10px] text-yellow-500 leading-relaxed">
                WARNING: This is a cross-chain trade. Ensure you have the correct wallet connected for the receiving network. 
                Funds will be locked in escrow until verification is complete.
              </p>
            </div>

            <div className="flex gap-4">
              <button 
                disabled={isProcessing}
                onClick={() => setIsTradeModalOpen(false)}
                className="flex-1 py-3 border border-white/20 text-gray-400 font-bold uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button 
                disabled={isProcessing}
                onClick={executeTrade}
                className="flex-1 py-3 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" /> : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bridge;
