import { describe, expect, it } from 'vitest';
import { isValidGorbaganaWallet } from '../shared/constants';

describe('Wallet Validation', () => {
  it('should accept valid Gorbagana wallet addresses', () => {
    // Valid Solana/Gorbagana addresses (Base58 encoded, 32-44 chars)
    const validWallets = [
      'So11111111111111111111111111111111111111112', // 44 chars
      'EPjFWaJY5Au9r6mWBxhiPvWKsDQhjhsFXjKgXoKKKKK', // 44 chars
      'TokenkegQfeZyiNwAJsyFbPVwwQQfyanvTQFC1sPL', // 44 chars
    ];

    validWallets.forEach((wallet) => {
      expect(isValidGorbaganaWallet(wallet)).toBe(true);
    });
  });

  it('should reject invalid wallet addresses', () => {
    const invalidWallets = [
      'invalid', // too short
      '0x1234567890123456789012345678901234567890', // Ethereum format
      '', // empty
      '   ', // whitespace only
    ];

    invalidWallets.forEach((wallet) => {
      expect(isValidGorbaganaWallet(wallet)).toBe(false);
    });
  });

  it('should handle edge cases', () => {
    // 32 chars minimum - valid
    const min32 = '1' + '1'.repeat(31);
    expect(isValidGorbaganaWallet(min32)).toBe(true);
    
    // 44 chars maximum - valid
    const max44 = '1' + '1'.repeat(43);
    expect(isValidGorbaganaWallet(max44)).toBe(true);
    
    // 31 chars - too short
    const under32 = '1' + '1'.repeat(30);
    expect(isValidGorbaganaWallet(under32)).toBe(false);
    
    // 45 chars - too long
    const over44 = '1' + '1'.repeat(44);
    expect(isValidGorbaganaWallet(over44)).toBe(false);
  });

  it('should trim whitespace before validation', () => {
    const wallet = 'So11111111111111111111111111111111111111112';
    expect(isValidGorbaganaWallet(`  ${wallet}  `)).toBe(true);
    expect(isValidGorbaganaWallet(`\n${wallet}\n`)).toBe(true);
    expect(isValidGorbaganaWallet(`\t${wallet}\t`)).toBe(true);
  });
});
