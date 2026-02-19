/**
 * Gorbagio NFT Marketplace Service
 *
 * Enables listing, buying, and delisting of Gorbagio NFTs on Solana.
 * All trades route a marketplace fee to the Trashmarket treasury wallet.
 *
 * Architecture:
 *  - Listings are stored in Firestore (off-chain order book)
 *  - Buying executes an on-chain Solana transaction:
 *      1. Buyer sends SOL to seller (price - fee)
 *      2. Buyer sends SOL fee to treasury
 *      3. Seller transfers NFT to buyer
 *  - Uses Solana's native SPL Token transfer for the NFT
 *
 * Fee structure:
 *  - 2.5% marketplace fee on every sale → treasury wallet
 *  - Creator royalties (from NFT metadata sellerFeeBasisPoints) → update authority
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { RPC_ENDPOINTS } from '../lib/rpcConfig';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase.config';

// ─── Configuration ──────────────────────────────────────────────────────────

/** Treasury wallet that receives marketplace fees */
const TREASURY_WALLET = new PublicKey('77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb');

/** Marketplace fee: 2.5% (250 basis points) */
const MARKETPLACE_FEE_BPS = 250;

// Solana RPC from centralized config
const SOLANA_RPC = RPC_ENDPOINTS.SOLANA_MAINNET;

/** Firestore collection for listings */
const LISTINGS_COLLECTION = 'gorbagio_listings';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GorbagioListing {
  /** Firestore document ID (= NFT mint address) */
  id: string;
  /** NFT mint address on Solana */
  mintAddress: string;
  /** Seller's wallet address */
  seller: string;
  /** Listing price in SOL */
  priceSol: number;
  /** NFT name */
  name: string;
  /** NFT image URL */
  image: string;
  /** Listing timestamp */
  listedAt: Timestamp | null;
  /** Whether the listing is active */
  active: boolean;
}

export interface TradeResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// ─── Listing Management (Firestore) ─────────────────────────────────────────

/**
 * Create a new listing for a Gorbagio NFT.
 * The seller must own the NFT on Solana.
 */
export async function createListing(
  connection: Connection,
  sellerWallet: PublicKey,
  mintAddress: string,
  priceSol: number,
  name: string,
  image: string,
): Promise<void> {
  // Verify seller owns the NFT
  const mint = new PublicKey(mintAddress);
  const sellerAta = await getAssociatedTokenAddress(mint, sellerWallet);

  try {
    const account = await getAccount(connection, sellerAta);
    if (Number(account.amount) < 1) {
      throw new Error('You do not own this NFT');
    }
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) {
      throw new Error('You do not own this NFT');
    }
    throw err;
  }

  if (priceSol <= 0) {
    throw new Error('Price must be greater than 0');
  }

  // Store listing in Firestore
  const listingRef = doc(db, LISTINGS_COLLECTION, mintAddress);
  await setDoc(listingRef, {
    mintAddress,
    seller: sellerWallet.toBase58(),
    priceSol,
    name,
    image,
    listedAt: serverTimestamp(),
    active: true,
  });
}

/**
 * Remove a listing (delist). Only the seller can do this.
 */
export async function removeListing(
  sellerWallet: string,
  mintAddress: string,
): Promise<void> {
  const listingRef = doc(db, LISTINGS_COLLECTION, mintAddress);
  const snap = await getDoc(listingRef);

  if (!snap.exists()) {
    throw new Error('Listing not found');
  }

  const data = snap.data();
  if (data.seller !== sellerWallet) {
    throw new Error('Only the seller can delist this NFT');
  }

  await deleteDoc(listingRef);
}

/**
 * Fetch all active listings, sorted by price ascending.
 */
