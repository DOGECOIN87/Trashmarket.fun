/**
 * One-time script to correct player profits for users affected by
 * the broken withdrawal function. Sets profit so users can withdraw
 * their previously earned amounts.
 *
 * Usage: npx tsx scripts/fix-profits.ts <admin-keypair.json>
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const RPC_URL = 'https://rpc.trashscan.io';
const GAME_PROGRAM_ID = new PublicKey('5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe');

// Corrections: [playerPubkey, newBalance, netProfitDelta]
// Player 1: XPc3...4ByG — Score 1958, Balance 100, Profit 0 → set balance to 2058, profit +1958
// Player 2: AmTF...Vbot — Score 335, Balance 100, Profit 0 → set balance to 435, profit +335
// Player 5: 3ZhD...VqWb — Balance 19628, Profit -305 → keep balance, profit +305
// Player 11: f52K...YVau — Balance 98, Profit -100 → keep balance, profit +100
// Player 12: 77hD...Q8wb — Balance 66, Profit -132 → keep balance, profit +132
const CORRECTIONS: { player: string; newBalance: number; profitDelta: number }[] = [
  { player: 'XPc3rhRriZd97VNADETZKruqCbjUoAb4ZDY8RJV4ByG', newBalance: 2058, profitDelta: 1958 },
  { player: 'AmTF9CmcSQke2zbszPgiGGQhY3NS3JYw2sJU8pMjVbot', newBalance: 435, profitDelta: 335 },
  { player: '3ZhDzyZZYAutYdL3e6JemW92K2BPGBt2FFhxy48GVqWb', newBalance: 19628, profitDelta: 305 },
  { player: 'f52Knb9ZkU3GGwz9e9YbM2BBU8MCWCSF5yHpqckYVau', newBalance: 98, profitDelta: 100 },
  { player: '77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb', newBalance: 66, profitDelta: 132 },
];

// Max profit delta per call (backend cap is 500, but on-chain has no cap when calling directly)
const MAX_DELTA_PER_CALL = 500;

function getDiscriminator(): Buffer {
  const hash = createHash('sha256').update('global:update_balance').digest();
  return hash.subarray(0, 8);
}

function buildInstructionData(newBalance: number, netProfitDelta: number): Buffer {
  const data = Buffer.alloc(24);
  getDiscriminator().copy(data, 0);
  data.writeBigUInt64LE(BigInt(newBalance), 8);
  data.writeBigInt64LE(BigInt(netProfitDelta), 16);
  return data;
}

function findPDA(seeds: Buffer[], programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
  return pda;
}

async function main() {
  const keypairPath = process.argv[2];
  if (!keypairPath) {
    console.error('Usage: npx tsx scripts/fix-profits.ts <admin-keypair.json>');
    process.exit(1);
  }

  const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log(`Admin: ${admin.publicKey.toBase58()}`);
  console.log(`Program: ${GAME_PROGRAM_ID.toBase58()}`);
  console.log(`Corrections: ${CORRECTIONS.length} players\n`);

  const gameConfigPDA = findPDA([Buffer.from('game_config')], GAME_PROGRAM_ID);

  let success = 0;
  let failed = 0;

  for (const correction of CORRECTIONS) {
    const playerPubkey = new PublicKey(correction.player);
    const gameStatePDA = findPDA(
      [Buffer.from('game_state'), playerPubkey.toBuffer()],
      GAME_PROGRAM_ID
    );

    console.log(`Correcting ${correction.player.slice(0, 4)}...${correction.player.slice(-4)}`);
    console.log(`  Balance → ${correction.newBalance}, Profit delta → +${correction.profitDelta}`);

    // Split into multiple calls if delta exceeds MAX_DELTA_PER_CALL
    let remaining = correction.profitDelta;
    let currentBalance = correction.newBalance;
    let callNum = 0;

    // For the first call, set the new balance. Subsequent calls keep the same balance.
    while (remaining > 0) {
      const delta = Math.min(remaining, MAX_DELTA_PER_CALL);
      callNum++;

      const data = buildInstructionData(currentBalance, delta);

      const ix = new TransactionInstruction({
        programId: GAME_PROGRAM_ID,
        keys: [
          { pubkey: gameStatePDA, isSigner: false, isWritable: true },
          { pubkey: playerPubkey, isSigner: false, isWritable: false },
          { pubkey: gameConfigPDA, isSigner: false, isWritable: false },
          { pubkey: admin.publicKey, isSigner: true, isWritable: false },
        ],
        data,
      });

      try {
        const tx = new Transaction().add(ix);
        const sig = await sendAndConfirmTransaction(connection, tx, [admin]);
        console.log(`  Call ${callNum}: +${delta} profit → ${sig}`);
        remaining -= delta;
      } catch (err: any) {
        console.error(`  Call ${callNum}: FAILED — ${err.message}`);
        failed++;
        break;
      }
    }

    if (remaining <= 0) {
      console.log(`  ✓ Done\n`);
      success++;
    }
  }

  console.log(`\nResults: ${success} corrected, ${failed} failed`);
}

main().catch(console.error);
