/**
 * One-time setup script: Transfer the treasury DEBRIS token account authority
 * to the program's PDA so it can sign withdrawals.
 *
 * IMPORTANT: This must be run with the treasury wallet's keypair.
 *
 * Usage:
 *   npx ts-node scripts/setup-treasury-authority.ts <path-to-treasury-keypair.json>
 *
 * Or with solana CLI directly:
 *   spl-token authorize <TREASURY_ATA> owner JqmENAh1F16QVzt5U7gjqQCJT4Qk2Ja9J2Pa4L55n6m \
 *     --owner <path-to-treasury-keypair.json> \
 *     --url https://rpc.trashscan.io
 */

import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createSetAuthorityInstruction, AuthorityType, getAssociatedTokenAddress } from '@solana/spl-token';
import * as fs from 'fs';

const PROGRAM_ID = new PublicKey('5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe');
const DEBRIS_MINT = new PublicKey('DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy');
const TREASURY_WALLET = new PublicKey('8iKCvwz3tyUp4hzxcyLYtPQghiwiEhiLDd38MEQBF6kR');
const RPC_URL = 'https://rpc.trashscan.io';

async function main() {
  const keypairPath = process.argv[2];
  if (!keypairPath) {
    console.error('Usage: npx ts-node scripts/setup-treasury-authority.ts <path-to-treasury-keypair.json>');
    console.error('\nOr use the spl-token CLI:');
    console.error('  spl-token authorize <TREASURY_ATA> owner JqmENAh1F16QVzt5U7gjqQCJT4Qk2Ja9J2Pa4L55n6m \\');
    console.error('    --owner <path-to-treasury-keypair.json> \\');
    console.error('    --url https://rpc.trashscan.io');
    process.exit(1);
  }

  // Load treasury keypair
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log('Treasury wallet:', treasuryKeypair.publicKey.toBase58());
  if (treasuryKeypair.publicKey.toBase58() !== TREASURY_WALLET.toBase58()) {
    console.error('ERROR: Keypair does not match treasury wallet!');
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, 'confirmed');

  // Derive the treasury authority PDA
  const [treasuryAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury_authority')],
    PROGRAM_ID
  );
  console.log('Treasury Authority PDA:', treasuryAuthority.toBase58());

  // Get the treasury's DEBRIS associated token account
  const treasuryAta = await getAssociatedTokenAddress(DEBRIS_MINT, TREASURY_WALLET);
  console.log('Treasury ATA:', treasuryAta.toBase58());

  // Create the set authority instruction
  const setAuthIx = createSetAuthorityInstruction(
    treasuryAta,                    // token account
    treasuryKeypair.publicKey,      // current authority
    AuthorityType.AccountOwner,     // authority type
    treasuryAuthority,              // new authority (PDA)
  );

  const tx = new Transaction().add(setAuthIx);

  console.log('\nTransferring token account authority to program PDA...');
  const signature = await sendAndConfirmTransaction(connection, tx, [treasuryKeypair]);
  console.log('Success! Signature:', signature);
  console.log('\nThe treasury token account is now controlled by the program PDA.');
  console.log('Players can now withdraw verified winnings through the game.');
}

main().catch(console.error);
