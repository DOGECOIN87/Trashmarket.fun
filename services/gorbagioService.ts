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

/**
 * Fetch all Gorbagios NFTs from the API
 */
export const getGorbagios = async (): Promise<NFT[]> => {
  try {
    const response = await fetch(`${GORBAGIO_API_BASE}/gorbagios`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Gorbagios: ${response.status}`);
    }
    const data: GorbagioApiResponse = await response.json();

    // Handle various possible response formats
    const nfts = data.nfts || data.items || data.data || (Array.isArray(data) ? data : []);

    return nfts.map((nft: GorbagioNFT) => ({
      id: nft.id || String(Math.random()),
      name: nft.name || 'Gorbagio',
      image: nft.image || '',
      price: nft.price || 0,
      rank: nft.rank,
      rarity: nft.rarity,
      collectionId: 'gorbagios',
      description: '',
      lastSale: nft.lastSale,
    }));
  } catch (error) {
    console.error('Error fetching Gorbagios:', error);
    throw error;
  }
};

/**
 * Fetch Gorbagios collection metadata
 */
export const getGorbagioCollection = async (): Promise<Collection> => {
  try {
    const response = await fetch(`${GORBAGIO_API_BASE}/gorbagios`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Gorbagio collection: ${response.status}`);
    }
    const data: GorbagioApiResponse = await response.json();

    // Try to extract collection info or construct from NFTs
    const nfts = data.nfts || data.items || data.data || (Array.isArray(data) ? data : []);
    const collection = data.collection;

    // Calculate floor price from NFTs if not provided
    const listedNfts = nfts.filter((n: GorbagioNFT) => n.price && n.price > 0);
    const floorPrice = collection?.floorPrice ||
      (listedNfts.length > 0 ? Math.min(...listedNfts.map((n: GorbagioNFT) => n.price || Infinity)) : 0.05);

    return {
      id: 'gorbagios',
      name: collection?.name || 'Gorbagios',
      description: collection?.description || 'The official Gorbagio NFT collection on Gorbagana Network.',
      image: collection?.image || (nfts[0]?.image || 'https://picsum.photos/seed/gorbagios/400/400'),
      banner: collection?.banner || (nfts[0]?.image || 'https://picsum.photos/seed/gorbagiosbanner/1200/400'),
      floorPrice: floorPrice,
      totalVolume: collection?.totalVolume || 69420,
      listedCount: collection?.listedCount || listedNfts.length || nfts.length,
      supply: collection?.supply || nfts.length || 6969,
      isVerified: collection?.isVerified ?? true,
      change24h: 0,
    };
  } catch (error) {
    console.error('Error fetching Gorbagio collection:', error);
    throw error;
  }
};

/**
 * Fetch paginated Gorbagios NFTs
 */
export const getGorbagiosPaginated = async (offset = 0, limit = 20): Promise<NFT[]> => {
  try {
    const allNfts = await getGorbagios();
    return allNfts.slice(offset, offset + limit);
  } catch (error) {
    console.error('Error fetching paginated Gorbagios:', error);
    throw error;
  }
};

/**
 * Get a specific Gorbagio by ID
 */
export const getGorbagioById = async (id: string): Promise<NFT | null> => {
  try {
    const allNfts = await getGorbagios();
    return allNfts.find(nft => nft.id === id) || null;
  } catch (error) {
    console.error('Error fetching Gorbagio by ID:', error);
    throw error;
  }
};

/**
 * Generate activity data for Gorbagios (simulated based on NFT data)
 */
export const getGorbagioActivity = async (limit = 15): Promise<ActivityItem[]> => {
  try {
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
  } catch (error) {
    console.error('Error generating Gorbagio activity:', error);
    throw error;
  }
};
