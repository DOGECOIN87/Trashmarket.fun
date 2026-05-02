/**
 * Cleanup: close orphaned escrow token accounts on Gorbagana.
 *
 * Background
 * ----------
 * An old version of the gorbagio-marketplace program forgot to close the
 * `escrow_nft` token PDA after `cancel_listing` and `buy_nft`.  Those empty
 * accounts (0 tokens, non-zero rent lamports) remain on-chain and block
 * future `list_nft` calls for the same NFT mint (AccountAlreadyInUse / Custom:0).
 *
 * This script:
 *   1. Finds every token account whose authority is the program's
 *      `escrow_authority` PDA and whose balance is 0.
 *   2. For each, looks up the original seller via transaction history so that
 *      recovered rent goes back to the right person.
 *   3. Calls the new `close_orphaned_escrow` admin instruction (deployed in
 *      the fixed program build) to close the account.
 *
 * Usage
 * -----
 *   # Dry run — shows what would be closed, sends nothing:
 *   npx ts-node scripts/cleanup-orphaned-escrows.ts
 *
 *   # Execute for real:
 *   npx ts-node scripts/cleanup-orphaned-escrows.ts --execute
 *
 *   # Use a different keypair:
 *   KEYPAIR_PATH=/path/to/keypair.json npx ts-node scripts/cleanup-orphaned-escrows.ts --execute
 *
 * Safety
 * ------
 *   - Only accounts with amount == 0 are touched.  The on-chain instruction
 *     enforces this with a hard constraint.
 *   - Active listings always have 1 NFT in escrow; they are never affected.
 *   - The admin keypair must match `marketplace_config.authority`.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// ─── Constants ────────────────────────────────────────────────────────────────

const RPC_URL = 'https://rpc.gorbagana.wtf';
const RPC_FALLBACK = 'https://rpc.trashscan.io';
const PROGRAM_ID = new PublicKey('DohoM3SvQzfcHVWH1r6BVTWdcNgYQxsxsTqxeZWBmL2E');

// ─── PDA Helpers ──────────────────────────────────────────────────────────────

function getMarketplaceConfigPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('marketplace_config')],
    PROGRAM_ID,
  );
  return pda;
}

function getEscrowAuthorityPDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('marketplace_authority')],
    PROGRAM_ID,
  );
  return pda;
}

function getEscrowNftPDA(nftMint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow_nft'), nftMint.toBuffer()],
    PROGRAM_ID,
  );
  return pda;
}

function getAnchorDiscriminator(name: string): Buffer {
  return createHash('sha256')
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

// ─── Keypair ──────────────────────────────────────────────────────────────────

function loadKeypair(): Keypair {
  const keyPath =
    process.env.KEYPAIR_PATH ||
    path.join(process.env.HOME || '~', '.config/solana/id.json');
  const raw = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ─── Find Original Seller ─────────────────────────────────────────────────────

/**
 * Try to find the wallet that originally called `list_nft` for this escrow.
 * We fetch the signature history for the escrow account and look for the
 * earliest transaction where the account was created.  The fee-payer of that
 * transaction is the original seller.
 *
 * Returns null if the history cannot be determined (fallback to admin).
 */
