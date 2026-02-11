import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Activity,
  XCircle,
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useNetwork } from '../contexts/NetworkContext';
import { useWallet } from '../contexts/WalletContext';
import {
  type BridgeOrder,
  type EscrowRecord,
  type TradeHistory,
  subscribeToActiveOrders,
  subscribeToEscrows,
  createBridgeOrder,
  cancelBridgeOrder,
  createEscrow,
  completeTrade,
  cancelEscrow,
  getTradeHistory,
  getBridgeStats,
} from '../services/bridgeService';
import {
  SGOR_TOKEN_MINT,
  BRIDGE_FEE_RATE,
  PLATFORM_FEE_WALLET,
  calculateBridgeFee,
  sendSGORTokens,
  sendSGORWithPlatformFee,
  sendGGORNative,
  sendGGORWithPlatformFee,
  verifyTransaction,
  isValidPublicKey,
  verifySGORTokenMint,
  getSolanaConnection,
} from '../services/bridgeTransactionService';

type ViewMode = 'trade' | 'create' | 'escrow' | 'history';

const Bridge: React.FC = () => {
  const { getExplorerLink } = useNetwork();
  const { connected, address } = useWallet();

  // --- STATE ---
  const [viewMode, setViewMode] = useState<ViewMode>('trade');
  const [orders, setOrders] = useState<BridgeOrder[]>([]);
  const [escrows, setEscrows] = useState<EscrowRecord[]>([]);
  const [history, setHistory] = useState<TradeHistory[]>([]);
  const [stats, setStats] = useState({ activeOffers: 0, totalVolume: 0, completedTrades: 0, totalFees: 0 });
  const [filter, setFilter] = useState<'all' | 'gGOR' | 'sGOR'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Trade modal
  const [selectedOrder, setSelectedOrder] = useState<BridgeOrder | null>(null);
  const [buyerSolanaAddr, setBuyerSolanaAddr] = useState('');
  const [buyerGorbaganaAddr, setBuyerGorbaganaAddr] = useState('');

  // Create offer form
  const [createSellToken, setCreateSellToken] = useState<'gGOR' | 'sGOR'>('gGOR');
  const [createAmount, setCreateAmount] = useState('');
  const [createSolanaAddr, setCreateSolanaAddr] = useState('');
  const [createGorbaganaAddr, setCreateGorbaganaAddr] = useState('');

  // Seller release modal
  const [releaseEscrow, setReleaseEscrow] = useState<EscrowRecord | null>(null);

  // --- REAL-TIME SUBSCRIPTIONS ---
  useEffect(() => {
    const filterVal = filter === 'all' ? undefined : filter;
    const unsubOrders = subscribeToActiveOrders((data) => setOrders(data), filterVal);
    return () => unsubOrders();
  }, [filter]);

  useEffect(() => {
    if (!address) {
      setEscrows([]);
      return;
    }
    const unsub = subscribeToEscrows(address, (data) => setEscrows(data));
    return () => unsub();
  }, [address]);

  useEffect(() => {
    if (!address) return;
    getTradeHistory(address).then(setHistory).catch(console.error);
  }, [address]);

  useEffect(() => {
    getBridgeStats().then(setStats).catch(console.error);
  }, []);

  // Auto-fill connected wallet address
  useEffect(() => {
    if (address) {
      setCreateGorbaganaAddr(address);
      setBuyerGorbaganaAddr(address);
    }
  }, [address]);

  // --- HELPERS ---
  const clearMessages = () => { setError(null); setSuccess(null); };

  const formatAddr = (addr: string) => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const feeBreakdown = useMemo(() => {
    if (!selectedOrder) return null;
    return calculateBridgeFee(selectedOrder.amount);
  }, [selectedOrder]);

  // --- CREATE OFFER ---
  const handleCreateOffer = async () => {
    clearMessages();
    if (!connected) { setError('Connect your wallet first'); return; }

    const amount = parseFloat(createAmount);
    if (!amount || amount <= 0) { setError('Enter a valid amount'); return; }
    if (!isValidPublicKey(createSolanaAddr)) { setError('Invalid Solana address'); return; }
    if (!isValidPublicKey(createGorbaganaAddr)) { setError('Invalid Gorbagana address'); return; }

    setIsProcessing(true);
    try {
      // Verify sGOR token exists on-chain before allowing any sGOR offer
      if (createSellToken === 'sGOR') {
        const conn = getSolanaConnection();
        await verifySGORTokenMint(conn);
      }

      const orderId = await createBridgeOrder(
        createSellToken,
        amount,
        createSolanaAddr,
        createGorbaganaAddr
      );
      setSuccess(`Offer created: ${orderId}`);
      setCreateAmount('');
      setViewMode('trade');
    } catch (err: any) {
      setError(err.message || 'Failed to create offer');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- BUYER: EXECUTE TRADE ---
  const handleBuyerDeposit = async () => {
    clearMessages();
    if (!selectedOrder || !connected) return;

    if (!isValidPublicKey(buyerSolanaAddr)) { setError('Invalid Solana address'); return; }
    if (!isValidPublicKey(buyerGorbaganaAddr)) { setError('Invalid Gorbagana address'); return; }

    setIsProcessing(true);
    try {
      let txHash: string;
      let txChain: 'solana' | 'gorbagana';

      if (selectedOrder.sellToken === 'gGOR') {
        // Seller is selling gGOR, buyer pays with sGOR on Solana
        // Splits: netAmount to seller + fee to platform wallet (single tx)
        const conn = getSolanaConnection();
        await verifySGORTokenMint(conn);

        txHash = await sendSGORWithPlatformFee(
          new PublicKey(buyerSolanaAddr),
          new PublicKey(selectedOrder.sellerSolanaAddress),
          selectedOrder.amount
        );
        txChain = 'solana';
      } else {
        // Seller is selling sGOR, buyer pays with gGOR on Gorbagana
        // Splits: netAmount to seller + fee to platform wallet (single tx)
        txHash = await sendGGORWithPlatformFee(
          new PublicKey(buyerGorbaganaAddr),
          new PublicKey(selectedOrder.sellerGorbaganaAddress),
          selectedOrder.amount
        );
        txChain = 'gorbagana';
      }

      // Verify transaction on-chain
      const verification = await verifyTransaction(txHash, txChain);
      if (!verification.confirmed) {
        throw new Error('Transaction failed on-chain. Funds were not transferred.');
      }

      // Create escrow record in Firebase
      await createEscrow(
        selectedOrder.id,
        buyerSolanaAddr,
        buyerGorbaganaAddr,
        selectedOrder.sellerSolanaAddress,
        selectedOrder.sellerGorbaganaAddress,
        selectedOrder.amount,
        selectedOrder.sellToken,
        txHash,
        txChain
      );

      setSuccess(`Deposit confirmed! TX: ${txHash.slice(0, 16)}... Waiting for seller to release.`);
      setSelectedOrder(null);
      setViewMode('escrow');
    } catch (err: any) {
      setError(err.message || 'Trade execution failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- SELLER: RELEASE FUNDS ---
  const handleSellerRelease = async () => {
    clearMessages();
    if (!releaseEscrow || !connected) return;

    setIsProcessing(true);
    try {
      let txHash: string;
      let txChain: 'solana' | 'gorbagana';
      const { netAmount } = releaseEscrow;

      if (releaseEscrow.sellToken === 'gGOR') {
        // Seller sends gGOR native to buyer on Gorbagana (net of 5% fee)
        txHash = await sendGGORNative(
          new PublicKey(releaseEscrow.sellerGorbaganaAddress),
          new PublicKey(releaseEscrow.buyerGorbaganaAddress),
          netAmount
        );
        txChain = 'gorbagana';
      } else {
        // Seller sends sGOR tokens to buyer on Solana (net of 5% fee)
        // Verify sGOR token mint before release
        const conn = getSolanaConnection();
        await verifySGORTokenMint(conn);

        txHash = await sendSGORTokens(
          new PublicKey(releaseEscrow.sellerSolanaAddress),
          new PublicKey(releaseEscrow.buyerSolanaAddress),
          netAmount
        );
        txChain = 'solana';
      }

      // Verify on-chain
      const verification = await verifyTransaction(txHash, txChain);
      if (!verification.confirmed) {
        throw new Error('Release transaction failed on-chain.');
      }

      // Complete the trade in Firebase
      await completeTrade(releaseEscrow.id, releaseEscrow, txHash, txChain);

      setSuccess(`Trade completed! TX: ${txHash.slice(0, 16)}...`);
      setReleaseEscrow(null);
      // Refresh history
      if (address) getTradeHistory(address).then(setHistory);
    } catch (err: any) {
      setError(err.message || 'Release failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- CANCEL ESCROW ---
  const handleCancelEscrow = async (escrow: EscrowRecord) => {
    clearMessages();
    setIsProcessing(true);
    try {
      await cancelEscrow(escrow.id, escrow.orderId);
      setSuccess('Escrow cancelled. Order re-listed.');
    } catch (err: any) {
      setError(err.message || 'Cancel failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- CANCEL ORDER ---
  const handleCancelOrder = async (orderId: string) => {
    clearMessages();
    setIsProcessing(true);
    try {
      await cancelBridgeOrder(orderId);
      setSuccess('Order cancelled.');
    } catch (err: any) {
      setError(err.message || 'Cancel failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if current wallet is the seller of an escrow
  const isSeller = useCallback((escrow: EscrowRecord) => {
    return address === escrow.sellerSolanaAddress || address === escrow.sellerGorbaganaAddress;
  }, [address]);

  // --- STYLING ---
  const btnClass = (active: boolean) =>
    `px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-all duration-200 ${
      active
        ? 'bg-magic-green text-black border-magic-green'
        : 'text-gray-400 border-white/10 hover:border-white/40 hover:text-white'
    }`;

  const inputClass = 'w-full bg-black border border-white/20 p-3 text-sm outline-none focus:border-magic-green font-mono';

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
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
                P2P bridge between Solana (sGOR) and Gorbagana (gGOR).
                1:1 rate. 5% flat fee to platform. All transactions on-chain.
              </p>
              <div className="mt-2 text-[10px] text-gray-600 font-mono">
                sGOR MINT: {SGOR_TOKEN_MINT.toBase58()}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-px bg-white/20 border border-white/20 w-full md:w-auto">
              <div className="bg-black p-4">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Active_Offers</div>
                <div className="text-magic-green font-bold text-xl">{stats.activeOffers}</div>
              </div>
              <div className="bg-black p-4">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Total_Volume</div>
                <div className="text-white font-bold text-xl">{stats.totalVolume.toLocaleString()} G</div>
              </div>
              <div className="bg-black p-4">
                <div className="text-gray-500 text-[10px] uppercase font-bold mb-1">Trades</div>
                <div className="text-white font-bold text-xl">{stats.completedTrades}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="max-w-[1600px] mx-auto px-4 pt-4">
          <div className="bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-red-400">{error}</div>
            <button onClick={() => setError(null)} className="text-red-500 text-xs">DISMISS</button>
          </div>
        </div>
      )}
      {success && (
        <div className="max-w-[1600px] mx-auto px-4 pt-4">
          <div className="bg-magic-green/10 border border-magic-green/30 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-magic-green shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-magic-green font-mono break-all">{success}</div>
            <button onClick={() => setSuccess(null)} className="text-magic-green text-xs">DISMISS</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
          <button onClick={() => setViewMode('trade')} className={btnClass(viewMode === 'trade')}>
            <Activity className="w-3 h-3 inline mr-2" /> Market
          </button>
          <button onClick={() => setViewMode('create')} className={btnClass(viewMode === 'create')}>
            <Plus className="w-3 h-3 inline mr-2" /> Create_Offer
          </button>
          <button onClick={() => setViewMode('escrow')} className={btnClass(viewMode === 'escrow')}>
            <ShieldCheck className="w-3 h-3 inline mr-2" /> Escrows ({escrows.length})
          </button>
          <button onClick={() => setViewMode('history')} className={btnClass(viewMode === 'history')}>
            <History className="w-3 h-3 inline mr-2" /> History
          </button>
        </div>

        {/* ===== MARKET VIEW ===== */}
        {viewMode === 'trade' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(['all', 'gGOR', 'sGOR'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-[10px] border ${
                      filter === f ? 'border-magic-green text-magic-green' : 'border-white/10 text-gray-500'
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">Live_Orders &bull; 5% Bridge Fee</div>
            </div>

            <div className="overflow-x-auto border border-white/10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-[10px] uppercase text-gray-500 border-b border-white/10">
                    <th className="p-4 font-bold">Seller</th>
                    <th className="p-4 font-bold">Selling</th>
                    <th className="p-4 font-bold">Amount</th>
                    <th className="p-4 font-bold">You Receive</th>
                    <th className="p-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-gray-500">
                        NO_ACTIVE_ORDERS
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const fee = calculateBridgeFee(order.amount);
                      const isOwnOrder = address === order.seller ||
                        address === order.sellerSolanaAddress ||
                        address === order.sellerGorbaganaAddress;
                      return (
                        <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-magic-green font-mono text-xs">{formatAddr(order.seller)}</td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold ${
                                order.sellToken === 'gGOR'
                                  ? 'bg-orange-500/20 text-orange-400'
                                  : 'bg-purple-500/20 text-purple-400'
                              }`}
                            >
                              {order.sellToken}
                            </span>
                          </td>
                          <td className="p-4 font-bold">
                            {order.amount.toLocaleString()} {order.sellToken}
                          </td>
                          <td className="p-4 text-magic-green">
                            {fee.netAmount.toLocaleString()} {order.sellToken}
                          </td>
                          <td className="p-4 text-right">
                            {isOwnOrder ? (
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={isProcessing}
                                className="px-4 py-1 border border-red-500/50 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors disabled:opacity-50"
                              >
                                CANCEL
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  clearMessages();
                                  if (!connected) { setError('Connect your wallet first'); return; }
                                  setSelectedOrder(order);
                                }}
                                disabled={isProcessing}
                                className="px-4 py-1 bg-magic-green text-black text-xs font-bold hover:bg-white transition-colors disabled:opacity-50"
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

        {/* ===== CREATE OFFER VIEW ===== */}
        {viewMode === 'create' && (
          <div className="max-w-xl mx-auto border border-white/10 p-8 bg-white/5">
            <h2 className="text-xl font-bold mb-6 uppercase tracking-widest">Create_P2P_Offer</h2>
            {!connected ? (
              <div className="text-center py-8 text-gray-500">Connect your wallet to create an offer.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-1">I want to sell</label>
                  <select
                    value={createSellToken}
                    onChange={(e) => setCreateSellToken(e.target.value as 'gGOR' | 'sGOR')}
                    className={inputClass}
                  >
                    <option value="gGOR">gGOR (Gorbagana Native)</option>
                    <option value="sGOR">sGOR (Solana SPL Token)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-1">Amount</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-1">Your Solana Address (for sGOR)</label>
                  <input
                    type="text"
                    placeholder="Solana public key..."
                    value={createSolanaAddr}
                    onChange={(e) => setCreateSolanaAddr(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-1">Your Gorbagana Address (for gGOR)</label>
                  <input
                    type="text"
                    placeholder="Gorbagana public key..."
                    value={createGorbaganaAddr}
                    onChange={(e) => setCreateGorbaganaAddr(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {createAmount && parseFloat(createAmount) > 0 && (() => {
                  const fb = calculateBridgeFee(parseFloat(createAmount));
                  const otherToken = createSellToken === 'gGOR' ? 'sGOR' : 'gGOR';
                  return (
                    <div className="p-4 bg-white/5 border border-white/10 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Listed amount:</span>
                        <span>{fb.grossAmount.toLocaleString()} {createSellToken}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Buyer pays (total):</span>
                        <span>{fb.grossAmount.toLocaleString()} {otherToken}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">You receive from buyer:</span>
                        <span>{fb.netAmount.toLocaleString()} {otherToken}</span>
                      </div>
                      <div className="flex justify-between text-red-400">
                        <span>Platform fee (5%):</span>
                        <span>{fb.fee.toLocaleString()} {otherToken}</span>
                      </div>
                      <div className="flex justify-between text-magic-green">
                        <span>Both sides exchange:</span>
                        <span>{fb.netAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="p-4 bg-magic-green/10 border border-magic-green/20">
                  <div className="flex gap-2 text-magic-green text-xs">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>
                      Your offer will be listed publicly. When a buyer accepts,
                      they pay the full amount (5% fee goes to platform, rest to you).
                      You then send the net amount of {createSellToken} to the buyer to complete the trade.
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCreateOffer}
                  disabled={isProcessing}
                  className="w-full py-4 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'POSTING...' : 'POST_OFFER'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== ESCROW VIEW ===== */}
        {viewMode === 'escrow' && (
          <div className="space-y-6">
            {!connected ? (
              <div className="text-center py-20 border border-dashed border-white/10 text-gray-500">
                CONNECT_WALLET_TO_VIEW_ESCROWS
              </div>
            ) : escrows.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/10 text-gray-500">
                NO_ACTIVE_ESCROWS
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {escrows.map((escrow) => {
                  const isSellerSide = isSeller(escrow);
                  const needsRelease = isSellerSide && escrow.status === 'buyer_deposited';

                  return (
                    <div key={escrow.id} className="border border-white/10 p-6 bg-white/5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-[10px] text-gray-500 uppercase mb-1">
                            Escrow: {escrow.id.slice(0, 8)}...
                          </div>
                          <div className="text-lg font-bold">
                            {escrow.amount.toLocaleString()} {escrow.sellToken}
                          </div>
                        </div>
                        <div
                          className={`px-2 py-1 text-[10px] font-bold ${
                            escrow.status === 'completed'
                              ? 'bg-magic-green text-black'
                              : 'bg-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          {escrow.status.toUpperCase().replace('_', ' ')}
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-gray-400 mb-4">
                        <div className="flex justify-between">
                          <span>Fee (5%):</span>
                          <span>{escrow.feeAmount} {escrow.sellToken}</span>
                        </div>
                        <div className="flex justify-between text-magic-green">
                          <span>Net to buyer:</span>
                          <span>{escrow.netAmount} {escrow.sellToken}</span>
                        </div>
                        {escrow.buyerTxHash && (
                          <div className="flex justify-between">
                            <span>Buyer TX:</span>
                            <a
                              href={
                                escrow.buyerTxChain === 'solana'
                                  ? `https://solscan.io/tx/${escrow.buyerTxHash}`
                                  : getExplorerLink('tx', escrow.buyerTxHash)
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-magic-green hover:underline flex items-center gap-1"
                            >
                              {escrow.buyerTxHash.slice(0, 12)}...
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {escrow.sellerTxHash && (
                          <div className="flex justify-between">
                            <span>Seller TX:</span>
                            <a
                              href={
                                escrow.sellerTxChain === 'solana'
                                  ? `https://solscan.io/tx/${escrow.sellerTxHash}`
                                  : getExplorerLink('tx', escrow.sellerTxHash)
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-magic-green hover:underline flex items-center gap-1"
                            >
                              {escrow.sellerTxHash.slice(0, 12)}...
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="w-full bg-white/10 h-1 mb-4">
                        <div
                          className={`h-full bg-magic-green transition-all duration-500 ${
                            escrow.status === 'completed' ? 'w-full' : 'w-1/2'
                          }`}
                        />
                      </div>

                      <div className="flex gap-2">
                        {needsRelease && (
                          <button
                            onClick={() => { clearMessages(); setReleaseEscrow(escrow); }}
                            disabled={isProcessing}
                            className="flex-1 py-2 bg-magic-green text-black text-xs font-bold hover:bg-white transition-colors disabled:opacity-50"
                          >
                            RELEASE_FUNDS
                          </button>
                        )}
                        {escrow.status === 'buyer_deposited' && (
                          <button
                            onClick={() => handleCancelEscrow(escrow)}
                            disabled={isProcessing}
                            className="py-2 px-3 border border-red-500/50 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            CANCEL
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== HISTORY VIEW ===== */}
        {viewMode === 'history' && (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-[10px] uppercase text-gray-500 border-b border-white/10">
                  <th className="p-4 font-bold">Date</th>
                  <th className="p-4 font-bold">Pair</th>
                  <th className="p-4 font-bold">Amount</th>
                  <th className="p-4 font-bold">Fee</th>
                  <th className="p-4 font-bold">Net</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold text-right">TX</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-gray-500">
                      {connected ? 'NO_HISTORY_FOUND' : 'CONNECT_WALLET_TO_VIEW_HISTORY'}
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="p-4 text-gray-400 text-xs">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-xs">
                        <span className="text-orange-400">{item.sellToken}</span>
                        <span className="text-gray-600 mx-1">/</span>
                        <span className="text-purple-400">{item.buyToken}</span>
                      </td>
                      <td className="p-4 font-bold">{item.amount.toLocaleString()}</td>
                      <td className="p-4 text-red-400 text-xs">{item.feeAmount}</td>
                      <td className="p-4 text-magic-green">{item.netAmount.toLocaleString()}</td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-xs">
                          <CheckCircle2 className="w-3 h-3 text-magic-green" /> {item.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {item.sellerTxHash && (
                          <a
                            href={`https://solscan.io/tx/${item.sellerTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 hover:text-magic-green flex items-center gap-1 justify-end"
                          >
                            {item.sellerTxHash.slice(0, 10)}...
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== TRADE CONFIRMATION MODAL ===== */}
      {selectedOrder && feeBreakdown && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={() => !isProcessing && setSelectedOrder(null)}
          />
          <div className="relative bg-magic-dark border border-magic-green/30 p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 uppercase tracking-widest">Confirm_Trade</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">You Send (total)</span>
                <span className="font-bold">
                  {selectedOrder.amount.toLocaleString()} {selectedOrder.buyToken}
                </span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2 pl-4">
                <span className="text-gray-600">to Seller</span>
                <span>{feeBreakdown.netAmount.toLocaleString()} {selectedOrder.buyToken}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2 pl-4">
                <span className="text-gray-600">to Platform (5% fee)</span>
                <span className="text-red-400">{feeBreakdown.fee.toLocaleString()} {selectedOrder.buyToken}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">You Receive</span>
                <span className="font-bold text-magic-green">
                  {feeBreakdown.netAmount.toLocaleString()} {selectedOrder.sellToken}
                </span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">Seller</span>
                <span className="text-xs font-mono">{formatAddr(selectedOrder.seller)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fee Wallet</span>
                <span className="text-xs font-mono">{formatAddr(PLATFORM_FEE_WALLET.toBase58())}</span>
              </div>
            </div>

            {/* Buyer address inputs */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">Your Solana Address</label>
                <input
                  type="text"
                  value={buyerSolanaAddr}
                  onChange={(e) => setBuyerSolanaAddr(e.target.value)}
                  placeholder="Solana public key..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">Your Gorbagana Address</label>
                <input
                  type="text"
                  value={buyerGorbaganaAddr}
                  onChange={(e) => setBuyerGorbaganaAddr(e.target.value)}
                  placeholder="Gorbagana public key..."
                  className={inputClass}
                />
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 mb-6 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
              <p className="text-[10px] text-yellow-500 leading-relaxed">
                This is a real cross-chain P2P trade. Your wallet will sign one atomic transaction
                that sends {feeBreakdown.netAmount} {selectedOrder.buyToken} to the seller
                and {feeBreakdown.fee} {selectedOrder.buyToken} (5% fee) to the platform wallet.
                The seller must then release {feeBreakdown.netAmount} {selectedOrder.sellToken} to you.
                sGOR mint ({SGOR_TOKEN_MINT.toBase58().slice(0, 8)}...) verified before every deposit.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                disabled={isProcessing}
                onClick={() => setSelectedOrder(null)}
                className="flex-1 py-3 border border-white/20 text-gray-400 font-bold uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                disabled={isProcessing}
                onClick={handleBuyerDeposit}
                className="flex-1 py-3 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
                ) : (
                  'SEND & LOCK'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== SELLER RELEASE MODAL ===== */}
      {releaseEscrow && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={() => !isProcessing && setReleaseEscrow(null)}
          />
          <div className="relative bg-magic-dark border border-magic-green/30 p-8 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-6 uppercase tracking-widest">Release_Funds</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">Trade Amount</span>
                <span>{releaseEscrow.amount.toLocaleString()} {releaseEscrow.sellToken}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">Platform Fee (paid by buyer)</span>
                <span className="text-gray-500">{releaseEscrow.feeAmount} {releaseEscrow.buyToken}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">You Received from Buyer</span>
                <span>{releaseEscrow.netAmount.toLocaleString()} {releaseEscrow.buyToken}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-white/10 pb-2">
                <span className="text-gray-500">You Send to Buyer</span>
                <span className="font-bold text-magic-green">{releaseEscrow.netAmount.toLocaleString()} {releaseEscrow.sellToken}</span>
              </div>
              {releaseEscrow.buyerTxHash && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Buyer's TX</span>
                  <a
                    href={
                      releaseEscrow.buyerTxChain === 'solana'
                        ? `https://solscan.io/tx/${releaseEscrow.buyerTxHash}`
                        : getExplorerLink('tx', releaseEscrow.buyerTxHash)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-magic-green text-xs flex items-center gap-1"
                  >
                    {releaseEscrow.buyerTxHash.slice(0, 16)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 mb-6 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
              <p className="text-[10px] text-yellow-500 leading-relaxed">
                Verify the buyer's deposit before releasing. The buyer already paid the 5% platform fee.
                Your wallet will sign a transaction to send {releaseEscrow.netAmount} {releaseEscrow.sellToken} to the buyer.
                Both sides exchange the same net amount.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                disabled={isProcessing}
                onClick={() => setReleaseEscrow(null)}
                className="flex-1 py-3 border border-white/20 text-gray-400 font-bold uppercase tracking-widest hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                disabled={isProcessing}
                onClick={handleSellerRelease}
                className="flex-1 py-3 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin" />
                ) : (
                  'RELEASE'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bridge;
