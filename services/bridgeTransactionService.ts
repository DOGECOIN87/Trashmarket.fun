import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
  getMint,
} from '@solana/spl-token';
import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';

// --- CONSTANTS ---
export const SGOR_TOKEN_MINT = new PublicKey('71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg');
export const SGOR_DECIMALS = 9;
export const BRIDGE_FEE_RATE = 0.05; // 5%
export const GGOR_DECIMALS = GORBAGANA_CONFIG.currency.decimals; // 9

// Platform fee wallet — receives the 5% bridge fee on both chains
export const PLATFORM_FEE_WALLET = new PublicKey('GdS8GCrAaVviZE5nxTNGG3pYxxb1UCgUbf23FwCTVirK');

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const GORBAGANA_RPC = GORBAGANA_CONFIG.rpcEndpoint;

// --- CONNECTIONS ---
export const getSolanaConnection = (): Connection =>
  new Connection(SOLANA_RPC, 'confirmed');

export const getGorbaganaConnection = (): Connection =>
  new Connection(GORBAGANA_RPC, 'confirmed');

// --- WALLET PROVIDER HELPERS ---

/**
 * Get the Solana wallet provider from browser extension.
 * Supports Backpack and Phantom.
 */
export const getSolanaProvider = (): any => {
  const w = window as any;
  const provider = w.backpack?.solana || w.phantom?.solana || w.solana;
  if (!provider) throw new Error('No Solana wallet detected. Install Backpack or Phantom.');
  return provider;
};

/**
 * Get the Gorbagana wallet provider from browser extension.
 * Gorbagana is a Solana fork so uses compatible providers.
 */
export const getGorbaganaProvider = (): any => {
  const w = window as any;
  const provider = w.backpack?.gorbagana || w.gorbag || w.gorbagWallet;
  if (!provider) throw new Error('No Gorbagana wallet detected. Install Backpack or Gorbag Wallet.');
  return provider;
};

// --- TOKEN VERIFICATION ---

/**
 * Verify the sGOR token mint address on Solana mainnet.
 * MUST be called before every deposit to ensure the correct token is used.
 * Returns the mint info if valid, throws if invalid.
 */
export const verifySGORTokenMint = async (
  connection: Connection
): Promise<{ supply: bigint; decimals: number }> => {
  try {
    const mintInfo = await getMint(connection, SGOR_TOKEN_MINT, 'confirmed', TOKEN_PROGRAM_ID);

    if (!mintInfo) {
      throw new Error('sGOR token mint not found on-chain');
    }

    if (mintInfo.decimals !== SGOR_DECIMALS) {
      throw new Error(
        `sGOR decimals mismatch: expected ${SGOR_DECIMALS}, got ${mintInfo.decimals}`
      );
    }

    return { supply: mintInfo.supply, decimals: mintInfo.decimals };
  } catch (error: any) {
    if (error.message?.includes('could not find mint')) {
      throw new Error(
        `sGOR token mint ${SGOR_TOKEN_MINT.toBase58()} does not exist on Solana mainnet`
      );
    }
    throw error;
  }
};

// --- FEE CALCULATION ---

export interface FeeBreakdown {
  grossAmount: number;
  fee: number;
  netAmount: number;
  feeRate: number;
}

/**
 * Calculate the 5% bridge fee.
 * Fee is sent to the platform wallet. Both parties exchange netAmount.
 * Buyer pays grossAmount total: netAmount to seller + fee to platform.
 * Seller sends netAmount to buyer.
 */
export const calculateBridgeFee = (grossAmount: number): FeeBreakdown => {
  if (grossAmount <= 0) throw new Error('Amount must be positive');
  const fee = grossAmount * BRIDGE_FEE_RATE;
  const netAmount = grossAmount - fee;
  return {
    grossAmount,
    fee: parseFloat(fee.toFixed(SGOR_DECIMALS)),
    netAmount: parseFloat(netAmount.toFixed(SGOR_DECIMALS)),
    feeRate: BRIDGE_FEE_RATE,
  };
};

// --- sGOR SPL TOKEN TRANSFER (SOLANA) ---

