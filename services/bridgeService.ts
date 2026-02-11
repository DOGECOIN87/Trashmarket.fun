import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { BRIDGE_FEE_RATE } from './bridgeTransactionService';

// --- TYPES ---
export interface BridgeOrder {
  id: string;
  /** Address of the seller on the chain of the token being sold */
  seller: string;
  /** Token being sold */
  sellToken: 'gGOR' | 'sGOR';
  /** Token being received */
  buyToken: 'gGOR' | 'sGOR';
  /** Amount of sellToken offered */
  amount: number;
  /** Order status */
  status: 'active' | 'pending' | 'completed' | 'cancelled';
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Seller's Solana wallet address (for receiving sGOR or sending sGOR) */
  sellerSolanaAddress: string;
  /** Seller's Gorbagana wallet address (for receiving gGOR or sending gGOR) */
  sellerGorbaganaAddress: string;
}

export interface EscrowRecord {
  id: string;
  orderId: string;
  /** Buyer's Solana wallet address */
  buyerSolanaAddress: string;
  /** Buyer's Gorbagana wallet address */
  buyerGorbaganaAddress: string;
  /** Seller's Solana wallet address */
  sellerSolanaAddress: string;
  /** Seller's Gorbagana wallet address */
  sellerGorbaganaAddress: string;
  /** Gross amount of the trade */
  amount: number;
  /** 5% fee amount */
  feeAmount: number;
  /** Net amount buyer receives (amount - fee) */
  netAmount: number;
  /** Token being traded */
  sellToken: 'gGOR' | 'sGOR';
  buyToken: 'gGOR' | 'sGOR';
  /** Escrow status */
  status: 'buyer_deposited' | 'seller_released' | 'completed' | 'failed' | 'cancelled';
  /** Buyer's deposit transaction hash */
  buyerTxHash?: string;
  /** Chain of buyer's deposit */
  buyerTxChain?: 'solana' | 'gorbagana';
  /** Seller's release transaction hash */
  sellerTxHash?: string;
  /** Chain of seller's release */
  sellerTxChain?: 'solana' | 'gorbagana';
  /** ISO timestamp */
  createdAt: string;
  completedAt?: string;
}

export interface TradeHistory {
  id: string;
  escrowId: string;
  buyerSolanaAddress: string;
  buyerGorbaganaAddress: string;
  sellerSolanaAddress: string;
  sellerGorbaganaAddress: string;
  sellToken: 'gGOR' | 'sGOR';
  buyToken: 'gGOR' | 'sGOR';
  amount: number;
  feeAmount: number;
  netAmount: number;
  buyerTxHash: string;
  sellerTxHash: string;
  status: 'completed' | 'failed';
  timestamp: string;
}

// --- CONSTANTS ---
const ORDERS_COLLECTION = 'bridge_orders';
const ESCROWS_COLLECTION = 'bridge_escrows';
const HISTORY_COLLECTION = 'bridge_history';

// --- ORDER MANAGEMENT ---

