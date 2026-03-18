/**
 * Gorbagio NFT Marketplace Service
 *
 * On-chain marketplace for Gorbagio NFTs on Gorbagana.
 * Listings stored on-chain via PDA accounts, NFTs escrowed in program-controlled token accounts.
 * Payments in native GOR (9 decimals) via system_program::transfer.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';
import { RPC_ENDPOINTS, EXPLORER_URLS } from '../lib/rpcConfig';
// Native GOR uses 9 decimals on Gorbagana (SVM L2, same as SOL lamports)
const GOR_DECIMALS = 9;
const GOR_DIVISOR = 1_000_000_000;

// ─── Program Constants ──────────────────────────────────────────────────────

const MARKETPLACE_PROGRAM_ID = new PublicKey('DohoM3SvQzfcHVWH1r6BVTWdcNgYQxsxsTqxeZWBmL2E');

/** Gorbagio collection mint on Gorbagana */
const GORBAGIO_COLLECTION_MINT = new PublicKey('FBJ47AgQSzSWVQVzsspoUzcFVeEf8a6xihZKZgmRuno1');

/** Treasury wallet for marketplace fees */
const TREASURY = new PublicKey('77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb');

/** Metaplex Token Metadata program */
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

/** DAS API endpoint */
const DAS_API_URL = `${RPC_ENDPOINTS.GORBAGANA_API}/das`;

// ─── Connection Singleton ───────────────────────────────────────────────────

let connection: Connection | null = null;
function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(GORBAGANA_CONFIG.rpcEndpoint, 'confirmed');
  }
  return connection;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NftListingInfo {
  /** Listing PDA address */
  listingAddress: string;
  /** Seller wallet */
  seller: string;
  /** NFT mint address */
  nftMint: string;
  /** Price in native GOR (human-readable) */
  price: number;
  /** Price in raw lamports (9 decimals) */
  priceLamports: bigint;
  /** Listing timestamp (ms) */
  listedAt: number;
  /** NFT name (populated from metadata) */
  name?: string;
  /** NFT image URL */
  image?: string;
}

export interface WalletNft {
  mint: string;
  name: string;
  image: string;
  owner: string;
}

// ─── PDA Derivation ─────────────────────────────────────────────────────────

export function getMarketplaceConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('marketplace_config')],
    MARKETPLACE_PROGRAM_ID,
  );
}

export function getListingPDA(nftMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('listing'), nftMint.toBuffer()],
    MARKETPLACE_PROGRAM_ID,
  );
}

export function getEscrowNftPDA(nftMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_nft'), nftMint.toBuffer()],
    MARKETPLACE_PROGRAM_ID,
  );
}

export function getEscrowAuthorityPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('marketplace_authority')],
    MARKETPLACE_PROGRAM_ID,
  );
}

function getMetadataPDA(nftMint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METAPLEX_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
    METAPLEX_PROGRAM_ID,
  );
  return pda;
}

// ─── Binary Helpers ─────────────────────────────────────────────────────────

function encodeU64(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return buf;
}

function decodeU64(bytes: Uint8Array): bigint {
  let val = 0n;
  for (let i = 7; i >= 0; i--) {
    val = (val << 8n) | BigInt(bytes[i]);
  }
  return val;
}

function decodeI64(bytes: Uint8Array): bigint {
  const unsigned = decodeU64(bytes);
  if (unsigned >= (1n << 63n)) {
    return unsigned - (1n << 64n);
  }
  return unsigned;
}

/** Compute Anchor discriminator: SHA256("global:<name>")[0..8] */
async function computeDiscriminator(name: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(`global:${name}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash).slice(0, 8);
}

/** Compute Anchor account discriminator: SHA256("account:<Name>")[0..8] */
async function computeAccountDiscriminator(name: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(`account:${name}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash).slice(0, 8);
}

// ─── Price Conversion (Native GOR, 6 decimals) ─────────────────────────────

export function gorToLamports(gor: number): bigint {
  return BigInt(Math.round(gor * GOR_DIVISOR));
}

export function lamportsToGor(lamports: bigint): number {
  return Number(lamports) / GOR_DIVISOR;
}

export function formatGorPrice(lamports: bigint): string {
  return lamportsToGor(lamports).toFixed(2);
}

// ─── Fee Calculation ────────────────────────────────────────────────────────

