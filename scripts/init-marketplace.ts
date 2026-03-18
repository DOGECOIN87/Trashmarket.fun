/**
 * Initialize Gorbagio NFT Marketplace config on Gorbagana.
 *
 * Usage: npx ts-node scripts/init-marketplace.ts
 *
 * Reads the deployer keypair from ~/.config/solana/id.json
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// ─── Constants ────────────────────────────────────────────────────────────────

const RPC_URL = 'https://rpc.gorbagana.wtf';
const PROGRAM_ID = new PublicKey('DohoM3SvQzfcHVWH1r6BVTWdcNgYQxsxsTqxeZWBmL2E');
const TREASURY = new PublicKey('77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb');
const COLLECTION_MINT = new PublicKey('FBJ47AgQSzSWVQVzsspoUzcFVeEf8a6xihZKZgmRuno1');
const FEE_BPS = 250; // 2.5%

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAnchorDiscriminator(namespace: string, name: string): Buffer {
  const hash = createHash('sha256')
    .update(`${namespace}:${name}`)
    .digest();
  return hash.subarray(0, 8);
}

function loadKeypair(): Keypair {
  const keyPath = path.join(process.env.HOME || '~', '.config/solana/id.json');
  const raw = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const authority = loadKeypair();

  console.log('Authority:', authority.publicKey.toBase58());
  console.log('Program:', PROGRAM_ID.toBase58());
  console.log('Treasury:', TREASURY.toBase58());
  console.log('Collection:', COLLECTION_MINT.toBase58());
  console.log('Fee:', FEE_BPS, 'bps (', FEE_BPS / 100, '%)');

  // Derive marketplace_config PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('marketplace_config')],
    PROGRAM_ID,
  );
  console.log('Config PDA:', configPDA.toBase58());

  // Check if already initialized
  const existing = await connection.getAccountInfo(configPDA);
  if (existing) {
    console.log('Marketplace config already initialized!');
    console.log('Account data length:', existing.data.length);
    return;
  }

  // Build initialize instruction
  // Anchor discriminator: sha256("global:initialize")[0..8]
  const discriminator = getAnchorDiscriminator('global', 'initialize');

  // Serialize args: treasury (32) + fee_bps (2, u16 LE) + collection_mint (32)
  const data = Buffer.alloc(8 + 32 + 2 + 32);
  discriminator.copy(data, 0);
  TREASURY.toBuffer().copy(data, 8);
  data.writeUInt16LE(FEE_BPS, 40);
  COLLECTION_MINT.toBuffer().copy(data, 42);

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(instruction);
  tx.feePayer = authority.publicKey;

  console.log('\nSending initialize transaction...');
  const sig = await sendAndConfirmTransaction(connection, tx, [authority], {
    commitment: 'confirmed',
  });

  console.log('Marketplace initialized!');
  console.log('Signature:', sig);
  console.log('Explorer:', `https://explorer.gorbagana.wtf/tx/${sig}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
