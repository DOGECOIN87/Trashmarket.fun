import { Collection, NFT, ActivityItem } from '../types';

const GORBAGIO_API_BASE = 'https://gorapi.onrender.com/api';

export interface GorbagioNFT {
  id: string;
  name: string;
  image: string;
  price?: number;
  rank?: number;
  rarity?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  owner?: string;
  listed?: boolean;
  lastSale?: number;
}

export interface GorbagioCollection {
  name: string;
  description: string;
  image: string;
  banner?: string;
  floorPrice?: number;
  totalVolume?: number;
  listedCount?: number;
  supply?: number;
  isVerified?: boolean;
}

export interface GorbagioApiResponse {
  collection?: GorbagioCollection;
  nfts?: GorbagioNFT[];
  items?: GorbagioNFT[];
  data?: GorbagioNFT[];
  total?: number;
  success?: boolean;
}

// Fallback mock NFT data for when API is unavailable
const MOCK_GORBAGIOS: NFT[] = Array.from({ length: 24 }).map((_, i) => ({
  id: `gorbagio-${i + 1}`,
  name: `Gorbagio #${i + 1}`,
  image: `https://gorapi.onrender.com/images/${i + 1}.png`,
  price: parseFloat((0.05 + Math.random() * 0.5).toFixed(3)),
  rank: Math.floor(Math.random() * 1000) + 1,
  rarity: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][Math.floor(Math.random() * 5)],
  collectionId: 'gorbagios',
  description: 'A unique Gorbagio from the Gorbagana Network.',
}));

const MOCK_COLLECTION: Collection = {
  id: 'gorbagios',
  name: 'Gorbagios',
  description: 'The official Gorbagio NFT collection on Gorbagana Network. Literal garbage bags living on the blockchain.',
  image: 'https://gorapi.onrender.com/images/1.png',
  banner: 'https://gorapi.onrender.com/images/banner.png',
  floorPrice: 0.05,
  totalVolume: 69420,
  listedCount: 420,
  supply: 6969,
  isVerified: true,
  change24h: 42.0,
};

/**
 * Fetch all Gorbagios NFTs from the API
 */
export const getGorbagios = async (): Promise<NFT[]> => {
  try {
    const response = await fetch(`${GORBAGIO_API_BASE}/gorbagios`);
    if (!response.ok) {
      console.warn(`Gorbagio API returned ${response.status}, using fallback data`);
      return MOCK_GORBAGIOS;
    }
    const data: GorbagioApiResponse = await response.json();

    // Handle various possible response formats
    const nfts = data.nfts || data.items || data.data || (Array.isArray(data) ? data : []);

    if (nfts.length === 0) {
      console.warn('Gorbagio API returned empty data, using fallback');
      return MOCK_GORBAGIOS;
    }

    return nfts.map((nft: GorbagioNFT) => ({
      id: nft.id || String(Math.random()),
      name: nft.name || 'Gorbagio',
      image: nft.image || `https://gorapi.onrender.com/images/${Math.floor(Math.random() * 24) + 1}.png`,
      price: nft.price || 0,
      rank: nft.rank,
      rarity: nft.rarity,
      collectionId: 'gorbagios',
      description: '',
      lastSale: nft.lastSale,
    }));
  } catch (error) {
    console.error('Error fetching Gorbagios, using fallback:', error);
    return MOCK_GORBAGIOS;
  }
};

/**
 * Fetch Gorbagios collection metadata
 */
export const getGorbagioCollection = async (): Promise<Collection> => {
  try {
    const response = await fetch(`${GORBAGIO_API_BASE}/gorbagios`);
    if (!response.ok) {
      console.warn(`Gorbagio API returned ${response.status}, using fallback collection`);
      return MOCK_COLLECTION;
    }
    const data: GorbagioApiResponse = await response.json();

    // Try to extract collection info or construct from NFTs
    const nfts = data.nfts || data.items || data.data || (Array.isArray(data) ? data : []);
    const collection = data.collection;

    if (nfts.length === 0 && !collection) {
      console.warn('Gorbagio API returned empty data, using fallback collection');
      return MOCK_COLLECTION;
    }

    // Calculate floor price from NFTs if not provided
    const listedNfts = nfts.filter((n: GorbagioNFT) => n.price && n.price > 0);
    const floorPrice = collection?.floorPrice ||
      (listedNfts.length > 0 ? Math.min(...listedNfts.map((n: GorbagioNFT) => n.price || Infinity)) : 0.05);

    return {
      id: 'gorbagios',
      name: collection?.name || 'Gorbagios',
      description: collection?.description || 'The official Gorbagio NFT collection on Gorbagana Network.',
      image: collection?.image || (nfts[0]?.image || 'https://gorapi.onrender.com/images/1.png'),
      banner: collection?.banner || 'https://gorapi.onrender.com/images/banner.png',
      floorPrice: floorPrice,
      totalVolume: collection?.totalVolume || 69420,
      listedCount: collection?.listedCount || listedNfts.length || nfts.length,
      supply: collection?.supply || nfts.length || 6969,
      isVerified: collection?.isVerified ?? true,
      change24h: 42.0,
    };
  } catch (error) {
    console.error('Error fetching Gorbagio collection, using fallback:', error);
    return MOCK_COLLECTION;
  }
};

/**
 * Fetch paginated Gorbagios NFTs
 */
export const getGorbagiosPaginated = async (offset = 0, limit = 20): Promise<NFT[]> => {
  const allNfts = await getGorbagios();
  return allNfts.slice(offset, offset + limit);
};

/**
 * Get a specific Gorbagio by ID
 */
export const getGorbagioById = async (id: string): Promise<NFT | null> => {
  const allNfts = await getGorbagios();
  return allNfts.find(nft => nft.id === id) || null;
};

/**
 * Generate activity data for Gorbagios (simulated based on NFT data)
 */
export const getGorbagioActivity = async (limit = 15): Promise<ActivityItem[]> => {
  const nfts = await getGorbagios();

  return nfts.slice(0, limit).map((nft, i) => {
    const isSale = Math.random() > 0.3;
    return {
      id: `gor-act-${nft.id}-${i}`,
      type: isSale ? 'sale' as const : 'list' as const,
      price: nft.price || parseFloat((Math.random() * 2).toFixed(2)),
      from: `gor...${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`,
      to: isSale ? `bag...${Math.floor(Math.random() * 999).toString().padStart(3, '0')}` : undefined,
      time: `${Math.floor(Math.random() * 59) + 1}m ago`,
      image: nft.image,
      name: nft.name,
    };
  });
};
