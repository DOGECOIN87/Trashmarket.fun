/**
 * Game Security Module for JUNKPUSHER
 * 
 * Enforces strict security rules:
 * 1. Only DEBRIS tokens allowed for deposits
 * 2. Withdrawals only permitted for verified winnings
 * 3. Protection against common vulnerabilities
 */

import { PublicKey } from '@solana/web3.js';
import { TOKEN_CONFIG } from './tokenConfig';

/**
 * Validates that a token mint is the authorized DEBRIS token
 */
export function validateDebrisTokenMint(tokenMint: string | PublicKey): boolean {
  const debrisMint = typeof tokenMint === 'string' ? tokenMint : tokenMint.toBase58();
  const authorizedMint = TOKEN_CONFIG.DEBRIS.address;
  
  if (debrisMint !== authorizedMint) {
    console.error(`[Security] Invalid token mint. Expected ${authorizedMint}, got ${debrisMint}`);
    return false;
  }
  
  return true;
}

/**
 * Validates deposit amount is within acceptable range
 */
export function validateDepositAmount(amount: number): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: 'Deposit amount must be greater than 0' };
  }
  
  if (amount > 1_000_000_000) {
    return { valid: false, error: 'Deposit amount exceeds maximum limit' };
  }
  
  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Deposit amount must be an integer' };
  }
  
  return { valid: true };
}

/**
 * Validates withdrawal amount against verified winnings
 * This ensures players can only withdraw what they've actually won
 */
export function validateWithdrawalAmount(
  requestedAmount: number,
  verifiedWinnings: number,
  currentBalance: number
): { valid: boolean; error?: string } {
  if (requestedAmount <= 0) {
    return { valid: false, error: 'Withdrawal amount must be greater than 0' };
  }
  
  if (requestedAmount > verifiedWinnings) {
    return {
      valid: false,
      error: `Cannot withdraw ${requestedAmount}. Verified winnings: ${verifiedWinnings}`,
    };
  }
  
  if (requestedAmount > currentBalance) {
    return {
      valid: false,
      error: `Cannot withdraw ${requestedAmount}. Current balance: ${currentBalance}`,
    };
  }
  
  if (!Number.isInteger(requestedAmount)) {
    return { valid: false, error: 'Withdrawal amount must be an integer' };
  }
  
  return { valid: true };
}

/**
 * Validates wallet address format
 */
export function validateWalletAddress(address: string | PublicKey): boolean {
  try {
    if (typeof address === 'string') {
      new PublicKey(address);
    }
    return true;
  } catch {
    console.error('[Security] Invalid wallet address format');
    return false;
  }
}

/**
 * Validates transaction signature format
 */
export function validateTransactionSignature(signature: string): boolean {
  // Solana signatures are base58 encoded and typically 88 characters
  if (typeof signature !== 'string' || signature.length < 50 || signature.length > 100) {
    return false;
  }
  
  try {
    // Attempt to decode as base58
    const base58Regex = /^[1-9A-HJ-NP-Z]+$/;
    return base58Regex.test(signature);
  } catch {
    return false;
  }
}

/**
 * Sanitizes and validates game score
 */
export function validateGameScore(score: number): { valid: boolean; error?: string } {
  if (score < 0) {
    return { valid: false, error: 'Score cannot be negative' };
  }
  
  if (!Number.isInteger(score)) {
    return { valid: false, error: 'Score must be an integer' };
  }
  
  if (score > 999_999_999) {
    return { valid: false, error: 'Score exceeds maximum limit' };
  }
  
  return { valid: true };
}

/**
 * Checks for replay attack vulnerability
 */
export function detectReplayAttack(
  previousSignature: string | null,
  currentSignature: string
): boolean {
  if (!previousSignature) return false;
  return previousSignature === currentSignature;
}

/**
 * Validates that a transaction involves only the authorized DEBRIS token
 */
export function validateTokenTransactionIntegrity(
  tokenMint: string,
  amount: number,
  walletAddress: string
): { valid: boolean; error?: string } {
  // Validate token mint
  if (!validateDebrisTokenMint(tokenMint)) {
    return { valid: false, error: 'Unauthorized token mint' };
  }
  
  // Validate amount
  const amountValidation = validateDepositAmount(amount);
  if (!amountValidation.valid) {
    return amountValidation;
  }
  
  // Validate wallet
  if (!validateWalletAddress(walletAddress)) {
    return { valid: false, error: 'Invalid wallet address' };
  }
  
  return { valid: true };
}

/**
 * Generates a secure nonce for transaction replay protection
 */
export function generateSecureNonce(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Validates nonce to prevent replay attacks
 */
export function validateNonce(nonce: string, maxAgeMs: number = 300000): boolean {
  try {
    const [timestamp] = nonce.split('-');
    const nonceTime = parseInt(timestamp, 10);
    const now = Date.now();
    
    if (isNaN(nonceTime)) return false;
    if (now - nonceTime > maxAgeMs) return false;
    
    return true;
  } catch {
    return false;
  }
}

export default {
  validateDebrisTokenMint,
  validateDepositAmount,
  validateWithdrawalAmount,
  validateWalletAddress,
  validateTransactionSignature,
  validateGameScore,
  detectReplayAttack,
  validateTokenTransactionIntegrity,
  generateSecureNonce,
  validateNonce,
};
