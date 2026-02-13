import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, Connection } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';
import type { GorbaganaBridge } from '../src/idl/gorbagana_bridge';
import idl from '../src/idl/gorbagana_bridge.json';

const PROGRAM_ID = new PublicKey('FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq');
const SGOR_MINT = new PublicKey('71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg');

export interface BridgeOrder {
  orderPDA: PublicKey;
  maker: PublicKey;
  amount: BN;
  direction: number;
  expirationSlot: BN;
  isFilled: boolean;
  bump: number;
}

// Dedicated Gorbagana connection — all bridge RPCs go here regardless of wallet network
const gorbaganaConnection = new Connection(GORBAGANA_CONFIG.rpcEndpoint, 'confirmed');

export const useBridgeService = () => {
  const wallet = useWallet();

  // Create a bridge-specific Anchor program that always targets Gorbagana
  const { program, provider } = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      return { program: null, provider: null };
    }

    try {
      const provider = new AnchorProvider(
        gorbaganaConnection,
        wallet as any,
        {
          commitment: 'confirmed',
          preflightCommitment: 'processed',
          skipPreflight: true,
        }
      );

      const program = new Program(
        idl as any,
        provider
      ) as unknown as Program<GorbaganaBridge>;

      return { program, provider };
    } catch (err) {
      console.warn('Bridge service: Failed to initialize program:', err);
      return { program: null, provider: null };
    }
  }, [wallet.publicKey, wallet.signTransaction]);

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

  // Create Order (Direction 1: gGOR -> sGOR)
  const createOrderGGOR = async (amount: number, expirationSlot: number) => {
    if (!program || !provider || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }
    const amountBN = new BN(amount);
    const orderPDA = deriveOrderPDA(wallet.publicKey, amountBN);

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

    const latestBlockhash = await gorbaganaConnection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);

    const txid = await gorbaganaConnection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    await gorbaganaConnection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    return { tx: txid, orderPDA };
  };

  // Create Order (Direction 0: sGOR -> gGOR)
  const createOrderSGOR = async (amount: number, expirationSlot: number) => {
    if (!program || !provider || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }
    const amountBN = new BN(amount);
    const orderPDA = deriveOrderPDA(wallet.publicKey, amountBN);

    const escrowPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from('escrow'),
        wallet.publicKey.toBuffer(),
        amountBN.toArrayLike(Buffer, 'le', 8),
      ],
      PROGRAM_ID
    )[0];

    const makerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);

    const tx = await program.methods
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

    const latestBlockhash = await gorbaganaConnection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);

    const txid = await gorbaganaConnection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    await gorbaganaConnection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    return { tx: txid, orderPDA, escrowPDA };
  };

  // Fill Order
  const fillOrder = async (orderPDA: PublicKey) => {
    if (!program || !provider || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }

    // Fetch order from Gorbagana to get direction and maker
    const order = await program.account.order.fetch(orderPDA);

    const accounts: any = {
      taker: wallet.publicKey,
      maker: order.maker,
      order: orderPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      escrowTokenAccount: null,
      takerTokenAccount: null,
      takerReceiveTokenAccount: null,
      makerReceiveTokenAccount: null,
    };

    // Pre-instructions to create ATAs if they don't exist
    const preInstructions: any[] = [];

    // Helper to check if an account exists on Gorbagana
    const accountExists = async (pubkey: PublicKey): Promise<boolean> => {
      const info = await gorbaganaConnection.getAccountInfo(pubkey);
      return info !== null;
    };

    if (order.direction === 0) {
      // Direction 0: Taker sends gGOR, receives sGOR
      const takerReceiveATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const escrowPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          order.maker.toBuffer(),
          order.amount.toArrayLike(Buffer, 'le', 8),
        ],
        PROGRAM_ID
      )[0];

      // Create taker's sGOR ATA if it doesn't exist on Gorbagana
      if (!(await accountExists(takerReceiveATA))) {
        preInstructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            takerReceiveATA,
            wallet.publicKey,
            SGOR_MINT,
          )
        );
      }

      accounts.escrowTokenAccount = escrowPDA;
      accounts.takerReceiveTokenAccount = takerReceiveATA;
    } else {
      // Direction 1: Taker sends sGOR, receives gGOR
      const takerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, order.maker);

      // Create maker's sGOR receive ATA if it doesn't exist on Gorbagana
      if (!(await accountExists(makerATA))) {
        preInstructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            makerATA,
            order.maker,
            SGOR_MINT,
          )
        );
      }

      accounts.takerTokenAccount = takerATA;
      accounts.makerReceiveTokenAccount = makerATA;
    }

    const tx = await program.methods
      .fillOrder()
      .accounts(accounts)
      .transaction();

    // Prepend ATA creation instructions if needed
    if (preInstructions.length > 0) {
      const fullTx = new Transaction();
      preInstructions.forEach(ix => fullTx.add(ix));
      fullTx.add(...tx.instructions);
      tx.instructions = fullTx.instructions;
    }

    const latestBlockhash = await gorbaganaConnection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);

    const txid = await gorbaganaConnection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    const confirmation = await gorbaganaConnection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    if (confirmation.value.err) {
      const errJson = JSON.stringify(confirmation.value.err);
      const customMatch = errJson.match(/"Custom":(\d+)/);
      if (customMatch) {
        const code = parseInt(customMatch[1], 10);
        const err = new Error(`Transaction failed with Custom:${code}`);
        (err as any).code = code;
        throw err;
      }
      throw new Error(`Transaction failed: ${errJson}`);
    }

    return txid;
  };

  // Cancel Order
  const cancelOrder = async (orderPDA: PublicKey) => {
    if (!program || !provider || !wallet.publicKey || !wallet.signTransaction) {
      throw new Error('Wallet not connected');
    }
    const order = await program.account.order.fetch(orderPDA);

    const accounts: any = {
      maker: wallet.publicKey,
      order: orderPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      escrowTokenAccount: null,
      makerTokenAccount: null,
    };

    if (order.direction === 0) {
      const escrowPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          wallet.publicKey.toBuffer(),
          order.amount.toArrayLike(Buffer, 'le', 8),
        ],
        PROGRAM_ID
      )[0];
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);

      accounts.escrowTokenAccount = escrowPDA;
      accounts.makerTokenAccount = makerATA;
    }

    const tx = await program.methods
      .cancelOrder()
      .accounts(accounts)
      .transaction();

    const latestBlockhash = await gorbaganaConnection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);

    const txid = await gorbaganaConnection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    const confirmation = await gorbaganaConnection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return txid;
  };

  // Fetch all orders (always from Gorbagana)
  const fetchAllOrders = async (): Promise<BridgeOrder[]> => {
    if (!program) return [];
    const accounts = await program.account.order.all();
    return accounts.map(acc => ({
      orderPDA: acc.publicKey,
      maker: acc.account.maker,
      amount: acc.account.amount,
      direction: acc.account.direction,
      expirationSlot: acc.account.expirationSlot,
      isFilled: acc.account.isFilled,
      bump: acc.account.bump,
    }));
  };

  return {
    createOrderGGOR,
    createOrderSGOR,
    fillOrder,
    cancelOrder,
    fetchAllOrders,
    deriveOrderPDA,
  };
};
