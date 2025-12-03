import { Collection, NFT, ActivityItem } from '../types';

export const getCollection = async (symbol: string): Promise<Collection> => {
  const response = await fetch(`https://api-mainnet.magiceden.dev/v2/collections/${symbol}`);
  if (!response.ok) throw new Error(`Failed to fetch collection ${symbol}`);
  const data = await response.json();
  return {
    id: symbol,
    name: data.name || 'Unknown',
    description: data.description || 'No description available',
    image: data.image,
    banner: data.bannerImage || data.image,
    floorPrice: parseFloat(data.stats?.floorPrice || '0') / 1e9,
    totalVolume: parseFloat(data.stats?.volume24h || '0') / 1e9,
    listedCount: data.stats?.listedCount || 0,
    supply: data.stats?.totalSupply || 0,
    isVerified: data.verified || false,
    change24h: parseFloat(data.stats?.priceChange24h24h || '0'),
  };
};

export const getTopCollections = async (limit = 5): Promise<Collection[]> => {
  const response = await fetch(`https://api-mainnet.magiceden.dev/v2/collections?offset=0&limit=${limit}&sortBy=volume24h`);
  if (!response.ok) throw new Error('Failed to fetch top collections');
  const data = await response.json();
  return data.map((d: any) => ({
    id: d.symbol,
    name: d.name || 'Unknown',
    description: d.description || 'No description available',
    image: d.image,
    banner: d.bannerImage || d.image,
    floorPrice: parseFloat(d.stats?.floorPrice || '0') / 1e9,
    totalVolume: parseFloat(d.stats?.volume24h || '0') / 1e9,
    listedCount: d.stats?.listedCount || 0,
    supply: d.stats?.totalSupply || 0,
    isVerified: d.verified || false,
    change24h: parseFloat(d.stats?.priceChange24h24h || '0'),
  })) as Collection[];
};

export const getCollectionTokens = async (symbol: string, offset = 0, limit = 20): Promise<NFT[]> => {
  const response = await fetch(`https://api-mainnet.magiceden.dev/v2/${symbol}/tokens?offset=${offset}&limit=${limit}`);
  if (!response.ok) throw new Error(`Failed to fetch tokens for ${symbol}`);
  const data = await response.json();
  return data.map((token: any) => ({
    id: token.tokenMint,
    name: token.name || `#${token.tokenNumber || 'N/A'}`,
    image: token.imageUri,
    price: parseFloat(token.price || '0') / 1e9,
    rank: token.rarityRank,
    collectionId: symbol,
    description: '',
  })) as NFT[];
};

export const getCollectionActivities = async (symbol: string, offset = 0, limit = 20): Promise<ActivityItem[]> => {
  const response = await fetch(`https://api-mainnet.magiceden.dev/v2/${symbol}/activities?offset=${offset}&limit=${limit}`);
  if (!response.ok) throw new Error(`Failed to fetch activities for ${symbol}`);
  const data = await response.json();
  return data.map((act: any) => ({
    id: act.signature,
    type: act.type as 'sale' | 'list' | 'offer',
    price: parseFloat(act.price || '0') / 1e9,
    from: act.buyer || act.seller || 'Unknown',
    to: act.seller || act.buyer || undefined,
    time: new Date(act.ts || Date.now()).toLocaleString(),
    image: act.imageUris?.[0] || '',
    name: act.name || 'Unknown item',
  })) as ActivityItem[];
};
