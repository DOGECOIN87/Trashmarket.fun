/**
 * Security Test Suite for DEBRIS Token Integration
 *
 * Covers all items from the Testing Checklist:
 * - Deposit with DEBRIS token succeeds
 * - Deposit with non-DEBRIS token fails
 * - Deposit with invalid amount fails
 * - Withdrawal with verified winnings succeeds
 * - Withdrawal exceeding winnings fails
 * - Withdrawal exceeding balance fails
 * - Score recording with valid score succeeds
 * - Score recording with negative score fails
 * - Score recording with overflow score fails
 * - Replay attack detection works
 * - Invalid wallet address rejected
 * - All transactions appear on-chain (validated via transaction integrity)
 */

import { describe, it, expect } from 'vitest';
import {
  validateDebrisTokenMint,
  validateDepositAmount,
  validateWithdrawalAmount,
  validateWalletAddress,
  validateGameScore,
  detectReplayAttack,
  validateTransactionSignature,
  validateTokenTransactionIntegrity,
  generateSecureNonce,
  validateNonce,
} from './gameSecurityModule';
import { TOKEN_CONFIG } from './tokenConfig';

// ─── Token Configuration ───────────────────────────────────────────────────

describe('Token Configuration', () => {
  it('DEBRIS token has correct address', () => {
    expect(TOKEN_CONFIG.DEBRIS.address).toBe('DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy');
  });

  it('DEBRIS token has 9 decimals', () => {
    expect(TOKEN_CONFIG.DEBRIS.decimals).toBe(9);
  });

  it('DEBRIS token symbol is correct', () => {
    expect(TOKEN_CONFIG.DEBRIS.symbol).toBe('DEBRIS');
  });
});

// ─── Deposit Tests ─────────────────────────────────────────────────────────

