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
 * Fee is deducted from the amount the buyer receives.
 * Seller sends grossAmount, buyer receives netAmount.
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
 * Send sGOR SPL tokens on Solana from sender to recipient.
 * Verifies the sGOR token mint before every transfer.
 * Creates the recipient's Associated Token Account if needed.
 *
 * @param fromPubkey - Sender's Solana public key
 * @param toPubkey - Recipient's Solana public key
 * @param amount - Amount of sGOR tokens (in human-readable units, not lamports)
 * @returns Transaction signature
 */
export const sendSGORTokens = async (
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amount: number
): Promise<string> => {
  if (amount <= 0) throw new Error('Transfer amount must be positive');

  const provider = getSolanaProvider();
  const connection = getSolanaConnection();

  // Verify token mint before deposit
  await verifySGORTokenMint(connection);

  const sourceATA = await getAssociatedTokenAddress(SGOR_TOKEN_MINT, fromPubkey);
  const destATA = await getAssociatedTokenAddress(SGOR_TOKEN_MINT, toPubkey);

  // Verify sender has sufficient balance
  try {
    const sourceAccount = await getAccount(connection, sourceATA, 'confirmed');
    const requiredLamports = BigInt(Math.round(amount * Math.pow(10, SGOR_DECIMALS)));
    if (sourceAccount.amount < requiredLamports) {
      const currentBalance = Number(sourceAccount.amount) / Math.pow(10, SGOR_DECIMALS);
      throw new Error(
        `Insufficient sGOR balance: have ${currentBalance}, need ${amount}`
      );
    }
  } catch (error: any) {
    if (error.message?.includes('could not find account')) {
      throw new Error('You do not have an sGOR token account. Ensure you hold sGOR tokens.');
    }
    throw error;
  }

  const transaction = new Transaction();

  // Create destination ATA if it doesn't exist
  try {
    await getAccount(connection, destATA, 'confirmed');
  } catch {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey,    // payer
        destATA,       // ATA to create
        toPubkey,      // owner of the new ATA
        SGOR_TOKEN_MINT // token mint
      )
    );
  }

  // Transfer sGOR tokens
  const lamports = BigInt(Math.round(amount * Math.pow(10, SGOR_DECIMALS)));
  transaction.add(
    createTransferInstruction(
      sourceATA,   // source
      destATA,     // destination
      fromPubkey,  // owner/signer
      lamports     // amount in smallest units
    )
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  // Sign via wallet extension
  const signed = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  // Wait for confirmation
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  return signature;
};

// --- gGOR NATIVE TRANSFER (GORBAGANA) ---

/**
 * Send gGOR native tokens on Gorbagana from sender to recipient.
 * gGOR is the native gas token (like SOL on Solana).
 *
 * @param fromPubkey - Sender's Gorbagana public key
 * @param toPubkey - Recipient's Gorbagana public key
 * @param amount - Amount of gGOR (in human-readable units)
 * @returns Transaction signature
 */
export const sendGGORNative = async (
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amount: number
): Promise<string> => {
  if (amount <= 0) throw new Error('Transfer amount must be positive');

  const provider = getGorbaganaProvider();
  const connection = getGorbaganaConnection();

  // Verify sender has sufficient balance
  const balanceLamports = await connection.getBalance(fromPubkey, 'confirmed');
  const requiredLamports = Math.round(amount * Math.pow(10, GGOR_DECIMALS));
  // Account for tx fees (~5000 lamports)
  if (balanceLamports < requiredLamports + 10000) {
    const currentBalance = balanceLamports / Math.pow(10, GGOR_DECIMALS);
    throw new Error(
      `Insufficient gGOR balance: have ${currentBalance.toFixed(4)}, need ${amount} + gas`
    );
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: requiredLamports,
    })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  const signed = await provider.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );

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
