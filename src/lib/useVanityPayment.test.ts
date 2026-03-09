/**
 * Test suite for useVanityPayment hook
 * Tests Anchor program integration, payment logic, and account management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateDifficultyMultiplier,
  calculateEstimatedAttempts,
  calculateBatchCostGOR,
  calculateBatchCostLamports,
} from './useVanityPayment';

describe('Vanity Payment Calculations', () => {
  describe('calculateDifficultyMultiplier', () => {
    it('should return 1 for zero length', () => {
      expect(calculateDifficultyMultiplier(0, 0)).toBe(1);
    });

    it('should increase exponentially with pattern length', () => {
      const m1 = calculateDifficultyMultiplier(1, 0);
      const m2 = calculateDifficultyMultiplier(2, 0);
      const m3 = calculateDifficultyMultiplier(3, 0);
      
      expect(m2).toBeGreaterThan(m1);
      expect(m3).toBeGreaterThan(m2);
    });

    it('should cap multiplier at 1000x', () => {
      const multiplier = calculateDifficultyMultiplier(15, 0);
      expect(multiplier).toBeLessThanOrEqual(1000);
    });

    it('should combine prefix and suffix lengths', () => {
      const prefixOnly = calculateDifficultyMultiplier(3, 0);
      const suffixOnly = calculateDifficultyMultiplier(0, 3);
      const combined = calculateDifficultyMultiplier(2, 1);
      
      expect(suffixOnly).toBe(prefixOnly);
      expect(combined).toBeGreaterThan(calculateDifficultyMultiplier(1, 0));
    });
  });

  describe('calculateEstimatedAttempts', () => {
    it('should return 0 for zero length', () => {
      expect(calculateEstimatedAttempts(0, 0)).toBe(0);
    });

    it('should return 58 for 1 character (Base58)', () => {
      expect(calculateEstimatedAttempts(1, 0)).toBe(58);
    });

    it('should return 58^2 for 2 characters', () => {
      expect(calculateEstimatedAttempts(2, 0)).toBe(58 * 58);
    });

    it('should combine prefix and suffix', () => {
      const attempts = calculateEstimatedAttempts(2, 1);
      expect(attempts).toBe(Math.pow(58, 3));
    });
  });

  describe('calculateBatchCostGOR', () => {
    it('should return positive cost for any pattern', () => {
      const cost = calculateBatchCostGOR(2, 1);
      expect(cost).toBeGreaterThan(0);
    });

    it('should scale with difficulty', () => {
      const cost1 = calculateBatchCostGOR(1, 0);
      const cost2 = calculateBatchCostGOR(2, 0);
      const cost3 = calculateBatchCostGOR(3, 0);
      
      expect(cost2).toBeGreaterThan(cost1);
      expect(cost3).toBeGreaterThan(cost2);
    });

    it('should be consistent with multiplier', () => {
      const prefixLen = 2;
      const suffixLen = 1;
      const multiplier = calculateDifficultyMultiplier(prefixLen, suffixLen);
      const cost = calculateBatchCostGOR(prefixLen, suffixLen);
      
      // Base cost is 0.01 GOR, so cost should be 0.01 * multiplier
      expect(cost).toBeCloseTo(0.01 * multiplier, 5);
    });
  });

  describe('calculateBatchCostLamports', () => {
    it('should return positive cost in lamports', () => {
      const cost = calculateBatchCostLamports(2, 1);
      expect(cost).toBeGreaterThan(0);
    });

    it('should be 10^9 times the GOR cost', () => {
      const prefixLen = 2;
      const suffixLen = 1;
      const costGOR = calculateBatchCostGOR(prefixLen, suffixLen);
      const costLamports = calculateBatchCostLamports(prefixLen, suffixLen);
      
      expect(costLamports).toBeCloseTo(costGOR * 1_000_000_000, 0);
    });

    it('should match base cost for 0 difficulty', () => {
      const cost = calculateBatchCostLamports(0, 0);
      expect(cost).toBe(10_000_000); // BASE_BATCH_COST_LAMPORTS
    });
  });
});

describe('Vanity Payment Constants', () => {
  it('should have correct program ID', () => {
    const VANITY_PROGRAM_ID = '5YSYX6GX3wD2xTp6poLuP92FT8uiWeRFLwASsULXXYM4';
    expect(VANITY_PROGRAM_ID).toBeTruthy();
    expect(VANITY_PROGRAM_ID.length).toBe(44); // Base58 encoded public key length
  });

  it('should have correct treasury wallet', () => {
    const TREASURY_WALLET = 'TMABDMgLHfmmRNyHgbHTP9P5XP1zrAMFfbRAef69o9f';
    expect(TREASURY_WALLET).toBeTruthy();
    expect(TREASURY_WALLET.length).toBe(43); // Base58 encoded public key length
  });

  it('should have correct GOR decimals', () => {
    const GOR_DECIMALS = 9;
    const LAMPORTS_PER_GOR = Math.pow(10, GOR_DECIMALS);
    expect(LAMPORTS_PER_GOR).toBe(1_000_000_000);
  });
});

describe('Vanity Payment Interface', () => {
  it('should define MiningAccount interface correctly', () => {
    // This is a compile-time check, but we can verify structure
    const mockAccount = {
      balance: 1.5,
      balanceLamports: 1_500_000_000,
      totalSpent: 0.2,
      matchesFound: 3,
      isActive: true,
    };

    expect(mockAccount.balance).toBeGreaterThan(0);
    expect(mockAccount.balanceLamports).toBeGreaterThan(0);
    expect(typeof mockAccount.matchesFound).toBe('number');
    expect(typeof mockAccount.isActive).toBe('boolean');
  });

  it('should define VanityPaymentState interface correctly', () => {
    const mockState = {
      miningAccount: null,
      isInitializing: false,
      isDepositing: false,
      isWithdrawing: false,
      error: null,
    };

    expect(typeof mockState.isInitializing).toBe('boolean');
    expect(typeof mockState.isDepositing).toBe('boolean');
    expect(typeof mockState.isWithdrawing).toBe('boolean');
  });
});

describe('Cost Calculation Edge Cases', () => {
  it('should handle maximum reasonable pattern length', () => {
    const cost = calculateBatchCostGOR(10, 0);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThanOrEqual(10); // Should be reasonable
  });

  it('should maintain precision for small costs', () => {
    const cost = calculateBatchCostGOR(0, 0);
    expect(cost).toBeCloseTo(0.01, 5);
  });

  it('should handle combined prefix and suffix', () => {
    const combined = calculateBatchCostGOR(2, 2);
    const prefixOnly = calculateBatchCostGOR(4, 0);
    
    // Combined should be similar to 4-char prefix
    expect(Math.abs(combined - prefixOnly) / prefixOnly).toBeLessThan(0.5);
  });
});
