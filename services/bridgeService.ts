import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
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
  // On Solana devnet: Creates order locking sGOR, expecting gGOR on Gorbagana
  const createOrderSGOR = async (amount: number, expirationSlot: number, gorbaganaRecipient?: PublicKey) => {
    const currentProvider = isDevnet ? (solanaProgram?.provider as any) : provider;
    const currentProgram = isDevnet ? solanaProgram : program;

    if (!currentProgram || !currentProvider) throw new Error('Wallet not connected');

    const wallet = currentProvider.wallet;
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

    // Gorbagana recipient defaults to maker's wallet if not specified
    const gorRecipient = gorbaganaRecipient || wallet.publicKey;

    const tx = isDevnet
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

    await currentProvider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    return { tx: txid, orderPDA, escrowPDA };
  };

  // Helper to check if an account exists on-chain
  const accountExists = async (pubkey: PublicKey): Promise<boolean> => {
    if (!provider) return false;
    const info = await provider.connection.getAccountInfo(pubkey);
    return info !== null;
  };

  // Helper to ensure ATA exists by adding instruction to transaction if needed
  const ensureATA = async (transaction: Transaction, mint: PublicKey, owner: PublicKey) => {
    if (!provider) return null;
    const ata = await getAssociatedTokenAddress(mint, owner);
    if (!(await accountExists(ata))) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          provider.wallet.publicKey, // payer
          ata,
          owner,
          mint
        )
      );
    }
    return ata;
  };

  // Fill Order
  const fillOrder = async (orderPDA: PublicKey) => {
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;

    console.log('[fillOrder] Starting fill order process for:', orderPDA.toBase58());

    // Fetch order to get direction and maker
    const order = await program.account.order.fetch(orderPDA);
    console.log('[fillOrder] Order fetched:', {
      maker: order.maker.toBase58(),
      amount: order.amount.toString(),
      direction: order.direction,
      isFilled: order.isFilled,
      expirationSlot: order.expirationSlot.toString()
    });

    // Check if order is already filled
    if (order.isFilled) {
      throw new Error('Order has already been filled.');
    }

    // Check SOL balance for fees
    const solBalance = await provider.connection.getBalance(wallet.publicKey);
    console.log('[fillOrder] Taker SOL balance:', solBalance / 1e9, 'SOL');

    // Require at least 0.01 SOL for fees and rent
    if (solBalance < 0.01 * 1e9) {
      throw new Error('Insufficient SOL balance. You need at least 0.01 SOL for transaction fees and rent.');
    }

    const tx = new Transaction();
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

    if (order.direction === 0) {
      // Direction 0: Maker sold sGOR. Taker sends gGOR (native), receives sGOR (SPL)
      console.log('[fillOrder] Direction 0: Taker sends gGOR, receives sGOR');

      const escrowPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          order.maker.toBuffer(),
          order.amount.toArrayLike(Buffer, 'le', 8),
        ],
        PROGRAM_ID
      )[0];
      console.log('[fillOrder] Escrow PDA:', escrowPDA.toBase58());

      // Verify escrow exists and has funds
      const escrowInfo = await provider.connection.getAccountInfo(escrowPDA);
      if (!escrowInfo) {
        throw new Error('Escrow account does not exist. The order may be invalid.');
      }
      console.log('[fillOrder] Escrow account exists');

      // Ensure taker's receive ATA exists (where taker will receive sGOR)
      const takerReceiveATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const takerReceiveExists = await accountExists(takerReceiveATA);

      if (!takerReceiveExists) {
        console.log('[fillOrder] Creating taker receive ATA:', takerReceiveATA.toBase58());
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            takerReceiveATA,
            wallet.publicKey, // owner
            SGOR_MINT
          )
        );
      } else {
        console.log('[fillOrder] Taker receive ATA exists:', takerReceiveATA.toBase58());
      }

      accounts.escrowTokenAccount = escrowPDA;
      accounts.takerReceiveTokenAccount = takerReceiveATA;

      // Verify taker has enough gGOR (native SOL) to send
      const requiredGGOR = order.amount.toNumber();
      if (solBalance < requiredGGOR + 0.01 * 1e9) {
        throw new Error(`Insufficient gGOR balance. You need ${requiredGGOR / 1e9} gGOR + 0.01 SOL for fees.`);
      }

    } else {
      // Direction 1: Maker sold gGOR. Taker sends sGOR (SPL), receives gGOR (native)
      console.log('[fillOrder] Direction 1: Taker sends sGOR, receives gGOR');

      // Ensure taker's send ATA exists (where taker sends FROM)
      const takerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
      const takerATAExists = await accountExists(takerATA);

      if (!takerATAExists) {
        console.log('[fillOrder] Creating taker send ATA:', takerATA.toBase58());
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            takerATA,
            wallet.publicKey, // owner
            SGOR_MINT
          )
        );
        // If we just created the ATA, taker won't have sGOR in it yet
        throw new Error('You do not have an sGOR token account. Please create one and fund it with sGOR first.');
      } else {
        console.log('[fillOrder] Taker send ATA exists:', takerATA.toBase58());

        // Verify taker has enough sGOR tokens
        const takerTokenBalance = await provider.connection.getTokenAccountBalance(takerATA);
        const requiredSGOR = order.amount.toNumber();
        const takerBalance = BigInt(takerTokenBalance.value.amount);

        console.log('[fillOrder] Taker sGOR balance:', takerBalance.toString(), 'required:', requiredSGOR.toString());

        if (takerBalance < BigInt(requiredSGOR)) {
          throw new Error(`Insufficient sGOR balance. You have ${Number(takerBalance) / 1e9} sGOR but need ${requiredSGOR / 1e9} sGOR.`);
        }
      }

      // Ensure maker's receive ATA exists (where maker will receive sGOR)
      const makerATA = await getAssociatedTokenAddress(SGOR_MINT, order.maker);
      const makerATAExists = await accountExists(makerATA);

      if (!makerATAExists) {
        console.log('[fillOrder] Creating maker receive ATA:', makerATA.toBase58());
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer (taker pays for maker's ATA creation)
            makerATA,
            order.maker, // owner
            SGOR_MINT
          )
        );
      } else {
        console.log('[fillOrder] Maker receive ATA exists:', makerATA.toBase58());
      }

      accounts.takerTokenAccount = takerATA;
      accounts.makerReceiveTokenAccount = makerATA;
    }

    // Add the fill order instruction AFTER all account creation instructions
    const fillInstruction = await program.methods
      .fillOrder()
      .accounts(accounts)
      .instruction();

    tx.add(fillInstruction);

    // Get latest blockhash specifically from Gorbagana
    const latestBlockhash = await provider.connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;

    console.log('[fillOrder] Transaction prepared:', {
      recentBlockhash: tx.recentBlockhash,
      feePayer: tx.feePayer.toBase58(),
      instructions: tx.instructions.length
    });

    // Simulate transaction before signing
    try {
      console.log('[fillOrder] Simulating transaction...');
      const simulation = await provider.connection.simulateTransaction(tx);
      if (simulation.value.err) {
        console.error('[fillOrder] Simulation failed:', simulation.value);
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      console.log('[fillOrder] Simulation successful. Logs:', simulation.value.logs);
    } catch (simErr: any) {
      console.error('[fillOrder] Simulation error:', simErr);
      throw new Error(`Transaction simulation failed: ${simErr.message}`);
    }

    console.log('[fillOrder] Requesting wallet signature...');
    const signedTx = await wallet.signTransaction(tx);

    // Use sendRawTransaction with better error handling
    let txid: string;
    try {
      console.log('[fillOrder] Sending transaction to Gorbagana RPC...');
      txid = await provider.connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      console.log('[fillOrder] Transaction sent. Signature:', txid);
    } catch (sendErr: any) {
      console.error('[fillOrder] sendRawTransaction error:', sendErr);
      if (sendErr?.logs) {
        console.error('[fillOrder] Transaction logs:', sendErr.logs);
        throw new Error(`Transaction failed: ${sendErr.message}\n\nLogs:\n${sendErr.logs.join('\n')}`);
      }
      throw new Error(`Failed to send transaction: ${sendErr.message || sendErr}`);
    }

    console.log('[fillOrder] Confirming transaction...');
    const confirmation = await provider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: txid,
    }, 'confirmed');

    if (confirmation.value.err) {
      console.error('[fillOrder] Confirmation error:', confirmation.value.err);
      const errJson = JSON.stringify(confirmation.value.err);
      const customMatch = errJson.match(/"Custom":(\d+)/);
      if (customMatch) {
        const code = parseInt(customMatch[1], 10);
        const err = new Error(`Transaction failed with error code ${code}`);
        (err as any).code = code;
        throw err;
      }
      throw new Error(`Transaction failed: ${errJson}`);
    }

    console.log('[fillOrder] Order filled successfully! Transaction:', txid);
    return txid;
  };

  // Cancel Order
  const cancelOrder = async (orderPDA: PublicKey) => {
    if (!program || !provider) throw new Error('Wallet not connected');
    const wallet = provider.wallet;
    const order = await program.account.order.fetch(orderPDA);
    const tx = new Transaction();

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
      const makerATA = await ensureATA(tx, SGOR_MINT, wallet.publicKey);

      accounts.escrowTokenAccount = escrowPDA;
      accounts.makerTokenAccount = makerATA;
    }

    const cancelInstruction = await program.methods
      .cancelOrder()
      .accounts(accounts)
      .instruction();
    
    tx.add(cancelInstruction);

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
    // Use the correct program based on current network
    const currentProgram = activeProgram;
    if (!currentProgram) return [];

    try {
      const accounts = await currentProgram.account.order.all();
      return accounts.map(acc => ({
        orderPDA: acc.publicKey,
        maker: acc.account.maker,
        amount: acc.account.amount,
        direction: acc.account.direction || 0, // Solana devnet program doesn't have direction field
        expirationSlot: acc.account.expirationSlot,
        isFilled: acc.account.isFilled,
        bump: acc.account.bump,
      }));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      return [];
    }
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