/**
 * Helper: ensure an ATA exists for a given owner, add create instruction if not.
 */
const ensureATA = async (
  connection: Connection,
  transaction: Transaction,
  payer: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> => {
  const ata = await getAssociatedTokenAddress(SGOR_TOKEN_MINT, owner);
  try {
    await getAccount(connection, ata, 'confirmed');
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(payer, ata, owner, SGOR_TOKEN_MINT)
    );
  }
  return ata;
};

/**
 * Send sGOR SPL tokens on Solana — simple transfer (no fee split).
 * Used for seller release where the full amount goes to buyer.
 * Verifies sGOR token mint before every transfer.
 */
export const sendSGORTokens = async (
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amount: number
): Promise<string> => {
  if (amount <= 0) throw new Error('Transfer amount must be positive');

  const provider = getSolanaProvider();
  const connection = getSolanaConnection();

  await verifySGORTokenMint(connection);

  const sourceATA = await getAssociatedTokenAddress(SGOR_TOKEN_MINT, fromPubkey);

  // Verify sender has sufficient balance
  try {
    const sourceAccount = await getAccount(connection, sourceATA, 'confirmed');
    const requiredLamports = BigInt(Math.round(amount * Math.pow(10, SGOR_DECIMALS)));
    if (sourceAccount.amount < requiredLamports) {
      const currentBalance = Number(sourceAccount.amount) / Math.pow(10, SGOR_DECIMALS);
      throw new Error(`Insufficient sGOR balance: have ${currentBalance}, need ${amount}`);
    }
  } catch (error: any) {
    if (error.message?.includes('could not find account')) {
      throw new Error('You do not have an sGOR token account. Ensure you hold sGOR tokens.');
    }
    throw error;
  }

  const transaction = new Transaction();
  const destATA = await ensureATA(connection, transaction, fromPubkey, toPubkey);

  const lamports = BigInt(Math.round(amount * Math.pow(10, SGOR_DECIMALS)));
  transaction.add(
    createTransferInstruction(sourceATA, destATA, fromPubkey, lamports)
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  const signed = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  return signature;
};

/**
 * Send sGOR with platform fee split — single atomic transaction.
 * Sends netAmount to the seller and feeAmount to the platform fee wallet.
 * Used for buyer deposit.
 *
 * @param fromPubkey - Buyer's Solana public key
 * @param toSellerPubkey - Seller's Solana public key
 * @param grossAmount - Total trade amount (net + fee will be transferred)
 * @returns Transaction signature
 */
export const sendSGORWithPlatformFee = async (
  fromPubkey: PublicKey,
  toSellerPubkey: PublicKey,
  grossAmount: number
): Promise<string> => {
  if (grossAmount <= 0) throw new Error('Transfer amount must be positive');

  const provider = getSolanaProvider();
  const connection = getSolanaConnection();

  await verifySGORTokenMint(connection);

  const { fee, netAmount } = calculateBridgeFee(grossAmount);
  const sourceATA = await getAssociatedTokenAddress(SGOR_TOKEN_MINT, fromPubkey);

  // Verify sender has sufficient balance for the full grossAmount
  try {
    const sourceAccount = await getAccount(connection, sourceATA, 'confirmed');
    const requiredLamports = BigInt(Math.round(grossAmount * Math.pow(10, SGOR_DECIMALS)));
    if (sourceAccount.amount < requiredLamports) {
      const currentBalance = Number(sourceAccount.amount) / Math.pow(10, SGOR_DECIMALS);
      throw new Error(`Insufficient sGOR balance: have ${currentBalance}, need ${grossAmount}`);
    }
  } catch (error: any) {
    if (error.message?.includes('could not find account')) {
      throw new Error('You do not have an sGOR token account. Ensure you hold sGOR tokens.');
    }
    throw error;
  }

  const transaction = new Transaction();

  // Ensure ATAs exist for seller and platform fee wallet
  const sellerATA = await ensureATA(connection, transaction, fromPubkey, toSellerPubkey);
  const feeATA = await ensureATA(connection, transaction, fromPubkey, PLATFORM_FEE_WALLET);

  // Transfer netAmount to seller
  const netLamports = BigInt(Math.round(netAmount * Math.pow(10, SGOR_DECIMALS)));
  transaction.add(
    createTransferInstruction(sourceATA, sellerATA, fromPubkey, netLamports)
  );

  // Transfer fee to platform wallet
  const feeLamports = BigInt(Math.round(fee * Math.pow(10, SGOR_DECIMALS)));
  transaction.add(
    createTransferInstruction(sourceATA, feeATA, fromPubkey, feeLamports)
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  const signed = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  return signature;
};

// --- gGOR NATIVE TRANSFER (GORBAGANA) ---

/**
 * Send gGOR native tokens — simple transfer (no fee split).
 * Used for seller release where the full netAmount goes to buyer.
 */
export const sendGGORNative = async (
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amount: number
): Promise<string> => {
  if (amount <= 0) throw new Error('Transfer amount must be positive');

  const provider = getGorbaganaProvider();
  const connection = getGorbaganaConnection();

  const balanceLamports = await connection.getBalance(fromPubkey, 'confirmed');
  const requiredLamports = Math.round(amount * Math.pow(10, GGOR_DECIMALS));
  if (balanceLamports < requiredLamports + 10000) {
    const currentBalance = balanceLamports / Math.pow(10, GGOR_DECIMALS);
    throw new Error(`Insufficient gGOR balance: have ${currentBalance.toFixed(4)}, need ${amount} + gas`);
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports: requiredLamports })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  const signed = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  return signature;
};

/**
 * Send gGOR with platform fee split — single atomic transaction.
 * Sends netAmount to the seller and feeAmount to the platform fee wallet.
 * Used for buyer deposit when paying with gGOR.
 *
 * @param fromPubkey - Buyer's Gorbagana public key
 * @param toSellerPubkey - Seller's Gorbagana public key
 * @param grossAmount - Total trade amount
 * @returns Transaction signature
 */
export const sendGGORWithPlatformFee = async (
  fromPubkey: PublicKey,
  toSellerPubkey: PublicKey,
  grossAmount: number
): Promise<string> => {
  if (grossAmount <= 0) throw new Error('Transfer amount must be positive');

  const provider = getGorbaganaProvider();
  const connection = getGorbaganaConnection();

  const { fee, netAmount } = calculateBridgeFee(grossAmount);
  const netLamports = Math.round(netAmount * Math.pow(10, GGOR_DECIMALS));
  const feeLamports = Math.round(fee * Math.pow(10, GGOR_DECIMALS));
  const totalLamports = netLamports + feeLamports;

  const balanceLamports = await connection.getBalance(fromPubkey, 'confirmed');
  if (balanceLamports < totalLamports + 10000) {
    const currentBalance = balanceLamports / Math.pow(10, GGOR_DECIMALS);
    throw new Error(`Insufficient gGOR balance: have ${currentBalance.toFixed(4)}, need ${grossAmount} + gas`);
  }

  const transaction = new Transaction();

  // Transfer netAmount to seller
  transaction.add(
    SystemProgram.transfer({ fromPubkey, toPubkey: toSellerPubkey, lamports: netLamports })
  );

  // Transfer fee to platform wallet
  transaction.add(
    SystemProgram.transfer({ fromPubkey, toPubkey: PLATFORM_FEE_WALLET, lamports: feeLamports })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  const signed = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

  return signature;
};

// --- TRANSACTION VERIFICATION ---

/**
 * Verify a transaction exists and succeeded on a given chain.
 */
export const verifyTransaction = async (
  signature: string,
  chain: 'solana' | 'gorbagana'
): Promise<{ confirmed: boolean; slot?: number; blockTime?: number | null }> => {
  const connection = chain === 'solana' ? getSolanaConnection() : getGorbaganaConnection();

  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) return { confirmed: false };

  return {
    confirmed: tx.meta?.err === null,
    slot: tx.slot,
    blockTime: tx.blockTime,
  };
};

/**
 * Validate a Solana/Gorbagana public key string.
 */
export const isValidPublicKey = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};
