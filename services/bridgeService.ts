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
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase.config';

// --- TYPES ---
export interface BridgeOrder {
  id: string;
  seller: string;
  sellToken: 'gGOR' | 'sGOR';
  buyToken: 'gGOR' | 'sGOR';
  amount: number;
  status: 'active' | 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  requiredWallet: string;
  sellerWallet: string;
}

export interface EscrowRecord {
  id: string;
  orderId: string;
  buyerAddress: string;
  sellerAddress: string;
  amount: number;
  token: 'gGOR' | 'sGOR';
  status: 'locking' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  lockTx?: string;
  verifyTx?: string;
  settleTx?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TradeHistory {
  id: string;
  escrowId: string;
  buyerAddress: string;
  sellerAddress: string;
  type: 'BUY' | 'SELL';
  amount: number;
  token: 'gGOR' | 'sGOR';
  status: 'completed' | 'failed';
  txHash: string;
  timestamp: string;
}

// --- CONSTANTS ---
const ORDERS_COLLECTION = 'bridge_orders';
const ESCROWS_COLLECTION = 'bridge_escrows';
const HISTORY_COLLECTION = 'bridge_history';
const ORDER_EXPIRY_HOURS = 24;

// --- ORDER MANAGEMENT ---

/**
 * Create a new P2P bridge order
 */
export const createBridgeOrder = async (
  seller: string,
  sellToken: 'gGOR' | 'sGOR',
  buyToken: 'gGOR' | 'sGOR',
  amount: number,
  requiredWallet: string
): Promise<string> => {
  try {
    if (amount <= 0) throw new Error('Amount must be greater than 0');
    if (sellToken === buyToken) throw new Error('Cannot trade same token');
    if (!seller) throw new Error('Seller address required');

    const order: Omit<BridgeOrder, 'id'> = {
      seller,
      sellToken,
      buyToken,
      amount,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requiredWallet,
      sellerWallet: seller
    };

    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), {
      ...order,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating bridge order:', error);
    throw error;
  }
};

/**
 * Get all active orders with optional filtering
 */
export const getActiveOrders = async (filter?: 'gGOR' | 'sGOR'): Promise<BridgeOrder[]> => {
  try {
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
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BridgeOrder[];
  } catch (error) {
    console.error('Error fetching active orders:', error);
    return [];
  }
};

/**
 * Get orders by seller address
 */
export const getSellerOrders = async (seller: string): Promise<BridgeOrder[]> => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      where('seller', '==', seller),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BridgeOrder[];
  } catch (error) {
    console.error('Error fetching seller orders:', error);
    return [];
  }
};

/**
 * Cancel an order
 */
export const cancelBridgeOrder = async (orderId: string): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
};

// --- ESCROW MANAGEMENT ---

/**
 * Create an escrow record for a trade
 */