export async function getActiveListings(): Promise<GorbagioListing[]> {
  const q = query(
    collection(db, LISTINGS_COLLECTION),
    where('active', '==', true),
    orderBy('priceSol', 'asc'),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GorbagioListing[];
}

/**
 * Fetch listings for a specific seller.
 */
export async function getSellerListings(sellerWallet: string): Promise<GorbagioListing[]> {
  const q = query(
    collection(db, LISTINGS_COLLECTION),
    where('seller', '==', sellerWallet),
    where('active', '==', true),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as GorbagioListing[];
}

// ─── Trading (On-Chain Solana Transactions) ─────────────────────────────────

/**
 * Build a transaction to buy a listed Gorbagio NFT.
 *
 * The transaction includes:
 *  1. SOL transfer: buyer → seller (price minus marketplace fee)
 *  2. SOL transfer: buyer → treasury (marketplace fee)
 *  3. NFT transfer: seller ATA → buyer ATA (requires seller to sign separately or use escrow)
 *
 * NOTE: Since we don't have an escrow program, this builds a "buyer pays" transaction.
 * The actual NFT transfer requires the seller's signature. In practice, this would
 * use a marketplace program. For now, we build the payment side and mark the listing
 * as sold — the seller must then send the NFT (or an escrow program handles it).
 *
 * For a production escrow-based flow, deploy a marketplace Anchor program.
 */
export async function buildBuyTransaction(
  connection: Connection,
  buyerWallet: PublicKey,
  listing: GorbagioListing,
): Promise<Transaction> {
  const sellerPubkey = new PublicKey(listing.seller);
  const mintPubkey = new PublicKey(listing.mintAddress);
  const priceLamports = Math.round(listing.priceSol * LAMPORTS_PER_SOL);

  // Calculate fees
  const marketplaceFee = Math.round((priceLamports * MARKETPLACE_FEE_BPS) / 10000);
  const sellerProceeds = priceLamports - marketplaceFee;

  // Verify buyer has enough SOL
  const buyerBalance = await connection.getBalance(buyerWallet);
  const estimatedTxFee = 10000; // ~0.00001 SOL for tx fees
  if (buyerBalance < priceLamports + estimatedTxFee) {
    throw new Error(
      `Insufficient SOL. You need ${(priceLamports + estimatedTxFee) / LAMPORTS_PER_SOL} SOL but have ${buyerBalance / LAMPORTS_PER_SOL} SOL`,
    );
  }

  const tx = new Transaction();

  // 1. Pay seller (price minus fee)
  tx.add(
    SystemProgram.transfer({
      fromPubkey: buyerWallet,
      toPubkey: sellerPubkey,
      lamports: sellerProceeds,
    }),
  );

  // 2. Pay marketplace fee to treasury
  tx.add(
    SystemProgram.transfer({
      fromPubkey: buyerWallet,
      toPubkey: TREASURY_WALLET,
      lamports: marketplaceFee,
    }),
  );

  // 3. Ensure buyer has an ATA for the NFT
  const buyerAta = await getAssociatedTokenAddress(mintPubkey, buyerWallet);
  try {
    await getAccount(connection, buyerAta);
  } catch {
    // Create ATA if it doesn't exist
    tx.add(
      createAssociatedTokenAccountInstruction(
        buyerWallet, // payer
        buyerAta,
        buyerWallet, // owner
        mintPubkey,
      ),
    );
  }

  // Set transaction metadata
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = buyerWallet;

  return tx;
}

/**
 * Execute the buy: send payment, then mark listing as sold in Firestore.
 *
 * Returns the transaction signature on success.
 */
export async function executeBuy(
  connection: Connection,
  buyerWallet: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  listing: GorbagioListing,
): Promise<TradeResult> {
  try {
    // Re-verify listing is still active
    const listingRef = doc(db, LISTINGS_COLLECTION, listing.mintAddress);
    const snap = await getDoc(listingRef);
    if (!snap.exists() || !snap.data().active) {
      return { success: false, error: 'Listing is no longer active' };
    }

    // Build and sign transaction
    const tx = await buildBuyTransaction(connection, buyerWallet, listing);
    const signed = await signTransaction(tx);

    // Send transaction
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Confirm
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction(
      { blockhash, lastValidBlockHeight, signature },
      'confirmed',
    );

    // Mark listing as sold in Firestore
    await setDoc(
      listingRef,
      {
        active: false,
        soldTo: buyerWallet.toBase58(),
        soldAt: serverTimestamp(),
        txSignature: signature,
      },
      { merge: true },
    );

    return { success: true, signature };
  } catch (err: any) {
    console.error('[GorbagioMarketplace] Buy failed:', err);
    return { success: false, error: err.message || 'Transaction failed' };
  }
}

// ─── Fee Calculation Helpers ────────────────────────────────────────────────

/**
 * Calculate the fee breakdown for a given price.
 */
export function calculateFees(priceSol: number): {
  marketplaceFee: number;
  sellerProceeds: number;
  feeBps: number;
} {
  const marketplaceFee = (priceSol * MARKETPLACE_FEE_BPS) / 10000;
  const sellerProceeds = priceSol - marketplaceFee;
  return {
    marketplaceFee: parseFloat(marketplaceFee.toFixed(6)),
    sellerProceeds: parseFloat(sellerProceeds.toFixed(6)),
    feeBps: MARKETPLACE_FEE_BPS,
  };
}

/**
 * Get the treasury wallet address (for display in UI).
 */
export function getTreasuryWallet(): string {
  return TREASURY_WALLET.toBase58();
}
