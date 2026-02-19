/**
 * Worker Manager - Manages multiple Web Workers for parallel processing
 * Used for vanity address mining, heavy computations, etc.
 */

export interface WorkerConfig {
  workerPath: string;
  maxWorkers?: number;
  onProgress?: (data: ProgressData) => void;
  onMatch?: (data: MatchData) => void;
  onError?: (error: Error) => void;
  onStopped?: (data: StoppedData) => void;
}

export interface ProgressData {
  workerId: number;
  checked: number;
  rate: number;
  elapsed: number;
}

export interface MatchData {
  address: string;
  secretKey: Uint8Array;
  score: number;
  matches: MatchDetail[];
  timestamp: number;
}

export interface MatchDetail {
  type: 'PREFIX' | 'SUFFIX' | 'CONTAINS';
  pattern: string;
  position: number;
}

export interface StoppedData {
  workerId: number;
  checked: number;
}

export interface PatternConfig {
  prefixes: string[];
  suffixes: string[];
  contains: string[];
  minScore: number;
}

export class WorkerManager {
  private workers: Worker[] = [];
  private config: WorkerConfig;
  private isRunning = false;
  private totalChecked = 0;
  private aggregatedRate = 0;
  private progressSnapshots: Map<number, ProgressData> = new Map();

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  /**
   * Get optimal worker count based on CPU cores
   */
  getOptimalWorkerCount(): number {
    const cores = navigator.hardwareConcurrency || 4;
    // Leave 1-2 cores for UI
    return Math.max(1, Math.min(cores - 1, this.config.maxWorkers || 8));
  }

