import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';
import { TRADING_CONFIG, calculateFees } from '../lib/trading-config';
import { humanToTradingAmount, tradingAmountToHuman } from '../utils/decimals';
import { RPC_ENDPOINTS } from '../lib/rpcConfig';

// API endpoints
const DAS_API_URL = `${RPC_ENDPOINTS.GORBAGANA_API}/das`;
const TRADING_API_URL = `${RPC_ENDPOINTS.GORBAGANA_API}/trading`;

// Name Service Program
const NAME_SERVICE_PROGRAM = new PublicKey('namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX');
const WRAPPED_GOR_MINT = new PublicKey(TRADING_CONFIG.WRAPPED_GOR_MINT);
const FEE_RECIPIENT = new PublicKey(TRADING_CONFIG.FEE_RECIPIENT);

// Connection singleton
let connection: Connection | null = null;
function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(GORBAGANA_CONFIG.rpcEndpoint, 'confirmed');
  }
  return connection;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface DomainAsset {
  name: string;
  address: string;
  owner: string;
  mint: string;
  image?: string;
}

export interface MarketplaceListing {
  id: string;
  domainName: string;
  domainMint: string;
  seller: string;
  price: number;        // Human-readable Wrapped GOR
  priceRaw: bigint;     // Base units (9 decimals)
  listedAt: number;
  escrowAccount?: string;
}

export interface MarketplaceSale {
  id: string;
  domainName: string;
  domainMint: string;
  seller: string;
  buyer: string;
  price: number;
  timestamp: number;
  txSignature: string;
}

// ─── DAS API - Domain Asset Queries ──────────────────────────────────

/** Get all .gor domains owned by a wallet via the DAS API */
export async function getDomainAssetsByOwner(ownerAddress: string): Promise<DomainAsset[]> {
  try {
    const response = await fetch(DAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAssetsByOwner',
        params: {
          ownerAddress,
          page: 1,
          limit: 1000,
        },
      }),
    });

    const data = await response.json();

    if (!data.result?.items) return [];

    return data.result.items
      .filter((asset: any) =>
        asset.interface === 'V1_NFT' &&
        asset.content?.metadata?.name?.endsWith('.gor')
      )
      .map((asset: any) => ({
        name: asset.content.metadata.name,
        address: asset.id,
        owner: asset.ownership.owner,
        mint: asset.id,
        image: asset.content?.files?.[0]?.uri,
      }));
  } catch (error) {
    console.error('DAS API: Error fetching domains by owner:', error);
    return [];
  }
}

/** Get a specific domain asset by mint address */
export async function getDomainAsset(mintAddress: string): Promise<DomainAsset | null> {
  try {
    const response = await fetch(DAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAsset',
        params: { id: mintAddress },
      }),
    });

    const data = await response.json();
    const asset = data.result;

    if (!asset || !asset.content?.metadata?.name?.endsWith('.gor')) return null;

    return {
      name: asset.content.metadata.name,
      address: asset.id,
      owner: asset.ownership.owner,
      mint: asset.id,
      image: asset.content?.files?.[0]?.uri,
    };
  } catch (error) {
    console.error('DAS API: Error fetching domain asset:', error);
    return null;
  }
}

// ─── Trading API - Marketplace Listings ──────────────────────────────

