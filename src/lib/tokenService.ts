import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { TOKEN_CONFIG } from './tokenConfig';

/**
 * SPL Token Service for DEBRIS token on Gorbagana
 */

export interface TokenBalance {
  debris: number;
}

/**
 * Get DEBRIS token balance for a wallet
 * Tries both TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID since the token
 * may use either program depending on how it was created.
 */
export async function getDebrisBalance(
  connection: Connection,
  walletAddress: PublicKey
): Promise<number> {
  const debrisMint = new PublicKey(TOKEN_CONFIG.DEBRIS.address);

  // Try standard SPL Token first, then Token-2022
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const tokenAccount = await getAssociatedTokenAddress(
        debrisMint,
        walletAddress,
        false,
        programId,
      );

      const accountInfo = await getAccount(connection, tokenAccount, undefined, programId);
      const balance = Number(accountInfo.amount) / Math.pow(10, TOKEN_CONFIG.DEBRIS.decimals);
      return balance;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        continue; // Try next program ID
      }
      // For other errors on first attempt, try the other program
      if (programId === TOKEN_PROGRAM_ID) continue;
      console.error('Error fetching DEBRIS balance:', error);
      throw error;
    }
  }

  // No account found with either program
  return 0;
}

/**
 * Get token balance
 */
export async function getTokenBalances(
  connection: Connection,
  walletAddress: PublicKey
): Promise<TokenBalance> {
  const debris = await getDebrisBalance(connection, walletAddress);
  return { debris };
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
 * Check if wallet has sufficient DEBRIS balance for an action
 */
export async function hasSufficientDebris(
  connection: Connection,
  walletAddress: PublicKey,
  requiredAmount: number
): Promise<boolean> {
  const balance = await getDebrisBalance(connection, walletAddress);
  return balance >= requiredAmount;
}

export default {
  getDebrisBalance,
  getTokenBalances,
  ensureTokenAccount,
  hasSufficientDebris,
};
