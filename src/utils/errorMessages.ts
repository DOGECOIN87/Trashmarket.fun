/**
 * Error Message Parser for Solana/Anchor Transactions
 *
 * Translates raw Anchor error codes and Solana transaction errors
 * into user-friendly messages.
 */

// Anchor program error codes mapped to user-friendly messages
const ANCHOR_ERROR_MAP: Record<number, string> = {
  // Standard Anchor errors (6000+)
  6000: 'Insufficient balance for this action.',
  6001: 'Game session not initialized. Please deposit first.',
  6002: 'Invalid token — only DEBRIS is accepted.',
  6003: 'Withdrawal exceeds verified winnings.',
  6004: 'Score exceeds maximum allowed value.',
  6005: 'Deposit amount exceeds maximum limit.',
  6006: 'Game session already initialized.',
  6007: 'Unauthorized — you are not the owner of this game session.',
  6008: 'Invalid game configuration.',
  // Anchor built-in errors (2000+)
  2000: 'Instruction missing — check program ID.',
  2001: 'Instruction fallback failed.',
  2002: 'Instruction did not deserialize correctly.',
  2003: 'Constraint violation — account not valid for this action.',
  2004: 'Constraint not mutable — account must be writable.',
  2005: 'Constraint signer — account must be a signer.',
  2006: 'Constraint has one — account does not match expected owner.',
  2007: 'Constraint owner — account owner mismatch.',
  2008: 'Constraint rent exempt — account not rent exempt.',
  2009: 'Constraint seeds — PDA seeds mismatch.',
  2010: 'Constraint executable — account must be executable.',
  // Solana built-in errors
  0: 'Transaction failed — insufficient funds for fees.',
  1: 'Account not found or not initialized.',
};

// Common Solana/wallet error patterns
const ERROR_PATTERNS: [RegExp, string][] = [
  [/User rejected/i, 'Transaction cancelled by user.'],
  [/user rejected the request/i, 'Transaction cancelled by user.'],
  [/insufficient funds/i, 'Insufficient funds for this transaction.'],
  [/Blockhash not found/i, 'Transaction expired. Please try again.'],
  [/block height exceeded/i, 'Transaction expired. Please try again.'],
  // Don't swallow simulation errors — let the actual error message through
  [/Account does not exist/i, 'Token account not found. Deposit DEBRIS first.'],
  [/0x1$/, 'Insufficient funds for transaction fees.'],
  [/0x0$/, 'Transaction failed — check your balance.'],
  [/Attempt to debit an account but found no record/i, 'No token account found. Make sure you have DEBRIS tokens.'],
  [/TokenAccountNotFoundError/i, 'DEBRIS token account not found in your wallet.'],
];

/**
 * Parse a raw error into a user-friendly message.
 * Handles Anchor custom error codes, Solana errors, and wallet adapter errors.
 */
export function parseTransactionError(error: unknown): string {
  if (!error) return 'An unknown error occurred.';

  const message = error instanceof Error ? error.message : String(error);

  // 1. Check for Anchor custom error codes (e.g., "Custom":6000 or custom program error: 0x1770)
  const customMatch = message.match(/"Custom"\s*:\s*(\d+)/i)
    || message.match(/custom program error:\s*0x([0-9a-fA-F]+)/i);
  if (customMatch) {
    const code = customMatch[1].startsWith('0x')
      ? parseInt(customMatch[1], 16)
      : parseInt(customMatch[1], 10);
    if (ANCHOR_ERROR_MAP[code]) {
      return ANCHOR_ERROR_MAP[code];
    }
    return `Transaction failed (error code ${code}).`;
  }

  // 2. Check common error patterns
  for (const [pattern, friendly] of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return friendly;
    }
  }

  // 3. Truncate overly long raw messages
  if (message.length > 120) {
    return message.slice(0, 117) + '...';
  }

  return message || 'Transaction failed.';
}
