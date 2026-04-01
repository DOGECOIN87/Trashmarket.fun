/**
 * Launchpad Service — BRUH, IT'S JUST ALIENS Collection
 *
 * On-chain interactions for the Just Aliens NFT collection on Gorbagana.
 * Program ID: 9CzjUboaFZtUhtkqVN2wgWEunDasdorwo6CJfYrJWngj
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { RPC_ENDPOINTS } from '../lib/rpcConfig';
import idl from '../idl/nft_launchpad.json';

// ─── Constants ───────────────────────────────────────────────────────────────

export const LAUNCHPAD_PROGRAM_ID = new PublicKey(
  '9CzjUboaFZtUhtkqVN2wgWEunDasdorwo6CJfYrJWngj',
);

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

const TREASURY = new PublicKey('Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo');

// ─── Collection Config (display only — truth is on-chain) ────────────────────

export const JUST_ALIENS_CONFIG = {
  programId: LAUNCHPAD_PROGRAM_ID.toBase58(),
  collectionName: "BRUH, IT'S JUST ALIENS",
  tagline: 'DUDE RELAX',
  symbol: 'JALIEN',
  description:
    'Born from the buzz surrounding recent UFO disclosures and Alien speculation. In a time when Aliens are dominating headlines, we offer a fun way to explore the mystery, reminding everyone to chill out and enjoy the ride.',
  totalSupply: 10000,
  mintPrice: 200,
  maxPerWallet: 50,
  treasury: TREASURY.toBase58(),

  previewImages: [
    '/nft-previews/just-aliens/10.png',
    '/nft-previews/just-aliens/11.png',
    '/nft-previews/just-aliens/12.png',
    '/nft-previews/just-aliens/15.png',
    '/nft-previews/just-aliens/18.png',
    '/nft-previews/just-aliens/47.png',
  ],

  website: 'https://justaliens.space',
  twitter: 'https://x.com/just_aliens',
  discord: 'https://discord.gg/xEeTyrTb',
  telegram: 'https://t.me/JustAliensNFT',

  rarityTiers: [
    {
      name: 'Standard',
      percentage: 70,
      count: 7000,
      description: 'Base collection — unique trait combinations',
      color: '#adff02',
    },
    {
      name: 'Rare',
      percentage: 24,
      count: 2400,
      description: 'Special editions including Android and Infantry types',
      color: '#9945ff',
    },
    {
      name: 'Secret Rare',
      percentage: 0.06,
      count: 6,
      description: 'Ultra-rare animated GIF variants — only 6 in existence',
      color: '#ff00ff',
    },
  ] as { name: string; percentage: number; count: number; description: string; color: string }[],

  traitCategories: ['Background', 'Clothing', 'Expression'] as string[],
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CollectionState {
  name: string;
  symbol: string;
  description: string;
  totalSupply: number;
  mintPrice: number;
  itemsMinted: number;
  isLive: boolean;
  goLiveDate: Date | null;
  previewImages: string[];
}

export interface MintResult {
  success: boolean;
  signature?: string;
  mintAddress?: string;
  metadataAddress?: string;
  name?: string;
  imageUri?: string;
  index?: number;
  error?: string;
}

// ─── PDA Helpers ─────────────────────────────────────────────────────────────

export function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    LAUNCHPAD_PROGRAM_ID,
  );
}

export function getMetadataPda(mintPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintPubkey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

export function getMasterEditionPda(mintPubkey: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintPubkey.toBuffer(),
      Buffer.from('edition'),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

// ─── Connection / Program ────────────────────────────────────────────────────

function getConnection(): Connection {
  return new Connection(RPC_ENDPOINTS.GORBAGANA, 'confirmed');
}

function getReadOnlyProgram(connection: Connection): Program {
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: Transaction) => tx,
    signAllTransactions: async (txs: Transaction[]) => txs,
  } as unknown as Wallet;
  const provider = new AnchorProvider(connection, dummyWallet, {
    commitment: 'confirmed',
  });
  return new Program(idl as any, provider);
}

// ─── Fetch Collection State ───────────────────────────────────────────────────

/**
 * Fetch the live collection state from the on-chain config PDA.
 * Falls back to static config values if the program account isn't found yet.
 */
