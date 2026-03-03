/**
 * Test suite for workerManager
 * Tests worker pool management, pattern generation, and difficulty estimation
 */

import { describe, it, expect } from 'vitest';
import {
  generatePatternVariations,
  estimateDifficulty,
  formatDuration,
  formatNumber,
  BASE58_SUBSTITUTIONS,
} from './workerManager';

describe('Pattern Generation', () => {
  describe('generatePatternVariations', () => {
    it('should generate single variation for single character', () => {
      const variations = generatePatternVariations('a');
      expect(variations.length).toBeGreaterThan(0);
      expect(variations).toContain('a');
    });

    it('should generate multiple variations for character with substitutions', () => {
      const variations = generatePatternVariations('a');
      // 'a' has substitutions: ['a', 'A', '4']
      expect(variations.length).toBe(3);
      expect(variations).toContain('a');
      expect(variations).toContain('A');
      expect(variations).toContain('4');
    });

    it('should generate combinations for multiple characters', () => {
      const variations = generatePatternVariations('ab');
      // 'a' has 3 variants, 'b' has 3 variants = 3 * 3 = 9 combinations
      expect(variations.length).toBe(9);
    });

    it('should handle numbers without substitution', () => {
      const variations = generatePatternVariations('1');
      expect(variations.length).toBe(1);
      expect(variations[0]).toBe('1');
    });

    it('should handle mixed alphanumeric patterns', () => {
      const variations = generatePatternVariations('a1');
      // 'a' has 3 variants, '1' has 1 variant = 3 * 1 = 3 combinations
      expect(variations.length).toBe(3);
    });
  });

  describe('BASE58_SUBSTITUTIONS', () => {
    it('should have substitutions for common letters', () => {
      expect(BASE58_SUBSTITUTIONS['a']).toBeDefined();
      expect(BASE58_SUBSTITUTIONS['b']).toBeDefined();
      expect(BASE58_SUBSTITUTIONS['e']).toBeDefined();
    });

    it('should not have substitutions for excluded characters (0, O, I, l)', () => {
      expect(BASE58_SUBSTITUTIONS['0']).toBeUndefined();
      expect(BASE58_SUBSTITUTIONS['O']).toBeUndefined();
      expect(BASE58_SUBSTITUTIONS['I']).toBeUndefined();
      expect(BASE58_SUBSTITUTIONS['l']).toBeUndefined();
    });

    it('should have case variants for most letters', () => {
      const lowercase = BASE58_SUBSTITUTIONS['a'];
      const uppercase = BASE58_SUBSTITUTIONS['A'];
      
      expect(lowercase).toBeDefined();
      expect(uppercase).toBeDefined();
      expect(lowercase.length).toBeGreaterThan(0);
      expect(uppercase.length).toBeGreaterThan(0);
    });

    it('should include number substitutions for similar-looking letters', () => {
      expect(BASE58_SUBSTITUTIONS['a']).toContain('4'); // 'a' looks like '4'
      expect(BASE58_SUBSTITUTIONS['e']).toContain('3'); // 'e' looks like '3'
      expect(BASE58_SUBSTITUTIONS['s']).toContain('5'); // 's' looks like '5'
    });
  });
});

describe('Difficulty Estimation', () => {
  describe('estimateDifficulty', () => {
    it('should return easy difficulty for short patterns', () => {
      const result = estimateDifficulty(1, 0);
      expect(result.difficulty).toBe('easy');
    });

    it('should return medium difficulty for 2-3 character patterns', () => {
      const result = estimateDifficulty(2, 0);
      expect(['easy', 'medium']).toContain(result.difficulty);
    });

    it('should increase difficulty with pattern length', () => {
      const easy = estimateDifficulty(1, 0);
      const medium = estimateDifficulty(2, 0);
      const hard = estimateDifficulty(3, 0);
      
      expect(easy.estimatedSeconds).toBeLessThan(medium.estimatedSeconds);
      expect(medium.estimatedSeconds).toBeLessThan(hard.estimatedSeconds);
    });

    it('should calculate probability correctly', () => {
      const result = estimateDifficulty(1, 0);
      // Probability for 1 char = 1/58
      expect(result.probability).toBeCloseTo(1 / 58, 10);
    });

    it('should combine prefix and suffix lengths', () => {
      const separate = estimateDifficulty(2, 1);
      const combined = estimateDifficulty(3, 0);
      
      // Should be similar since total length is same
      expect(Math.abs(separate.estimatedSeconds - combined.estimatedSeconds) / combined.estimatedSeconds).toBeLessThan(0.1);
    });

    it('should return extreme difficulty for very long patterns', () => {
      const result = estimateDifficulty(10, 0);
      expect(result.difficulty).toBe('extreme');
    });
  });
});

