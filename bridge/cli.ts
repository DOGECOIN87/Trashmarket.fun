// check_sgor.ts
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  getAccount,
} from "@solana/spl-token";
import fs from "fs";

// --- CONFIG ---
const WALLET_PATH = "./bridge-keypair.json"; // path to your keypair file
const SGOR_MINT = new PublicKey("71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg");

// RPC endpoints
const GORBAGANA_RPC = "https://rpc.trashscan.io"; // gGOR
const SOLANA_RPC = "https://api.mainnet-beta.solana.com"; // sGOR SPL

// --- HELPERS ---
function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(path, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

// --- MAIN ---
(async () => {
  const wallet = loadKeypair(WALLET_PATH);
  const walletPub = wallet.publicKey;

  console.log("Wallet:", walletPub.toBase58());

  // gGOR balance (native on Gorbagana)
  const connGor = new Connection(GORBAGANA_RPC, "confirmed");
  const ggorBalance = await connGor.getBalance(walletPub);
  console.log("gGOR (native SOL):", ggorBalance / LAMPORTS_PER_SOL);

  // sGOR balance (SPL token on Solana)
  const connSol = new Connection(SOLANA_RPC, "confirmed");

  try {
    const ata = await getOrCreateAssociatedTokenAccount(
      connSol,
      wallet,    // payer
      SGOR_MINT, // token mint
      walletPub  // owner
    );

    const accountInfo = await getAccount(connSol, ata.address);
    console.log("sGOR (SPL):", Number(accountInfo.amount));

  } catch (err: any) {
    console.error("Error fetching sGOR:", err);
  }
})();
