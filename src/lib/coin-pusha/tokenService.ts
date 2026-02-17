import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { TOKEN_CONFIG } from '../game/tokenConfig';

/**
 * SPL Token Service for JUNK and TRASHCOIN tokens on Gorbagana
 */

export interface TokenBalance {
  junk: number;
  trashcoin: number;
}

/**
 * Get JUNK token balance for a wallet
 */
export async function getJunkBalance(
  connection: Connection,
  walletAddress: PublicKey
): Promise<number> {
  try {
    const junkMint = new PublicKey(TOKEN_CONFIG.JUNK.address);
    const tokenAccount = await getAssociatedTokenAddress(
      junkMint,
      walletAddress
    );

    const accountInfo = await getAccount(connection, tokenAccount);
    const balance = Number(accountInfo.amount) / Math.pow(10, TOKEN_CONFIG.JUNK.decimals);
    return balance;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      // Token account doesn't exist yet, balance is 0
      return 0;
    }
    console.error('Error fetching JUNK balance:', error);
    throw error;
  }
}

/**
 * Get TRASHCOIN token balance for a wallet
 */
export async function getTrashcoinBalance(
  connection: Connection,
  walletAddress: PublicKey
): Promise<number> {
  try {
    const trashcoinMint = new PublicKey(TOKEN_CONFIG.TRASHCOIN.address);
    const tokenAccount = await getAssociatedTokenAddress(
      trashcoinMint,
      walletAddress
    );

    const accountInfo = await getAccount(connection, tokenAccount);
    const balance = Number(accountInfo.amount) / Math.pow(10, TOKEN_CONFIG.TRASHCOIN.decimals);
    return balance;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      return 0;
    }
    console.error('Error fetching TRASHCOIN balance:', error);
    throw error;
  }
}

/**
 * Get both token balances at once
 */
export async function getTokenBalances(
  connection: Connection,
  walletAddress: PublicKey
): Promise<TokenBalance> {
  const [junk, trashcoin] = await Promise.all([
    getJunkBalance(connection, walletAddress),
    getTrashcoinBalance(connection, walletAddress),
  ]);

  return { junk, trashcoin };
}

/**
 * Create associated token account if it doesn't exist
 */
export async function ensureTokenAccount(
  connection: Connection,
  walletAddress: PublicKey,
  tokenMint: PublicKey,
  payer: PublicKey
): Promise<PublicKey> {
  const associatedTokenAddress = await getAssociatedTokenAddress(
    tokenMint,
    walletAddress
  );

  try {
    await getAccount(connection, associatedTokenAddress);
    return associatedTokenAddress;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      // Create the token account
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer,
          associatedTokenAddress,
          walletAddress,
          tokenMint
        )
      );
      return associatedTokenAddress;
    }
    throw error;
  }
}

/**
 * Check if wallet has sufficient JUNK balance for an action
 */
export async function hasSufficientJunk(
  connection: Connection,
  walletAddress: PublicKey,
  requiredAmount: number
): Promise<boolean> {
  const balance = await getJunkBalance(connection, walletAddress);
  return balance >= requiredAmount;
}

export default {
  getJunkBalance,
  getTrashcoinBalance,
  getTokenBalances,
  ensureTokenAccount,
  hasSufficientJunk,
};