export async function fetchCollectionState(): Promise<CollectionState> {
  const connection = getConnection();
  const program = getReadOnlyProgram(connection);
  const [configPda] = getConfigPda();

  try {
    const config = await (program.account as any).launchpadConfig.fetch(configPda);

    const goLiveTs: number = config.goLiveTimestamp.toNumber();
    const now = Date.now() / 1000;
    const isLive: boolean = config.isLive && goLiveTs <= now;

    return {
      name: JUST_ALIENS_CONFIG.collectionName,
      symbol: JUST_ALIENS_CONFIG.symbol,
      description: JUST_ALIENS_CONFIG.description,
      totalSupply: config.maxSupply.toNumber(),
      mintPrice: config.mintPrice.toNumber() / 1e9,
      itemsMinted: config.itemsMinted.toNumber(),
      isLive,
      goLiveDate: goLiveTs > 0 ? new Date(goLiveTs * 1000) : null,
      previewImages: JUST_ALIENS_CONFIG.previewImages,
    };
  } catch {
    // Program not yet initialized — return static defaults
    return {
      name: JUST_ALIENS_CONFIG.collectionName,
      symbol: JUST_ALIENS_CONFIG.symbol,
      description: JUST_ALIENS_CONFIG.description,
      totalSupply: JUST_ALIENS_CONFIG.totalSupply,
      mintPrice: JUST_ALIENS_CONFIG.mintPrice,
      itemsMinted: 0,
      isLive: false,
      goLiveDate: null,
      previewImages: JUST_ALIENS_CONFIG.previewImages,
    };
  }
}

// ─── Mint ─────────────────────────────────────────────────────────────────────

/**
 * Mint one JUST ALIENS NFT.
 *
 * Flow:
 *  1. Generate a fresh Keypair for the NFT mint
 *  2. Derive metadata + master edition PDAs
 *  3. Derive minter's ATA
 *  4. Build the `mintNft` transaction via Anchor
 *  5. Partial-sign with the nftMint keypair (required since it's being `init`'d)
 *  6. Hand off to the user's wallet for the minter signature
 *  7. Broadcast + confirm
 */