async function findOriginalSeller(
  connection: Connection,
  escrowAccount: PublicKey,
): Promise<PublicKey | null> {
  try {
    // getSignaturesForAddress returns newest-first; we want the oldest (creation tx).
    const sigs = await connection.getSignaturesForAddress(escrowAccount, {
      limit: 1000,
    });

    if (sigs.length === 0) return null;

    // The oldest signature is last in the array.
    const oldestSig = sigs[sigs.length - 1].signature;
    const tx: ParsedTransactionWithMeta | null =
      await connection.getParsedTransaction(oldestSig, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

    if (!tx?.transaction?.message?.accountKeys) return null;

    // Fee payer is always the first account (writable + signer).
    const feePayer = tx.transaction.message.accountKeys[0]?.pubkey;
    return feePayer ?? null;
  } catch {
    return null;
  }
}

// ─── Build close_orphaned_escrow Transaction ──────────────────────────────────

function buildCloseOrphanedEscrowTx(
  authority: PublicKey,
  nftMint: PublicKey,
  rentDestination: PublicKey,
  recentBlockhash: string,
): Transaction {
  const disc = getAnchorDiscriminator('close_orphaned_escrow');

  const configPDA = getMarketplaceConfigPDA();
  const escrowNftPDA = getEscrowNftPDA(nftMint);
  const escrowAuthority = getEscrowAuthorityPDA();

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority,       isSigner: true,  isWritable: true  },
      { pubkey: configPDA,       isSigner: false, isWritable: false },
      { pubkey: nftMint,         isSigner: false, isWritable: false },
      { pubkey: escrowNftPDA,    isSigner: false, isWritable: true  },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: rentDestination, isSigner: false, isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,isSigner: false, isWritable: false },
    ],
    data: disc,
  });

  const tx = new Transaction().add(instruction);
  tx.recentBlockhash = recentBlockhash;
  tx.feePayer = authority;
  return tx;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const execute = process.argv.includes('--execute');
  if (!execute) {
    console.log('=== DRY RUN (pass --execute to send transactions) ===\n');
  } else {
    console.log('=== EXECUTE MODE — transactions will be sent ===\n');
  }

  // Connection with fallback
  let connection = new Connection(RPC_URL, 'confirmed');
  try {
    await connection.getSlot();
  } catch {
    console.warn(`Primary RPC unreachable, falling back to ${RPC_FALLBACK}`);
    connection = new Connection(RPC_FALLBACK, 'confirmed');
  }

  const admin = loadKeypair();
  const escrowAuthority = getEscrowAuthorityPDA();

  console.log('Admin:            ', admin.publicKey.toBase58());
  console.log('Program:          ', PROGRAM_ID.toBase58());
  console.log('Escrow authority: ', escrowAuthority.toBase58());
  console.log();

  // ── Step 1: find all token accounts owned by the escrow authority ────────────
  console.log('Fetching token accounts owned by escrow authority PDA…');
  const tokenAccountsResp = await connection.getParsedTokenAccountsByOwner(
    escrowAuthority,
    { programId: TOKEN_PROGRAM_ID },
  );

  const allEscrows = tokenAccountsResp.value;
  console.log(`Found ${allEscrows.length} total escrow token account(s).`);

  // ── Step 2: filter to empty (orphaned) accounts ──────────────────────────────
  const orphaned = allEscrows.filter(({ account }) => {
    const parsed = account.data.parsed?.info;
    return parsed && parseInt(parsed.tokenAmount.amount, 10) === 0;
  });

  if (orphaned.length === 0) {
    console.log('\nNo orphaned escrow accounts found. Nothing to do.');
    return;
  }

  console.log(`\nFound ${orphaned.length} orphaned (empty) escrow account(s):\n`);

  // ── Step 3: for each orphaned escrow, find seller and optionally close ────────
  let closed = 0;
  let failed = 0;

  for (const { pubkey: escrowPubkey, account } of orphaned) {
    const mintAddress: string = account.data.parsed?.info?.mint;
    if (!mintAddress) {
      console.warn(`  [SKIP] ${escrowPubkey.toBase58()} — could not read mint`);
      continue;
    }

    const nftMint = new PublicKey(mintAddress);

    // Verify the escrow PDA is correctly derived (sanity check)
    const expectedEscrow = getEscrowNftPDA(nftMint);
    if (!expectedEscrow.equals(escrowPubkey)) {
      console.warn(
        `  [SKIP] ${escrowPubkey.toBase58()} — not a valid escrow PDA for mint ${mintAddress}`,
      );
      continue;
    }

    // Rent lamports that will be recovered
    const lamports = account.lamports;
    const gor = (lamports / 1e9).toFixed(6);

    // Find original seller
    process.stdout.write(`  NFT mint: ${mintAddress}\n`);
    process.stdout.write(`    Escrow: ${escrowPubkey.toBase58()} (${gor} GOR rent)\n`);

    let rentDestination: PublicKey = admin.publicKey; // fallback
    const originalSeller = await findOriginalSeller(connection, escrowPubkey);

    if (originalSeller) {
      rentDestination = originalSeller;
      process.stdout.write(`    Seller: ${originalSeller.toBase58()} (rent returned here)\n`);
    } else {
      process.stdout.write(`    Seller: unknown — rent sent to admin wallet\n`);
    }

    if (!execute) {
      process.stdout.write(`    Action: [DRY RUN] would close and send ${gor} GOR to ${rentDestination.toBase58()}\n\n`);
      continue;
    }

    // Execute the close — fetch blockhash immediately before signing so it's fresh
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const tx = buildCloseOrphanedEscrowTx(
        admin.publicKey,
        nftMint,
        rentDestination,
        blockhash,
      );
      tx.sign(admin);

      const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Poll for confirmation via HTTP (no WebSocket needed)
      let confirmed = false;
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const statuses = await connection.getSignatureStatuses([sig]);
        const s = statuses.value[0];
        if (s) {
          if (s.err) throw new Error(`tx error: ${JSON.stringify(s.err)}`);
          if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') {
            confirmed = true;
            break;
          }
        }
        // Also check if blockhash has expired
        const slot = await connection.getSlot('confirmed');
        if (slot > lastValidBlockHeight) {
          throw new Error('blockhash expired before confirmation');
        }
      }
      if (!confirmed) throw new Error('confirmation timeout');

      process.stdout.write(
        `    Result: CLOSED — sig ${sig}\n` +
        `            Explorer: https://explorer.gorbagana.wtf/tx/${sig}\n\n`,
      );
      closed++;
    } catch (err: any) {
      process.stdout.write(`    Result: FAILED — ${err?.message ?? err}\n\n`);
      failed++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  if (execute) {
    console.log('─'.repeat(60));
    console.log(`Done.  Closed: ${closed}  Failed: ${failed}`);
    if (failed > 0) {
      console.log('Re-run with --execute to retry failed accounts.');
    }
  } else {
    console.log(
      `─`.repeat(60) + `\nDry run complete — ${orphaned.length} account(s) would be closed.` +
      `\nRun with --execute to apply changes.`,
    );
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
