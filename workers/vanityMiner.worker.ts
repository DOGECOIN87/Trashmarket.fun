/**
 * Vanity Address Miner Web Worker
 * Runs in background thread for heavy keypair generation
 * Uses @solana/web3.js Keypair for Base58 address generation
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Message types from main thread
interface MineRequest {
  type: 'START' | 'STOP' | 'PAUSE' | 'RESUME';
  config?: MineConfig;
}

interface MineConfig {
  patterns: PatternConfig;
  workerId: number;
  batchSize: number;
}

interface PatternConfig {
  prefixes: string[];
  suffixes: string[];
  contains: string[];
  minScore: number;
}

// Message types to main thread  
interface MineResult {
  type: 'PROGRESS' | 'MATCH' | 'STOPPED' | 'ERROR';
  data: any;
}

interface MatchData {
  address: string;
  secretKey: Uint8Array;
  score: number;
  matches: MatchDetail[];
  timestamp: number;
}

interface MatchDetail {
  type: 'PREFIX' | 'SUFFIX' | 'CONTAINS';
  pattern: string;
  position: number;
}

// Worker state
let isRunning = false;
let isPaused = false;
let checkedCount = 0;
let startTime = 0;
let config: MineConfig | null = null;

// Base58 character set (exclude 0, O, I, l)
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Check if an address matches any pattern and calculate score
 */
function checkAddress(address: string, patterns: PatternConfig): { score: number; matches: MatchDetail[] } | null {
  const matches: MatchDetail[] = [];
  let score = 0;

  // Check prefixes (highest value)
  for (const prefix of patterns.prefixes) {
    if (address.toLowerCase().startsWith(prefix.toLowerCase())) {
      matches.push({ type: 'PREFIX', pattern: prefix, position: 0 });
      score += prefix.length * 15; // Prefix is most valuable
    }
  }

  // Check suffixes
  for (const suffix of patterns.suffixes) {
    if (address.toLowerCase().endsWith(suffix.toLowerCase())) {
      matches.push({ type: 'SUFFIX', pattern: suffix, position: address.length - suffix.length });
      score += suffix.length * 10;
    }
  }

  // Check contains (anywhere in address)
  for (const pattern of patterns.contains) {
    const idx = address.toLowerCase().indexOf(pattern.toLowerCase());
    if (idx !== -1) {
      // Don't double-count if already matched as prefix/suffix
      const alreadyMatched = matches.some(m => 
        (m.type === 'PREFIX' && idx === 0) || 
        (m.type === 'SUFFIX' && idx === address.length - pattern.length)
      );
      if (!alreadyMatched) {
        matches.push({ type: 'CONTAINS', pattern, position: idx });
        score += pattern.length * 5;
      }
    }
  }

  if (matches.length > 0 && score >= patterns.minScore) {
    // Bonus for multiple matches
    if (matches.length > 1) {
      score += matches.length * 8;
    }
    // Bonus for prefix + suffix combo
    if (matches.some(m => m.type === 'PREFIX') && matches.some(m => m.type === 'SUFFIX')) {
      score += 25;
    }
    return { score, matches };
  }

  return null;
}

/**
 * Generate keypairs and check against patterns
 */
function mineBatch(): void {
  if (!config || !isRunning || isPaused) return;

  const batchSize = config.batchSize || 1000;
  
  for (let i = 0; i < batchSize; i++) {
    if (!isRunning || isPaused) break;

    // Generate new keypair
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();
    checkedCount++;

    // Check for matches
    const result = checkAddress(address, config.patterns);
    
    if (result) {
      const matchData: MatchData = {
        address,
        secretKey: keypair.secretKey,
        score: result.score,
        matches: result.matches,
        timestamp: Date.now(),
      };

      self.postMessage({
        type: 'MATCH',
        data: matchData,
      } as MineResult);
    }
  }

  // Report progress every batch
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = Math.round(checkedCount / elapsed);

  self.postMessage({
    type: 'PROGRESS',
    data: {
      checked: checkedCount,
      rate,
      elapsed: Math.round(elapsed),
      workerId: config.workerId,
    },
  } as MineResult);

  // Continue mining
  if (isRunning && !isPaused) {
    setTimeout(mineBatch, 0);
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = (event: MessageEvent<MineRequest>) => {
  const { type, config: newConfig } = event.data;

  switch (type) {
    case 'START':
      if (newConfig) {
        config = newConfig;
        isRunning = true;
        isPaused = false;
        checkedCount = 0;
        startTime = Date.now();
        mineBatch();
      }
      break;

    case 'STOP':
      isRunning = false;
      isPaused = false;
      self.postMessage({
        type: 'STOPPED',
        data: { checked: checkedCount, workerId: config?.workerId },
      } as MineResult);
      break;

    case 'PAUSE':
      isPaused = true;
      break;

    case 'RESUME':
      if (isRunning && isPaused) {
        isPaused = false;
        mineBatch();
      }
      break;
  }
};

// Export empty to make it a module
export {};
