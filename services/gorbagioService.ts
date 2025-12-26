import { Collection, NFT } from '../types';
import {
  isCacheValid,
  getCachedCollection,
  getCachedNFTs,
  saveToCache,
  getCacheStatus,
  getCacheAge
} from './gorbagioCache';

const GORBAGIO_API_URL = 'https://gorapi.onrender.com/api/gorbagios';

interface GorbagioAttribute {
  trait_type: string;
  value: string;
}

interface GorbagioMetadata {
  mintAddress?: string;
  supply?: number;
  collection?: string;
  collectionName?: string;
  name?: string;
  updateAuthority?: string;
  primarySaleHappened?: boolean;
  sellerFeeBasisPoints?: number;
  image?: string;
  attributes?: GorbagioAttribute[];
  properties?: {
    files?: Array<{ uri?: string; type?: string }>;
    category?: string;
  };
  isCompressed?: boolean;
  listStatus?: string;
}

interface GorbagioApiItem {
  solana_mint?: string;
  gorbagana_mint?: string;
  current_owner?: string;
  metadata?: GorbagioMetadata;
}

interface GorbagioApiResponse {
  success?: boolean;
  count?: number;
  total?: number;
  data?: GorbagioApiItem[];
}

const normalizeWhitespace = (value?: string): string => {
  return value ? value.replace(/\s+/g, ' ').trim() : '';
};

// In-memory cache for current session (reduces Firestore reads)
let sessionCache: {
  collection: Collection | null;
  nfts: NFT[];
  total: number;
  timestamp: number;
} | null = null;

const SESSION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const isSessionCacheValid = (): boolean => {
  if (!sessionCache) return false;
  return (Date.now() - sessionCache.timestamp) < SESSION_CACHE_DURATION;
};

/**
 * Fetch data directly from the Gorbagio API
 */
const fetchFromAPI = async (): Promise<GorbagioApiResponse> => {
  const response = await fetch(GORBAGIO_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Gorbagios (${response.status})`);
  }
  return response.json();
};

const getSupplyFromResponse = (response: GorbagioApiResponse): number => {
  if (typeof response.total === 'number') return response.total;
  if (typeof response.count === 'number') return response.count;
  return response.data?.length ?? 0;
};

const buildGorbagioCollection = (response: GorbagioApiResponse): Collection => {
  const items = response.data ?? [];
  const first = items[0];
  const supply = getSupplyFromResponse(response);
  const listedFromApi = items.filter(
    (item) => item.metadata?.listStatus && item.metadata.listStatus !== 'unlisted'
  ).length;

  const name = normalizeWhitespace(
    first?.metadata?.collectionName || 'Gorbagios'
  ) || 'Gorbagios';
  const image = first?.metadata?.image || '';
  const banner = image;

  return {
    id: 'gorbagios',
    name,
    description: 'The OG Gorbagio collection on Gorbagana L2.',
    image,
    banner,
    floorPrice: 0,
    totalVolume: 0,
    listedCount: listedFromApi,
    supply: supply || 0,
    isVerified: true,
    change24h: 0,
  };
};

const mapGorbagioNFTs = (
  items: GorbagioApiItem[],
  options: {
    collectionId: string;
    collectionName: string;
  }
): NFT[] => {
  return items.map((item, index) => {
    const name =
      normalizeWhitespace(item.metadata?.name) ||
      `${options.collectionName} #${index + 1}`;

    return {
      id: item.gorbagana_mint || item.solana_mint || `${options.collectionId}-${index}`,
      name,
      image: item.metadata?.image || '',
      price: 0,
      collectionId: options.collectionId,
    };
  });
};

/**
 * Sync data from API to cache
 * Returns the synced data
 */