const MARKETPLACE_FEE_BPS = 250; // 2.5%

export function calculateMarketplaceFees(priceGor: number) {
  const fee = (priceGor * MARKETPLACE_FEE_BPS) / 10000;
  return {
    marketplaceFee: parseFloat(fee.toFixed(6)),
    sellerProceeds: parseFloat((priceGor - fee).toFixed(6)),
    feeBps: MARKETPLACE_FEE_BPS,
  };
}

// ─── Read: Fetch Listings (On-Chain) ────────────────────────────────────────

/**
 * Fetch all active listings from on-chain program accounts.
 * Layout: disc(8) + seller(32) + nft_mint(32) + price(8) + created_at(8) + bump(1) = 89
 */
export async function fetchAllListings(conn?: Connection): Promise<NftListingInfo[]> {
  const c = conn || getConnection();
  try {
    const listingDiscriminator = await computeAccountDiscriminator('Listing');

    const accounts = await c.getProgramAccounts(MARKETPLACE_PROGRAM_ID, {
      filters: [{ dataSize: 8 + 81 }], // 89 bytes
    });

    const listings: NftListingInfo[] = [];

    for (const { pubkey, account } of accounts) {
      const data = new Uint8Array(account.data);
      const disc = data.slice(0, 8);

      // Verify discriminator
      if (!disc.every((b, i) => b === listingDiscriminator[i])) continue;

      const seller = new PublicKey(data.slice(8, 40));
      const nftMint = new PublicKey(data.slice(40, 72));
      const priceLamports = decodeU64(data.slice(72, 80));
      const createdAt = decodeI64(data.slice(80, 88));

      listings.push({
        listingAddress: pubkey.toBase58(),
        seller: seller.toBase58(),
        nftMint: nftMint.toBase58(),
        price: lamportsToGor(priceLamports),
        priceLamports,
        listedAt: Number(createdAt) * 1000,
      });
    }

    return listings.sort((a, b) => a.price - b.price);
  } catch (error) {
    console.error('[NFT Marketplace] Error fetching listings:', error);
    return [];
  }
}

// ─── Read: Fetch Wallet NFTs (DAS API) ──────────────────────────────────────

/**
 * Fetch Gorbagio NFTs owned by a wallet via the DAS API.
 * Filters to the Gorbagio collection mint.
 */
export async function fetchWalletNFTs(
  ownerAddress: string,
  conn?: Connection,
): Promise<WalletNft[]> {
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
      .filter((asset: any) => {
        // Filter to Gorbagio collection NFTs
        const grouping = asset.grouping || [];
        return grouping.some(
          (g: any) =>
            g.group_key === 'collection' &&
            g.group_value === GORBAGIO_COLLECTION_MINT.toBase58(),
        );
      })
      .map((asset: any) => ({
        mint: asset.id,
        name: asset.content?.metadata?.name || `Gorbagio #${asset.id.slice(-4)}`,
        image:
          asset.content?.links?.image ||
          asset.content?.files?.[0]?.uri ||
          '/assets/nft-placeholder.svg',
        owner: asset.ownership?.owner || ownerAddress,
      }));
  } catch (error) {
    console.error('[NFT Marketplace] Error fetching wallet NFTs:', error);
    return [];
  }
}

/**
 * Fetch metadata (name + image) for a single NFT mint via DAS API.
 */
export async function fetchNftMetadata(
  mintAddress: string,
): Promise<{ name: string; image: string } | null> {
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
    if (!asset) return null;

    return {
      name: asset.content?.metadata?.name || `Gorbagio #${mintAddress.slice(-4)}`,
      image:
        asset.content?.links?.image ||
        asset.content?.files?.[0]?.uri ||
        '/assets/nft-placeholder.svg',
    };
  } catch {
    return null;
  }
}

// ─── Write: Transaction Builders ────────────────────────────────────────────

/**
 * Build a transaction to list an NFT on the marketplace.
 */