export const createBridgeOrder = async (
  sellToken: 'gGOR' | 'sGOR',
  amount: number,
  sellerSolanaAddress: string,
  sellerGorbaganaAddress: string
): Promise<string> => {
  if (amount <= 0) throw new Error('Amount must be greater than 0');
  if (!sellerSolanaAddress) throw new Error('Solana address required');
  if (!sellerGorbaganaAddress) throw new Error('Gorbagana address required');

  const buyToken = sellToken === 'gGOR' ? 'sGOR' : 'gGOR';
  const seller = sellToken === 'gGOR' ? sellerGorbaganaAddress : sellerSolanaAddress;

  const order: Omit<BridgeOrder, 'id'> = {
    seller,
    sellToken,
    buyToken,
    amount,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sellerSolanaAddress,
    sellerGorbaganaAddress,
  };

  const docRef = await addDoc(collection(db, ORDERS_COLLECTION), {
    ...order,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return docRef.id;
};

export const getActiveOrders = async (filter?: 'gGOR' | 'sGOR'): Promise<BridgeOrder[]> => {
  let q = query(
    collection(db, ORDERS_COLLECTION),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  if (filter) {
    q = query(
      collection(db, ORDERS_COLLECTION),
      where('status', '==', 'active'),
      where('sellToken', '==', filter),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as BridgeOrder[];
};

export const getSellerOrders = async (sellerAddress: string): Promise<BridgeOrder[]> => {
  const q = query(
    collection(db, ORDERS_COLLECTION),
    where('seller', '==', sellerAddress),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as BridgeOrder[];
};

export const cancelBridgeOrder = async (orderId: string): Promise<void> => {
  const docRef = doc(db, ORDERS_COLLECTION, orderId);
  await updateDoc(docRef, {
    status: 'cancelled',
    updatedAt: Timestamp.now(),
  });
};

// --- ESCROW MANAGEMENT ---

/**
 * Create an escrow record when a buyer initiates a trade.
 * The 5% fee is calculated and recorded.
 */
export const createEscrow = async (
  orderId: string,
  buyerSolanaAddress: string,
  buyerGorbaganaAddress: string,
  sellerSolanaAddress: string,
  sellerGorbaganaAddress: string,
  amount: number,
  sellToken: 'gGOR' | 'sGOR',
  buyerTxHash: string,
  buyerTxChain: 'solana' | 'gorbagana'
): Promise<string> => {
  const feeAmount = parseFloat((amount * BRIDGE_FEE_RATE).toFixed(9));
  const netAmount = parseFloat((amount - feeAmount).toFixed(9));
  const buyToken = sellToken === 'gGOR' ? 'sGOR' : 'gGOR';

  const escrow: Omit<EscrowRecord, 'id'> = {
    orderId,
    buyerSolanaAddress,
    buyerGorbaganaAddress,
    sellerSolanaAddress,
    sellerGorbaganaAddress,
    amount,
    feeAmount,
    netAmount,
    sellToken,
    buyToken,
    status: 'buyer_deposited',
    buyerTxHash,
    buyerTxChain,
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, ESCROWS_COLLECTION), {
    ...escrow,
    createdAt: Timestamp.now(),
  });

  // Mark order as pending
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status: 'pending',
    updatedAt: Timestamp.now(),
  });

  return docRef.id;
};

/**
 * Mark escrow as seller released (seller sent their tokens to buyer).
 */
export const markSellerReleased = async (
  escrowId: string,
  sellerTxHash: string,
  sellerTxChain: 'solana' | 'gorbagana'
): Promise<void> => {
  await updateDoc(doc(db, ESCROWS_COLLECTION, escrowId), {
    status: 'completed',
    sellerTxHash,
    sellerTxChain,
    completedAt: Timestamp.now(),
  });
};

/**
 * Complete the trade: mark escrow as completed and record history.
 */
export const completeTrade = async (
  escrowId: string,
  escrow: EscrowRecord,
  sellerTxHash: string,
  sellerTxChain: 'solana' | 'gorbagana'
): Promise<void> => {
  // Update escrow
  await markSellerReleased(escrowId, sellerTxHash, sellerTxChain);

  // Mark order as completed
  await updateDoc(doc(db, ORDERS_COLLECTION, escrow.orderId), {
    status: 'completed',
    updatedAt: Timestamp.now(),
  });

  // Record trade history
  const history: Omit<TradeHistory, 'id'> = {
    escrowId,
    buyerSolanaAddress: escrow.buyerSolanaAddress,
    buyerGorbaganaAddress: escrow.buyerGorbaganaAddress,
    sellerSolanaAddress: escrow.sellerSolanaAddress,
    sellerGorbaganaAddress: escrow.sellerGorbaganaAddress,
    sellToken: escrow.sellToken,
    buyToken: escrow.buyToken,
    amount: escrow.amount,
    feeAmount: escrow.feeAmount,
    netAmount: escrow.netAmount,
    buyerTxHash: escrow.buyerTxHash || '',
    sellerTxHash,
    status: 'completed',
    timestamp: new Date().toISOString(),
  };

  await addDoc(collection(db, HISTORY_COLLECTION), {
    ...history,
    timestamp: Timestamp.now(),
  });
};

/**
 * Cancel an escrow (e.g., if seller doesn't fulfill).
 */
export const cancelEscrow = async (escrowId: string, orderId: string): Promise<void> => {
  await updateDoc(doc(db, ESCROWS_COLLECTION, escrowId), {
    status: 'cancelled',
  });

  // Re-activate the order so another buyer can take it
  await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
    status: 'active',
    updatedAt: Timestamp.now(),
  });
};

export const getActiveEscrows = async (address: string): Promise<EscrowRecord[]> => {
  const q = query(
    collection(db, ESCROWS_COLLECTION),
    where('status', 'in', ['buyer_deposited', 'seller_released']),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return (
    snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() })) as EscrowRecord[]
  ).filter(
    (e) =>
      e.buyerSolanaAddress === address ||
      e.buyerGorbaganaAddress === address ||
      e.sellerSolanaAddress === address ||
      e.sellerGorbaganaAddress === address
  );
};