export const createEscrow = async (
  orderId: string,
  buyerAddress: string,
  sellerAddress: string,
  amount: number,
  token: 'gGOR' | 'sGOR'
): Promise<string> => {
  try {
    const escrow: Omit<EscrowRecord, 'id'> = {
      orderId,
      buyerAddress,
      sellerAddress,
      amount,
      token,
      status: 'locking',
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, ESCROWS_COLLECTION), {
      ...escrow,
      createdAt: Timestamp.now()
    });

    // Mark order as pending
    await updateDoc(doc(db, ORDERS_COLLECTION, orderId), {
      status: 'pending',
      updatedAt: Timestamp.now()
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating escrow:', error);
    throw error;
  }
};

/**
 * Update escrow status with transaction hash
 */
export const updateEscrowStatus = async (
  escrowId: string,
  status: EscrowRecord['status'],
  txHash?: string
): Promise<void> => {
  try {
    const updates: any = {
      status,
      updatedAt: Timestamp.now()
    };

    if (status === 'locking' && txHash) updates.lockTx = txHash;
    if (status === 'verifying' && txHash) updates.verifyTx = txHash;
    if (status === 'completed' && txHash) {
      updates.settleTx = txHash;
      updates.completedAt = Timestamp.now();
    }

    await updateDoc(doc(db, ESCROWS_COLLECTION, escrowId), updates);
  } catch (error) {
    console.error('Error updating escrow:', error);
    throw error;
  }
};

/**
 * Get active escrows for an address
 */
export const getActiveEscrows = async (address: string): Promise<EscrowRecord[]> => {
  try {
    const q = query(
      collection(db, ESCROWS_COLLECTION),
      where('status', 'in', ['locking', 'verifying']),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EscrowRecord[]
      .filter(e => e.buyerAddress === address || e.sellerAddress === address);
  } catch (error) {
    console.error('Error fetching active escrows:', error);
    return [];
  }
};

// --- HISTORY & ANALYTICS ---

/**
 * Record a completed trade in history
 */
export const recordTradeHistory = async (
  escrowId: string,
  buyerAddress: string,
  sellerAddress: string,
  type: 'BUY' | 'SELL',
  amount: number,
  token: 'gGOR' | 'sGOR',
  txHash: string
): Promise<void> => {
  try {
    const history: Omit<TradeHistory, 'id'> = {
      escrowId,
      buyerAddress,
      sellerAddress,
      type,
      amount,
      token,
      status: 'completed',
      txHash,
      timestamp: new Date().toISOString()
    };

    await addDoc(collection(db, HISTORY_COLLECTION), {
      ...history,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error recording trade history:', error);
    throw error;
  }
};

/**
 * Get trade history for an address
 */
export const getTradeHistory = async (address: string, limit_: number = 50): Promise<TradeHistory[]> => {
  try {
    const q = query(
      collection(db, HISTORY_COLLECTION),
      where('status', '==', 'completed'),
      orderBy('timestamp', 'desc'),
      limit(limit_)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TradeHistory[]
      .filter(h => h.buyerAddress === address || h.sellerAddress === address);
  } catch (error) {
    console.error('Error fetching trade history:', error);
    return [];
  }
};

/**
 * Get bridge statistics
 */
export const getBridgeStats = async () => {
  try {
    const ordersSnapshot = await getDocs(collection(db, ORDERS_COLLECTION));
    const escrowsSnapshot = await getDocs(collection(db, ESCROWS_COLLECTION));
    const historySnapshot = await getDocs(collection(db, HISTORY_COLLECTION));

    const orders = ordersSnapshot.docs.map(d => d.data()) as BridgeOrder[];
    const escrows = escrowsSnapshot.docs.map(d => d.data()) as EscrowRecord[];
    const history = historySnapshot.docs.map(d => d.data()) as TradeHistory[];

    const totalVolume = history.reduce((sum, h) => sum + h.amount, 0);
    const completedTrades = history.filter(h => h.status === 'completed').length;
    const activeOffers = orders.filter(o => o.status === 'active').length;

    return {
      activeOffers,
      totalVolume,
      completedTrades,
      totalEscrows: escrows.length,
      avgTradeSize: completedTrades > 0 ? totalVolume / completedTrades : 0
    };
  } catch (error) {
    console.error('Error getting bridge stats:', error);
    return {
      activeOffers: 0,
      totalVolume: 0,
      completedTrades: 0,
      totalEscrows: 0,
      avgTradeSize: 0
    };
  }
};

// --- REAL-TIME SUBSCRIPTIONS ---

/**
 * Subscribe to active orders in real-time
 */
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
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as BridgeOrder[];
    callback(orders);
  });
};

/**
 * Subscribe to escrow updates
 */
export const subscribeToEscrows = (
  address: string,
  callback: (escrows: EscrowRecord[]) => void
) => {
  const q = query(
    collection(db, ESCROWS_COLLECTION),
    where('status', 'in', ['locking', 'verifying']),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const escrows = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EscrowRecord[]
      .filter(e => e.buyerAddress === address || e.sellerAddress === address);
    callback(escrows);
  });
};

export default {
  createBridgeOrder,
  getActiveOrders,
  getSellerOrders,
  cancelBridgeOrder,
  createEscrow,
  updateEscrowStatus,
  getActiveEscrows,
  recordTradeHistory,
  getTradeHistory,
  getBridgeStats,
  subscribeToActiveOrders,
  subscribeToEscrows
};
