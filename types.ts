export interface NFT {
  id: string;
  name: string;
  image: string;
  price: number;
  rank?: number;
  rarity?: string;
  collectionId: string;
  description?: string;
  lastSale?: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  image: string;
  banner: string;
  floorPrice: number;
  totalVolume: number;
  listedCount: number;
  supply: number;
  isVerified?: boolean;
  change24h: number;
}

export interface ChartPoint {
  time: string; // ISO date or label
  price: number;
}

export interface ActivityItem {
  id: string;
  type: 'sale' | 'list' | 'offer';
  price: number;
  from: string;
  to?: string;
  time: string;
  image: string;
  name: string;
}

export enum LaunchpadStatus {
  IDLE,
  GENERATING,
  SUCCESS,
  ERROR
}