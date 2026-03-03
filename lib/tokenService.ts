import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { TOKEN_CONFIG } from './tokenConfig';

/**
 * SPL Token Service for DEBRI token on Gorbagana
 */

export interface TokenBalance {
  debri: number;
}

/**
 * Get DEBRI token balance for a wallet
 */
export async function getDebriBalance(
  connection: Connection,
  walletAddress: PublicKey
): Promise<number> {
  try {
    const debriMint = new PublicKey(TOKEN_CONFIG.DEBRI.address);
    const tokenAccount = await getAssociatedTokenAddress(
      debriMint,
      walletAddress
    );

    const accountInfo = await getAccount(connection, tokenAccount);
    const balance = Number(accountInfo.amount) / Math.pow(10, TOKEN_CONFIG.DEBRI.decimals);
    return balance;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      // Token account doesn't exist yet, balance is 0
      return 0;
    }
    console.error('Error fetching DEBRI balance:', error);
    throw error;
  }
}

/**
 * Get token balance
 */
export async function getTokenBalances(
  connection: Connection,
  walletAddress: PublicKey
): Promise<TokenBalance> {
  const debri = await getDebriBalance(connection, walletAddress);
  return { debri };
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
 * Check if wallet has sufficient DEBRI balance for an action
 */
export async function hasSufficientDebri(
  connection: Connection,
  walletAddress: PublicKey,
  requiredAmount: number
): Promise<boolean> {
  const balance = await getDebriBalance(connection, walletAddress);
  return balance >= requiredAmount;
}

export default {
  getDebriBalance,
  getTokenBalances,
  ensureTokenAccount,
  hasSufficientDebri,
};