export const syncFromAPI = async (): Promise<{
  success: boolean;
  collection: Collection | null;
  nfts: NFT[];
  total: number;
  error?: string;
}> => {
  try {
    console.log('Syncing Gorbagios from API...');
    const response = await fetchFromAPI();
    const collection = buildGorbagioCollection(response);
    const nfts = mapGorbagioNFTs(response.data ?? [], {
      collectionId: collection.id,
      collectionName: collection.name,
    });
    const total = getSupplyFromResponse(response);

    // Save to Firestore cache
    await saveToCache(collection, nfts);

    // Update session cache
    sessionCache = {
      collection,
      nfts,
      total,
      timestamp: Date.now()
    };

    console.log(`Synced ${nfts.length} Gorbagios`);

    return {
      success: true,
      collection,
      nfts,
      total
    };
  } catch (error) {
    console.error('Error syncing from API:', error);
    return {
      success: false,
      collection: null,
      nfts: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Get collection data with cache-first strategy
 */
export const getGorbagioCollection = async (): Promise<Collection> => {
  // Check session cache first (fastest)
  if (isSessionCacheValid() && sessionCache?.collection) {
    return sessionCache.collection;
  }

  // Check Firestore cache
  const cacheValid = await isCacheValid();

  if (cacheValid) {
    const cached = await getCachedCollection();
    if (cached) {
      // Update session cache
      if (!sessionCache) {
        sessionCache = { collection: cached, nfts: [], total: 0, timestamp: Date.now() };
      } else {
        sessionCache.collection = cached;
        sessionCache.timestamp = Date.now();
      }
      return cached;
    }
  }

  // Cache miss or stale - try API
  const syncResult = await syncFromAPI();

  if (syncResult.success && syncResult.collection) {
    return syncResult.collection;
  }

  // API failed - try to use stale cache as fallback
  const staleCache = await getCachedCollection();
  if (staleCache) {
    console.warn('Using stale cache data (API unavailable)');
    return staleCache;
  }

  // No data available
  throw new Error('Failed to load Gorbagios collection. Please try again later.');
};

/**
 * Get NFTs with cache-first strategy
 */
export const getGorbagioNFTs = async (options?: {
  limit?: number;
  offset?: number;
}): Promise<NFT[]> => {
  // Check session cache first
  if (isSessionCacheValid() && sessionCache?.nfts.length) {
    let nfts = sessionCache.nfts;
    if (options?.offset) {
      nfts = nfts.slice(options.offset);
    }
    if (options?.limit) {
      nfts = nfts.slice(0, options.limit);
    }
    return nfts;
  }

  // Check Firestore cache
  const cacheValid = await isCacheValid();

  if (cacheValid) {
    const { nfts, total } = await getCachedNFTs(options);
    if (nfts.length > 0) {
      // Update session cache with all data (for future requests)
      if (!sessionCache || sessionCache.nfts.length === 0) {
        const fullData = await getCachedNFTs();
        sessionCache = {
          collection: sessionCache?.collection || null,
          nfts: fullData.nfts,
          total: fullData.total,
          timestamp: Date.now()
        };
      }
      return nfts;
    }
  }

  // Cache miss or stale - try API
  const syncResult = await syncFromAPI();

  if (syncResult.success) {
    let nfts = syncResult.nfts;
    if (options?.offset) {
      nfts = nfts.slice(options.offset);
    }
    if (options?.limit) {
      nfts = nfts.slice(0, options.limit);
    }
    return nfts;
  }

  // API failed - try stale cache
  const { nfts } = await getCachedNFTs(options);
  if (nfts.length > 0) {
    console.warn('Using stale cache data (API unavailable)');
    return nfts;
  }

  // No data available
  throw new Error('Failed to load Gorbagios. Please try again later.');
};

/**
 * Get collection with NFTs in a single call
 */
export const getGorbagioCollectionWithNFTs = async (options?: {
  limit?: number;
  offset?: number;
}): Promise<{ collection: Collection; nfts: NFT[]; total: number }> => {
  // Check session cache first
  if (isSessionCacheValid() && sessionCache?.collection && sessionCache.nfts.length) {
    let nfts = sessionCache.nfts;
    if (options?.offset) {
      nfts = nfts.slice(options.offset);
    }
    if (options?.limit) {
      nfts = nfts.slice(0, options.limit);
    }
    return {
      collection: sessionCache.collection,
      nfts,
      total: sessionCache.total
    };
  }

  // Check Firestore cache
  const cacheValid = await isCacheValid();

  if (cacheValid) {
    const [collection, { nfts, total }] = await Promise.all([
      getCachedCollection(),
      getCachedNFTs(options)
    ]);

    if (collection && nfts.length > 0) {
      // Populate session cache
      const fullData = await getCachedNFTs();
      sessionCache = {
        collection,
        nfts: fullData.nfts,
        total: fullData.total,
        timestamp: Date.now()
      };

      return { collection, nfts, total };
    }
  }

  // Cache miss or stale - sync from API
  const syncResult = await syncFromAPI();

  if (syncResult.success && syncResult.collection) {
    let nfts = syncResult.nfts;
    if (options?.offset) {
      nfts = nfts.slice(options.offset);
    }
    if (options?.limit) {
      nfts = nfts.slice(0, options.limit);
    }
    return {
      collection: syncResult.collection,
      nfts,
      total: syncResult.total
    };
  }

  // API failed - try stale cache
  const [staleCollection, staleNFTs] = await Promise.all([
    getCachedCollection(),
    getCachedNFTs(options)
  ]);

  if (staleCollection && staleNFTs.nfts.length > 0) {
    console.warn('Using stale cache data (API unavailable)');
    return {
      collection: staleCollection,
      nfts: staleNFTs.nfts,
      total: staleNFTs.total
    };
  }

  // No data available
  throw new Error('Failed to load Gorbagios collection. Please try again later.');
};

/**
 * Force refresh from API (manual sync)
 */
export const forceSync = async (): Promise<{
  success: boolean;
  message: string;
  count?: number;
}> => {
  const result = await syncFromAPI();

  if (result.success) {
    return {
      success: true,
      message: `Successfully synced ${result.nfts.length} Gorbagios`,
      count: result.nfts.length
    };
  }

  return {
    success: false,
    message: result.error || 'Failed to sync from API'
  };
};

/**
 * Get current cache status
 */
export { getCacheStatus, getCacheAge };
