/**
 * NFT Collection Service
 *
 * Replaces the deprecated Magic Eden API (SEC-03).
 * Uses the Tensor Trade API as primary source with graceful fallback
 * to the local mock data from constants.ts.
 *
 * Tensor API docs: https://docs.tensor.trade
 */
import { Collection, NFT, ActivityItem } from '../types';
import { MOCK_COLLECTIONS, MOCK_NFTS } from '../constants';

const TENSOR_API = 'https://api.tensor.so/graphql';

// ─── Tensor GraphQL helpers ─────────────────────────────────────────────────

async function tensorQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const res = await fetch(TENSOR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

// ─── Public API (same interface as before) ──────────────────────────────────

/**
 * Get a single collection by symbol/slug.
 * Falls back to MOCK_COLLECTIONS if the API call fails.
 */
export const getCollection = async (symbol: string): Promise<Collection> => {
  // Try Tensor first
  const data = await tensorQuery<any>(
    `query GetCollection($slug: String!) {
      instrumentTV2(slug: $slug) {
        slug name description imageUri bannerUri
        statsV2 { currency floor1h floor7d floor30d numListed numMints buyNowPrice sellNowPrice }
      }
    }`,
    { slug: symbol },
  );

  if (data?.instrumentTV2) {
    const c = data.instrumentTV2;
    const stats = c.statsV2 || {};
    return {
      id: c.slug || symbol,
      name: c.name || 'Unknown',
      description: c.description || '',
      image: c.imageUri || '',
      banner: c.bannerUri || c.imageUri || '',
      floorPrice: parseFloat(stats.buyNowPrice || '0') / 1e9,
      totalVolume: 0,
      listedCount: stats.numListed || 0,
      supply: stats.numMints || 0,
      isVerified: true,
      change24h: 0,
    };
  }

  // Fallback to mock
  const mock = MOCK_COLLECTIONS.find((c) => c.id === symbol);
  if (mock) return mock;
  throw new Error(`Collection ${symbol} not found`);
};

/**
 * Get top collections sorted by volume.
 * Falls back to MOCK_COLLECTIONS.
 */
export const getTopCollections = async (limit = 5): Promise<Collection[]> => {
  const data = await tensorQuery<any>(
    `query TopCollections($limit: Int!) {
      allCollections(sortBy: "volume24h", limit: $limit) {
        collections {
          slug name imageUri
          statsV2 { buyNowPrice numListed numMints }
        }
      }
    }`,
    { limit },
  );

  if (data?.allCollections?.collections?.length) {
    return data.allCollections.collections.map((c: any) => {
      const stats = c.statsV2 || {};
      return {
        id: c.slug,
        name: c.name || 'Unknown',
        description: '',
        image: c.imageUri || '',
        banner: c.imageUri || '',
        floorPrice: parseFloat(stats.buyNowPrice || '0') / 1e9,
        totalVolume: 0,
        listedCount: stats.numListed || 0,
        supply: stats.numMints || 0,
        isVerified: true,
        change24h: 0,
      } as Collection;
    });
  }

  // Fallback to mock data
  console.warn('[NFT Service] Tensor API unavailable, using mock data');
  return MOCK_COLLECTIONS.slice(0, limit);
};

/**
 * Get tokens/NFTs in a collection.
 * Falls back to MOCK_NFTS.
 */
export const getCollectionTokens = async (
  symbol: string,
  offset = 0,
  limit = 20,
): Promise<NFT[]> => {
  const data = await tensorQuery<any>(
    `query GetListings($slug: String!, $limit: Int!, $offset: Int!) {
      activeListingsV2(slug: $slug, sortBy: "PriceAsc", limit: $limit, cursor: { offset: $offset }) {
        txs {
          mint { onchainId name imageUri }
          tx { grossAmount }
        }
      }
    }`,
    { slug: symbol, limit, offset },
  );

  if (data?.activeListingsV2?.txs?.length) {
    return data.activeListingsV2.txs.map((item: any) => ({
      id: item.mint?.onchainId || '',
      name: item.mint?.name || 'Unknown',
      image: item.mint?.imageUri || '',
      price: parseFloat(item.tx?.grossAmount || '0') / 1e9,
      collectionId: symbol,
      description: '',
    }));
  }

  // Fallback
  const mockNfts = MOCK_NFTS[symbol] || [];
  return mockNfts.slice(offset, offset + limit);
};

/**
 * Get collection activity (sales, listings).
 * Returns empty array on failure — activity is non-critical.
 */
export const getCollectionActivities = async (
  symbol: string,
  _offset = 0,
  _limit = 20,
): Promise<ActivityItem[]> => {
  const data = await tensorQuery<any>(
    `query GetActivity($slug: String!) {
      recentTransactionsV2(slug: $slug) {
        txs {
          txId txType grossAmount
          mint { onchainId name imageUri }
          buyer seller
          txAt
        }
      }
    }`,
    { slug: symbol },
  );

  if (data?.recentTransactionsV2?.txs?.length) {
    return data.recentTransactionsV2.txs.map((tx: any) => ({
      id: tx.txId || '',
      type: mapTxType(tx.txType),
      price: parseFloat(tx.grossAmount || '0') / 1e9,
      from: tx.seller || 'Unknown',
      to: tx.buyer || undefined,
      time: tx.txAt ? new Date(tx.txAt).toLocaleString() : 'Unknown',
      image: tx.mint?.imageUri || '',
      name: tx.mint?.name || 'Unknown item',
    }));
  }

  return [];
};

function mapTxType(type: string): 'sale' | 'list' | 'offer' {
  switch (type?.toLowerCase()) {
    case 'sale':
    case 'buy':
      return 'sale';
    case 'list':
    case 'listing':
      return 'list';
    default:
      return 'offer';
  }
}
