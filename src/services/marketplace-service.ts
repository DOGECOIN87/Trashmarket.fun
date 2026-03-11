import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import goridIdl from '../idl/gor_name_marketplace.json';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';
import { TRADING_CONFIG, calculateFees } from '../lib/trading-config';
import { humanToTradingAmount, tradingAmountToHuman } from '../utils/decimals';
import { RPC_ENDPOINTS } from '../lib/rpcConfig';

// API endpoints
const DAS_API_URL = `${RPC_ENDPOINTS.GORBAGANA_API}/das`;
const TRADING_API_URL = `${RPC_ENDPOINTS.GORBAGANA_API}/trading`;

// Name Service Program
const NAME_SERVICE_PROGRAM = new PublicKey('namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX');
const GORID_ESCROW_PROGRAM_ID = new PublicKey('GoRidLAhqsVEWYgH1JPdzYChyyUcFZPpJEBkJzUPYnw');
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

  return apiListings;
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




// ─── On-Chain Interaction (Direct Program Calls) ──────────────────────

/**
 * Get the Anchor program instance for Gorid Marketplace
 */
export function getGoridProgram(provider?: AnchorProvider): Program {
  const conn = getConnection();
  const activeProvider = provider || new AnchorProvider(
    conn,
    {
      publicKey: PublicKey.default,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    },
    { commitment: 'confirmed' }
  );
  const idlWithAddress = { ...goridIdl, address: GORID_ESCROW_PROGRAM_ID.toBase58() };
  return new Program(idlWithAddress as any, activeProvider);
}

/**
 * Derive the listing PDA for a specific name account
 */
export function getListingPDA(nameAccount: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("listing"), nameAccount.toBytes()],
    GORID_ESCROW_PROGRAM_ID
  );
}

/**
 * Derive the config PDA
 */
export function getConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("config")],
    GORID_ESCROW_PROGRAM_ID
  );
}

/**
 * Derive the fee vault PDA
 */
export function getFeeVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("fee_vault")],
    GORID_ESCROW_PROGRAM_ID
  );
}

/**
 * Fetch all active listings directly from the on-chain program
 */
/** Listing account discriminator: first 8 bytes of SHA256("account:Listing") */
const LISTING_DISCRIMINATOR = new Uint8Array([0xda, 0x20, 0x32, 0x49, 0x2b, 0x86, 0x1a, 0x3a]);

/** Decode a u64 from 8-byte little-endian Uint8Array */
function decodeU64(bytes: Uint8Array): bigint {
  let val = 0n;
  for (let i = 7; i >= 0; i--) {
    val = (val << 8n) | BigInt(bytes[i]);
  }
  return val;
}

/** Decode an i64 from 8-byte little-endian Uint8Array */
function decodeI64(bytes: Uint8Array): bigint {
  const unsigned = decodeU64(bytes);
  // Handle sign bit
  if (unsigned >= (1n << 63n)) {
    return unsigned - (1n << 64n);
  }
  return unsigned;
}

export async function fetchOnChainListings(): Promise<MarketplaceListing[]> {
  try {
    const conn = getConnection();
    // Listing account size: 8 (disc) + 32 (name) + 32 (seller) + 8 (price) + 1 (bump) + 8 (created_at) = 89
    const accounts = await conn.getProgramAccounts(GORID_ESCROW_PROGRAM_ID, {
      filters: [{ dataSize: 89 }],
    });

    return accounts
      .filter(({ account }) => {
        // Verify discriminator matches Listing
        const disc = new Uint8Array(account.data).slice(0, 8);
        return disc.every((b, i) => b === LISTING_DISCRIMINATOR[i]);
      })
      .map(({ pubkey, account }) => {
        const data = new Uint8Array(account.data);
        // Layout after 8-byte discriminator: name(32) + seller(32) + price(8) + bump(1) + created_at(8)
        const name = new PublicKey(data.slice(8, 40));
        const seller = new PublicKey(data.slice(40, 72));
        const price = decodeU64(data.slice(72, 80));
        const createdAt = decodeI64(data.slice(81, 89));

        return {
          id: pubkey.toBase58(),
          domainName: "",
          domainMint: name.toBase58(),
          seller: seller.toBase58(),
          price: tradingAmountToHuman(price),
          priceRaw: price,
          listedAt: Number(createdAt) * 1000,
          escrowAccount: pubkey.toBase58(),
        };
      });
  } catch (error) {
    console.error('Error fetching on-chain listings:', error);
    return [];
  }
}