  /**
   * Start mining with given patterns
   */
  start(patterns: PatternConfig): void {
    if (this.isRunning) {
      console.warn('Workers already running');
      return;
    }

    const workerCount = this.getOptimalWorkerCount();
    this.isRunning = true;
    this.totalChecked = 0;
    this.aggregatedRate = 0;
    this.progressSnapshots.clear();

    console.log(`Starting ${workerCount} workers...`);

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(
        new URL('../workers/vanityMiner.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event) => this.handleWorkerMessage(event, i);
      worker.onerror = (error) => {
        console.error(`Worker ${i} error:`, error);
        this.config.onError?.(new Error(error.message));
      };

      this.workers.push(worker);

      // Start the worker
      worker.postMessage({
        type: 'START',
        config: {
          patterns,
          workerId: i,
          batchSize: 500, // Balance between responsiveness and throughput
        },
      });
    }
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(event: MessageEvent, workerId: number): void {
    const { type, data } = event.data;

    switch (type) {
      case 'PROGRESS':
        this.progressSnapshots.set(workerId, data);
        this.aggregateProgress();
        break;

      case 'MATCH':
        this.config.onMatch?.(data);
        break;

      case 'STOPPED':
        this.config.onStopped?.(data);
        break;

      case 'ERROR':
        this.config.onError?.(new Error(data.message));
        break;
    }
  }

  /**
   * Aggregate progress from all workers
   */
  private aggregateProgress(): void {
    let totalChecked = 0;
    let totalRate = 0;
    let maxElapsed = 0;

    this.progressSnapshots.forEach((snap) => {
      totalChecked += snap.checked;
      totalRate += snap.rate;
      maxElapsed = Math.max(maxElapsed, snap.elapsed);
    });

    this.totalChecked = totalChecked;
    this.aggregatedRate = totalRate;

    this.config.onProgress?.({
      workerId: -1, // -1 indicates aggregated
      checked: totalChecked,
      rate: totalRate,
      elapsed: maxElapsed,
    });
  }

  /**
   * Pause all workers
   */
  pause(): void {
    this.workers.forEach((worker) => {
      worker.postMessage({ type: 'PAUSE' });
    });
  }

  /**
   * Resume all workers
   */
  resume(): void {
    this.workers.forEach((worker) => {
      worker.postMessage({ type: 'RESUME' });
    });
  }

  /**
   * Stop all workers
   */
  stop(): void {
    this.isRunning = false;
    this.workers.forEach((worker) => {
      worker.postMessage({ type: 'STOP' });
    });
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    this.stop();
    this.workers.forEach((worker) => {
      worker.terminate();
    });
    this.workers = [];
  }

  /**
   * Get current stats
   */
  getStats(): { checked: number; rate: number; workerCount: number } {
    return {
      checked: this.totalChecked,
      rate: this.aggregatedRate,
      workerCount: this.workers.length,
    };
  }

  /**
   * Check if running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Generate Base58 character variations for vanity patterns
 */
export const BASE58_SUBSTITUTIONS: Record<string, string[]> = {
  // Letters with number alternatives
  'a': ['a', 'A', '4'],
  'A': ['A', 'a', '4'],
  'b': ['b', 'B', '8'],
  'B': ['B', 'b', '8'],
  'e': ['e', 'E', '3'],
  'E': ['E', 'e', '3'],
  'g': ['g', 'G', '9'],
  'G': ['G', 'g', '9'],
  'i': ['i', '1'],  // Note: 'I' not in Base58
  's': ['s', 'S', '5'],
  'S': ['S', 's', '5'],
  't': ['t', 'T', '7'],
  'T': ['T', 't', '7'],
  'z': ['z', 'Z', '2'],
  'Z': ['Z', 'z', '2'],
  // Letters with case variants only
  'c': ['c', 'C'],
  'C': ['C', 'c'],
  'd': ['d', 'D'],
  'D': ['D', 'd'],
  'f': ['f', 'F'],
  'F': ['F', 'f'],
  'h': ['h', 'H'],
  'H': ['H', 'h'],
  'j': ['j', 'J'],
  'J': ['J', 'j'],
  'k': ['k', 'K'],
  'K': ['K', 'k'],
  'm': ['m', 'M'],
  'M': ['M', 'm'],
  'n': ['n', 'N'],
  'N': ['N', 'n'],
  'p': ['p', 'P'],
  'P': ['P', 'p'],
  'q': ['q', 'Q'],
  'Q': ['Q', 'q'],
  'r': ['r', 'R'],
  'R': ['R', 'r'],
  'u': ['u', 'U'],
  'U': ['U', 'u'],
  'v': ['v', 'V'],
  'V': ['V', 'v'],
  'w': ['w', 'W'],
  'W': ['W', 'w'],
  'x': ['x', 'X'],
  'X': ['X', 'x'],
  'y': ['y', 'Y'],
  'Y': ['Y', 'y'],
  // Numbers stay as-is
  '1': ['1'],
  '2': ['2'],
  '3': ['3'],
  '4': ['4'],
  '5': ['5'],
  '6': ['6'],
  '7': ['7'],
  '8': ['8'],
  '9': ['9'],
};

/**
 * Generate all variations of a pattern using Base58 substitutions
 */
export function generatePatternVariations(pattern: string): string[] {
  const chars = pattern.split('');
  const variations: string[][] = chars.map((char) => {
    return BASE58_SUBSTITUTIONS[char] || [char];
  });

  // Generate all combinations
  const results: string[] = [];
  
  function combine(index: number, current: string): void {
    if (index === variations.length) {
      results.push(current);
      return;
    }
    for (const variant of variations[index]) {
      combine(index + 1, current + variant);
    }
  }

  combine(0, '');
  return results;
}

/**
 * Estimate difficulty based on pattern length
 * Returns estimated time in seconds
 */
export function estimateDifficulty(prefixLen: number, suffixLen: number): {
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  estimatedSeconds: number;
  probability: number;
} {
  // Base58 has 58 chars, probability = 1/(58^length)
  const totalLen = prefixLen + suffixLen;
  const probability = 1 / Math.pow(58, totalLen);
  
  // Assume 100,000 addr/sec with 8 workers
  const ratePerSecond = 100000;
  const estimatedSeconds = 1 / (probability * ratePerSecond);

  let difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  if (estimatedSeconds < 60) {
    difficulty = 'easy';
  } else if (estimatedSeconds < 600) {
    difficulty = 'medium';
  } else if (estimatedSeconds < 3600) {
    difficulty = 'hard';
  } else {
    difficulty = 'extreme';
  }

  return { difficulty, estimatedSeconds, probability };
}

/**
 * Format time duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${(seconds / 3600).toFixed(1)}h`;
  }
  return `${(seconds / 86400).toFixed(1)}d`;
}

/**
 * Format large numbers with k/m suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}
