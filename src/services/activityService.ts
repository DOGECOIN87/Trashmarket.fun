/**
 * Live Activity Feed Service
 *
 * Aggregates real events from all dapp sources into a unified activity feed
 * for the bottom ActivityTicker marquee.
 *
 * Sources:
 *  1. Gorid marketplace — domain listings & sales (Trading API, polled)
 *  2. Gorbagio NFT marketplace — listings & sales (Firestore, real-time)
 *  3. Gorid on-chain listings (Gorbagana program accounts, polled)
 */

import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { fetchListings, fetchRecentSales } from './marketplace-service';
import type { MarketplaceListing, MarketplaceSale } from './marketplace-service';

// ─── Types ──────────────────────────────────────────────────────────────

export type ActivityType = 'SALE' | 'LIST' | 'DELIST' | 'OFFER' | 'MINT' | 'DEPOSIT' | 'WIN';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  text: string;
  timestamp: number; // ms since epoch
  source: 'gorid' | 'gorbagio' | 'game';
}

// ─── Game Event Emitter ─────────────────────────────────────────────────
// Games call pushGameEvent() to inject wins/deposits into the live feed.

type GameEventListener = (item: ActivityItem) => void;
const gameListeners = new Set<GameEventListener>();
let gameEventCounter = 0;

function subscribeToGameEvents(listener: GameEventListener): () => void {
  gameListeners.add(listener);
  return () => gameListeners.delete(listener);
}

/**
 * Push a game event into the live activity feed.
 * Call this from any game component when a notable event occurs.
 */
export function pushGameEvent(
  type: ActivityType,
  text: string,
): void {
  const item: ActivityItem = {
    id: `game-${++gameEventCounter}-${Date.now()}`,
    type,
    text,
    timestamp: Date.now(),
    source: 'game',
  };
  gameListeners.forEach((fn) => fn(item));
}

// ─── Gorid Marketplace (Trading API — polled) ───────────────────────────

async function fetchGoridActivity(): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];

  try {
    const [listings, sales] = await Promise.all([
      fetchListings(),
      fetchRecentSales(),
    ]);

    for (const listing of listings) {
      const label = listing.domainName || shortenAddress(listing.domainMint);
      items.push({
        id: `gorid-list-${listing.id}`,
        type: 'LIST',
        text: `${label} listed for ${listing.price.toFixed(1)} G`,
        timestamp: listing.listedAt || Date.now(),
        source: 'gorid',
      });
    }

    for (const sale of sales) {
      const label = sale.domainName || shortenAddress(sale.domainMint);
      items.push({
        id: `gorid-sale-${sale.id}`,
        type: 'SALE',
        text: `${label} sold for ${sale.price.toFixed(1)} G`,
        timestamp: sale.timestamp || Date.now(),
        source: 'gorid',
      });
    }
  } catch (err) {
    console.warn('[ActivityService] Gorid fetch failed:', err);
  }

  return items;
}

// ─── Gorbagio NFT Marketplace (Firestore — real-time) ───────────────────

function subscribeToGorbagioActivity(
  callback: (items: ActivityItem[]) => void,
): () => void {
  // Active listings
  const listingsQuery = query(
    collection(db, 'gorbagio_listings'),
    where('active', '==', true),
    orderBy('listedAt', 'desc'),
    limit(20),
  );

  // Recent sold listings
  const salesQuery = query(
    collection(db, 'gorbagio_listings'),
    where('active', '==', false),
    orderBy('soldAt', 'desc'),
    limit(20),
  );

  let listingItems: ActivityItem[] = [];
  let saleItems: ActivityItem[] = [];

  const emitCombined = () => callback([...listingItems, ...saleItems]);

  const unsubListings = onSnapshot(
    listingsQuery,
    (snapshot) => {
      listingItems = snapshot.docs.map((doc) => {
        const data = doc.data();
        const name = data.name || shortenAddress(data.mintAddress);
        const ts = data.listedAt instanceof Timestamp
          ? data.listedAt.toMillis()
          : Date.now();
        return {
          id: `gorbagio-list-${doc.id}`,
          type: 'LIST' as ActivityType,
          text: `${name} listed for ${data.priceSol} SOL`,
          timestamp: ts,
          source: 'gorbagio' as const,
        };
      });
      emitCombined();
    },
    (err) => console.warn('[ActivityService] Gorbagio listings snapshot error:', err),
  );

  const unsubSales = onSnapshot(
    salesQuery,
    (snapshot) => {
      saleItems = snapshot.docs.map((doc) => {
        const data = doc.data();
        const name = data.name || shortenAddress(data.mintAddress);
        const buyer = shortenAddress(data.soldTo || '');
        const ts = data.soldAt instanceof Timestamp
          ? data.soldAt.toMillis()
          : Date.now();
        return {
          id: `gorbagio-sale-${doc.id}`,
          type: 'SALE' as ActivityType,
          text: `${name} sold for ${data.priceSol} SOL`,
          timestamp: ts,
          source: 'gorbagio' as const,
        };
      });
      emitCombined();
    },
    (err) => console.warn('[ActivityService] Gorbagio sales snapshot error:', err),
  );

  return () => {
    unsubListings();
    unsubSales();
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 8) return addr || '???';
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ─── Combined Feed ──────────────────────────────────────────────────────

export interface ActivityFeedOptions {
  /** Polling interval for non-realtime sources (ms). Default: 30000 */
  pollInterval?: number;
  /** Max items to keep in the feed. Default: 30 */
  maxItems?: number;
}

/**
 * Subscribe to the unified live activity feed.
 * Returns an unsubscribe function.
 *
 * @param callback - Called with sorted activity items whenever data changes
 */
export function subscribeToActivityFeed(
  callback: (items: ActivityItem[]) => void,
  options: ActivityFeedOptions = {},
): () => void {
  const { pollInterval = 30000, maxItems = 30 } = options;

  let goridItems: ActivityItem[] = [];
  let gorbagioItems: ActivityItem[] = [];
  let gameItems: ActivityItem[] = [];
  let destroyed = false;

  const emit = () => {
    const all = [...goridItems, ...gorbagioItems, ...gameItems]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxItems);
    callback(all);
  };

  // 1. Gorbagio real-time (Firestore)
  const unsubGorbagio = subscribeToGorbagioActivity((items) => {
    gorbagioItems = items;
    emit();
  });

  // 2. Game events (wins, deposits — pushed from game components)
  const unsubGame = subscribeToGameEvents((item) => {
    // Keep last 20 game events, drop oldest
    gameItems = [item, ...gameItems].slice(0, 20);
    emit();
  });

  // 3. Gorid polled
  const pollGorid = async () => {
    if (destroyed) return;
    goridItems = await fetchGoridActivity();
    emit();
  };

  pollGorid(); // initial
  const intervalId = setInterval(pollGorid, pollInterval);

  return () => {
    destroyed = true;
    clearInterval(intervalId);
    unsubGorbagio();
    unsubGame();
  };
}

export { timeAgo };
