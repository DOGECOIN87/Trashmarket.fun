#!/usr/bin/env ts-node
/**
 * Faucet Token Distribution Script
 *
 * Usage:
 *   ts-node scripts/faucet-drip.ts <recipient_address>
 *
 * This script sends 5 test sGOR tokens from the faucet to a recipient.
 * Requires the faucet authority keypair to be available.
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const TEST_SGOR_MINT = new PublicKey('5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk');
const FAUCET_AMOUNT = 5_000_000; // 5 tokens (6 decimals)

async function main() {
  // Get recipient from command line
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: ts-node faucet-drip.ts <recipient_address>');
    process.exit(1);
  }

  const recipientAddress = args[0];
  let recipient: PublicKey;

  try {
    recipient = new PublicKey(recipientAddress);
  } catch (error) {
    console.error('Invalid recipient address:', recipientAddress);
    process.exit(1);
  }

  console.log('🚰 Faucet Token Distribution');
  console.log('━'.repeat(50));
  console.log(`Recipient: ${recipient.toString()}`);
  console.log(`Amount: 5 sGOR (${FAUCET_AMOUNT} lamports)`);
  console.log(`Network: Devnet`);
  console.log('━'.repeat(50));

  // Load faucet authority keypair
  const authorityKeypairPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  if (!fs.existsSync(authorityKeypairPath)) {
    console.error('Error: Faucet authority keypair not found at:', authorityKeypairPath);
    console.error('Please ensure your Solana keypair is configured.');
    process.exit(1);
  }

  const authorityKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(authorityKeypairPath, 'utf-8')))
  );

  console.log(`Faucet authority: ${authorityKeypair.publicKey.toString()}`);

  // Connect to devnet
  const connection = new Connection(DEVNET_RPC, 'confirmed');

  try {
    // Get associated token accounts
    const authorityTokenAccount = await getAssociatedTokenAddress(
      TEST_SGOR_MINT,
      authorityKeypair.publicKey
    );

    const recipientTokenAccount = await getAssociatedTokenAddress(
      TEST_SGOR_MINT,
      recipient
    );

    console.log('\n📝 Preparing transaction...');

    // Check if authority has tokens
    let authorityAccount;
    try {
      authorityAccount = await getAccount(connection, authorityTokenAccount);
      console.log(`Faucet balance: ${Number(authorityAccount.amount) / 1_000_000} sGOR`);

      if (Number(authorityAccount.amount) < FAUCET_AMOUNT) {
        console.error('Error: Insufficient tokens in faucet');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error: Faucet token account not found');
      process.exit(1);
    }

    // Check if recipient account exists
    let accountExists = true;
    try {
      await getAccount(connection, recipientTokenAccount);
      console.log('Recipient token account exists ✓');
    } catch {
      accountExists = false;
      console.log('Recipient token account will be created');
    }

    // Build transaction
    const transaction = new Transaction();

    // Create token account if needed
    if (!accountExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          authorityKeypair.publicKey, // payer
          recipientTokenAccount,
          recipient,
          TEST_SGOR_MINT
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        authorityTokenAccount,
        recipientTokenAccount,
        authorityKeypair.publicKey,
        FAUCET_AMOUNT
      )
    );

    // Send transaction
    console.log('\n💸 Sending tokens...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authorityKeypair],
      {
        commitment: 'confirmed',
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('━'.repeat(50));
    console.log(`Transaction: ${signature}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`\nSent 5 sGOR to ${recipient.toString()}`);
    console.log('━'.repeat(50));

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