// ─── Anchor Discriminators (first 8 bytes of SHA256("global:<snake_case_name>")) ───
const DISC_CREATE_LISTING = new Uint8Array([0x12, 0xa8, 0x2d, 0x18, 0xbf, 0x1f, 0x75, 0x36]);
const DISC_BUY_LISTING    = new Uint8Array([0x73, 0x95, 0x2a, 0x6c, 0x2c, 0x31, 0x8c, 0x99]);
const DISC_CANCEL_LISTING = new Uint8Array([0x29, 0xb7, 0x32, 0xe8, 0xe6, 0xe9, 0x9d, 0x46]);

/** Encode a u64 as 8-byte little-endian Uint8Array */
function encodeU64(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return buf;
}

/**
 * Create a listing transaction directly on-chain
 */
export async function createGoridListingOnChain(
  sellerPubkey: PublicKey,
  nameAccount: PublicKey,
  priceHuman: number,
): Promise<Transaction> {
  const [listingPDA] = getListingPDA(nameAccount);
  const priceRaw = humanToTradingAmount(priceHuman);

  const data = new Uint8Array([...DISC_CREATE_LISTING, ...encodeU64(priceRaw)]);

  const instruction = new TransactionInstruction({
    programId: GORID_ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: sellerPubkey, isSigner: true, isWritable: true },
      { pubkey: nameAccount, isSigner: false, isWritable: false },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as any,
  });

  const transaction = new Transaction().add(instruction);
  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = sellerPubkey;

  return transaction;
}

/**
 * Build a purchase transaction directly on-chain
 */
export async function buildOnChainPurchaseTransaction(
  buyerPubkey: PublicKey,
  listing: MarketplaceListing,
  nameAccountOverride?: PublicKey,
): Promise<Transaction> {
  const nameAccount = nameAccountOverride || new PublicKey(listing.domainMint);
  const [listingPDA] = getListingPDA(nameAccount);
  const [configPDA] = getConfigPDA();
  const [feeVaultPDA] = getFeeVaultPDA();
  const sellerPubkey = new PublicKey(listing.seller);

  // Fetch the config to get the admin wallet (fee recipient)
  const conn = getConnection();
  const program = getGoridProgram();
  const configAccount = await (program.account as any).config.fetch(configPDA);
  const platformAdmin = configAccount.admin as PublicKey;

  const instruction = new TransactionInstruction({
    programId: GORID_ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: feeVaultPDA, isSigner: false, isWritable: true },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: sellerPubkey, isSigner: false, isWritable: true },
      { pubkey: buyerPubkey, isSigner: true, isWritable: true },
      { pubkey: nameAccount, isSigner: false, isWritable: true },
      { pubkey: NAME_SERVICE_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: platformAdmin, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISC_BUY_LISTING as any,
  });

  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = buyerPubkey;

  return transaction;
}

/**
 * Build a cancel listing transaction directly on-chain
 */
export async function buildOnChainCancelTransaction(
  sellerPubkey: PublicKey,
  nameAccount: PublicKey,
): Promise<Transaction> {
  const [listingPDA] = getListingPDA(nameAccount);

  const instruction = new TransactionInstruction({
    programId: GORID_ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: sellerPubkey, isSigner: true, isWritable: true },
      { pubkey: nameAccount, isSigner: false, isWritable: false },
    ],
    data: DISC_CANCEL_LISTING as any,
  });

  const transaction = new Transaction().add(instruction);
  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = sellerPubkey;

  return transaction;
}
