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

export enum SubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface CollectionSubmission {
  id: string;
  // Collection Details
  name: string;
  symbol: string;
  description: string;
  supply: number;
  mintPrice: number;
  mintDate: string;
  
  // Visual Assets
  logoUrl: string;
  bannerUrl: string;
  sampleImages: string[];
  
  // Smart Contract Info
  contractAddress: string;
  creatorWallet: string;
  submittedBy: string; // Wallet address that submitted
  royaltyPercentage: number;
  
  // Social Links
  website?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  
  // Project Information
  teamInfo: string;
  roadmap: string;
  utility: string;
  contactEmail: string;
  
  // Review Tracking
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  
  // Submission Tracking
  submissionCount: number; // Track per wallet for limit enforcement
}
