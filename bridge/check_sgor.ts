// @ts-nocheck
/**
 * Gorbagana Token Helper
 * Checks gGOR balance on Gorbagana and sGOR balance on Solana
 * 
 * RPCs:
 * - Gorbagana: https://rpc.trashscan.io (for gGOR native balance)
 * - Solana: https://solana-mainnet.g.alchemy.com/v2/mOHquYPwc4dVQLmp_jFkY (for sGOR SPL token)
 * 
 * sGOR Mint (Solana): 71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg
 */

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import fs from "fs";
import os from "os";
import path from "path";

// Dual RPC configuration
const GORBAGANA_RPC = "https://rpc.trashscan.io";
const SOLANA_RPC = "https://solana-mainnet.g.alchemy.com/v2/mOHquYPwc4dVQLmp_jFkY";
const SGOR_MINT = new PublicKey("71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg");

// Token decimals - sGOR has 6 decimals, gGOR has 9 decimals (standard)
const SGOR_DECIMALS = 6;
const GGOR_DECIMALS = 9;
const SGOR_DIVISOR = Math.pow(10, SGOR_DECIMALS);
const GGOR_DIVISOR = Math.pow(10, GGOR_DECIMALS);

// Load local wallet
function loadWallet(): Keypair {
  const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");
  if (!fs.existsSync(walletPath)) {
    console.error("Wallet not found at " + walletPath);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
  const wallet = loadWallet();

  // Create separate connections for each chain
  const gorbaganaConnection = new Connection(GORBAGANA_RPC, "confirmed");
  const solanaConnection = new Connection(SOLANA_RPC, "confirmed");

  console.log("\n========================================");
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("========================================\n");

  // ── Query gGOR from Gorbagana chain ────────────────────────────
  console.log("📡 Querying Gorbagana (https://rpc.trashscan.io)...");
  try {
    const ggorLamports = await gorbaganaConnection.getBalance(wallet.publicKey);
    console.log("✅ gGOR (native Gorbagana):", (ggorLamports / GGOR_DIVISOR).toFixed(4));
    console.log("   Raw:", ggorLamports.toLocaleString(), "lamports");
  } catch (err) {
    console.error("❌ Failed to fetch gGOR balance:", err.message);
  }

  // ── Query sGOR from Solana Mainnet ─────────────────────────────
  console.log("\n📡 Querying Solana Mainnet (Alchemy)...");

  // Derive sGOR ATA (same address on both chains since same wallet)
  const ata = await getAssociatedTokenAddress(
    SGOR_MINT,
    wallet.publicKey,
    false
  );

  try {
    const account = await getAccount(solanaConnection, ata);
    const sgorBalance = Number(account.amount) / SGOR_DIVISOR;
    console.log("✅ sGOR (SPL on Solana):", sgorBalance.toFixed(4));
    console.log("   ATA:", ata.toBase58());
  } catch (err) {
    console.log("⚠️  sGOR (SPL on Solana): 0 (ATA not found)");
    console.log("   ATA:", ata.toBase58());
    console.log("\n📝 Creating associated token account on Solana...");

    try {
      // FIXED: Use Transaction from web3.js (not SystemProgram.Transaction)
      const transaction = new Transaction();

      // FIXED: Correct function signature (4 args only)
      const instruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // payer
        ata,              // ATA to create
        wallet.publicKey, // owner
        SGOR_MINT         // mint
      );

      transaction.add(instruction);

      // Use Solana connection for creating ATA
      const tx = await solanaConnection.sendTransaction(transaction, [wallet]);
      console.log("✅ Created ATA on Solana. Tx:", tx);
      console.log("   Explorer: https://solscan.io/tx/" + tx);
    } catch (createErr) {
      console.error("❌ Failed to create ATA:", createErr.message);
    }
  }

  console.log("\n========================================");
  console.log("Done.\n");
}

main().catch(console.error);