// --- HISTORY ---

export const getTradeHistory = async (address: string, limit_: number = 50): Promise<TradeHistory[]> => {
  const q = query(
    collection(db, HISTORY_COLLECTION),
    where('status', '==', 'completed'),
    orderBy('timestamp', 'desc'),
    limit(limit_)
  );

  const snapshot = await getDocs(q);
  return (
    snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() })) as TradeHistory[]
  ).filter(
    (h) =>
      h.buyerSolanaAddress === address ||
      h.buyerGorbaganaAddress === address ||
      h.sellerSolanaAddress === address ||
      h.sellerGorbaganaAddress === address
  );
};

// --- STATS ---

export const getBridgeStats = async () => {
  const ordersSnapshot = await getDocs(collection(db, ORDERS_COLLECTION));
  const historySnapshot = await getDocs(collection(db, HISTORY_COLLECTION));

  const orders = ordersSnapshot.docs.map((d) => d.data()) as BridgeOrder[];
  const history = historySnapshot.docs.map((d) => d.data()) as TradeHistory[];

  const totalVolume = history.reduce((sum, h) => sum + h.amount, 0);
  const completedTrades = history.filter((h) => h.status === 'completed').length;
  const activeOffers = orders.filter((o) => o.status === 'active').length;
  const totalFees = history.reduce((sum, h) => sum + (h.feeAmount || 0), 0);

  return {
    activeOffers,
    totalVolume,
    completedTrades,
    totalFees,
    avgTradeSize: completedTrades > 0 ? totalVolume / completedTrades : 0,
  };
};

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToActiveOrders = (
  callback: (orders: BridgeOrder[]) => void,
  filter?: 'gGOR' | 'sGOR'
) => {
  let q = query(
    collection(db, ORDERS_COLLECTION),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  if (filter) {
    q = query(
      collection(db, ORDERS_COLLECTION),
      where('status', '==', 'active'),
      where('sellToken', '==', filter),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
  }

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as BridgeOrder[];
    callback(orders);
  });
};

export const subscribeToEscrows = (
  address: string,
  callback: (escrows: EscrowRecord[]) => void
) => {
  const q = query(
    collection(db, ESCROWS_COLLECTION),
    where('status', 'in', ['buyer_deposited', 'seller_released']),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const escrows = (
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as EscrowRecord[]
    ).filter(
      (e) =>
        e.buyerSolanaAddress === address ||
        e.buyerGorbaganaAddress === address ||
        e.sellerSolanaAddress === address ||
        e.sellerGorbaganaAddress === address
    );
    callback(escrows);
  });
};
