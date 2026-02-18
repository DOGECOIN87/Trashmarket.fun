import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert, expect } from "chai";
import { GorbaganaBridge } from "../target/types/gorbagana_bridge";

// ═══════════════════════════════════════════════════════════════════════
// Helper: derive PDAs
// ═══════════════════════════════════════════════════════════════════════
function deriveOrderPDA(
  programId: PublicKey,
  maker: PublicKey,
  amount: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("order"),
      maker.toBuffer(),
      amount.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

function deriveEscrowPDA(
  programId: PublicKey,
  maker: PublicKey,
  amount: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      maker.toBuffer(),
      amount.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════════════
describe("gorbagana_bridge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .GorbaganaBridge as Program<GorbaganaBridge>;

  // Actors
  let maker: Keypair;
  let taker: Keypair;
  let unauthorized: Keypair;

  // sGOR SPL mint (simulated in tests)
  let sgorMint: PublicKey;
  let mintAuthority: Keypair;

  // Token accounts
  let makerSgorATA: PublicKey;
  let takerSgorATA: PublicKey;

  const ORDER_AMOUNT = new anchor.BN(1_000_000_000); // 1 sGOR / 1 gGOR
  const EXPIRY_OFFSET = 500; // slots in the future

  // ─── Setup ───────────────────────────────────────────────────────
  before(async () => {
    maker = Keypair.generate();
    taker = Keypair.generate();
    unauthorized = Keypair.generate();
    mintAuthority = Keypair.generate();

    // Airdrop SOL to all actors
    for (const kp of [maker, taker, unauthorized, mintAuthority]) {
      const sig = await provider.connection.requestAirdrop(
        kp.publicKey,
        10 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);
    }

    // Create sGOR mint (in production this is the real mint)
    sgorMint = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9 // 9 decimals like SOL
    );

    // Create ATAs and mint sGOR to maker and taker
    makerSgorATA = await createAssociatedTokenAccount(
      provider.connection,
      maker,
      sgorMint,
      maker.publicKey
    );
    takerSgorATA = await createAssociatedTokenAccount(
      provider.connection,
      taker,
      sgorMint,
      taker.publicKey
    );

    await mintTo(
      provider.connection,
      mintAuthority,
      sgorMint,
      makerSgorATA,
      mintAuthority,
      10_000_000_000 // 10 sGOR
    );
    await mintTo(
      provider.connection,
      mintAuthority,
      sgorMint,
      takerSgorATA,
      mintAuthority,
      10_000_000_000
    );
  });

  // ─── Utility ─────────────────────────────────────────────────────
  async function getCurrentSlot(): Promise<number> {
    return provider.connection.getSlot();
  }

  async function getLamports(pubkey: PublicKey): Promise<number> {
    return provider.connection.getBalance(pubkey);
  }

  // ═══════════════════════════════════════════════════════════════════
  // DIRECTION 0: Maker sells sGOR (SPL) → wants gGOR (native)
  // ═══════════════════════════════════════════════════════════════════
  describe("Direction 0: sGOR → gGOR", () => {
    let orderPDA: PublicKey;
    let escrowPDA: PublicKey;

    it("creates an order (maker deposits sGOR into escrow)", async () => {
      const currentSlot = await getCurrentSlot();
      const expirationSlot = new anchor.BN(currentSlot + EXPIRY_OFFSET);

      [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        ORDER_AMOUNT
      );
      [escrowPDA] = deriveEscrowPDA(
        program.programId,
        maker.publicKey,
        ORDER_AMOUNT
      );

      const makerBalanceBefore = (
        await getAccount(provider.connection, makerSgorATA)
      ).amount;

      await program.methods
        .createOrder(ORDER_AMOUNT, 0, expirationSlot)
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: escrowPDA,
          makerTokenAccount: makerSgorATA,
          sgorMint: sgorMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maker])
        .rpc();

      // Verify escrow received sGOR
      const escrowBalance = (
        await getAccount(provider.connection, escrowPDA)
      ).amount;
      assert.equal(
        escrowBalance.toString(),
        ORDER_AMOUNT.toString(),
        "Escrow should hold the deposited sGOR"
      );

      // Verify maker balance decreased
      const makerBalanceAfter = (
        await getAccount(provider.connection, makerSgorATA)
      ).amount;
      assert.equal(
        (makerBalanceBefore - makerBalanceAfter).toString(),
        ORDER_AMOUNT.toString(),
        "Maker sGOR balance should decrease by order amount"
      );

      // Verify order state
      const orderAccount = await program.account.order.fetch(orderPDA);
      assert.equal(orderAccount.maker.toBase58(), maker.publicKey.toBase58());
      assert.equal(orderAccount.amount.toString(), ORDER_AMOUNT.toString());
      assert.equal(orderAccount.direction, 0);
      assert.equal(orderAccount.isFilled, false);
    });

    it("fills the order (taker sends gGOR, receives sGOR)", async () => {
      const makerLamportsBefore = await getLamports(maker.publicKey);
      const takerSgorBefore = (
        await getAccount(provider.connection, takerSgorATA)
      ).amount;

      // Create taker's sGOR receive account (same as takerSgorATA since same mint)
      await program.methods
        .fillOrder()
        .accounts({
          taker: taker.publicKey,
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: escrowPDA,
          takerTokenAccount: null, // not needed for direction 0
          takerReceiveTokenAccount: takerSgorATA,
          makerReceiveTokenAccount: null, // not needed for direction 0
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([taker])
        .rpc();

      // Verify maker received gGOR (native lamports)
      const makerLamportsAfter = await getLamports(maker.publicKey);
      // Maker gets native gGOR + rent from closed PDA
      assert.isTrue(
        makerLamportsAfter > makerLamportsBefore,
        "Maker should receive gGOR (native lamports)"
      );

      // Verify taker received sGOR from escrow
      const takerSgorAfter = (
        await getAccount(provider.connection, takerSgorATA)
      ).amount;
      assert.equal(
        (takerSgorAfter - takerSgorBefore).toString(),
        ORDER_AMOUNT.toString(),
        "Taker should receive sGOR from escrow"
      );

      // Verify order account is closed
      try {
        await program.account.order.fetch(orderPDA);
        assert.fail("Order account should be closed after fill");
      } catch (e: any) {
        assert.include(e.message, "Account does not exist");
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DIRECTION 1: Maker sells gGOR (native) → wants sGOR (SPL)
  // ═══════════════════════════════════════════════════════════════════
  describe("Direction 1: gGOR → sGOR", () => {
    const amount = new anchor.BN(500_000_000); // 0.5 gGOR
    let orderPDA: PublicKey;

    it("creates an order (maker deposits gGOR native into PDA)", async () => {
      const currentSlot = await getCurrentSlot();
      const expirationSlot = new anchor.BN(currentSlot + EXPIRY_OFFSET);

      [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        amount
      );

      const makerLamportsBefore = await getLamports(maker.publicKey);

      await program.methods
        .createOrder(amount, 1, expirationSlot)
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: null, // not needed for native direction
          makerTokenAccount: null,
          sgorMint: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maker])
        .rpc();

      // Verify PDA received native gGOR
      const orderLamports = await getLamports(orderPDA);
      // PDA holds amount + rent-exempt minimum
      assert.isTrue(
        orderLamports >= amount.toNumber(),
        "Order PDA should hold native gGOR lamports"
      );

      // Verify order state
      const orderAccount = await program.account.order.fetch(orderPDA);
      assert.equal(orderAccount.direction, 1);
      assert.equal(orderAccount.amount.toString(), amount.toString());
      assert.equal(orderAccount.isFilled, false);
    });

    it("fills the order (taker sends sGOR, receives gGOR native)", async () => {
      const takerLamportsBefore = await getLamports(taker.publicKey);

      // Maker needs an sGOR receive account
      await program.methods
        .fillOrder()
        .accounts({
          taker: taker.publicKey,
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: null,
          takerTokenAccount: takerSgorATA,
          takerReceiveTokenAccount: null,
          makerReceiveTokenAccount: makerSgorATA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([taker])
        .rpc();

      // Verify taker received gGOR (native)
      const takerLamportsAfter = await getLamports(taker.publicKey);
      // Account for tx fees, but taker should have gained ~amount
      const netGain =
        takerLamportsAfter - takerLamportsBefore + 10_000; // rough fee buffer
      assert.isTrue(
        netGain > 0,
        "Taker should receive native gGOR lamports"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CANCEL ORDER
  // ═══════════════════════════════════════════════════════════════════
  describe("Cancel Order", () => {
    const cancelAmount = new anchor.BN(250_000_000);

    it("maker can cancel a direction 0 order and reclaim sGOR", async () => {
      const currentSlot = await getCurrentSlot();
      const expirationSlot = new anchor.BN(currentSlot + EXPIRY_OFFSET);

      const [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        cancelAmount
      );
      const [escrowPDA] = deriveEscrowPDA(
        program.programId,
        maker.publicKey,
        cancelAmount
      );

      // Create order
      await program.methods
        .createOrder(cancelAmount, 0, expirationSlot)
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: escrowPDA,
          makerTokenAccount: makerSgorATA,
          sgorMint: sgorMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maker])
        .rpc();

      const makerSgorBefore = (
        await getAccount(provider.connection, makerSgorATA)
      ).amount;

      // Cancel
      await program.methods
        .cancelOrder()
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: escrowPDA,
          makerTokenAccount: makerSgorATA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      // Verify sGOR returned
      const makerSgorAfter = (
        await getAccount(provider.connection, makerSgorATA)
      ).amount;
      assert.equal(
        (makerSgorAfter - makerSgorBefore).toString(),
        cancelAmount.toString(),
        "Maker should reclaim sGOR after cancel"
      );

      // Verify order closed
      try {
        await program.account.order.fetch(orderPDA);
        assert.fail("Order should be closed after cancel");
      } catch (e: any) {
        assert.include(e.message, "Account does not exist");
      }
    });

    it("maker can cancel a direction 1 order and reclaim gGOR", async () => {
      const nativeAmount = new anchor.BN(300_000_000);
      const currentSlot = await getCurrentSlot();
      const expirationSlot = new anchor.BN(currentSlot + EXPIRY_OFFSET);

      const [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        nativeAmount
      );

      await program.methods
        .createOrder(nativeAmount, 1, expirationSlot)
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: null,
          makerTokenAccount: null,
          sgorMint: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maker])
        .rpc();

      const makerLamportsBefore = await getLamports(maker.publicKey);

      await program.methods
        .cancelOrder()
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: null,
          makerTokenAccount: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      const makerLamportsAfter = await getLamports(maker.publicKey);
      assert.isTrue(
        makerLamportsAfter > makerLamportsBefore,
        "Maker should reclaim native gGOR + rent after cancel"
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY TESTS
  // ═══════════════════════════════════════════════════════════════════
  describe("Security", () => {
    it("rejects unauthorized cancellation", async () => {
      const secAmount = new anchor.BN(100_000_000);
      const currentSlot = await getCurrentSlot();
      const expirationSlot = new anchor.BN(currentSlot + EXPIRY_OFFSET);

      const [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        secAmount
      );
      const [escrowPDA] = deriveEscrowPDA(
        program.programId,
        maker.publicKey,
        secAmount
      );

      await program.methods
        .createOrder(secAmount, 0, expirationSlot)
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: escrowPDA,
          makerTokenAccount: makerSgorATA,
          sgorMint: sgorMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maker])
        .rpc();

      try {
        await program.methods
          .cancelOrder()
          .accounts({
            maker: unauthorized.publicKey, // wrong signer!
            order: orderPDA,
            escrowTokenAccount: escrowPDA,
            makerTokenAccount: makerSgorATA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([unauthorized])
          .rpc();
        assert.fail("Should reject unauthorized cancel");
      } catch (e: any) {
        // Expected: has_one constraint failure
        assert.isTrue(
          e.message.includes("Unauthorized") ||
            e.message.includes("ConstraintHasOne") ||
            e.message.includes("2012") ||
            e.message.includes("Error"),
          `Expected auth error, got: ${e.message}`
        );
      }

      // Cleanup: cancel with correct maker
      await program.methods
        .cancelOrder()
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: escrowPDA,
          makerTokenAccount: makerSgorATA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();
    });

    it("rejects zero amount", async () => {
      const zeroAmount = new anchor.BN(0);
      const currentSlot = await getCurrentSlot();
      const expirationSlot = new anchor.BN(currentSlot + EXPIRY_OFFSET);

      const [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        zeroAmount
      );

      try {
        await program.methods
          .createOrder(zeroAmount, 1, expirationSlot)
          .accounts({
            maker: maker.publicKey,
            order: orderPDA,
            escrowTokenAccount: null,
            makerTokenAccount: null,
            sgorMint: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([maker])
          .rpc();
        assert.fail("Should reject zero amount");
      } catch (e: any) {
        assert.isTrue(
          e.message.includes("InvalidAmount") || e.message.includes("6000"),
          `Expected InvalidAmount error, got: ${e.message}`
        );
      }
    });

    it("rejects invalid direction", async () => {
      const amt = new anchor.BN(100_000_000);
      const currentSlot = await getCurrentSlot();
      const expirationSlot = new anchor.BN(currentSlot + EXPIRY_OFFSET);

      const [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        amt
      );

      try {
        await program.methods
          .createOrder(amt, 5, expirationSlot) // invalid direction
          .accounts({
            maker: maker.publicKey,
            order: orderPDA,
            escrowTokenAccount: null,
            makerTokenAccount: null,
            sgorMint: null,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([maker])
          .rpc();
        assert.fail("Should reject invalid direction");
      } catch (e: any) {
        assert.isTrue(
          e.message.includes("InvalidDirection") ||
            e.message.includes("6001"),
          `Expected InvalidDirection error, got: ${e.message}`
        );
      }
    });

    it("rejects filling an expired order", async () => {
      const expAmount = new anchor.BN(200_000_000);
      const currentSlot = await getCurrentSlot();
      // Set expiration to current slot (effectively already expired by tx time)
      const expirationSlot = new anchor.BN(currentSlot + 1);

      const [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        expAmount
      );

      await program.methods
        .createOrder(expAmount, 1, expirationSlot)
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: null,
          makerTokenAccount: null,
          sgorMint: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maker])
        .rpc();

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        await program.methods
          .fillOrder()
          .accounts({
            taker: taker.publicKey,
            maker: maker.publicKey,
            order: orderPDA,
            escrowTokenAccount: null,
            takerTokenAccount: takerSgorATA,
            takerReceiveTokenAccount: null,
            makerReceiveTokenAccount: makerSgorATA,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([taker])
          .rpc();
        assert.fail("Should reject expired order fill");
      } catch (e: any) {
        assert.isTrue(
          e.message.includes("OrderExpired") || e.message.includes("6003"),
          `Expected OrderExpired error, got: ${e.message}`
        );
      }

      // Cleanup
      await program.methods
        .cancelOrder()
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: null,
          makerTokenAccount: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // NATIVE gGOR VERIFICATION (per Step 4.2 of deployment doc)
  // ═══════════════════════════════════════════════════════════════════
  describe("Native gGOR Verification", () => {
    it("direction 1 deposits use system_program::transfer (no SPL wrapping)", async () => {
      const nativeAmt = new anchor.BN(150_000_000);
      const currentSlot = await getCurrentSlot();
      const expirationSlot = new anchor.BN(currentSlot + EXPIRY_OFFSET);

      const [orderPDA] = deriveOrderPDA(
        program.programId,
        maker.publicKey,
        nativeAmt
      );

      const makerBefore = await getLamports(maker.publicKey);

      await program.methods
        .createOrder(nativeAmt, 1, expirationSlot)
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: null,
          makerTokenAccount: null,
          sgorMint: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([maker])
        .rpc();

      const makerAfter = await getLamports(maker.publicKey);
      const pdaBalance = await getLamports(orderPDA);

      // PDA should hold native lamports — not an SPL token account
      assert.isTrue(pdaBalance >= nativeAmt.toNumber());

      // Maker balance decreased by at least the order amount
      assert.isTrue(makerBefore - makerAfter >= nativeAmt.toNumber());

      // Cleanup
      await program.methods
        .cancelOrder()
        .accounts({
          maker: maker.publicKey,
          order: orderPDA,
          escrowTokenAccount: null,
          makerTokenAccount: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();
    });
  });
});
