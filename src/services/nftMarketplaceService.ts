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

/** DAS API endpoint (root, not /das — that path returns HTML) */
const DAS_API_URL = RPC_ENDPOINTS.GORBAGANA_API;

/** Allowed NFT symbols for the marketplace */
const ALLOWED_SYMBOLS = ['GORBAGIO', 'GORI'];

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

// ─── Price Conversion (Native GOR, 9 decimals) ─────────────────────────────

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

// ─── Read: Fetch Wallet NFTs (RPC on-chain metadata) ────────────────────────

/**
 * Parse on-chain Metaplex metadata account to extract name, symbol, and URI.
 * Layout: key(1) + update_authority(32) + mint(32) + name(4+32) + symbol(4+10) + uri(4+200) + ...
 */
function parseMetaplexMetadata(
  data: Buffer,
): { name: string; symbol: string; uri: string } | null {
  try {
    let offset = 1 + 32 + 32; // skip key, update_authority, mint
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.subarray(offset, offset + nameLen).toString('utf-8').replace(/\0+$/, '');
    offset += nameLen;
    const symLen = data.readUInt32LE(offset);
    offset += 4;
    const symbol = data.subarray(offset, offset + symLen).toString('utf-8').replace(/\0+$/, '');
    offset += symLen;
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.subarray(offset, offset + uriLen).toString('utf-8').replace(/\0+$/, '');
    return { name, symbol, uri };
  } catch {
    return null;
  }
}

/**
 * Fetch on-chain Metaplex metadata for multiple NFT mints in a single RPC call.
 */
async function fetchOnChainMetadataBatch(
  mints: string[],
  conn: Connection,
): Promise<Map<string, { name: string; symbol: string; uri: string }>> {
  const results = new Map<string, { name: string; symbol: string; uri: string }>();
  if (mints.length === 0) return results;

  const metadataPDAs = mints.map((mint) => getMetadataPDA(new PublicKey(mint)));
  const accounts = await conn.getMultipleAccountsInfo(metadataPDAs);

  for (let i = 0; i < mints.length; i++) {
    const account = accounts[i];
    if (!account?.data) continue;
    // Ensure data is a Buffer (getMultipleAccountsInfo may return Uint8Array)
    const buf = Buffer.isBuffer(account.data) ? account.data : Buffer.from(account.data);
    const parsed = parseMetaplexMetadata(buf);
    if (parsed) {
      results.set(mints[i], parsed);
    }
  }

  return results;
}

/** In-memory image cache to avoid re-fetching */
const imageCache = new Map<string, string>();

/**
 * Gorbagio image base URL — images follow pattern {BASE}/{N}.png
 * Derived from on-chain metadata; hosted on Pinata.
 */
const GORBAGIO_IMAGE_BASE =
  'https://plum-far-bobcat-940.mypinata.cloud/ipfs/bafybeihkdrontwttwgcaqlpifsav2pvyzyi2m4otl2jeklp4dbdzasdcu4';

/**
 * Gorigin image CID mapping — loaded once from static JSON.
 * Maps NFT number → IPFS CID (e.g., "337" → "QmZpKxFn...")
 */
let goriginImageMap: Record<string, string> | null = null;
let goriginMapLoading: Promise<void> | null = null;

export async function loadGoriginImageMap(): Promise<void> {
  if (goriginImageMap) return;
  if (goriginMapLoading) return goriginMapLoading;

  goriginMapLoading = (async () => {
    try {
      const resp = await fetch('data/gorigin-images.json');
      if (resp.ok) {
        goriginImageMap = await resp.json();
      } else {
        console.warn('[NFT] Failed to load gorigin-images.json:', resp.status);
        goriginImageMap = {};
      }
    } catch (err) {
      console.warn('[NFT] Failed to load gorigin-images.json:', err);
      goriginImageMap = {};
    }
  })();
  return goriginMapLoading;
}

/**
 * Resolve NFT image URL directly from on-chain metadata name + symbol.
 * No IPFS JSON fetch needed — uses predictable URL patterns or static mapping.
 */
