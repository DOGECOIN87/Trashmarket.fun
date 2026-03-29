/**
 * Gorbagio NFT Migration Service
 *
 * Builds transactions for migrating legacy Gorbagio NFTs to Metaplex Token Metadata standard.
 * Uses the on-chain GorMigrate program deployed on Gorbagana.
 *
 * The on-chain program (gorbagio_migration_program_final.rs) uses token_interface types
 * for the legacy Token-2022 side and standard SPL Token for the new Metaplex NFT side.
 * The program must be deployed to Gorbagana before migration transactions will work.
 * Replace MIGRATION_PROGRAM_ID_STR with the deployed program address after deployment.
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  Transaction,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

// Program IDs — MIGRATION_PROGRAM_ID is a placeholder until the program is deployed.
// Kept as a string to avoid crashing the module on import (invalid base58).
const MIGRATION_PROGRAM_ID_STR = '3PtknVekKAYAYExL6YQWxf6bycpGWoQQ9tNM566qzKmU';
const METAPLEX_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

// Gorbagio collection update authority on Gorbagana (Token-2022 metadata)
const GORBAGIO_UPDATE_AUTHORITY = new PublicKey('fair1sCzkkPSvF44QGoD89ThvZdK1e4vP1jBKxW3v7M');

// Gorbagio collection NFT mint on Gorbagana
const GORBAGIO_COLLECTION_MINT = new PublicKey('FBJ47AgQSzSWVQVzsspoUzcFVeEf8a6xihZKZgmRuno1');

// Treasury wallet that receives migration fees
const TREASURY_WALLET = new PublicKey('77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb');

// Anchor discriminator for migrate_gorbagio instruction
// sha256("global:migrate_gorbagio")[0..8]
const MIGRATE_DISCRIMINATOR = Buffer.from([
  0x4e, 0xd2, 0x1e, 0x0c, 0x73, 0x37, 0x74, 0x96,
]);

/** Get the migration program ID. Throws if the placeholder hasn't been replaced with a real address. */
function getMigrationProgramId(): PublicKey {
  try {
    return new PublicKey(MIGRATION_PROGRAM_ID_STR);
  } catch {
    throw new Error(
      'Migration program ID is not a valid public key. Replace MIGRATION_PROGRAM_ID_STR with the deployed program address.',
    );
  }
}

export interface LegacyGorbagio {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  image: string;
  tokenAccount: string;
}

/**
 * Fetch legacy Gorbagio NFTs owned by the user on Gorbagana.
 *
 * Legacy Gorbagios are Token-2022 mints with inline metadata extension.
 * They have update authority = fair1sCzkkPSvF44QGoD89ThvZdK1e4vP1jBKxW3v7M
 * and sizes 419-420 bytes (metadata extension with name/symbol/uri).
 */
