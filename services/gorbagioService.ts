import { Collection, NFT } from '../types';

const GORBAGIO_API_URL = 'https://gorapi.trashscan.io/api/gorbagios';

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

let gorbagioCache: GorbagioApiResponse | null = null;
let gorbagioFetchPromise: Promise<GorbagioApiResponse> | null = null;

const fetchGorbagios = async (): Promise<GorbagioApiResponse> => {
  if (gorbagioCache) return gorbagioCache;
  if (gorbagioFetchPromise) return gorbagioFetchPromise;

  gorbagioFetchPromise = fetch(GORBAGIO_API_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch Gorbagios (${response.status})`);
      }
      return response.json();
    })
    .then((data: GorbagioApiResponse) => {
      gorbagioCache = data;
      return data;
    })
    .finally(() => {
      gorbagioFetchPromise = null;
    });

  return gorbagioFetchPromise;
};

const getSupplyFromResponse = (response: GorbagioApiResponse): number => {
  if (typeof response.total === 'number') return response.total;
  if (typeof response.count === 'number') return response.count;
  return response.data?.length ?? 0;
};

const buildGorbagioCollection = (
  response: GorbagioApiResponse,
  fallback?: Partial<Collection>
): Collection => {
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

  return {
    id: fallback?.id || 'gorbagios',
    name,
    description: fallback?.description || 'The Gorbagio collection on Gorbagana.',
    image,
    banner,
    floorPrice: fallback?.floorPrice ?? 0,
    totalVolume: fallback?.totalVolume ?? 0,
    listedCount: items.length ? listedFromApi : fallback?.listedCount ?? 0,
    supply: supply || fallback?.supply || 0,
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
  const price = Number.isFinite(options.defaultPrice) ? options.defaultPrice : 0;

  return items.slice(offset, offset + limit).map((item, index) => {
    const name =
      normalizeWhitespace(item.metadata?.name) ||
      `${options.collectionName} #${offset + index + 1}`;

    return {
      id: item.gorbagana_mint || item.solana_mint || `${options.collectionId}-${offset + index}`,
      name,
      image: item.metadata?.image || '',
      price,
      collectionId: options.collectionId,
    };
  });
};

export const getGorbagioCollection = async (
  fallback?: Partial<Collection>
): Promise<Collection> => {
  const response = await fetchGorbagios();
  return buildGorbagioCollection(response, fallback);
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
  const collection = buildGorbagioCollection(response, options?.collectionFallback);
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
