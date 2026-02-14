/**
 * Solana Devnet Test Token Faucet Server
 *
 * Simple API server for distributing test sGOR tokens on Solana devnet.
 * Rate limits: 5 tokens per wallet per 24 hours.
 */

import express from 'express';
import cors from 'cors';
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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const DEVNET_RPC = process.env.RPC_URL || 'https://api.devnet.solana.com';
const TEST_SGOR_MINT = new PublicKey('5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk');
const FAUCET_AMOUNT = 5_000_000; // 5 tokens (6 decimals)
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory rate limiting (in production, use Redis or a database)
const claimHistory: Map<string, number> = new Map();

// Load faucet authority keypair
let authorityKeypair: Keypair;
try {
  const keypairPath = process.env.KEYPAIR_PATH || path.join(process.env.HOME || '', '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  authorityKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log(`Faucet authority: ${authorityKeypair.publicKey.toString()}`);
} catch (error) {
  console.error('Failed to load faucet authority keypair:', error);
  process.exit(1);
}

const connection = new Connection(DEVNET_RPC, 'confirmed');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    network: 'devnet',
    faucetAddress: authorityKeypair.publicKey.toString(),
  });
});

// Get faucet info
app.get('/info', async (req, res) => {
  try {
    const tokenAccount = await getAssociatedTokenAddress(
      TEST_SGOR_MINT,
      authorityKeypair.publicKey
    );
    const account = await getAccount(connection, tokenAccount);

    res.json({
      mint: TEST_SGOR_MINT.toString(),
      authority: authorityKeypair.publicKey.toString(),
      balance: Number(account.amount) / 1_000_000,
      amountPerClaim: 5,
      rateLimitHours: 24,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check if wallet can claim
app.get('/can-claim/:wallet', (req, res) => {
  const { wallet } = req.params;

  try {
    new PublicKey(wallet); // Validate address
  } catch {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const lastClaim = claimHistory.get(wallet);
  if (!lastClaim) {
    return res.json({ canClaim: true, nextClaimTime: null });
  }

  const timeSinceClaim = Date.now() - lastClaim;
  const canClaim = timeSinceClaim >= RATE_LIMIT_MS;

  res.json({
    canClaim,
    nextClaimTime: canClaim ? null : new Date(lastClaim + RATE_LIMIT_MS).toISOString(),
    timeRemaining: canClaim ? 0 : RATE_LIMIT_MS - timeSinceClaim,
  });
});

// Claim tokens
app.post('/claim', async (req, res) => {
  const { wallet } = req.body;

  // Validate wallet address
  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(wallet);
  } catch {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  // Check rate limit
  const lastClaim = claimHistory.get(wallet);
  if (lastClaim && (Date.now() - lastClaim) < RATE_LIMIT_MS) {
    const nextClaimTime = new Date(lastClaim + RATE_LIMIT_MS);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'You can only claim once per 24 hours',
      nextClaimTime: nextClaimTime.toISOString(),
    });
  }

  try {
    // Get token accounts
    const authorityTokenAccount = await getAssociatedTokenAddress(
      TEST_SGOR_MINT,
      authorityKeypair.publicKey
    );

    const recipientTokenAccount = await getAssociatedTokenAddress(
      TEST_SGOR_MINT,
      recipientPubkey
    );

    // Check faucet balance
    const authorityAccount = await getAccount(connection, authorityTokenAccount);
    if (Number(authorityAccount.amount) < FAUCET_AMOUNT) {
      return res.status(503).json({
        error: 'Faucet empty',
        message: 'The faucet has insufficient tokens. Please try again later.',
      });
    }

    // Check if recipient account exists
    let accountExists = true;
    try {
      await getAccount(connection, recipientTokenAccount);
    } catch {
      accountExists = false;
    }

    // Build transaction
    const transaction = new Transaction();

    // Create token account if needed
    if (!accountExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          authorityKeypair.publicKey,
          recipientTokenAccount,
          recipientPubkey,
          TEST_SGOR_MINT
        )
      );
    }

    // Add transfer
    transaction.add(
      createTransferInstruction(
        authorityTokenAccount,
        recipientTokenAccount,
        authorityKeypair.publicKey,
        FAUCET_AMOUNT
      )
    );

    // Send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [authorityKeypair],
      { commitment: 'confirmed' }
    );

    // Record claim
    claimHistory.set(wallet, Date.now());

    res.json({
      success: true,
      signature,
      amount: 5,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });

    console.log(`✅ Sent 5 sGOR to ${wallet} (tx: ${signature})`);

  } catch (error: any) {
    console.error('Claim failed:', error);
    res.status(500).json({
      error: 'Transaction failed',
      message: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚰 Faucet server running on port ${PORT}`);
  console.log(`Network: Solana Devnet`);
  console.log(`Mint: ${TEST_SGOR_MINT.toString()}`);
});
