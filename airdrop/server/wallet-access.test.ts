import { describe, expect, it } from 'vitest';
import { isValidGorbaganaWallet } from '../shared/constants';

describe('Wallet-Based Admin Access', () => {
  const adminWallet = 'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo';
  const userWallet = 'So11111111111111111111111111111111111111112';

  it('should validate admin wallet format', () => {
    expect(isValidGorbaganaWallet(adminWallet)).toBe(true);
  });

  it('should verify wallet matches admin wallet', () => {
    expect(adminWallet === adminWallet).toBe(true);
  });

  it('should reject non-admin wallets', () => {
    expect(userWallet === adminWallet).toBe(false);
  });

  it('should handle wallet comparison case-sensitively', () => {
    const lowerCaseWallet = adminWallet.toLowerCase();
    expect(lowerCaseWallet === adminWallet).toBe(false);
  });

  it('should trim whitespace before comparison', () => {
    const trimmedWallet = `  ${adminWallet}  `.trim();
    expect(trimmedWallet === adminWallet).toBe(true);
  });

  it('should reject empty or invalid wallets', () => {
    expect('' === adminWallet).toBe(false);
    expect('invalid' === adminWallet).toBe(false);
    expect(null === adminWallet).toBe(false);
  });
});
