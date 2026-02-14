import { Collection, NFT } from '../types';

// Gorbagio API temporarily disabled - will be re-enabled when NFTs are minted on Gorbagana
// Currently bridging from Solana, will use live data once minting is complete

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
  price_SOL?: number;
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

// Fetch Gorbagios data from local scraped data or API
const fetchGorbagios = async (): Promise<GorbagioApiResponse> => {
  try {
    // Try fetching from local data first (scraped from Magic Eden)
    const response = await fetch('/data/gorbagios_nfts_full.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const nfts = await response.json();

    // Transform the scraped data to our API format
    const transformedData: GorbagioApiItem[] = nfts.map((nft: any) => ({
      solana_mint: nft.mintAddress,
      gorbagana_mint: null, // Not bridged yet
      current_owner: nft.owner,
      metadata: {
        mintAddress: nft.mintAddress,
        supply: nft.supply,
        collection: nft.collection,
        collectionName: nft.collectionName,
        name: nft.name,
        updateAuthority: nft.updateAuthority,
        primarySaleHappened: nft.primarySaleHappened,
        sellerFeeBasisPoints: nft.sellerFeeBasisPoints,
        image: nft.image,
        attributes: nft.attributes,
        listStatus: nft.listStatus,
        price_SOL: nft.price_SOL,
      }
    }));

    return {
      success: true,
      count: transformedData.length,
      total: transformedData.length,
      data: transformedData
    };
  } catch (error) {
    console.error('Error fetching Gorbagios:', error);
    // Return empty data on error
    return {
      success: false,
      count: 0,
      total: 0,
      data: []
    };
  }
};

const getSupplyFromResponse = (response: GorbagioApiResponse): number => {
  if (typeof response.total === 'number') return response.total;
  if (typeof response.count === 'number') return response.count;
  return response.data?.length ?? 0;
};

const buildGorbagioCollection = async (
  response: GorbagioApiResponse,
  fallback?: Partial<Collection>
): Promise<Collection> => {
  const items = response.data ?? [];
  const first = items[0];
  const supply = getSupplyFromResponse(response);
  const listedFromApi = items.filter(
    (item) => item.metadata?.listStatus && item.metadata.listStatus !== 'unlisted'
  ).length;

  const name = normalizeWhitespace(
    first?.metadata?.collectionName || fallback?.name || 'Gorbagios'
  ) || 'Gorbagios';
  const image = first?.metadata?.image || fallback?.image || '';
  const banner = fallback?.banner || image;

  // Try to fetch collection stats from scraped data
  let floorPrice = fallback?.floorPrice ?? 0;
  let totalVolume = fallback?.totalVolume ?? 0;
  let listedCount = items.length ? listedFromApi : fallback?.listedCount ?? 0;

  try {
    const statsResponse = await fetch('/data/gorbagios_collection_stats.json');
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      floorPrice = stats.floorPrice_SOL || floorPrice;
      totalVolume = stats.volumeAll_SOL || totalVolume;
      listedCount = stats.listedCount || listedCount;
    }
  } catch (error) {
    console.warn('Could not fetch collection stats, using fallback');
  }

  return {
    id: fallback?.id || 'gorbagios',
    name,
    description: fallback?.description || 'The Gorbagio collection - 4,444 unique NFTs on Solana.',
    image,
    banner,
    floorPrice,
    totalVolume,
    listedCount,
    supply: supply || fallback?.supply || 4444,
    isVerified: fallback?.isVerified ?? true,
    change24h: fallback?.change24h ?? 0,
  };
};

const mapGorbagioNFTs = (
  items: GorbagioApiItem[],
  options: {
    collectionId: string;
    collectionName: string;
    defaultPrice: number;
    limit?: number;
    offset?: number;
  }
): NFT[] => {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? items.length;
  const defaultPrice = Number.isFinite(options.defaultPrice) ? options.defaultPrice : 0;

  return items.slice(offset, offset + limit).map((item, index) => {
    const name =
      normalizeWhitespace(item.metadata?.name) ||
      `${options.collectionName} #${offset + index + 1}`;

    // Use the actual price from metadata if available, otherwise use default
    const price = item.metadata?.price_SOL ?? defaultPrice;

    return {
      id: item.gorbagana_mint || item.solana_mint || `${options.collectionId}-${offset + index}`,
      name,
      image: item.metadata?.image || '',
      price: typeof price === 'number' ? price : defaultPrice,
      collectionId: options.collectionId,
    };
  });
};

export const getGorbagioCollection = async (
  fallback?: Partial<Collection>
): Promise<Collection> => {
  const response = await fetchGorbagios();
  return await buildGorbagioCollection(response, fallback);
};

export const getGorbagioNFTs = async (options?: {
  limit?: number;
  offset?: number;
  defaultPrice?: number;
  collectionId?: string;
  collectionName?: string;
}): Promise<NFT[]> => {
  const response = await fetchGorbagios();
  const items = response.data ?? [];
  const collectionName =
    normalizeWhitespace(items[0]?.metadata?.collectionName) || options?.collectionName || 'Gorbagios';

  return mapGorbagioNFTs(items, {
    collectionId: options?.collectionId || 'gorbagios',
    collectionName,
    defaultPrice: options?.defaultPrice ?? 0,
    limit: options?.limit,
    offset: options?.offset,
  });
};

export const getGorbagioCollectionWithNFTs = async (options?: {
  collectionFallback?: Partial<Collection>;
  defaultPrice?: number;
  limit?: number;
  offset?: number;
}): Promise<{ collection: Collection; nfts: NFT[]; total: number }> => {
  const response = await fetchGorbagios();
  const collection = await buildGorbagioCollection(response, options?.collectionFallback);
  const nfts = mapGorbagioNFTs(response.data ?? [], {
    collectionId: collection.id,
    collectionName: collection.name,
    defaultPrice: options?.defaultPrice ?? collection.floorPrice,
    limit: options?.limit,
    offset: options?.offset,
  });

  return {
    collection,
    nfts,
    total: getSupplyFromResponse(response),
  };
};
