/**
 * Security Wrapper for DEX Operations
 * Provides runtime security checks and protections
 */

import type { DexToken } from '../services/dexService';

/**
 * Security context for tracking and validating operations
 */
export interface SecurityContext {
  timestamp: number;
  operationId: string;
  walletAddress: string;
  action: 'swap' | 'balance' | 'quote' | 'price';
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Rate limiter for API calls
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.config = { maxRequests, windowMs };
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < this.config.windowMs);

    if (recentRequests.length >= this.config.maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

/**
 * Global rate limiters for different operations
 */
const swapLimiter = new RateLimiter(5, 60000); // 5 swaps per minute
const quoteLimiter = new RateLimiter(20, 60000); // 20 quotes per minute
const balanceLimiter = new RateLimiter(10, 60000); // 10 balance checks per minute

/**
 * Validate wallet address format
 */
export const isValidWalletAddress = (address: string): boolean => {
  if (!address || address.length !== 44) return false;
  const base58Regex = /^[1-9A-HJ-NP-Z]{44}$/;
  return base58Regex.test(address);
};

/**
 * Validate token mint address
 */
export const isValidMintAddress = (mint: string): boolean => {
  if (!mint || mint.length !== 44) return false;
  const base58Regex = /^[1-9A-HJ-NP-Z]{44}$/;
  return base58Regex.test(mint);
};

/**
 * Validate swap parameters
 */
export const validateSwapParams = (
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  slippageBps: number
): { valid: boolean; error?: string } => {
  // Validate mints
  if (!isValidMintAddress(inputMint)) {
    return { valid: false, error: 'Invalid input mint address' };
  }
  if (!isValidMintAddress(outputMint)) {
    return { valid: false, error: 'Invalid output mint address' };
  }

  // Prevent self-swap
  if (inputMint === outputMint) {
    return { valid: false, error: 'Cannot swap identical tokens' };
  }

  // Validate amount
  if (!Number.isFinite(inputAmount) || inputAmount <= 0) {
    return { valid: false, error: 'Invalid input amount' };
  }

  // Prevent extremely large amounts (prevent overflow)
  if (inputAmount > Number.MAX_SAFE_INTEGER) {
    return { valid: false, error: 'Amount exceeds maximum safe value' };
  }

  // Validate slippage
  if (!Number.isFinite(slippageBps) || slippageBps < 0 || slippageBps > 10000) {
    return { valid: false, error: 'Invalid slippage tolerance (0-100%)' };
  }

  return { valid: true };
};

/**
 * Rate limit swap operations
 */
export const checkSwapRateLimit = (walletAddress: string): { allowed: boolean; error?: string } => {
  if (!isValidWalletAddress(walletAddress)) {
    return { allowed: false, error: 'Invalid wallet address' };
  }

  if (!swapLimiter.isAllowed(walletAddress)) {
    return { allowed: false, error: 'Swap rate limit exceeded. Please wait before trying again.' };
  }

  return { allowed: true };
};

/**
 * Rate limit quote requests
 */
export const checkQuoteRateLimit = (walletAddress: string): { allowed: boolean; error?: string } => {
  if (!isValidWalletAddress(walletAddress)) {
    return { allowed: false, error: 'Invalid wallet address' };
  }

  if (!quoteLimiter.isAllowed(walletAddress)) {
    return { allowed: false, error: 'Quote rate limit exceeded. Please wait before trying again.' };
  }

  return { allowed: true };
};

/**
 * Rate limit balance checks
 */
export const checkBalanceRateLimit = (walletAddress: string): { allowed: boolean; error?: string } => {
  if (!isValidWalletAddress(walletAddress)) {
    return { allowed: false, error: 'Invalid wallet address' };
  }

  if (!balanceLimiter.isAllowed(walletAddress)) {
    return { allowed: false, error: 'Balance check rate limit exceeded. Please wait before trying again.' };
  }

  return { allowed: true };
};

/**
 * Sanitize error messages to prevent information leakage
 */
export const sanitizeErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    // Remove sensitive information
    return error
      .replace(/0x[a-fA-F0-9]+/g, '[ADDRESS]')
      .replace(/\b[1-9A-HJ-NP-Z]{44}\b/g, '[MINT]')
      .replace(/https?:\/\/[^\s]+/g, '[URL]')
      .substring(0, 200); // Limit length
  }

  if (error?.message) {
    return sanitizeErrorMessage(error.message);
  }

  return 'An error occurred. Please try again.';
};

/**
 * Validate API response structure
 */
export const validateApiResponse = (response: any, expectedFields: string[]): boolean => {
  if (!response || typeof response !== 'object') {
    return false;
  }

  return expectedFields.every(field => field in response);
};

/**
 * Prevent double-submission of transactions
 */
export class SubmissionGuard {
  private pending: Set<string> = new Set();

  canSubmit(operationId: string): boolean {
    if (this.pending.has(operationId)) {
      return false;
    }
    this.pending.add(operationId);
    return true;
  }

  markComplete(operationId: string): void {
    this.pending.delete(operationId);
  }

  isPending(operationId: string): boolean {
    return this.pending.has(operationId);
  }

  clear(): void {
    this.pending.clear();
  }
}

/**
 * Global submission guard instance
 */
export const submissionGuard = new SubmissionGuard();

/**
 * Secure random operation ID generation
 */
export const generateOperationId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
};

/**
 * Validate token data structure
 */
export const validateTokenData = (token: any): token is DexToken => {
  return (
    token &&
    typeof token === 'object' &&
    'mint' in token &&
    'symbol' in token &&
    'name' in token &&
    'decimals' in token &&
    'priceUsd' in token &&
    isValidMintAddress(token.mint) &&
    typeof token.symbol === 'string' &&
    typeof token.name === 'string' &&
    typeof token.decimals === 'number' &&
    typeof token.priceUsd === 'number'
  );
};

/**
 * Secure fetch wrapper with timeout and error handling
 */
export const secureFetch = async (
  url: string,
  options?: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> => {
  // Validate URL is HTTPS
  if (!url.startsWith('https://')) {
    throw new Error('Only HTTPS URLs are allowed');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Log security event (for monitoring)
 */
export const logSecurityEvent = (context: SecurityContext): void => {
  // In production, this would send to a monitoring service
  if (import.meta.env.DEV) {
    console.log('[SECURITY]', {
      timestamp: new Date(context.timestamp).toISOString(),
      operationId: context.operationId,
      walletAddress: context.walletAddress.substring(0, 4) + '...',
      action: context.action,
      status: context.status,
      error: context.error,
    });
  }
};

/**
 * Create security context for operation tracking
 */
export const createSecurityContext = (
  walletAddress: string,
  action: SecurityContext['action']
): SecurityContext => {
  return {
    timestamp: Date.now(),
    operationId: generateOperationId(),
    walletAddress,
    action,
    status: 'pending',
  };
};
