import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { useCallback } from 'react';
import { useAnchor } from '../contexts/AnchorContext';
import { useNetwork } from '../contexts/NetworkContext';

// Gorbagana Bridge Program
const GORBAGANA_PROGRAM_ID = new PublicKey('FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq');
const SGOR_MINT_MAINNET = new PublicKey('71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg');

// Solana Devnet Bridge Program
const SOLANA_DEVNET_PROGRAM_ID = new PublicKey('66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M');
const SGOR_MINT_DEVNET = new PublicKey('5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk');

export interface BridgeOrder {
  orderPDA: PublicKey;
  maker: PublicKey;
  amount: BN;
  direction: number;
  expirationSlot: BN;
  isFilled: boolean;
  bump: number;
  /** The source network this order was fetched from */
  network?: 'GORBAGANA' | 'SOLANA';
}

export const useBridgeService = () => {
  const { program, gorbaganaProvider: provider, solanaProgram } = useAnchor();
  const { isDevnet, currentNetwork } = useNetwork();

  // Select the correct program, program ID, and mint based on network
  const activeProgram = isDevnet ? solanaProgram : program;
  const PROGRAM_ID = isDevnet ? SOLANA_DEVNET_PROGRAM_ID : GORBAGANA_PROGRAM_ID;
  const SGOR_MINT = isDevnet ? SGOR_MINT_DEVNET : SGOR_MINT_MAINNET;

  // Derive Order PDA
  const deriveOrderPDA = (maker: PublicKey, amount: BN): PublicKey => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('order'),
        maker.toBuffer(),
        amount.toArrayLike(Buffer, 'le', 8),
      ],
      PROGRAM_ID
    );
    return pda;
  };

  // Derive Escrow token account PDA (for direction 0 sGOR escrow)
  const deriveEscrowPDA = (maker: PublicKey, amount: BN): PublicKey => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('escrow'),
        maker.toBuffer(),
        amount.toArrayLike(Buffer, 'le', 8),
      ],
      PROGRAM_ID
    );
    return pda;
  };

  // Helper to check if an account exists on-chain
  const accountExists = async (pubkey: PublicKey, connection: any): Promise<boolean> => {
    const info = await connection.getAccountInfo(pubkey);
    return info !== null;
  };

  // Create Order (Direction 1: gGOR -> sGOR) — Gorbagana only
  // Maker deposits gGOR (native lamports) into order PDA, wants sGOR in return
  const createOrderGGOR = async (amount: number, expirationSlot: number) => {
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;
    const amountBN = new BN(amount);
    const orderPDA = deriveOrderPDA(wallet.publicKey, amountBN);

    // Direction 1: gGOR escrow — no SPL token accounts needed (pass null for Optional accounts)
    const tx = await program.methods
      .createOrder(amountBN, 1, new BN(expirationSlot))
      .accounts({
        maker: wallet.publicKey,
        order: orderPDA,
        escrowTokenAccount: null,
        makerTokenAccount: null,
        sgorMint: null,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .transaction();

    const latestBlockhash = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);
    const txid = await provider.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });

    const { confirmTransaction } = await import('../utils/confirmTx');
    await confirmTransaction(provider.connection, txid);

    return { tx: txid, orderPDA };
  };

  // Create Order (Direction 0: sGOR -> gGOR) — works on both Gorbagana and Solana devnet
  // Maker deposits sGOR (SPL token) into escrow, wants gGOR (native) in return
  const createOrderSGOR = async (amount: number, expirationSlot: number, gorbaganaRecipient?: PublicKey) => {
    const currentProvider = isDevnet ? (solanaProgram?.provider as any) : provider;
    const currentProgram = isDevnet ? solanaProgram : program;

    if (!currentProgram || !currentProvider) throw new Error('Wallet not connected');

    const wallet = currentProvider.wallet;
    const amountBN = new BN(amount);
    const orderPDA = deriveOrderPDA(wallet.publicKey, amountBN);
    const escrowPDA = deriveEscrowPDA(wallet.publicKey, amountBN);
    const makerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);

    // Gorbagana recipient defaults to maker's wallet if not specified
    const gorRecipient = gorbaganaRecipient || wallet.publicKey;

    const tx = isDevnet
      // Solana devnet bridge has different args: (amount, expiration_slot, gorbagana_recipient)
      ? await currentProgram.methods
          .createOrder(amountBN, new BN(expirationSlot), gorRecipient)
          .accounts({
            maker: wallet.publicKey,
            order: orderPDA,
            escrowTokenAccount: escrowPDA,
            makerTokenAccount: makerATA,
            sgorMint: SGOR_MINT,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .transaction()
      // Gorbagana bridge: (amount, direction, expiration_slot)
      : await currentProgram.methods
          .createOrder(amountBN, 0, new BN(expirationSlot))
          .accounts({
            maker: wallet.publicKey,
            order: orderPDA,
            escrowTokenAccount: escrowPDA,
            makerTokenAccount: makerATA,
            sgorMint: SGOR_MINT,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .transaction();

    const latestBlockhash = await currentProvider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);
    const txid = await currentProvider.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });

    const { confirmTransaction } = await import('../utils/confirmTx');
    await confirmTransaction(currentProvider.connection, txid);

    return { tx: txid, orderPDA, escrowPDA };
  };

  // Fill Order — handles both directions with correct accounts
  const fillOrder = async (orderPDA: PublicKey) => {
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;

    // Fetch order to get direction and maker
    const order = await program.account.order.fetch(orderPDA);

    // Check if order is already filled
    if (order.isFilled) {
      throw new Error('Order has already been filled.');
    }

    // Check SOL balance for fees
    const solBalance = await provider.connection.getBalance(wallet.publicKey);
    if (solBalance < 0.01 * 1e9) {
      throw new Error('Insufficient SOL balance. You need at least 0.01 SOL for transaction fees and rent.');
    }

    const tx = new Transaction();

    if (order.direction === 0) {
      // Direction 0: Maker sold sGOR, wants gGOR
      // Taker sends gGOR (native) → Maker, receives sGOR (SPL) from escrow
      const escrowPDA = deriveEscrowPDA(order.maker, order.amount);

      // Verify escrow exists and has funds
      const escrowExists = await accountExists(escrowPDA, provider.connection);
      if (!escrowExists) {
        throw new Error('Escrow account does not exist. The order may be invalid.');
      }

      // Ensure taker's receive ATA exists (where taker will receive sGOR)
      const takerReceiveATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      if (!(await accountExists(takerReceiveATA, provider.connection))) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            takerReceiveATA,
            wallet.publicKey,
            SGOR_MINT
          )
        );
      }

      // Verify taker has enough gGOR (native) to send
      const requiredGGOR = order.amount.toNumber();
      if (solBalance < requiredGGOR + 0.01 * 1e9) {
        throw new Error(`Insufficient gGOR balance. You need ${requiredGGOR / 1e9} gGOR + 0.01 SOL for fees.`);
      }

      const fillInstruction = await program.methods
        .fillOrder()
        .accounts({
          taker: wallet.publicKey,
          maker: order.maker,
          order: orderPDA,
          escrowTokenAccount: escrowPDA,
          takerTokenAccount: null,
          takerReceiveTokenAccount: takerReceiveATA,
          makerReceiveTokenAccount: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      tx.add(fillInstruction);

    } else {
      // Direction 1: Maker sold gGOR (native in PDA), wants sGOR
      // Taker sends sGOR (SPL) → Maker, receives gGOR (native) from PDA
      const takerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const takerATAExists = await accountExists(takerATA, provider.connection);

      if (!takerATAExists) {
        throw new Error('You do not have an sGOR token account. Please create one and fund it with sGOR first.');
      }

      // Verify taker has enough sGOR tokens
      const takerTokenBalance = await provider.connection.getTokenAccountBalance(takerATA);
      const requiredSGOR = order.amount.toNumber();
      const takerBalance = BigInt(takerTokenBalance.value.amount);
      if (takerBalance < BigInt(requiredSGOR)) {
        throw new Error(`Insufficient sGOR balance. You have ${Number(takerBalance) / 1e9} sGOR but need ${requiredSGOR / 1e9} sGOR.`);
      }

      // Ensure maker's receive ATA exists (where maker will receive sGOR)
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, order.maker);
      if (!(await accountExists(makerATA, provider.connection))) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            makerATA,
            order.maker,
            SGOR_MINT
          )
        );
      }

      const fillInstruction = await program.methods
        .fillOrder()
        .accounts({
          taker: wallet.publicKey,
          maker: order.maker,
          order: orderPDA,
          escrowTokenAccount: null,
          takerTokenAccount: takerATA,
          takerReceiveTokenAccount: null,
          makerReceiveTokenAccount: makerATA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      tx.add(fillInstruction);
    }

    // Get latest blockhash
    const latestBlockhash = await provider.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    // Simulate transaction before signing
    try {
      const simulation = await provider.connection.simulateTransaction(tx);
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
    } catch (simErr: any) {
      throw new Error(`Transaction simulation failed: ${simErr.message}`);
    }

    const signedTx = await wallet.signTransaction(tx);

    let txid: string;
    try {
      txid = await provider.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
    } catch (sendErr: any) {
      if (sendErr?.logs) {
        throw new Error(`Transaction failed: ${sendErr.message}\n\nLogs:\n${sendErr.logs.join('\n')}`);
      }
      throw new Error(`Failed to send transaction: ${sendErr.message || sendErr}`);
    }

    // confirmTransaction from our util already throws on tx error
    const { confirmTransaction } = await import('../utils/confirmTx');
    await confirmTransaction(provider.connection, txid);

    return txid;
  };

  // Cancel Order — returns escrowed funds to maker
  const cancelOrder = async (orderPDA: PublicKey) => {
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;
    const order = await program.account.order.fetch(orderPDA);
    const tx = new Transaction();

    if (order.direction === 0) {
      // Direction 0: Return sGOR (SPL) from escrow to maker
      const escrowPDA = deriveEscrowPDA(wallet.publicKey, order.amount);
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);

      // Ensure maker ATA exists (should, since they deposited from it)
      if (!(await accountExists(makerATA, provider.connection))) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            makerATA,
            wallet.publicKey,
            SGOR_MINT
          )
        );
      }

      const cancelInstruction = await program.methods
        .cancelOrder()
        .accounts({
          maker: wallet.publicKey,
          order: orderPDA,
          escrowTokenAccount: escrowPDA,
          makerTokenAccount: makerATA,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      tx.add(cancelInstruction);
    } else {
      // Direction 1: Return gGOR (native) from PDA — no SPL accounts needed
      const cancelInstruction = await program.methods
        .cancelOrder()
        .accounts({
          maker: wallet.publicKey,
          order: orderPDA,
          escrowTokenAccount: null,
          makerTokenAccount: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      tx.add(cancelInstruction);
    }

    const latestBlockhash = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);
    const txid = await provider.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 2,
    });

    const { confirmTransaction } = await import('../utils/confirmTx');
    await confirmTransaction(provider.connection, txid);

    return txid;
  };

  // Fetch all orders from BOTH programs simultaneously so orders are visible regardless of active network.
  const fetchAllOrders = useCallback(async (): Promise<BridgeOrder[]> => {
    const orders: BridgeOrder[] = [];

    // Always attempt to fetch from Gorbagana program
    if (program) {
      try {
        const gorbaganaAccounts = await program.account.order.all();
        orders.push(
          ...gorbaganaAccounts.map(acc => ({
            orderPDA: acc.publicKey,
            maker: acc.account.maker,
            amount: acc.account.amount,
            direction: acc.account.direction || 0,
            expirationSlot: acc.account.expirationSlot,
            isFilled: acc.account.isFilled,
            bump: acc.account.bump,
            network: 'GORBAGANA' as const,
          }))
        );
      } catch (err) {
        console.error('[BridgeService] Failed to fetch Gorbagana orders:', err);
      }
    }

    // Always attempt to fetch from Solana program
    if (solanaProgram) {
      try {
        const solanaAccounts = await solanaProgram.account.order.all();
        orders.push(
          ...solanaAccounts.map(acc => ({
            orderPDA: acc.publicKey,
            maker: acc.account.maker,
            amount: acc.account.amount,
            direction: acc.account.direction || 0,
            expirationSlot: acc.account.expirationSlot,
            isFilled: acc.account.isFilled,
            bump: acc.account.bump,
            network: 'SOLANA' as const,
          }))
        );
      } catch (err) {
        console.error('[BridgeService] Failed to fetch Solana orders:', err);
      }
    }

    return orders;
  }, [program, solanaProgram]);

  return {
    createOrderGGOR,
    createOrderSGOR,
    fillOrder,
    cancelOrder,
    fetchAllOrders,
    deriveOrderPDA,
  };
};
