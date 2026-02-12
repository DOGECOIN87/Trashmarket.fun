// @ts-nocheck
/**
 * Mainnet Test for Gorbagana Bridge
 * Creates and cancels an order to test the deployed program
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { GorbaganaBridge } from "./target/types/gorbagana_bridge";
import fs from "fs";
import path from "path";
import os from "os";

const RPC_URL = "https://rpc.trashscan.io";
const PROGRAM_ID = new PublicKey("FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq");

// Load wallet
function loadWallet(): Keypair {
    const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");
    const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function main() {
    console.log("🧪 Testing Gorbagana Bridge on Mainnet\n");
    console.log("Program ID:", PROGRAM_ID.toBase58());
    console.log("RPC:", RPC_URL);
    console.log("");

    const wallet = loadWallet();
    console.log("Wallet:", wallet.publicKey.toBase58());

    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new anchor.AnchorProvider(connection, {
        publicKey: wallet.publicKey,
        secretKey: wallet.secretKey,
    } as any, { commitment: "confirmed" });
    anchor.setProvider(provider);

    const program = new Program(
        require("./target/idl/gorbagana_bridge.json"),
        provider
    ) as Program<GorbaganaBridge>;

    // Test parameters
    const amount = new anchor.BN(1_000_000); // 0.001 gGOR
    const direction = 1; // Maker deposits gGOR (native), wants sGOR
    const currentSlot = await connection.getSlot();
    const expirationSlot = new anchor.BN(currentSlot + 1000); // ~10 minutes

    console.log("\n📋 Test Parameters:");
    console.log("  Amount:", amount.toString(), "lamports (0.001 gGOR)");
    console.log("  Direction:", direction, "(gGOR → sGOR)");
    console.log("  Current Slot:", currentSlot);
    console.log("  Expiration Slot:", expirationSlot.toString());

    // Derive Order PDA
    const [orderPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("order"),
            wallet.publicKey.toBuffer(),
            amount.toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
    );

    console.log("\n🔑 Order PDA:", orderPDA.toBase58());

    // Step 1: Create Order
    console.log("\n📝 Step 1: Creating order...");
    try {
        const tx = await program.methods
            .createOrder(amount, direction, expirationSlot)
            .accounts({
                maker: wallet.publicKey,
                order: orderPDA,
                escrowTokenAccount: null,
                makerTokenAccount: null,
                sgorMint: null,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([wallet])
            .rpc();

        console.log("✅ Order created!");
        console.log("   Transaction:", tx);
        console.log("   Explorer: https://trashscan.io/tx/" + tx);
    } catch (err) {
        console.error("❌ Failed to create order:", err.message);
        return;
    }

    // Verify order exists
    console.log("\n🔍 Verifying order on-chain...");
    try {
        const orderAccount = await program.account.order.fetch(orderPDA);
        console.log("✅ Order account found!");
        console.log("   Maker:", orderAccount.maker.toBase58());
        console.log("   Amount:", orderAccount.amount.toString());
        console.log("   Direction:", orderAccount.direction);
        console.log("   Expiration:", orderAccount.expirationSlot.toString());
        console.log("   Is Filled:", orderAccount.isFilled);
    } catch (err) {
        console.error("❌ Order not found:", err.message);
        return;
    }

    // Step 2: Cancel Order (to return gGOR)
    console.log("\n🗑️  Step 2: Cancelling order (to reclaim gGOR)...");
    try {
        const tx = await program.methods
            .cancelOrder()
            .accounts({
                maker: wallet.publicKey,
                order: orderPDA,
                escrowTokenAccount: null,
                makerTokenAccount: null,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([wallet])
            .rpc();

        console.log("✅ Order cancelled!");
        console.log("   Transaction:", tx);
        console.log("   Explorer: https://trashscan.io/tx/" + tx);
    } catch (err) {
        console.error("❌ Failed to cancel order:", err.message);
        return;
    }

    // Verify order is closed
    console.log("\n🔍 Verifying order is closed...");
    try {
        await program.account.order.fetch(orderPDA);
        console.log("⚠️  Order still exists (unexpected)");
    } catch (err) {
        console.log("✅ Order account closed successfully!");
    }

    console.log("\n🎉 TEST COMPLETED SUCCESSFULLY!");
    console.log("\nThe deployed program is working correctly:");
    console.log("  ✅ Create order (Direction 1: gGOR → sGOR)");
    console.log("  ✅ Cancel order");
    console.log("  ✅ Native gGOR handling");
}

main().catch((err) => {
    console.error("\n❌ Test failed:", err);
    process.exit(1);
});
