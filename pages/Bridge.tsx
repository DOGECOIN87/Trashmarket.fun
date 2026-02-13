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
  Activity
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBridgeService, BridgeOrder } from '../services/bridgeService';
import { PublicKey, Connection } from '@solana/web3.js';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';

// Dedicated read-only connection for fetching slot (always Gorbagana)
const gorbaganaConnection = new Connection(GORBAGANA_CONFIG.rpcEndpoint, 'confirmed');

const Bridge: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const { fetchAllOrders, createOrderGGOR, createOrderSGOR, fillOrder, cancelOrder } = useBridgeService();

  // --- STATE ---
  const [viewMode, setViewMode] = useState<'trade' | 'orders' | 'escrow' | 'history'>('trade');
  const [orders, setOrders] = useState<BridgeOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'gGOR' | 'sGOR'>('all');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<BridgeOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state for creating order
  const [createAmount, setCreateAmount] = useState<string>('');
  const [createDirection, setCreateDirection] = useState<'gGOR' | 'sGOR'>('gGOR'); // Token to sell

  // Fetch real orders from Gorbagana blockchain
  useEffect(() => {
    if (!connected) return;

    const loadOrders = async () => {
      setLoading(true);
      try {
        const allOrders = await fetchAllOrders();
        const activeOrders = allOrders.filter(o => !o.isFilled);
        setOrders(activeOrders);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();

    // Refresh every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [connected]);

  // --- LOGIC ---
  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    const targetDirection = filter === 'gGOR' ? 1 : 0;
    return orders.filter(o => o.direction === targetDirection);
  }, [orders, filter]);

  const handleTradeClick = (order: BridgeOrder) => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    setSelectedOrder(order);
    setIsTradeModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!connected) {
      alert('Please connect wallet first');
      return;
    }

    const amount = parseFloat(createAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    try {
      // Get current slot from Gorbagana
      const currentSlot = await gorbaganaConnection.getSlot();
      const expirationSlot = currentSlot + 216000; // ~24 hours

      if (createDirection === 'gGOR') {
        // Selling gGOR -> Buying sGOR (Direction 1)
        await createOrderGGOR(amount * 1e9, expirationSlot);
      } else {
        // Selling sGOR -> Buying gGOR (Direction 0)
        await createOrderSGOR(amount * 1e9, expirationSlot);
      }

      alert('Order created successfully!');
      setCreateAmount('');
      setViewMode('trade');

      // Refresh orders
      const allOrders = await fetchAllOrders();
      setOrders(allOrders.filter(o => !o.isFilled));
    } catch (err: any) {
      console.error(err);
      alert('Failed to create order: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const executeTrade = async () => {
    if (!selectedOrder) return;
    setIsProcessing(true);

    try {
      await fillOrder(selectedOrder.orderPDA);

      // Optimistic UI update: immediately remove the filled order from state
      const filledOrderKey = selectedOrder.orderPDA.toBase58();
      setOrders(prev => prev.filter(o => o.orderPDA.toBase58() !== filledOrderKey));
      setIsTradeModalOpen(false);
      setSelectedOrder(null);
      alert('Order filled successfully!');

      // Also do a background refresh to sync with chain state
      setTimeout(async () => {
        try {
          const allOrders = await fetchAllOrders();
          setOrders(allOrders.filter(o => !o.isFilled));
        } catch (refreshErr) {
          console.error('Failed to refresh orders after fill:', refreshErr);
        }
      }, 3000);
    } catch (err: any) {
      console.error('Fill order error:', err);

      // Parse Anchor/Solana custom error codes for user-friendly messages
      const errorMessage = parseOrderError(err);
      alert('Failed to fill order: ' + errorMessage);

      // If the error indicates the order is already filled, remove it from UI
      if (isOrderAlreadyFilledError(err)) {
        setOrders(prev => prev.filter(o => !o.orderPDA.equals(selectedOrder.orderPDA)));
        setIsTradeModalOpen(false);
      }
    } finally {
      setIsProcessing(false);
      setSelectedOrder(null);
    }
  };

  // Map Anchor custom error codes to human-readable messages
  const parseOrderError = (err: any): string => {
    // Try multiple ways to extract an error string
    let errStr = '';
    if (typeof err === 'string') {
      errStr = err;
    } else if (err?.message && err.message !== 'undefined') {
      errStr = err.message;
    } else if (err?.logs) {
      // Anchor SendTransactionError often has logs but no message
      errStr = err.logs.join(' ');
    } else if (err?.toString && err.toString() !== '[object Object]') {
      errStr = err.toString();
    }

    // Also check err.error or err.err for nested error objects
    if (!errStr && err?.error) {
      errStr = JSON.stringify(err.error);
    }

    // Anchor program custom error codes (6000+)
    const programErrorMap: Record<number, string> = {
      6000: 'Amount must be >= minimum order size.',
      6001: 'Invalid direction.',
      6002: 'Invalid token mint for this direction.',
      6003: 'Order has expired.',
      6004: 'Order has already been filled.',
      6005: 'Insufficient funds for swap.',
      6006: 'Only the maker can perform this action.',
      6007: 'Expiration slot is in the past.',
      6008: 'Expiration too far in future (max ~24 hours).',
      6009: 'Missing escrow token account.',
      6010: 'Missing maker token account.',
      6011: 'Missing taker token account.',
      6012: 'Missing taker receive token account.',
      6013: 'Missing maker receive token account.',
    };

    // Anchor framework error codes (below 6000)
    const frameworkErrorMap: Record<number, string> = {
      2006: 'Account owner mismatch.',
      2014: 'Token mint mismatch — wrong SPL token.',
      2015: 'Token account owner mismatch.',
      3007: 'Account owned by wrong program.',
      3012: 'Required token account not initialized. Please ensure you have an sGOR token account.',
    };

    const allErrors: Record<number, string> = { ...frameworkErrorMap, ...programErrorMap };

    // Check for "Custom":NNNN or Custom:NNNN patterns (handles JSON and plain formats)
    const customMatch = errStr.match(/Custom"?\s*[:]\s*(\d+)/i);
    if (customMatch) {
      const code = parseInt(customMatch[1], 10);
      if (allErrors[code]) {
        return allErrors[code];
      }
      return `Transaction failed (error code ${code}).`;
    }

    // Check for Anchor error code in InstructionError format
    const instructionMatch = errStr.match(/InstructionError.*?Custom.*?(\d+)/i);
    if (instructionMatch) {
      const code = parseInt(instructionMatch[1], 10);
      if (allErrors[code]) {
        return allErrors[code];
      }
    }

    // Check for Anchor error code number directly from error object
    if (err?.code !== undefined && typeof err.code === 'number') {
      if (allErrors[err.code]) {
        return allErrors[err.code];
      }
    }

    // Fallback
    if (!errStr || errStr === 'undefined' || errStr === '[object Object]') {
      return 'Transaction failed. The order may have already been filled or expired.';
    }

    return errStr;
  };

  // Check if an error indicates the order was already filled
  const isOrderAlreadyFilledError = (err: any): boolean => {
    const errStr = typeof err === 'string' ? err : (err?.message || err?.toString() || '');
    if (/Custom"?\s*[:]\s*6004/i.test(errStr)) return true;
    if (/already\s+filled/i.test(errStr)) return true;
    return false;
  };

  const handleCancelOrder = async (orderPDA: PublicKey) => {
    if (!connected) return;

    if (!confirm('Are you sure you want to cancel this order?')) return;

    setIsProcessing(true);
    try {
      await cancelOrder(orderPDA);
      alert('Order cancelled successfully!');

      // Refresh orders
      const allOrders = await fetchAllOrders();
      setOrders(allOrders.filter(o => !o.isFilled));
    } catch (err: any) {
      console.error(err);
      alert('Failed to cancel order: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to format amount
  const formatAmount = (bn: any) => {
    return (bn.toNumber() / 1e9).toLocaleString();
  };

  // Helper to get token names based on direction
  // Direction 0: sGOR -> gGOR (Seller sells sGOR, Buyer buys sGOR)
  // Direction 1: gGOR -> sGOR (Seller sells gGOR, Buyer buys gGOR)
  const getTokenInfo = (direction: number) => {
    if (direction === 1) {
      return { sell: 'gGOR', buy: 'sGOR' };
    } else {
      return { sell: 'sGOR', buy: 'gGOR' };
    }
  };

  // --- STYLING HELPERS ---
  const btnClass = (active: boolean) => `px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-all duration-200 ${active ? 'bg-magic-green text-black border-magic-green' : 'text-gray-400 border-white/10 hover:border-white/40 hover:text-white'
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
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Status</div>
                <div className="text-white font-bold text-xl">{loading ? 'SYNCING...' : 'ONLINE'}</div>
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
                    <th className="p-4 font-bold">Buying</th>
                    <th className="p-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={5} className="p-10 text-center text-gray-500">NO_ACTIVE_ORDERS</td></tr>
                  ) : (
                    filteredOrders.map(order => {
                      const { sell, buy } = getTokenInfo(order.direction);
                      const isMyOrder = publicKey?.equals(order.maker);

                      return (
                        <tr key={order.orderPDA.toBase58()} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-magic-green font-mono">{order.maker.toBase58().slice(0, 8)}...</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${sell === 'gGOR' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-400'}`}>
                              {sell}
                            </span>
                          </td>
                          <td className="p-4 font-bold">{formatAmount(order.amount)} {sell}</td>
                          <td className="p-4 text-gray-400 text-xs">{buy}</td>
                          <td className="p-4 text-right">
                            {isMyOrder && (
                              <button
                                onClick={() => handleCancelOrder(order.orderPDA)}
                                disabled={isProcessing}
                                className="px-4 py-1 border border-red-500/50 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors"
                              >
                                CANCEL
                              </button>
                            )}
                            {!isMyOrder && (
                              <button
                                onClick={() => handleTradeClick(order)}
                                disabled={isProcessing}
                                className="px-4 py-1 bg-magic-green text-black text-xs font-bold hover:bg-white transition-colors"
                              >
                                TRADE
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View: Create Offer */}
        {viewMode === 'orders' && (
          <div className="max-w-xl mx-auto border border-white/10 p-8 bg-white/5">
            <h2 className="text-xl font-bold mb-6 uppercase tracking-widest">Create_OTC_Offer</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">I want to sell</label>
                <select
                  value={createDirection}
                  onChange={(e) => setCreateDirection(e.target.value as 'gGOR' | 'sGOR')}
                  className="w-full bg-black border border-white/20 p-3 text-sm outline-none focus:border-magic-green"
                >
                  <option value="gGOR">gGOR (Gorbagana)</option>
                  <option value="sGOR">sGOR (Solana)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">Amount</label>
                <input
                  type="number"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black border border-white/20 p-3 text-sm outline-none focus:border-magic-green"
                />
              </div>
              <div className="p-4 bg-magic-green/10 border border-magic-green/20 rounded">
                <div className="flex gap-2 text-magic-green text-xs">
                  <Info className="w-4 h-4" />
                  <span>Your tokens will be locked in a secure escrow contract until a buyer completes the trade.</span>
                </div>
              </div>
              <button
                onClick={handleCreateOrder}
                disabled={isProcessing}
                className="w-full py-4 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'PROCESSING...' : 'POST_OFFER'}
              </button>
            </div>
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
                <span className="font-bold">{formatAmount(selectedOrder.amount)} {getTokenInfo(selectedOrder.direction).buy}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">You Receive</span>
                <span className="font-bold text-magic-green">{formatAmount(selectedOrder.amount)} {getTokenInfo(selectedOrder.direction).sell}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Counterparty</span>
                <span className="text-xs font-mono">{selectedOrder.maker.toBase58()}</span>
              </div>
            </div>

            <div className="bg-magic-green/10 border border-magic-green/20 p-4 mb-8 flex gap-3">
              <Info className="w-5 h-5 text-magic-green shrink-0" />
              <p className="text-[10px] text-magic-green leading-relaxed">
                All bridge transactions are executed on the Gorbagana network.
                Your wallet will sign the transaction and it will be submitted to Gorbagana automatically.
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