export async function fetchUserLegacyGorbagios(
  connection: Connection,
  walletAddress: PublicKey,
): Promise<LegacyGorbagio[]> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { programId: TOKEN_2022_PROGRAM_ID },
    );

    // Filter for NFTs (amount=1, decimals=0)
    const nftAccounts = tokenAccounts.value.filter((ta) => {
      const info = ta.account.data.parsed?.info;
      return (
        info &&
        info.tokenAmount?.uiAmount === 1 &&
        info.tokenAmount?.decimals === 0
      );
    });

    if (nftAccounts.length === 0) return [];

    // Fetch mint accounts to read metadata extensions.
    // getMultipleAccountsInfo supports max 100 per call — batch if needed.
    const mintAddresses = nftAccounts.map((ta) => new PublicKey(ta.account.data.parsed.info.mint));
    const BATCH_SIZE = 100;
    const mintInfos: (ReturnType<Connection['getAccountInfo']> extends Promise<infer T> ? T : never)[] = [];
    for (let i = 0; i < mintAddresses.length; i += BATCH_SIZE) {
      const batch = mintAddresses.slice(i, i + BATCH_SIZE);
      const results = await connection.getMultipleAccountsInfo(batch);
      mintInfos.push(...results);
    }

    const gorbagios: LegacyGorbagio[] = [];

    for (let i = 0; i < mintInfos.length; i++) {
      const mintInfo = mintInfos[i];
      if (!mintInfo || mintInfo.data.length < 300) continue;

      const data = Buffer.from(mintInfo.data);
      const metadata = parseToken2022Metadata(data);
      if (!metadata) continue;

      // Verify it's a Gorbagio by checking update authority
      if (!metadata.updateAuthority.equals(GORBAGIO_UPDATE_AUTHORITY)) continue;

      gorbagios.push({
        mint: mintAddresses[i].toBase58(),
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        image: '', // Fetched below
        tokenAccount: nftAccounts[i].pubkey.toBase58(),
      });
    }

    // Fetch images from URI metadata in parallel (try primary, then fallback IPFS gateway)
    await Promise.all(
      gorbagios.map(async (g) => {
        if (!g.uri) return;
        const uris = [g.uri];
        // Add ipfs.io fallback if it's a Pinata gateway URL
        const ipfsMatch = g.uri.match(/\/ipfs\/(.+)$/);
        if (ipfsMatch) {
          uris.push(`https://ipfs.io/ipfs/${ipfsMatch[1]}`);
        }
        for (const uri of uris) {
          try {
            const resp = await fetch(uri, { signal: AbortSignal.timeout(15000) });
            const json = await resp.json();
            if (json.image) {
              let imageUrl = json.image;
              if (imageUrl.startsWith('ipfs://')) {
                imageUrl = imageUrl.replace('ipfs://', 'https://plum-far-bobcat-940.mypinata.cloud/ipfs/');
              } else {
                const imgIpfsMatch = imageUrl.match(/\/ipfs\/(.+)$/);
                if (imgIpfsMatch) {
                  imageUrl = `https://plum-far-bobcat-940.mypinata.cloud/ipfs/${imgIpfsMatch[1]}`;
                }
              }
              g.image = imageUrl;
              return;
            }
          } catch {
            // Try next gateway
          }
        }
      }),
    );

    return gorbagios;
  } catch (err) {
    console.error('[MigrationService] Error fetching legacy Gorbagios:', err);
    return [];
  }
}

/**
 * Parse Token-2022 metadata extension from a mint account.
 *
 * Layout: 82 bytes standard mint, padding to 165, 1 byte account type at 165,
 * then extensions starting at offset 166 in TLV format:
 *   Extension type 18 (MetadataPointer): 2+2+64 = 68 bytes
 *   Extension type 19 (TokenMetadata): 2+2 + 32 updateAuth + 32 mint + borsh strings
 */