describe('Deposit Protection', () => {
  // ✅ Deposit with DEBRIS token succeeds
  it('accepts DEBRIS token mint', () => {
    expect(validateDebrisTokenMint(TOKEN_CONFIG.DEBRIS.address)).toBe(true);
  });

  // ✅ Deposit with non-DEBRIS token fails
  it('rejects non-DEBRIS token mint', () => {
    expect(validateDebrisTokenMint('So11111111111111111111111111111111')).toBe(false);
  });

  it('rejects empty string as token mint', () => {
    expect(validateDebrisTokenMint('')).toBe(false);
  });

  it('rejects similar but incorrect token mint', () => {
    expect(validateDebrisTokenMint('DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwz')).toBe(false);
  });

  // ✅ Deposit with valid amount succeeds
  it('accepts valid deposit amount', () => {
    const result = validateDepositAmount(100);
    expect(result.valid).toBe(true);
  });

  it('accepts deposit amount of 1', () => {
    const result = validateDepositAmount(1);
    expect(result.valid).toBe(true);
  });

  it('accepts maximum deposit amount (1 billion)', () => {
    const result = validateDepositAmount(1_000_000_000);
    expect(result.valid).toBe(true);
  });

  // ✅ Deposit with invalid amount fails
  it('rejects deposit of 0', () => {
    const result = validateDepositAmount(0);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects negative deposit', () => {
    const result = validateDepositAmount(-100);
    expect(result.valid).toBe(false);
  });

  it('rejects deposit exceeding maximum', () => {
    const result = validateDepositAmount(1_000_000_001);
    expect(result.valid).toBe(false);
  });

  it('rejects fractional deposit amount', () => {
    const result = validateDepositAmount(10.5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });
});

// ─── Withdrawal Tests ──────────────────────────────────────────────────────

describe('Withdrawal Protection', () => {
  // ✅ Withdrawal with verified winnings succeeds
  it('accepts withdrawal within verified winnings and balance', () => {
    const result = validateWithdrawalAmount(50, 100, 200);
    expect(result.valid).toBe(true);
  });

  it('accepts withdrawal equal to verified winnings', () => {
    const result = validateWithdrawalAmount(100, 100, 200);
    expect(result.valid).toBe(true);
  });

  // ✅ Withdrawal exceeding winnings fails
  it('rejects withdrawal exceeding verified winnings', () => {
    const result = validateWithdrawalAmount(150, 100, 200);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Verified winnings');
  });

  // ✅ Withdrawal exceeding balance fails
  it('rejects withdrawal exceeding current balance', () => {
    const result = validateWithdrawalAmount(50, 100, 30);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Current balance');
  });

  it('rejects zero withdrawal', () => {
    const result = validateWithdrawalAmount(0, 100, 200);
    expect(result.valid).toBe(false);
  });

  it('rejects negative withdrawal', () => {
    const result = validateWithdrawalAmount(-10, 100, 200);
    expect(result.valid).toBe(false);
  });

  it('rejects fractional withdrawal', () => {
    const result = validateWithdrawalAmount(10.5, 100, 200);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });
});

// ─── Score Validation Tests ────────────────────────────────────────────────

describe('Score Validation', () => {
  // ✅ Score recording with valid score succeeds
  it('accepts valid score', () => {
    const result = validateGameScore(1000);
    expect(result.valid).toBe(true);
  });

  it('accepts score of 0', () => {
    const result = validateGameScore(0);
    expect(result.valid).toBe(true);
  });

  it('accepts maximum valid score (999,999,999)', () => {
    const result = validateGameScore(999_999_999);
    expect(result.valid).toBe(true);
  });

  // ✅ Score recording with negative score fails
  it('rejects negative score', () => {
    const result = validateGameScore(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('negative');
  });

  it('rejects large negative score', () => {
    const result = validateGameScore(-999_999);
    expect(result.valid).toBe(false);
  });

  // ✅ Score recording with overflow score fails
  it('rejects score exceeding maximum', () => {
    const result = validateGameScore(1_000_000_000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('maximum');
  });

  it('rejects fractional score', () => {
    const result = validateGameScore(100.5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });
});

// ─── Replay Attack Detection ───────────────────────────────────────────────

describe('Replay Attack Prevention', () => {
  // ✅ Replay attack detection works
  it('detects replayed transaction signature', () => {
    const sig = '5VERv8NMhKgb8FUzVrFvpEsKnLi8r9ueaEWGCxXxPmVT7NnXL3JYAz5dZSfH3nPj';
    expect(detectReplayAttack(sig, sig)).toBe(true);
  });

  it('does not flag different signatures as replay', () => {
    const sig1 = '5VERv8NMhKgb8FUzVrFvpEsKnLi8r9ueaEWGCxXxPmVT7NnXL3JYAz5dZSfH3nPj';
    const sig2 = '4TERv8NMhKgb8FUzVrFvpEsKnLi8r9ueaEWGCxXxPmVT7NnXL3JYAz5dZSfH3nPk';
    expect(detectReplayAttack(sig1, sig2)).toBe(false);
  });

  it('does not flag first transaction as replay', () => {
    const sig = '5VERv8NMhKgb8FUzVrFvpEsKnLi8r9ueaEWGCxXxPmVT7NnXL3JYAz5dZSfH3nPj';
    expect(detectReplayAttack(null, sig)).toBe(false);
  });

  it('generates unique nonces', () => {
    const nonce1 = generateSecureNonce();
    const nonce2 = generateSecureNonce();
    expect(nonce1).not.toBe(nonce2);
  });

  it('validates fresh nonce', () => {
    const nonce = generateSecureNonce();
    expect(validateNonce(nonce)).toBe(true);
  });

  it('rejects expired nonce', () => {
    // Create a nonce with a timestamp from 6 minutes ago
    const oldTimestamp = Date.now() - 360_000;
    const expiredNonce = `${oldTimestamp}-abc123`;
    expect(validateNonce(expiredNonce)).toBe(false);
  });

  it('rejects malformed nonce', () => {
    expect(validateNonce('not-a-valid-nonce')).toBe(false);
  });
});

// ─── Wallet Address Validation ─────────────────────────────────────────────

describe('Wallet Address Validation', () => {
  // ✅ Invalid wallet address rejected
  it('accepts valid Solana address', () => {
    expect(validateWalletAddress('11111111111111111111111111111111')).toBe(true);
  });

  it('accepts DEBRIS token address as valid PublicKey', () => {
    expect(validateWalletAddress(TOKEN_CONFIG.DEBRIS.address)).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateWalletAddress('')).toBe(false);
  });

  it('rejects too-short address', () => {
    expect(validateWalletAddress('abc123')).toBe(false);
  });

  it('rejects non-base58 characters', () => {
    expect(validateWalletAddress('0OIl11111111111111111111111111111')).toBe(false);
  });
});

// ─── Transaction Signature Validation ──────────────────────────────────────

describe('Transaction Signature Validation', () => {
  it('accepts valid base58 signature', () => {
    const validSig = '5VERv8NMhKgb8FUzVrFvpEsKnL8r9ueaEWGCxXxPmVT7NnXL3JYAz5dZSfH3nPj';
    expect(validateTransactionSignature(validSig)).toBe(true);
  });

  it('rejects empty signature', () => {
    expect(validateTransactionSignature('')).toBe(false);
  });

  it('rejects too-short signature', () => {
    expect(validateTransactionSignature('abc')).toBe(false);
  });
});

// ─── Composite Transaction Integrity ───────────────────────────────────────

describe('Transaction Integrity (composite validation)', () => {
  // ✅ All transactions validated end-to-end
  it('passes valid DEBRIS transaction', () => {
    const result = validateTokenTransactionIntegrity(
      TOKEN_CONFIG.DEBRIS.address,
      100,
      '11111111111111111111111111111111'
    );
    expect(result.valid).toBe(true);
  });

  it('fails with wrong token mint', () => {
    const result = validateTokenTransactionIntegrity(
      'So11111111111111111111111111111111',
      100,
      '11111111111111111111111111111111'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('token mint');
  });

  it('fails with invalid amount', () => {
    const result = validateTokenTransactionIntegrity(
      TOKEN_CONFIG.DEBRIS.address,
      -1,
      '11111111111111111111111111111111'
    );
    expect(result.valid).toBe(false);
  });

  it('fails with invalid wallet', () => {
    const result = validateTokenTransactionIntegrity(
      TOKEN_CONFIG.DEBRIS.address,
      100,
      ''
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('wallet');
  });
});