export function resolveNftImageDirect(name: string, symbol: string): string {
  // Extract NFT number from name (e.g., "Gorbagio #700" → "700", "Gorigin #337" → "337")
  const numMatch = name.match(/#(\d+)/);
  if (!numMatch) return '/assets/nft-placeholder.svg';
  const num = numMatch[1];

  if (symbol === 'GORBAGIO') {
    return `${GORBAGIO_IMAGE_BASE}/${num}.png`;
  }

  if (symbol === 'GORI' && goriginImageMap) {
    const cid = goriginImageMap[num];
    if (cid) {
      return `https://plum-far-bobcat-940.mypinata.cloud/ipfs/${cid}`;
    }
  }

  return '/assets/nft-placeholder.svg';
}

/**
 * Fallback: Resolve image by fetching off-chain JSON metadata (slow, unreliable).
 * Only used when direct resolution fails.
 */
async function resolveNftImageFromJson(jsonUri: string): Promise<string> {
  if (!jsonUri) return '/assets/nft-placeholder.svg';
  const cached = imageCache.get(jsonUri);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(jsonUri, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return '/assets/nft-placeholder.svg';
    const json = await response.json();
    const image = json.image || json.image_url || '/assets/nft-placeholder.svg';
    imageCache.set(jsonUri, image);
    return image;
  } catch {
    return '/assets/nft-placeholder.svg';
  }
}

/**
 * Fetch Gorbagio/Gorigin NFTs owned by a wallet.
 *
 * Uses RPC getTokenAccountsByOwner to find NFT mints (decimals=0, amount=1),
 * then on-chain Metaplex metadata for name/symbol/uri, filtering by allowed symbols.
 * Images resolved from off-chain JSON (IPFS).
 */
export async function fetchWalletNFTs(
  ownerAddress: string,
  conn?: Connection,
): Promise<WalletNft[]> {
  const c = conn || getConnection();
  try {
    // Step 1: Get all token accounts for the wallet
    const tokenAccounts = await c.getParsedTokenAccountsByOwner(
      new PublicKey(ownerAddress),
      { programId: TOKEN_PROGRAM_ID },
    );

    // Step 2: Filter to NFTs (decimals=0, amount=1)
    const nftMints = tokenAccounts.value
      .filter((ta) => {
        const info = ta.account.data.parsed.info;
        return (
          info.tokenAmount.decimals === 0 &&
          parseInt(info.tokenAmount.amount) === 1
        );
      })
      .map((ta) => ta.account.data.parsed.info.mint as string);

    if (nftMints.length === 0) return [];

    // Step 3: Fetch on-chain metadata in batches of 100 (getMultipleAccountsInfo limit)
    const BATCH_SIZE = 100;
    const allMetadata = new Map<string, { name: string; symbol: string; uri: string }>();

    for (let i = 0; i < nftMints.length; i += BATCH_SIZE) {
      const batch = nftMints.slice(i, i + BATCH_SIZE);
      const batchMeta = await fetchOnChainMetadataBatch(batch, c);
      batchMeta.forEach((v, k) => allMetadata.set(k, v));
    }

    // Step 4: Filter by allowed symbols and resolve images
    const filtered = Array.from(allMetadata.entries()).filter(
      ([, meta]) => ALLOWED_SYMBOLS.includes(meta.symbol),
    );

    // Load Gorigin image map (no-op if already loaded)
    await loadGoriginImageMap();

    // Resolve images: direct URL first, fallback to off-chain JSON if needed
    const results: WalletNft[] = [];
    for (const [mint, meta] of filtered) {
      let image = resolveNftImageDirect(meta.name, meta.symbol);
      if (image === '/assets/nft-placeholder.svg' && meta.uri) {
        image = await resolveNftImageFromJson(meta.uri);
      }
      results.push({
        mint,
        name: meta.name || `NFT #${mint.slice(-4)}`,
        image,
        owner: ownerAddress,
      });
    }
    return results;
  } catch (error) {
    console.error('[NFT Marketplace] Error fetching wallet NFTs:', error);
    return [];
  }
}

/**
 * Fetch metadata (name + image) for a single NFT mint via on-chain metadata + off-chain JSON.
 */
export async function fetchNftMetadata(
  mintAddress: string,
  conn?: Connection,
): Promise<{ name: string; image: string } | null> {
  const c = conn || getConnection();
  const metadataMap = await fetchOnChainMetadataBatch([mintAddress], c);
  const meta = metadataMap.get(mintAddress);
  if (!meta) return null;

  await loadGoriginImageMap();
  let image = resolveNftImageDirect(meta.name, meta.symbol);
  // Fallback to JSON fetch if direct resolution returned placeholder and URI exists
  if (image === '/assets/nft-placeholder.svg' && meta.uri) {
    image = await resolveNftImageFromJson(meta.uri);
  }
  return {
    name: meta.name || `NFT #${mintAddress.slice(-4)}`,
    image,
  };
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