function parseToken2022Metadata(
  data: Buffer,
): { updateAuthority: PublicKey; name: string; symbol: string; uri: string } | null {
  try {
    // Walk extensions starting at offset 166
    let off = 166;
    while (off < data.length - 4) {
      const extType = data.readUInt16LE(off);
      const extLen = data.readUInt16LE(off + 2);

      if (extType === 19) {
        // TokenMetadata extension
        let moff = off + 4;
        const updateAuthority = new PublicKey(data.subarray(moff, moff + 32));
        moff += 32;
        const _mint = data.subarray(moff, moff + 32); // skip mint
        moff += 32;

        const nameLen = data.readUInt32LE(moff);
        moff += 4;
        const name = data.subarray(moff, moff + nameLen).toString('utf8');
        moff += nameLen;

        const symbolLen = data.readUInt32LE(moff);
        moff += 4;
        const symbol = data.subarray(moff, moff + symbolLen).toString('utf8');
        moff += symbolLen;

        const uriLen = data.readUInt32LE(moff);
        moff += 4;
        const uri = data.subarray(moff, moff + uriLen).toString('utf8');

        return { updateAuthority, name, symbol, uri };
      }

      off += 4 + extLen;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build the migration transaction for a legacy Gorbagio NFT.
 *
 * Returns the transaction (partially signed by newMint) and the new mint public key.
 */
export async function buildMigrationTransaction(
  connection: Connection,
  wallet: PublicKey,
  legacyMint: PublicKey,
  name: string,
  symbol: string,
  uri: string,
): Promise<{ transaction: Transaction; newMintAddress: PublicKey }> {
  const migrationProgramId = getMigrationProgramId();

  // Generate a new mint keypair for the migrated NFT
  const newMint = Keypair.generate();

  // User's legacy token account (ATA for Token-2022 mint)
  const userLegacyTokenAccount = await getAssociatedTokenAddress(
    legacyMint,
    wallet,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  // User's new token account for the migrated NFT (standard SPL Token)
  const userNewTokenAccount = await getAssociatedTokenAddress(
    newMint.publicKey,
    wallet,
  );

  // Metaplex metadata PDA for the new mint
  const [metadataAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
      newMint.publicKey.toBuffer(),
    ],
    METAPLEX_METADATA_PROGRAM_ID,
  );

  // Metaplex master edition PDA for the new mint
  const [masterEditionAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METAPLEX_METADATA_PROGRAM_ID.toBuffer(),
      newMint.publicKey.toBuffer(),
      Buffer.from('edition'),
    ],
    METAPLEX_METADATA_PROGRAM_ID,
  );

  // Encode instruction data: discriminator + borsh-encoded strings
  const nameBytes = Buffer.from(name, 'utf8');
  const symbolBytes = Buffer.from(symbol, 'utf8');
  const uriBytes = Buffer.from(uri, 'utf8');

  const dataLen = 8 + 4 + nameBytes.length + 4 + symbolBytes.length + 4 + uriBytes.length;
  const instructionData = Buffer.alloc(dataLen);
  let offset = 0;

  MIGRATE_DISCRIMINATOR.copy(instructionData, offset);
  offset += 8;

  instructionData.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(instructionData, offset);
  offset += nameBytes.length;

  instructionData.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(instructionData, offset);
  offset += symbolBytes.length;

  instructionData.writeUInt32LE(uriBytes.length, offset);
  offset += 4;
  uriBytes.copy(instructionData, offset);

  const migrateInstruction = new TransactionInstruction({
    programId: migrationProgramId,
    keys: [
      // Legacy side (Token-2022) — burn + close
      { pubkey: wallet, isSigner: true, isWritable: true },              // user
      { pubkey: legacyMint, isSigner: false, isWritable: true },         // legacy_mint (mut for burn)
      { pubkey: userLegacyTokenAccount, isSigner: false, isWritable: true }, // user_legacy_token_account
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false }, // legacy_token_program
      // New side (standard SPL Token + Metaplex)
      { pubkey: newMint.publicKey, isSigner: true, isWritable: true },   // new_mint
      { pubkey: userNewTokenAccount, isSigner: false, isWritable: true }, // user_new_token_account
      { pubkey: metadataAccount, isSigner: false, isWritable: true },    // metadata_account
      { pubkey: masterEditionAccount, isSigner: false, isWritable: true }, // master_edition_account
      { pubkey: METAPLEX_METADATA_PROGRAM_ID, isSigner: false, isWritable: false }, // metadata_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },  // token_program
      { pubkey: TREASURY_WALLET, isSigner: false, isWritable: true },    // treasury
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent
    ],
    data: instructionData,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet;
  (transaction as any).lastValidBlockHeight = lastValidBlockHeight;

  transaction.add(migrateInstruction);

  // The new mint keypair must partially sign
  transaction.partialSign(newMint);

  return { transaction, newMintAddress: newMint.publicKey };
}

/**
 * Execute the full migration: build tx, sign with wallet, send & confirm.
 */
export async function executeMigration(
  connection: Connection,
  wallet: any, // wallet adapter
  legacyMint: string,
  name: string,
  symbol: string,
  uri: string,
): Promise<{ signature: string; newMint: string; success: boolean; error?: string }> {
  try {
    const walletPubkey = wallet.publicKey;
    if (!walletPubkey) throw new Error('Wallet not connected');

    const legacyMintPk = new PublicKey(legacyMint);

    const { transaction, newMintAddress } = await buildMigrationTransaction(
      connection,
      walletPubkey,
      legacyMintPk,
      name,
      symbol,
      uri,
    );

    // Sign with wallet adapter (newMint already partially signed)
    const signedTx = await wallet.signTransaction(transaction);

    // Send
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Poll signature status instead of blockhash-based confirmation
    // (Gorbagana RPC can be slow, causing block height to expire before confirmation returns)
    const { confirmTransaction: confirmTx } = await import('../utils/confirmTx');
    await confirmTx(connection, signature);

    // Auto-verify collection via backend (fire-and-forget — don't block migration success)
    const newMintStr = newMintAddress.toBase58();
    const [metadataPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), METAPLEX_METADATA_PROGRAM_ID.toBuffer(), newMintAddress.toBuffer()],
      METAPLEX_METADATA_PROGRAM_ID,
    );
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://api.trashmarket.fun';
      fetch(`${apiBase}/api/migration/verify-collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: newMintStr, metadataPDA: metadataPDA.toBase58() }),
      }).then(res => res.json()).then(result => {
        if (result.success) {
          console.log(`[MigrationService] Collection verified for ${newMintStr}: ${result.signature}`);
        } else {
          console.warn(`[MigrationService] Collection verify failed: ${result.error}`);
        }
      }).catch(err => console.warn('[MigrationService] Collection verify request failed:', err));
    } catch (err) {
      console.warn('[MigrationService] Failed to request collection verification:', err);
    }

    return {
      signature,
      newMint: newMintStr,
      success: true,
    };
  } catch (err: any) {
    console.error('[MigrationService] Migration failed:', err);

    let errorMessage = 'Migration failed';
    if (err?.message?.includes('User rejected')) {
      errorMessage = 'Transaction rejected by user';
    } else if (err?.message?.includes('block height exceeded') || err?.message?.includes('expired')) {
      errorMessage = 'Transaction expired — please try again and approve quickly in your wallet';
    } else if (err?.message?.includes('Insufficient')) {
      errorMessage = 'Insufficient GOR for transaction fees';
    } else if (err?.logs) {
      const programLog = err.logs.find((l: string) => l.includes('Program log: Error'));
      if (programLog) errorMessage = programLog.replace('Program log: ', '');
    } else if (err?.message) {
      errorMessage = err.message;
    }

    return { signature: '', newMint: '', success: false, error: errorMessage };
  }
}

// ─── Collection Fix for Already-Migrated NFTs ────────────────────────

export interface MigratedGorbagioNeedingFix {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  image: string;
  metadataAccount: string;
  updateAuthority: string;
}

interface ParsedMetaplexMetadata {
  updateAuthority: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  hasCreators: boolean;
  creators: { address: PublicKey; verified: boolean; share: number }[];
  primarySaleHappened: boolean;
  isMutable: boolean;
  hasCollection: boolean;
  collectionVerified: boolean;
  collectionKey: PublicKey | null;
}

/**
 * Parse a Metaplex Token Metadata account (v1 format, key=4).
 */
function parseMetaplexMetadata(data: Buffer): ParsedMetaplexMetadata | null {
  try {
    let off = 0;
    const key = data[off]; off += 1;
    if (key !== 4) return null; // MetadataV1 = 4

    const updateAuthority = new PublicKey(data.subarray(off, off + 32)); off += 32;
    const mint = new PublicKey(data.subarray(off, off + 32)); off += 32;

    // name (borsh string)
    const nameLen = data.readUInt32LE(off); off += 4;
    const name = data.subarray(off, off + nameLen).toString('utf8').replace(/\0+$/, ''); off += nameLen;

    // symbol
    const symbolLen = data.readUInt32LE(off); off += 4;
    const symbol = data.subarray(off, off + symbolLen).toString('utf8').replace(/\0+$/, ''); off += symbolLen;

    // uri
    const uriLen = data.readUInt32LE(off); off += 4;
    const uri = data.subarray(off, off + uriLen).toString('utf8').replace(/\0+$/, ''); off += uriLen;

    // seller_fee_basis_points
    const sellerFeeBasisPoints = data.readUInt16LE(off); off += 2;

    // creators: Option<Vec<Creator>>
    const hasCreators = data[off] === 1; off += 1;
    const creators: { address: PublicKey; verified: boolean; share: number }[] = [];
    if (hasCreators) {
      const creatorsLen = data.readUInt32LE(off); off += 4;
      for (let i = 0; i < creatorsLen; i++) {
        const address = new PublicKey(data.subarray(off, off + 32)); off += 32;
        const verified = data[off] === 1; off += 1;
        const share = data[off]; off += 1;
        creators.push({ address, verified, share });
      }
    }

    // primary_sale_happened
    const primarySaleHappened = data[off] === 1; off += 1;

    // is_mutable
    const isMutable = data[off] === 1; off += 1;

    // edition_nonce: Option<u8>
    const hasEditionNonce = data[off] === 1; off += 1;
    if (hasEditionNonce) off += 1;

    // token_standard: Option<u8>
    let hasCollection = false;
    let collectionVerified = false;
    let collectionKey: PublicKey | null = null;

    if (off < data.length) {
      const hasTokenStandard = data[off] === 1; off += 1;
      if (hasTokenStandard) off += 1;

      // collection: Option<Collection>
      if (off < data.length) {
        hasCollection = data[off] === 1; off += 1;
        if (hasCollection) {
          collectionVerified = data[off] === 1; off += 1;
          collectionKey = new PublicKey(data.subarray(off, off + 32)); off += 32;
        }
      }
    }

    return {
      updateAuthority, mint, name, symbol, uri, sellerFeeBasisPoints,
      hasCreators, creators, primarySaleHappened, isMutable,
      hasCollection, collectionVerified, collectionKey,
    };
  } catch {
    return null;
  }
}

/**
 * Find migrated Gorbagio NFTs in the user's wallet that are missing the collection field.
 */
export async function fetchMigratedGorbagiosNeedingCollectionFix(
  connection: Connection,
  walletAddress: PublicKey,
): Promise<MigratedGorbagioNeedingFix[]> {
  try {
    // Get standard SPL Token NFTs (not Token-2022)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { programId: TOKEN_PROGRAM_ID },
    );

    const nftAccounts = tokenAccounts.value.filter((ta) => {
      const info = ta.account.data.parsed?.info;
      return info && info.tokenAmount?.uiAmount === 1 && info.tokenAmount?.decimals === 0;
    });

    if (nftAccounts.length === 0) return [];

    const results: MigratedGorbagioNeedingFix[] = [];

    // Check each NFT's Metaplex metadata
    const mintAddresses = nftAccounts.map((ta) => new PublicKey(ta.account.data.parsed.info.mint));
    const metadataPDAs = mintAddresses.map((mint) =>
      PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METAPLEX_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        METAPLEX_METADATA_PROGRAM_ID,
      )[0],
    );

    // Batch fetch metadata accounts
    const BATCH_SIZE = 100;
    const metadataInfos: (Awaited<ReturnType<Connection['getAccountInfo']>>)[] = [];
    for (let i = 0; i < metadataPDAs.length; i += BATCH_SIZE) {
      const batch = metadataPDAs.slice(i, i + BATCH_SIZE);
      const fetched = await connection.getMultipleAccountsInfo(batch);
      metadataInfos.push(...fetched);
    }

    for (let i = 0; i < metadataInfos.length; i++) {
      const metadataInfo = metadataInfos[i];
      if (!metadataInfo) continue;

      const parsed = parseMetaplexMetadata(Buffer.from(metadataInfo.data));
      if (!parsed) continue;

      // Only Gorbagios
      if (!parsed.name.startsWith('Gorbagio')) continue;

      // Skip if collection is already correctly set
      if (parsed.hasCollection && parsed.collectionKey?.equals(GORBAGIO_COLLECTION_MINT)) continue;

      results.push({
        mint: mintAddresses[i].toBase58(),
        name: parsed.name,
        symbol: parsed.symbol,
        uri: parsed.uri,
        image: '',
        metadataAccount: metadataPDAs[i].toBase58(),
        updateAuthority: parsed.updateAuthority.toBase58(),
      });
    }

    // Fetch images
    await Promise.all(
      results.map(async (g) => {
        if (!g.uri) return;
        const uris = [g.uri];
        const ipfsMatch = g.uri.match(/\/ipfs\/(.+)$/);
        if (ipfsMatch) uris.push(`https://ipfs.io/ipfs/${ipfsMatch[1]}`);
        for (const uri of uris) {
          try {
            const resp = await fetch(uri, { signal: AbortSignal.timeout(15000) });
            const json = await resp.json();
            if (json.image) {
              let imageUrl = json.image;
              if (imageUrl.startsWith('ipfs://')) {
                imageUrl = imageUrl.replace('ipfs://', 'https://plum-far-bobcat-940.mypinata.cloud/ipfs/');
              } else {
                const imgIpfsMatch = imageUrl.match(/\/ipfs\/(.+)$/);
                if (imgIpfsMatch) {
                  imageUrl = `https://plum-far-bobcat-940.mypinata.cloud/ipfs/${imgIpfsMatch[1]}`;
                }
              }
              g.image = imageUrl;
              return;
            }
          } catch { /* try next */ }
        }
      }),
    );

    return results;
  } catch (err) {
    console.error('[MigrationService] Error fetching migrated Gorbagios:', err);
    return [];
  }
}

