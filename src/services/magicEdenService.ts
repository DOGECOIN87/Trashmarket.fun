/**
 * NFT Collection Service
 *
 * Uses local mock data as primary source.
 * Tensor API is NOT called directly from the browser (CORS blocked).
 * If live data is needed in the future, route through a backend proxy.
 */
import { Collection, NFT, ActivityItem } from '../types';
import { MOCK_COLLECTIONS, MOCK_NFTS } from '../constants';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get a single collection by symbol/slug.
 * Uses MOCK_COLLECTIONS as the data source.
 */
export const getCollection = async (symbol: string): Promise<Collection> => {
  const mock = MOCK_COLLECTIONS.find((c) => c.id === symbol);
  if (mock) return mock;
  throw new Error(`Collection ${symbol} not found`);
};

/**
 * Get top collections sorted by volume.
 * Uses MOCK_COLLECTIONS as the data source.
 */
export const getTopCollections = async (limit = 5): Promise<Collection[]> => {
  return MOCK_COLLECTIONS.slice(0, limit);
};

/**
 * Get tokens/NFTs in a collection.
 * Uses MOCK_NFTS as the data source.
 */
export const getCollectionTokens = async (
  symbol: string,
  offset = 0,
  limit = 20,
): Promise<NFT[]> => {
  const mockNfts = MOCK_NFTS[symbol] || [];
  return mockNfts.slice(offset, offset + limit);
};

/**
 * Get collection activity (sales, listings).
 * Returns empty array — activity is non-critical and requires live API.
 */
export const getCollectionActivities = async (
  _symbol: string,
  _offset = 0,
  _limit = 20,
): Promise<ActivityItem[]> => {
  return [];
};