/** Fetch all active marketplace listings from the trading API */
export async function fetchListings(): Promise<MarketplaceListing[]> {
  let apiListings: MarketplaceListing[] = [];
  try {
    const response = await fetch(`${TRADING_API_URL}/listings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      apiListings = (data.listings || data || []).map((listing: any) => ({
        id: listing.id || listing.domainMint,
        domainName: listing.domainName || listing.name,
        domainMint: listing.domainMint || listing.mint,
        seller: listing.seller,
        price: listing.price || tradingAmountToHuman(BigInt(listing.priceRaw || '0')),
        priceRaw: BigInt(listing.priceRaw || humanToTradingAmount(listing.price || 0).toString()),
        listedAt: listing.listedAt || listing.timestamp || Date.now(),
        escrowAccount: listing.escrowAccount,
      }));
    } else {
      console.warn('Trading API: listings endpoint returned', response.status);
    }
  } catch (error) {
    console.error('Trading API: Error fetching listings:', error);
  }

  // Merge local listings from localStorage (created when API was unavailable)
  try {
    const localListings: any[] = JSON.parse(localStorage.getItem('gorid_local_listings') || '[]');
    const localMapped: MarketplaceListing[] = localListings.map((l: any) => ({
      id: l.id,
      domainName: l.domainName,
      domainMint: l.domainMint,
      seller: l.seller,
      price: l.price,
      priceRaw: BigInt(l.priceRaw || '0'),
      listedAt: l.listedAt || Date.now(),
    }));
    // Deduplicate by domainMint — API listings take priority
    const apiMints = new Set(apiListings.map(l => l.domainMint));
    const uniqueLocal = localMapped.filter(l => !apiMints.has(l.domainMint));
    return [...apiListings, ...uniqueLocal];
  } catch {
    return apiListings;
  }
}

/** Fetch recent sales from the trading API */
export async function fetchRecentSales(): Promise<MarketplaceSale[]> {
  try {
    const response = await fetch(`${TRADING_API_URL}/sales`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.warn('Trading API: sales endpoint returned', response.status);
      return [];
    }

    const data = await response.json();

    return (data.sales || data || []).map((sale: any) => ({
      id: sale.id || sale.txSignature,
      domainName: sale.domainName || sale.name,
      domainMint: sale.domainMint || sale.mint,
      seller: sale.seller || sale.from,
      buyer: sale.buyer || sale.to,
      price: sale.price,
      timestamp: sale.timestamp,
      txSignature: sale.txSignature || sale.signature,
    }));
  } catch (error) {
    console.error('Trading API: Error fetching sales:', error);
    return [];
  }
}

// ─── Transaction Building ────────────────────────────────────────────

/** Helper: ensure an Associated Token Account exists, return its address */
async function ensureATA(
  conn: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  transaction: Transaction,
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  try {
    await getAccount(conn, ata);
  } catch {
    // ATA doesn't exist yet — add creation instruction
    transaction.add(
      createAssociatedTokenAccountInstruction(payer, ata, owner, mint)
    );
  }
  return ata;
}

/**
 * Build a purchase transaction for a listed domain.
 *
 * The transaction:
 * 1. Transfers platform fee (Wrapped GOR) to fee recipient
 * 2. Transfers payment to seller (Wrapped GOR)
 * 3. Records the sale via the trading API
 *
 * NOTE: Domain transfer from escrow is handled by the trading API backend
 * after verifying the payment transaction on-chain.
 */
export async function buildPurchaseTransaction(
  buyerPubkey: PublicKey,
  listing: MarketplaceListing,
): Promise<Transaction> {
  const conn = getConnection();
  const priceRaw = humanToTradingAmount(listing.price);
  const fees = calculateFees(priceRaw);

  const transaction = new Transaction();

  // Buyer's Wrapped GOR ATA
  const buyerATA = await getAssociatedTokenAddress(WRAPPED_GOR_MINT, buyerPubkey);

  // Seller's Wrapped GOR ATA (ensure it exists)
  const sellerPubkey = new PublicKey(listing.seller);
  const sellerATA = await ensureATA(conn, WRAPPED_GOR_MINT, sellerPubkey, buyerPubkey, transaction);

  // Fee recipient ATA (ensure it exists)
  const feeATA = await ensureATA(conn, WRAPPED_GOR_MINT, FEE_RECIPIENT, buyerPubkey, transaction);

  // 1. Transfer platform fee
  transaction.add(
    createTransferInstruction(
      buyerATA,
      feeATA,
      buyerPubkey,
      fees.platformFee,
    )
  );

  // 2. Transfer payment to seller
  transaction.add(
    createTransferInstruction(
      buyerATA,
      sellerATA,
      buyerPubkey,
      fees.sellerReceives,
    )
  );

  // Set recent blockhash and fee payer
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = buyerPubkey;

  return transaction;
}

/**
 * Build a listing transaction.
 *
 * Posts the listing intent to the trading API which will
 * generate an escrow transaction for the seller to sign.
 */
export async function createListingViaAPI(
  sellerAddress: string,
  domainMint: string,
  domainName: string,
  priceHuman: number,
): Promise<{ listingId: string; transaction?: string } | null> {
  try {
    const response = await fetch(`${TRADING_API_URL}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seller: sellerAddress,
        domainMint,
        domainName,
        price: priceHuman,
        priceRaw: humanToTradingAmount(priceHuman).toString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Failed to create listing (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error('Trading API: Error creating listing, using local fallback:', error);
    // Local fallback: create a listing record locally when the API is unavailable
    const listingId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localListing = {
      id: listingId,
      domainName,
      domainMint,
      seller: sellerAddress,
      price: priceHuman,
      priceRaw: humanToTradingAmount(priceHuman).toString(),
      listedAt: Date.now(),
    };
    // Persist to localStorage so listings survive page reloads
    try {
      const existing = JSON.parse(localStorage.getItem('gorid_local_listings') || '[]');
      existing.push(localListing);
      localStorage.setItem('gorid_local_listings', JSON.stringify(existing));
    } catch (e) {
      console.warn('Failed to save local listing:', e);
    }
    return { listingId };
  }
}

/**
 * Confirm a purchase with the trading API after the on-chain transaction is confirmed.
 * This triggers the backend to release the domain NFT from escrow to the buyer.
 */
export async function confirmPurchase(
  listingId: string,
  buyerAddress: string,
  txSignature: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${TRADING_API_URL}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId,
        buyer: buyerAddress,
        txSignature,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Trading API: Error confirming purchase:', error);
    return false;
  }
}

/**
 * Cancel a listing via the trading API.
 * Returns the domain from escrow back to the seller.
 */
export async function cancelListing(
  listingId: string,
  sellerAddress: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${TRADING_API_URL}/listings/${listingId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seller: sellerAddress }),
    });

    if (response.ok && listingId.startsWith('local-')) {
      try {
        const existing = JSON.parse(localStorage.getItem('gorid_local_listings') || '[]');
        const updated = existing.filter((l: any) => l.id !== listingId);
        localStorage.setItem('gorid_local_listings', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to remove local listing:', e);
      }
    }
    return response.ok;
  } catch (error) {
    console.error('Trading API: Error cancelling listing:', error);
    if (listingId.startsWith('local-')) {
      try {
        const existing = JSON.parse(localStorage.getItem('gorid_local_listings') || '[]');
        const updated = existing.filter((l: any) => l.id !== listingId);
        localStorage.setItem('gorid_local_listings', JSON.stringify(updated));
        return true;
      } catch (e) {
        console.warn('Failed to remove local listing:', e);
      }
    }
    return false;
  }
}