export async function buildListNftTransaction(
  seller: PublicKey,
  nftMint: PublicKey,
  priceGor: number,
  conn?: Connection,
): Promise<Transaction> {
  const c = conn || getConnection();
  const priceLamports = gorToLamports(priceGor);

  const [marketplaceConfigPDA] = getMarketplaceConfigPDA();
  const [listingPDA] = getListingPDA(nftMint);
  const [escrowNftPDA] = getEscrowNftPDA(nftMint);
  const [escrowAuthority] = getEscrowAuthorityPDA();
  const metadataPDA = getMetadataPDA(nftMint);
  const sellerAta = await getAssociatedTokenAddress(nftMint, seller);

  const disc = await computeDiscriminator('list_nft');
  const data = new Uint8Array([...disc, ...encodeU64(priceLamports)]);

  const instruction = new TransactionInstruction({
    programId: MARKETPLACE_PROGRAM_ID,
    keys: [
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: marketplaceConfigPDA, isSigner: false, isWritable: false },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: nftMint, isSigner: false, isWritable: false },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: escrowNftPDA, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: metadataPDA, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  const tx = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = seller;

  return tx;
}

/**
 * Build a transaction to buy a listed NFT.
 */
export async function buildBuyNftTransaction(
  buyer: PublicKey,
  listing: NftListingInfo,
  conn?: Connection,
): Promise<Transaction> {
  const c = conn || getConnection();
  const nftMint = new PublicKey(listing.nftMint);
  const sellerPubkey = new PublicKey(listing.seller);

  const [marketplaceConfigPDA] = getMarketplaceConfigPDA();
  const [listingPDA] = getListingPDA(nftMint);
  const [escrowNftPDA] = getEscrowNftPDA(nftMint);
  const [escrowAuthority] = getEscrowAuthorityPDA();
  const buyerAta = await getAssociatedTokenAddress(nftMint, buyer);

  const disc = await computeDiscriminator('buy_nft');

  const tx = new Transaction();

  // Check if buyer ATA exists; if not, add create instruction
  const buyerAtaInfo = await c.getAccountInfo(buyerAta);
  if (!buyerAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(buyer, buyerAta, buyer, nftMint),
    );
  }

  const instruction = new TransactionInstruction({
    programId: MARKETPLACE_PROGRAM_ID,
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: sellerPubkey, isSigner: false, isWritable: true },
      { pubkey: marketplaceConfigPDA, isSigner: false, isWritable: false },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: nftMint, isSigner: false, isWritable: false },
      { pubkey: escrowNftPDA, isSigner: false, isWritable: true },
      { pubkey: buyerAta, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: TREASURY, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    data: Buffer.from(disc),
  });

  tx.add(instruction);
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = buyer;

  return tx;
}

/**
 * Build a transaction to cancel a listing and return NFT to seller.
 */
export async function buildCancelListingTransaction(
  seller: PublicKey,
  nftMint: PublicKey,
  conn?: Connection,
): Promise<Transaction> {
  const c = conn || getConnection();

  const [listingPDA] = getListingPDA(nftMint);
  const [escrowNftPDA] = getEscrowNftPDA(nftMint);
  const [escrowAuthority] = getEscrowAuthorityPDA();
  const sellerAta = await getAssociatedTokenAddress(nftMint, seller);

  const disc = await computeDiscriminator('cancel_listing');

  const instruction = new TransactionInstruction({
    programId: MARKETPLACE_PROGRAM_ID,
    keys: [
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: nftMint, isSigner: false, isWritable: false },
      { pubkey: escrowNftPDA, isSigner: false, isWritable: true },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(disc),
  });

  const tx = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = seller;

  return tx;
}

/**
 * Build a transaction to update listing price.
 */
export async function buildUpdatePriceTransaction(
  seller: PublicKey,
  nftMint: PublicKey,
  newPriceGor: number,
  conn?: Connection,
): Promise<Transaction> {
  const c = conn || getConnection();
  const newPriceLamports = gorToLamports(newPriceGor);

  const [listingPDA] = getListingPDA(nftMint);

  const disc = await computeDiscriminator('update_price');
  const data = new Uint8Array([...disc, ...encodeU64(newPriceLamports)]);

  const instruction = new TransactionInstruction({
    programId: MARKETPLACE_PROGRAM_ID,
    keys: [
      { pubkey: seller, isSigner: true, isWritable: false },
      { pubkey: listingPDA, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });

  const tx = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = seller;

  return tx;
}

// ─── Explorer Link ──────────────────────────────────────────────────────────

export function getExplorerTxLink(signature: string): string {
  return `${EXPLORER_URLS.GORBAGANA}/tx/${signature}`;
}

export function getExplorerAddressLink(address: string): string {
  return `${EXPLORER_URLS.GORBAGANA}/address/${address}`;
}
