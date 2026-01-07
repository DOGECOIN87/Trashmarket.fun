import { Connection, PublicKey } from '@solana/web3.js';
import { getAllDomains, resolve, reverseLookup } from '@gorid/spl-name-service';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';

// Gorid Name Service configuration
export const GORID_CONFIG = {
  rpcEndpoint: GORBAGANA_CONFIG.rpcEndpoint,
  programId: 'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX', // Gorid Name Service program
  tld: '.gor', // Top-level domain
};

// Types for Gorid names
export interface GoridName {
  name: string;
  owner: string;
  domainKey: string;
  registeredAt?: number;
  expiresAt?: number;
}

export interface GoridListing {
  name: string;
  domainKey: string;
  owner: string;
  price: number;
  listedAt: number;
}

// Connection singleton
let connectionInstance: Connection | null = null;

function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(GORID_CONFIG.rpcEndpoint, 'confirmed');
  }
  return connectionInstance;
}

/**
 * Resolve a .gor domain name to a wallet address
 */
export async function resolveGoridName(name: string): Promise<string | null> {
  try {
    const connection = getConnection();
    // Remove .gor suffix if present
    const cleanName = name.replace(/\.gor$/i, '').toLowerCase();
    const owner = await resolve(connection, cleanName);
    return owner?.toBase58() || null;
  } catch (error) {
    console.error('Error resolving gorid name:', error);
    return null;
  }
}

/**
 * Reverse lookup - get domain name from wallet address
 */
export async function getGoridNameFromAddress(address: string): Promise<string | null> {
  try {
    const connection = getConnection();
    const pubkey = new PublicKey(address);
    const domain = await reverseLookup(connection, pubkey);
    return domain ? `${domain}${GORID_CONFIG.tld}` : null;
  } catch (error) {
    console.error('Error in reverse lookup:', error);
    return null;
  }
}

/**
 * Get all domains owned by a wallet address
 */
export async function getDomainsOwnedBy(address: string): Promise<GoridName[]> {
  try {
    const connection = getConnection();
    const pubkey = new PublicKey(address);
    const domains = await getAllDomains(connection, pubkey);

    // Map domain keys to GoridName objects
    const goridNames: GoridName[] = await Promise.all(
      domains.map(async (domainKey) => {
        try {
          const name = await reverseLookup(connection, domainKey);
          return {
            name: name ? `${name}${GORID_CONFIG.tld}` : domainKey.toBase58(),
            owner: address,
            domainKey: domainKey.toBase58(),
          };
        } catch {
          return {
            name: domainKey.toBase58().slice(0, 8) + '...',
            owner: address,
            domainKey: domainKey.toBase58(),
          };
        }
      })
    );

    return goridNames;
  } catch (error) {
    console.error('Error getting domains:', error);
    return [];
  }
}

/**
 * Check if a domain name is available
 */
export async function isDomainAvailable(name: string): Promise<boolean> {
  const owner = await resolveGoridName(name);
  return owner === null;
}

// Mock listings data for the marketplace (in production, this would come from an on-chain program or API)
const MOCK_LISTINGS: GoridListing[] = [
  { name: 'trash.gor', domainKey: 'TrAsH1111111111111111111111111111111111111', owner: '7xKX...3nPq', price: 500, listedAt: Date.now() - 86400000 },
  { name: 'degen.gor', domainKey: 'DeGeN2222222222222222222222222222222222222', owner: '9mBQ...7kLp', price: 1200, listedAt: Date.now() - 172800000 },
  { name: 'gorbag.gor', domainKey: 'GorBaG333333333333333333333333333333333333', owner: '3pFR...9xWz', price: 2500, listedAt: Date.now() - 259200000 },
  { name: 'alpha.gor', domainKey: 'ALphA4444444444444444444444444444444444444', owner: '5kMN...2yQr', price: 800, listedAt: Date.now() - 345600000 },
  { name: 'whale.gor', domainKey: 'wHaLe5555555555555555555555555555555555555', owner: '8jRT...4pKm', price: 3000, listedAt: Date.now() - 432000000 },
  { name: 'moon.gor', domainKey: 'MoON66666666666666666666666666666666666666', owner: '2vXY...6nLs', price: 1500, listedAt: Date.now() - 518400000 },
  { name: 'ape.gor', domainKey: 'ApE777777777777777777777777777777777777777', owner: '6wHJ...8mBv', price: 750, listedAt: Date.now() - 604800000 },
  { name: 'diamond.gor', domainKey: 'DiAmOnD8888888888888888888888888888888888', owner: '1qNP...5kRt', price: 4500, listedAt: Date.now() - 691200000 },
  { name: 'lambo.gor', domainKey: 'LaMbO9999999999999999999999999999999999999', owner: '4tFG...3jWx', price: 2000, listedAt: Date.now() - 777600000 },
  { name: 'wagmi.gor', domainKey: 'WaGmI0000000000000000000000000000000000000', owner: '9hKL...7pYz', price: 600, listedAt: Date.now() - 864000000 },
  { name: 'gm.gor', domainKey: 'Gm111111111111111111111111111111111111111A', owner: '3bCD...1nMs', price: 5000, listedAt: Date.now() - 950400000 },
  { name: 'ser.gor', domainKey: 'SeR22222222222222222222222222222222222222B', owner: '7fEF...4qPv', price: 400, listedAt: Date.now() - 1036800000 },
];

