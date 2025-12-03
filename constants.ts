import { Collection, NFT, ChartPoint, ActivityItem } from './types';

export const MOCK_COLLECTIONS: Collection[] = [
  {
    id: 'galactic-geckos',
    name: 'Galactic Geckos',
    description: '10,000 space-faring lizards ruling the Solana galaxy.',
    image: 'https://picsum.photos/seed/gecko/400/400',
    banner: 'https://picsum.photos/seed/geckobanner/1200/400',
    floorPrice: 12.5,
    totalVolume: 450000,
    listedCount: 432,
    supply: 10000,
    isVerified: true,
    change24h: 5.2,
  },
  {
    id: 'gorbagios',
    name: 'Gorbagios',
    description: 'Literal garbage bags living on the blockchain. Smells like alpha.',
    image: 'https://picsum.photos/seed/gorbagios/400/400',
    banner: 'https://picsum.photos/seed/gorbagiosbanner/1200/400',
    floorPrice: 0.05,
    totalVolume: 69420,
    listedCount: 999,
    supply: 6969,
    isVerified: true,
    change24h: 420.0,
  },
  {
    id: 'cyber-samurai',
    name: 'Cyber Samurai',
    description: 'Honor and code in a dystopian future.',
    image: 'https://picsum.photos/seed/samurai/400/400',
    banner: 'https://picsum.photos/seed/samuraibanner/1200/400',
    floorPrice: 5.2,
    totalVolume: 120000,
    listedCount: 150,
    supply: 5000,
    isVerified: true,
    change24h: -2.1,
  },
  {
    id: 'pixel-punks',
    name: 'Solana Punks',
    description: 'The OGs of the chain. Not affiliated with anyone.',
    image: 'https://picsum.photos/seed/punk/400/400',
    banner: 'https://picsum.photos/seed/punkbanner/1200/400',
    floorPrice: 45.0,
    totalVolume: 890000,
    listedCount: 89,
    supply: 10000,
    isVerified: true,
    change24h: 12.4,
  },
  {
    id: 'bubble-dragons',
    name: 'Bubble Dragons',
    description: 'Cute dragons trapped in bubbles. Pop them to release!',
    image: 'https://picsum.photos/seed/dragon/400/400',
    banner: 'https://picsum.photos/seed/dragonbanner/1200/400',
    floorPrice: 1.8,
    totalVolume: 4500,
    listedCount: 1200,
    supply: 8888,
    isVerified: false,
    change24h: 0.5,
  },
];

const generateNFTs = (collection: Collection): NFT[] => {
  return Array.from({ length: 24 }).map((_, i) => ({
    id: `${collection.id}-${i}`,
    name: `${collection.name} #${i + 1240}`,
    image: `https://picsum.photos/seed/${collection.id}${i}/500/500`,
    price: parseFloat((collection.floorPrice + Math.random() * (i % 5)).toFixed(2)),
    rank: Math.floor(Math.random() * 5000) + 1,
    collectionId: collection.id,
    description: `A unique item from the ${collection.name} collection.`
  }));
};

export const MOCK_NFTS: Record<string, NFT[]> = {
  'galactic-geckos': generateNFTs(MOCK_COLLECTIONS[0]).sort((a,b) => a.price - b.price),
  'gorbagios': generateNFTs(MOCK_COLLECTIONS[1]).sort((a,b) => a.price - b.price),
  'cyber-samurai': generateNFTs(MOCK_COLLECTIONS[2]).sort((a,b) => a.price - b.price),
  'pixel-punks': generateNFTs(MOCK_COLLECTIONS[3]).sort((a,b) => a.price - b.price),
  'bubble-dragons': generateNFTs(MOCK_COLLECTIONS[4]).sort((a,b) => a.price - b.price),
};

// Generate somewhat realistic looking chart data
export const generateChartData = (basePrice: number): ChartPoint[] => {
    const points: ChartPoint[] = [];
    let currentPrice = basePrice * 0.8;
    const now = new Date();
    for(let i=30; i>=0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        // Random walk
        currentPrice = currentPrice * (1 + (Math.random() * 0.1 - 0.04));
        points.push({
            time: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            price: parseFloat(currentPrice.toFixed(2))
        });
    }
    return points;
}

export const generateActivity = (collectionId: string): ActivityItem[] => {
    return Array.from({ length: 15 }).map((_, i) => {
        const isSale = Math.random() > 0.3;
        return {
            id: `act-${i}`,
            type: isSale ? 'sale' : 'list',
            price: parseFloat((Math.random() * 20).toFixed(2)),
            from: `8x...${Math.floor(Math.random() * 999)}`,
            to: isSale ? `4k...${Math.floor(Math.random() * 999)}` : undefined,
            time: `${Math.floor(Math.random() * 59) + 1}m ago`,
            image: `https://picsum.photos/seed/${collectionId}${i}/100/100`,
            name: `Item #${Math.floor(Math.random() * 5000)}`
        };
    });
};