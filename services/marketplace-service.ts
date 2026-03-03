import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import goridIdl from '../idl/gor_name_marketplace.json';
import {
  getAssociatedTokenAddress,
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
const GORID_ESCROW_PROGRAM_ID = new PublicKey('GorNMkt1111111111111111111111111111111111111'); 
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
  return new Program(goridIdl as Idl, GORID_ESCROW_PROGRAM_ID, activeProvider);
}

/**
 * Derive the listing PDA for a specific name account
 */
export function getListingPDA(nameAccount: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), nameAccount.toBuffer()],
    GORID_ESCROW_PROGRAM_ID
  );
}

/**
 * Derive the config PDA
 */
export function getConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    GORID_ESCROW_PROGRAM_ID
  );
}

/**
 * Derive the fee vault PDA
 */
export function getFeeVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault")],
    GORID_ESCROW_PROGRAM_ID
  );
}

/**
 * Fetch all active listings directly from the on-chain program
 */
export async function fetchOnChainListings(): Promise<MarketplaceListing[]> {
  try {
    const program = getGoridProgram();
    const accounts = await program.account.listing.all();
    
    return accounts.map(acc => {
      const data = acc.account as any;
      return {
        id: acc.publicKey.toBase58(),
        domainName: "", // Will be resolved by the caller if needed
        domainMint: data.name.toBase58(),
        seller: data.seller.toBase58(),
        price: tradingAmountToHuman(BigInt(data.price.toString())),
        priceRaw: BigInt(data.price.toString()),
        listedAt: data.createdAt.toNumber() * 1000,
        escrowAccount: acc.publicKey.toBase58(),
      };
    });
  } catch (error) {
    console.error('Error fetching on-chain listings:', error);
    return [];
  }
}

/**
 * Create a listing transaction directly on-chain
 */
export async function createGoridListingOnChain(
  sellerPubkey: PublicKey,
  nameAccount: PublicKey,
  priceHuman: number,
): Promise<Transaction> {
  const program = getGoridProgram();
  const [listingPDA] = getListingPDA(nameAccount);
  const priceRaw = humanToTradingAmount(priceHuman);

  const instruction = await program.methods
    .createListing(new BN(priceRaw.toString()))
    .accounts({
      seller: sellerPubkey,
      name: nameAccount,
      listing: listingPDA,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

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
): Promise<Transaction> {
  const program = getGoridProgram();
  const nameAccount = new PublicKey(listing.domainMint);
  const [listingPDA] = getListingPDA(nameAccount);
  const [configPDA] = getConfigPDA();
  const [feeVaultPDA] = getFeeVaultPDA();
  const sellerPubkey = new PublicKey(listing.seller);

  const instruction = await program.methods
    .buyListing()
    .accounts({
      config: configPDA,
      feeVault: feeVaultPDA,
      listing: listingPDA,
      seller: sellerPubkey,
      buyer: buyerPubkey,
      name: nameAccount,
      nameServiceProgram: NAME_SERVICE_PROGRAM,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const transaction = new Transaction().add(instruction);
  const conn = getConnection();
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
  const program = getGoridProgram();
  const [listingPDA] = getListingPDA(nameAccount);

  const instruction = await program.methods
    .cancelListing()
    .accounts({
      listing: listingPDA,
      seller: sellerPubkey,
      name: nameAccount,
    })
    .instruction();

  const transaction = new Transaction().add(instruction);
  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = sellerPubkey;

  return transaction;
}