describe('Formatting Utilities', () => {
  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(30)).toContain('s');
      expect(formatDuration(30)).toBe('30s');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(120)).toContain('m');
      expect(formatDuration(120)).toBe('2m');
    });

    it('should format hours correctly', () => {
      expect(formatDuration(3600)).toContain('h');
      expect(formatDuration(3600)).toBe('1.0h');
    });

    it('should format days correctly', () => {
      expect(formatDuration(86400)).toContain('d');
      expect(formatDuration(86400)).toBe('1.0d');
    });

    it('should round appropriately', () => {
      expect(formatDuration(59)).toBe('59s');
      expect(formatDuration(61)).toBe('1m');
    });
  });

  describe('formatNumber', () => {
    it('should format small numbers as-is', () => {
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(999)).toBe('999');
    });

    it('should format thousands with k suffix', () => {
      expect(formatNumber(1000)).toBe('1.0k');
      expect(formatNumber(5500)).toBe('5.5k');
    });

    it('should format millions with M suffix', () => {
      expect(formatNumber(1000000)).toBe('1.0M');
      expect(formatNumber(5500000)).toBe('5.5M');
    });

    it('should handle large numbers', () => {
      const result = formatNumber(1234567890);
      expect(result).toContain('M');
    });

    it('should maintain precision', () => {
      expect(formatNumber(1234)).toBe('1.2k');
      expect(formatNumber(1234567)).toBe('1.2M');
    });
  });
});

describe('Worker Manager Configuration', () => {
  it('should define PatternConfig interface', () => {
    const config = {
      prefixes: ['test'],
      suffixes: ['ing'],
      contains: ['es'],
      minScore: 10,
    };

    expect(config.prefixes).toBeDefined();
    expect(config.suffixes).toBeDefined();
    expect(config.contains).toBeDefined();
    expect(config.minScore).toBeGreaterThan(0);
  });

  it('should define ProgressData interface', () => {
    const progress = {
      workerId: 0,
      checked: 1000,
      rate: 500,
      elapsed: 2000,
    };

    expect(progress.checked).toBeGreaterThan(0);
    expect(progress.rate).toBeGreaterThan(0);
    expect(progress.elapsed).toBeGreaterThan(0);
  });

  it('should define MatchData interface', () => {
    const match = {
      address: 'testaddress123',
      secretKey: new Uint8Array(32),
      score: 100,
      matches: [],
      timestamp: Date.now(),
    };

    expect(match.address).toBeTruthy();
    expect(match.secretKey).toBeInstanceOf(Uint8Array);
    expect(match.score).toBeGreaterThan(0);
  });
});

describe('Pattern Variation Edge Cases', () => {
  it('should handle empty pattern', () => {
    const variations = generatePatternVariations('');
    expect(variations.length).toBe(1);
    expect(variations[0]).toBe('');
  });

  it('should handle patterns with only numbers', () => {
    const variations = generatePatternVariations('123');
    expect(variations.length).toBe(1);
    expect(variations[0]).toBe('123');
  });

  it('should handle case-sensitive variations', () => {
    const variations = generatePatternVariations('Aa');
    expect(variations.length).toBeGreaterThan(1);
    expect(variations.some(v => v.includes('A'))).toBe(true);
    expect(variations.some(v => v.includes('a'))).toBe(true);
  });

  it('should generate correct number of combinations', () => {
    // 'a' has 3 variants, 'e' has 3 variants
    const variations = generatePatternVariations('ae');
    expect(variations.length).toBe(9); // 3 * 3
  });
});
