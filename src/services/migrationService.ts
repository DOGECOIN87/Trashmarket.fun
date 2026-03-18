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
              g.image = json.image;
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

    // Confirm using the blockhash already embedded in the transaction
    await connection.confirmTransaction(
      {
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight: (transaction as any).lastValidBlockHeight,
      },
      'confirmed',
    );

    return {
      signature,
      newMint: newMintAddress.toBase58(),
      success: true,
    };
  } catch (err: any) {
    console.error('[MigrationService] Migration failed:', err);

    let errorMessage = 'Migration failed';
    if (err?.message?.includes('User rejected')) {
      errorMessage = 'Transaction rejected by user';
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