// Recent sales mock data
export interface GoridSale {
  name: string;
  price: number;
  from: string;
  to: string;
  timestamp: number;
  txSignature: string;
}

const MOCK_RECENT_SALES: GoridSale[] = [
  { name: 'chad.gor', price: 1800, from: '7xKX...3nPq', to: '9mBQ...7kLp', timestamp: Date.now() - 3600000, txSignature: '5K7x...mN3p' },
  { name: 'based.gor', price: 950, from: '3pFR...9xWz', to: '5kMN...2yQr', timestamp: Date.now() - 7200000, txSignature: '8Jb2...qR4w' },
  { name: 'fren.gor', price: 650, from: '8jRT...4pKm', to: '2vXY...6nLs', timestamp: Date.now() - 14400000, txSignature: '3Lm9...xY7k' },
  { name: 'king.gor', price: 3200, from: '6wHJ...8mBv', to: '1qNP...5kRt', timestamp: Date.now() - 28800000, txSignature: '9Np4...bZ2j' },
  { name: 'pump.gor', price: 420, from: '4tFG...3jWx', to: '9hKL...7pYz', timestamp: Date.now() - 43200000, txSignature: '2Qr8...hK5m' },
];

/**
 * Get all listed domains for sale
 */
export async function getListedDomains(): Promise<GoridListing[]> {
  // In production, fetch from on-chain program or API
  // For now, return mock data
  return MOCK_LISTINGS.sort((a, b) => b.listedAt - a.listedAt);
}

/**
 * Get recent sales
 */
export async function getRecentSales(): Promise<GoridSale[]> {
  return MOCK_RECENT_SALES.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Search domains by name
 */
export async function searchDomains(query: string): Promise<GoridListing[]> {
  const listings = await getListedDomains();
  const searchTerm = query.toLowerCase().replace(/\.gor$/i, '');
  return listings.filter(listing =>
    listing.name.toLowerCase().includes(searchTerm)
  );
}

/**
 * Get domain details
 */
export async function getDomainDetails(name: string): Promise<GoridListing | null> {
  const listings = await getListedDomains();
  const cleanName = name.toLowerCase();
  return listings.find(l => l.name.toLowerCase() === cleanName) || null;
}

/**
 * Format time ago for display
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Validate domain name format
 */
export function isValidDomainName(name: string): boolean {
  const cleanName = name.replace(/\.gor$/i, '');
  // Must be 1-32 characters, alphanumeric and hyphens only, cannot start/end with hyphen
  const regex = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$|^[a-z0-9]$/i;
  return regex.test(cleanName);
}

/**
 * Get floor price of listed domains
 */
export async function getFloorPrice(): Promise<number> {
  const listings = await getListedDomains();
  if (listings.length === 0) return 0;
  return Math.min(...listings.map(l => l.price));
}

/**
 * Get total volume (mock)
 */
export async function getTotalVolume(): Promise<number> {
  const sales = await getRecentSales();
  return sales.reduce((total, sale) => total + sale.price, 0);
}