export async function mintJustAlien(
  walletAddress: string,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
): Promise<MintResult> {
  const connection = getConnection();
  const minterPubkey = new PublicKey(walletAddress);

  // Verify collection state first
  let state: CollectionState;
  try {
    state = await fetchCollectionState();
  } catch {
    return { success: false, error: 'Could not fetch collection state. Check your connection.' };
  }

  if (!state.isLive) {
    return { success: false, error: 'Minting is not live yet. Stay tuned!' };
  }
  if (state.itemsMinted >= state.totalSupply) {
    return { success: false, error: 'Collection is sold out!' };
  }

  // Build a minimal wallet adapter for the read-only provider (minter signs via signTransaction)
  const walletAdapter = {
    publicKey: minterPubkey,
    signTransaction,
    signAllTransactions: async (txs: Transaction[]) => {
      const signed: Transaction[] = [];
      for (const tx of txs) signed.push(await signTransaction(tx));
      return signed;
    },
  } as unknown as Wallet;

  const provider = new AnchorProvider(connection, walletAdapter, {
    commitment: 'confirmed',
    preflightCommitment: 'processed',
  });
  const program = new Program(idl as any, provider);

  // Fresh mint keypair for this NFT
  const nftMintKeypair = Keypair.generate();
  const nftMintPubkey = nftMintKeypair.publicKey;

  // Derive all PDAs
  const [configPda] = getConfigPda();
  const metadataPda = getMetadataPda(nftMintPubkey);
  const masterEditionPda = getMasterEditionPda(nftMintPubkey);
  const minterAta = await getAssociatedTokenAddress(nftMintPubkey, minterPubkey);

  try {
    // Build the transaction
    const tx = await (program.methods as any)
      .mintNft()
      .accounts({
        minter: minterPubkey,
        config: configPda,
        treasury: TREASURY,
        nftMint: nftMintPubkey,
        minterAta,
        metadata: metadataPda,
        masterEdition: masterEditionPda,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .transaction();

    // Set fee payer first, then fetch blockhash as late as possible
    tx.feePayer = minterPubkey;

    // The nftMint keypair must sign because it's being initialized by the program
    // Fetch blockhash right before signing to maximize validity window
    const { blockhash } = await connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.partialSign(nftMintKeypair);

    // Wallet signs (minter) — user approval happens here
    const signedTx = await signTransaction(tx);

    // Broadcast with skipPreflight to minimize latency after user approves
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
    });

    // Poll for confirmation instead of relying on lastValidBlockHeight
    let confirmed = false;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const status = await connection.getSignatureStatus(signature);
      const conf = status.value?.confirmationStatus;
      if (conf === 'confirmed' || conf === 'finalized') { confirmed = true; break; }
      if (status.value?.err) throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
    }
    if (!confirmed) throw new Error('Transaction confirmation timed out — check Trashscan for your signature');

    // Fetch image URI directly from IPFS using the known CID + token index
    // (avoids binary metadata parsing offset issues)
    let imageUri = '';
    let nftName = `${JUST_ALIENS_CONFIG.collectionName} #${state.itemsMinted + 1}`;
    try {
      const tokenIndex = state.itemsMinted; // index before increment = this token's index
      const ipfsCid = 'QmQGUyTty66iXCoJyT8H7aUBBFo5sFidWNoR7Kp8Vkq2xh';
      const metadataUri = `https://ipfs.io/ipfs/${ipfsCid}/${tokenIndex}.json`;
      const resp = await fetch(metadataUri);
      if (resp.ok) {
        const json = await resp.json();
        imageUri = json.image || '';
        if (json.name) nftName = json.name;
      }
    } catch {
      // Non-fatal — image display is best-effort
    }

    return {
      success: true,
      signature,
      mintAddress: nftMintPubkey.toBase58(),
      metadataAddress: metadataPda.toBase58(),
      name: nftName,
      imageUri,
      index: state.itemsMinted,
    };
  } catch (err: any) {
    const message: string = err?.message || 'Unknown error';
    const logs: string[] = err?.logs || [];

    // Parse program error codes
    if (logs.some((l: string) => l.includes('MintingNotLive')) || message.includes('MintingNotLive')) {
      return { success: false, error: 'Minting is not live yet.' };
    }
    if (logs.some((l: string) => l.includes('SoldOut')) || message.includes('SoldOut')) {
      return { success: false, error: 'Collection is sold out!' };
    }
    if (message.includes('insufficient') || message.includes('0x1')) {
      return {
        success: false,
        error: `Insufficient GOR balance. You need at least ${JUST_ALIENS_CONFIG.mintPrice} GOR plus fees.`,
      };
    }
    if (message.includes('rejected') || message.includes('User rejected')) {
      return { success: false, error: 'Transaction was rejected.' };
    }

    console.error('[mintJustAlien] Error:', err);
    return { success: false, error: `Mint failed: ${message}` };
  }
}

// ─── Admin Helpers (for initialize script) ───────────────────────────────────

/**
 * Fetch raw config PDA data — useful for admin dashboards.
 */
export async function fetchRawConfig() {
  const connection = getConnection();
  const program = getReadOnlyProgram(connection);
  const [configPda] = getConfigPda();
  try {
    return await (program.account as any).launchpadConfig.fetch(configPda);
  } catch {
    return null;
  }
}