/**
 * Build an UpdateMetadataAccountV2 transaction to set the collection field
 * on a migrated Gorbagio NFT. The user (update authority) must sign.
 */
export async function buildSetCollectionTransaction(
  connection: Connection,
  wallet: PublicKey,
  mintAddress: PublicKey,
): Promise<Transaction> {
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METAPLEX_METADATA_PROGRAM_ID.toBuffer(), mintAddress.toBuffer()],
    METAPLEX_METADATA_PROGRAM_ID,
  );

  const metadataInfo = await connection.getAccountInfo(metadataPDA);
  if (!metadataInfo) throw new Error('Metadata account not found');

  const parsed = parseMetaplexMetadata(Buffer.from(metadataInfo.data));
  if (!parsed) throw new Error('Failed to parse metadata');

  // Build UpdateMetadataAccountV2 instruction data (discriminator = 15)
  const parts: Buffer[] = [];

  // Instruction discriminator
  parts.push(Buffer.from([15]));

  // data: Some(DataV2)
  parts.push(Buffer.from([1])); // Some

  // DataV2.name
  const nameBytes = Buffer.from(parsed.name, 'utf8');
  const nameLenBuf = Buffer.alloc(4);
  nameLenBuf.writeUInt32LE(nameBytes.length);
  parts.push(nameLenBuf, nameBytes);

  // DataV2.symbol
  const symbolBytes = Buffer.from(parsed.symbol, 'utf8');
  const symbolLenBuf = Buffer.alloc(4);
  symbolLenBuf.writeUInt32LE(symbolBytes.length);
  parts.push(symbolLenBuf, symbolBytes);

  // DataV2.uri
  const uriBytes = Buffer.from(parsed.uri, 'utf8');
  const uriLenBuf = Buffer.alloc(4);
  uriLenBuf.writeUInt32LE(uriBytes.length);
  parts.push(uriLenBuf, uriBytes);

  // DataV2.seller_fee_basis_points
  const feeBuf = Buffer.alloc(2);
  feeBuf.writeUInt16LE(parsed.sellerFeeBasisPoints);
  parts.push(feeBuf);

  // DataV2.creators: preserve existing
  if (parsed.hasCreators && parsed.creators.length > 0) {
    parts.push(Buffer.from([1])); // Some
    const creatorsLenBuf = Buffer.alloc(4);
    creatorsLenBuf.writeUInt32LE(parsed.creators.length);
    parts.push(creatorsLenBuf);
    for (const c of parsed.creators) {
      parts.push(c.address.toBuffer());
      parts.push(Buffer.from([c.verified ? 1 : 0]));
      parts.push(Buffer.from([c.share]));
    }
  } else {
    parts.push(Buffer.from([0])); // None
  }

  // DataV2.collection: Some(Collection { verified: false, key: GORBAGIO_COLLECTION_MINT })
  parts.push(Buffer.from([1])); // Some
  parts.push(Buffer.from([0])); // verified = false (deployer verifies separately)
  parts.push(GORBAGIO_COLLECTION_MINT.toBuffer());

  // DataV2.uses: None
  parts.push(Buffer.from([0]));

  // update_authority: None (keep existing)
  parts.push(Buffer.from([0]));

  // primary_sale_happened: None (keep existing)
  parts.push(Buffer.from([0]));

  // is_mutable: None (keep existing)
  parts.push(Buffer.from([0]));

  const instructionData = Buffer.concat(parts);

  const ix = new TransactionInstruction({
    programId: METAPLEX_METADATA_PROGRAM_ID,
    keys: [
      { pubkey: metadataPDA, isSigner: false, isWritable: true },
      { pubkey: wallet, isSigner: true, isWritable: false },
    ],
    data: instructionData,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet;
  (tx as any).lastValidBlockHeight = lastValidBlockHeight;
  tx.add(ix);

  return tx;
}

/**
 * Execute the collection fix: build tx, sign with wallet, send & confirm.
 */
export async function executeSetCollection(
  connection: Connection,
  wallet: any, // wallet adapter
  mintAddress: string,
): Promise<{ signature: string; success: boolean; error?: string }> {
  try {
    const walletPubkey = wallet.publicKey;
    if (!walletPubkey) throw new Error('Wallet not connected');

    const mintPk = new PublicKey(mintAddress);
    const transaction = await buildSetCollectionTransaction(connection, walletPubkey, mintPk);

    const signedTx = await wallet.signTransaction(transaction);

    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    const { confirmTransaction: confirmTx } = await import('../utils/confirmTx');
    await confirmTx(connection, signature);

    return { signature, success: true };
  } catch (err: any) {
    console.error('[MigrationService] Set collection failed:', err);

    let errorMessage = 'Failed to set collection';
    if (err?.message?.includes('User rejected')) {
      errorMessage = 'Transaction rejected by user';
    } else if (err?.message?.includes('block height exceeded') || err?.message?.includes('expired')) {
      errorMessage = 'Transaction expired — please try again and approve quickly in your wallet';
    } else if (err?.message) {
      errorMessage = err.message;
    }

    return { signature: '', success: false, error: errorMessage };
  }
}
