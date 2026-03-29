/**
 * One-time script: Verify collection on all migrated Gorbagio NFTs.
 *
 * Finds all Metaplex metadata accounts with the Gorbagio collection set
 * but unverified, then calls VerifyCollection on each.
 *
 * Usage:
 *   npx ts-node scripts/verify-collection.ts <path-to-deployer-keypair.json>
 *
 * The deployer keypair must be for: Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ
 */

import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import * as fs from 'fs';

const RPC_URL = 'https://rpc.trashscan.io';
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const GORBAGIO_COLLECTION_MINT = new PublicKey('FBJ47AgQSzSWVQVzsspoUzcFVeEf8a6xihZKZgmRuno1');
const DEPLOYER_EXPECTED = 'Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ';

// Pre-computed PDAs for the collection NFT
const COLLECTION_METADATA_PDA = new PublicKey('FAi5K12awTH2ZChEUGg5whUcsK4QJ9GAAtjVz2LXPdUd');
const COLLECTION_MASTER_EDITION_PDA = new PublicKey('GpRXxtvvryUtbjjRny4mV3k5B7BMecGEbpxCbUPyvMkE');

interface UnverifiedNFT {
  metadataPDA: PublicKey;
  mint: PublicKey;
  name: string;
}

function parseMetadataForCollection(data: Buffer): { mint: PublicKey; name: string; collectionKey: PublicKey | null; verified: boolean } | null {
  try {
    if (data[0] !== 4) return null; // Key::MetadataV1

    const mint = new PublicKey(data.subarray(33, 65));

    // Parse name
    const nameLen = data.readUInt32LE(65);
    const name = data.subarray(69, 69 + nameLen).toString('utf8').replace(/\0/g, '').trim();

    // Find collection field by scanning for the collection mint bytes
    const collectionMintBytes = GORBAGIO_COLLECTION_MINT.toBuffer();
    for (let i = 65; i < data.length - 33; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (data[i + 1 + j] !== collectionMintBytes[j]) { match = false; break; }
      }
      if (match) {
        return { mint, name, collectionKey: GORBAGIO_COLLECTION_MINT, verified: data[i] === 1 };
      }
    }

    return { mint, name, collectionKey: null, verified: false };
  } catch {
    return null;
  }
}

async function main() {
  const keypairPath = process.argv[2];
  if (!keypairPath) {
    console.error('Usage: npx ts-node scripts/verify-collection.ts <path-to-deployer-keypair.json>');
    process.exit(1);
  }

  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const deployer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  if (deployer.publicKey.toBase58() !== DEPLOYER_EXPECTED) {
    console.error(`ERROR: Keypair does not match expected deployer ${DEPLOYER_EXPECTED}`);
    console.error(`Got: ${deployer.publicKey.toBase58()}`);
    process.exit(1);
  }

  console.log('Deployer:', deployer.publicKey.toBase58());
  console.log('RPC:', RPC_URL);
  console.log('Collection:', GORBAGIO_COLLECTION_MINT.toBase58());
  console.log('');

  const connection = new Connection(RPC_URL, 'confirmed');

  // Find all metadata accounts owned by Metaplex program
  console.log('Fetching all Metaplex metadata accounts...');
  const accounts = await connection.getProgramAccounts(METAPLEX_PROGRAM_ID, {
    filters: [
      { dataSize: 679 }, // Standard metadata account size (may vary, try common sizes)
    ],
  });

  // Also try without size filter if no results
  let allAccounts = accounts;
  if (allAccounts.length === 0) {
    console.log('No results with dataSize 679, trying without filter...');
    allAccounts = await connection.getProgramAccounts(METAPLEX_PROGRAM_ID);
  }

  console.log(`Found ${allAccounts.length} metadata accounts total`);

  // Filter for Gorbagio NFTs with unverified collection
  const unverified: UnverifiedNFT[] = [];
  let verified = 0;
  let nonGorbagio = 0;

  for (const { pubkey, account } of allAccounts) {
    const parsed = parseMetadataForCollection(Buffer.from(account.data));
    if (!parsed || !parsed.collectionKey) {
      nonGorbagio++;
      continue;
    }
    if (parsed.collectionKey.toBase58() !== GORBAGIO_COLLECTION_MINT.toBase58()) {
      nonGorbagio++;
      continue;
    }
    if (parsed.verified) {
      verified++;
      continue;
    }
    unverified.push({ metadataPDA: pubkey, mint: parsed.mint, name: parsed.name });
  }

  console.log(`\nGorbagio NFTs: ${verified + unverified.length} total`);
  console.log(`  Already verified: ${verified}`);
  console.log(`  Need verification: ${unverified.length}`);
  console.log(`  Non-Gorbagio: ${nonGorbagio}`);

  if (unverified.length === 0) {
    console.log('\nAll NFTs are already verified!');
    return;
  }

  console.log(`\nVerifying ${unverified.length} NFTs...\n`);

  let success = 0;
  let failed = 0;

  for (const nft of unverified) {
    try {
      // Build VerifySizedCollectionItem instruction (discriminator = 30)
      // Used instead of VerifyCollection (18) because the collection has a size field
      const ix = new TransactionInstruction({
        programId: METAPLEX_PROGRAM_ID,
        keys: [
          { pubkey: nft.metadataPDA, isSigner: false, isWritable: true },
          { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
          { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
          { pubkey: GORBAGIO_COLLECTION_MINT, isSigner: false, isWritable: false },
          { pubkey: COLLECTION_METADATA_PDA, isSigner: false, isWritable: true },
          { pubkey: COLLECTION_MASTER_EDITION_PDA, isSigner: false, isWritable: false },
        ],
        data: Buffer.from([30]),
      });

      const tx = new Transaction().add(ix);
      tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
      tx.feePayer = deployer.publicKey;
      const sig = await sendAndConfirmTransaction(connection, tx, [deployer]);
      console.log(`  ✓ ${nft.name} (${nft.mint.toBase58().slice(0, 8)}...): ${sig}`);
      success++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`  ✗ ${nft.name} (${nft.mint.toBase58().slice(0, 8)}...): ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Verified: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
