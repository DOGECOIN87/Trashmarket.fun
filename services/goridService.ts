import { Connection, PublicKey } from '@solana/web3.js';
import { getAllDomains, resolve, reverseLookup } from '@gorid/spl-name-service';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';
import {
  fetchListings,
  fetchRecentSales,
  getDomainAssetsByOwner,
  type MarketplaceListing,
  type MarketplaceSale,
} from './marketplace-service';

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
  mint?: string;
  image?: string;
  registeredAt?: number;
  expiresAt?: number;
}

export interface GoridListing {
  name: string;
  domainKey: string;
  owner: string;
  price: number;
  listedAt: number;
  domainMint?: string;
  listingId?: string;
}

export interface GoridSale {
  name: string;
  price: number;
  from: string;
  to: string;
  timestamp: number;
  txSignature: string;
}

// Connection singleton
let connectionInstance: Connection | null = null;

function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(GORID_CONFIG.rpcEndpoint, 'confirmed');
  }
  return connectionInstance;
}

// ─── Domain Resolution (via @gorid/spl-name-service) ─────────────────

/** Resolve a .gor domain name to a wallet address */
export async function resolveGoridName(name: string): Promise<string | null> {
  try {
    const connection = getConnection();
    const cleanName = name.replace(/\.gor$/i, '').toLowerCase();
    const owner = await resolve(connection, cleanName);
    return owner?.toBase58() || null;
  } catch (error) {
    console.error('Error resolving gorid name:', error);
    return null;
  }
}

/** Reverse lookup - get domain name from wallet address */
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

/** Get all domains owned by a wallet address */
export async function getDomainsOwnedBy(address: string): Promise<GoridName[]> {
  try {
    // Try DAS API first for richer data (images, mint addresses)
    const dasAssets = await getDomainAssetsByOwner(address);

    if (dasAssets.length > 0) {
      return dasAssets.map((asset) => ({
        name: asset.name,
        owner: asset.owner,
        domainKey: asset.address,
        mint: asset.mint,
        image: asset.image,
      }));
    }

    // Fallback to on-chain name service lookup
    const connection = getConnection();
    const pubkey = new PublicKey(address);
    const domains = await getAllDomains(connection, pubkey);

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

/** Check if a domain name is available */
export async function isDomainAvailable(name: string): Promise<boolean> {
  const owner = await resolveGoridName(name);
  return owner === null;
}

// ─── Marketplace Data (via Trading API) ──────────────────────────────

// Cache for listings/sales with short TTL to avoid hammering the API
let listingsCache: { data: GoridListing[]; timestamp: number } | null = null;
let salesCache: { data: GoridSale[]; timestamp: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

/** Get all listed domains for sale */
export async function getListedDomains(): Promise<GoridListing[]> {
  // Return cached data if fresh
  if (listingsCache && Date.now() - listingsCache.timestamp < CACHE_TTL) {
    return listingsCache.data;
  }

  try {
    const apiListings = await fetchListings();

    if (apiListings.length > 0) {
      const listings: GoridListing[] = apiListings.map((l) => ({
        name: l.domainName,
        domainKey: l.domainMint,
        owner: formatAddress(l.seller),
        price: l.price,
        listedAt: l.listedAt,
        domainMint: l.domainMint,
        listingId: l.id,
      }));

      listingsCache = { data: listings, timestamp: Date.now() };
      return listings;
    }
  } catch (error) {
    console.error('Error fetching listings from API:', error);
  }

  // Return empty if API unavailable (under construction)
  return [];
}

/** Get recent sales */
export async function getRecentSales(): Promise<GoridSale[]> {
  if (salesCache && Date.now() - salesCache.timestamp < CACHE_TTL) {
    return salesCache.data;
  }

  try {
    const apiSales = await fetchRecentSales();

    if (apiSales.length > 0) {
      const sales: GoridSale[] = apiSales.map((s) => ({
        name: s.domainName,
        price: s.price,
        from: formatAddress(s.seller),
        to: formatAddress(s.buyer),
        timestamp: s.timestamp,
        txSignature: s.txSignature,
      }));

      salesCache = { data: sales, timestamp: Date.now() };
      return sales;
    }
  } catch (error) {
    console.error('Error fetching sales from API:', error);
  }

  return [];
}

/** Search domains by name */
export async function searchDomains(query: string): Promise<GoridListing[]> {
  const listings = await getListedDomains();
  const searchTerm = query.toLowerCase().replace(/\.gor$/i, '');
  return listings.filter((listing) =>
    listing.name.toLowerCase().includes(searchTerm)
  );
}

/** Get domain details */
export async function getDomainDetails(name: string): Promise<GoridListing | null> {
  const listings = await getListedDomains();
  const cleanName = name.toLowerCase();
  return listings.find((l) => l.name.toLowerCase() === cleanName) || null;
}

// ─── Stats ───────────────────────────────────────────────────────────

/** Get floor price of listed domains */
export async function getFloorPrice(): Promise<number> {
  const listings = await getListedDomains();
  if (listings.length === 0) return 0;
  return Math.min(...listings.map((l) => l.price));
}

/** Get total volume from recent sales */
export async function getTotalVolume(): Promise<number> {
  const sales = await getRecentSales();
  return sales.reduce((total, sale) => total + sale.price, 0);
}

// ─── Utilities ───────────────────────────────────────────────────────

/** Format time ago for display */
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

/** Validate domain name format */
export function isValidDomainName(name: string): boolean {
  const cleanName = name.replace(/\.gor$/i, '');
  // Must be 1-32 characters, alphanumeric/hyphens/emoji, cannot start/end with hyphen
  const regex = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$|^[a-z0-9]$/i;
  // Also allow emoji-only domain names (like 🤑.gor)
  if (/^\p{Emoji}+$/u.test(cleanName)) return true;
  return regex.test(cleanName);
}

/** Shorten a wallet address for display (e.g. "7xKX...3nPq") */
function formatAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
