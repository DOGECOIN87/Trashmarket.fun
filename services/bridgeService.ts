import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { useAnchor } from '../contexts/AnchorContext';

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

export const useBridgeService = () => {
  const { program, provider } = useAnchor();

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
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;
    const amountBN = new BN(amount);
    const orderPDA = deriveOrderPDA(wallet.publicKey, amountBN);

    const tx = await program.methods
      .createOrder(amountBN, 1, new BN(expirationSlot))
      .accounts({
        maker: wallet.publicKey,
        order: orderPDA,
        escrowTokenAccount: null, // This is null for direction 1 during creation
        makerTokenAccount: null,   // This is null for direction 1 during creation
        sgorMint: null,           // This is null for direction 1 during creation
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
      skipPreflight: true,
      maxRetries: 2,
    });

    await provider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    return { tx: txid, orderPDA };
  };

  // Create Order (Direction 0: sGOR -> gGOR)
  const createOrderSGOR = async (amount: number, expirationSlot: number) => {
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;
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

    const latestBlockhash = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);

    const txid = await provider.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    await provider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    return { tx: txid, orderPDA, escrowPDA };
  };

  // Fill Order
  const fillOrder = async (orderPDA: PublicKey) => {
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;

    // Fetch order to get direction and maker
    const order = await program.account.order.fetch(orderPDA);

    const accounts: any = {
      taker: wallet.publicKey,
      maker: order.maker,
      order: orderPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      // Use null for optional accounts that are not used in the specific direction.
      // Anchor handles null by providing a dummy account if needed, but the key is that
      // all accounts defined in the instruction MUST be provided in the object.
      escrowTokenAccount: null,
      takerTokenAccount: null,
      takerReceiveTokenAccount: null,
      makerReceiveTokenAccount: null,
    };

    // Pre-instructions to create ATAs if they don't exist
    const preInstructions: any[] = [];

    // Helper to check if an account exists on-chain
    const accountExists = async (pubkey: PublicKey): Promise<boolean> => {
      const info = await provider.connection.getAccountInfo(pubkey);
      return info !== null;
    };

    if (order.direction === 0) {
      // Direction 0: Taker sends gGOR, receives sGOR
      // Maker is selling sGOR, so escrow holds sGOR.
      const takerReceiveATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const escrowPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          order.maker.toBuffer(),
          order.amount.toArrayLike(Buffer, 'le', 8),
        ],
        PROGRAM_ID
      )[0];

      // Create taker's sGOR ATA if it doesn't exist
      if (!(await accountExists(takerReceiveATA))) {
        preInstructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            takerReceiveATA,  // ata
            wallet.publicKey, // owner
            SGOR_MINT,        // mint
          )
        );
      }

      accounts.escrowTokenAccount = escrowPDA;
      accounts.takerReceiveTokenAccount = takerReceiveATA;
    } else {
      // Direction 1: Taker sends sGOR, receives gGOR
      // Maker is selling gGOR. Taker sends sGOR.
      const takerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, order.maker);

      // Create maker's sGOR receive ATA if it doesn't exist
      if (!(await accountExists(makerATA))) {
        preInstructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            makerATA,         // ata
            order.maker,      // owner
            SGOR_MINT,        // mint
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

    const latestBlockhash = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);

    const txid = await provider.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    const confirmation = await provider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    if (confirmation.value.err) {
      // Extract custom error code if present for better error messages
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
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;
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
      // Direction 0: Maker is selling sGOR. Escrow holds sGOR.
      const escrowPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          wallet.publicKey.toBuffer(),
          order.amount.toArrayLike(Buffer, 'le', 8),
        ],
        PROGRAM_ID
      )[0];
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey); // Maker's sGOR ATA

      accounts.escrowTokenAccount = escrowPDA;
      accounts.makerTokenAccount = makerATA;
    }
    // For direction 1, the escrow account is not explicitly managed in the same way,
    // so we don't add it here.

    const tx = await program.methods
      .cancelOrder()
      .accounts(accounts)
      .transaction();

    const latestBlockhash = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);

    const txid = await provider.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    const confirmation = await provider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    return txid;
  };

  // Fetch all orders
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
