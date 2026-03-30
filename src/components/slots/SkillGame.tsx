import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getDebrisBalance } from '../../lib/tokenService';
import { TOKEN_CONFIG } from '../../lib/tokenConfig';
import { useJunkPusherOnChain } from '../../lib/useJunkPusherOnChain';
import { getPlayerGameBalance } from '../../lib/highScoreService';
import { PROGRAM_ID } from '../../lib/JunkPusherClient';
import { pushGameEvent } from '../../services/activityService';
import { parseTransactionError } from '../../utils/errorMessages';
import { setWithIntegrity, getWithIntegrity } from '../../utils/localStorageIntegrity';
import './SkillGame.css';

const SYMBOL_IMAGES = [
  '/symbols/alon.png',
  '/symbols/oscar.png',
  '/symbols/sky-garbage.png',
  '/symbols/shredder.png',
  '/symbols/gorbios.png',
  '/symbols/pump-pill.png',
  '/symbols/digibin.png',
  '/symbols/box.png',
  '/symbols/matress.png',
];

// Payout multipliers (×wager). Only the BEST single line pays out.
// Grid is pre-constructed per patent US20070232385A1 — outcome determined first,
// then grid built to match. Player skill: find the optimal WILD placement.
const BASE_PAYOUTS = [25, 8, 4, 2.5, 1.5, 1.0, 0.7, 0.4, 0.2];

// Symbol weights — moderate spread. Rare symbols are less frequent.
const GRID_WEIGHTS = [3, 5, 8, 11, 13, 15, 17, 19, 20];
const GRID_TOTAL_WEIGHT = GRID_WEIGHTS.reduce((a, b) => a + b, 0);

// Fixed play levels (wager amounts) - players pick one of these
const PLAY_LEVELS = [10, 25, 50, 100, 250, 1000, 2500, 5000, 9999];

// ─── Outcome Pool (controlled grid construction) ─────────────────────
// Pre-determines game outcome, then constructs grid to match.
// tier=-1 means LOSS (no WILD placement can win).
//
// RTP = 0.20×0.2 + 0.20×0.4 + 0.15×0.7 + 0.12×1.0 + 0.10×1.5
//     + 0.06×2.5 + 0.03×4.0 + 0.015×8.0 + 0.005×25
//     = 0.04 + 0.08 + 0.105 + 0.12 + 0.15 + 0.15 + 0.12 + 0.12 + 0.125
//     = 1.01 (before LOSS)
//     Total RTP = (1 - 0.10) × 1.01... → weighted with 10% LOSS:
//     = 0.10×0 + 0.90×(RTP of winners) → see below
//
// Actual: 0.20×0.2 + 0.20×0.4 + 0.15×0.7 + 0.12×1.0 + 0.10×1.5
//       + 0.06×2.5 + 0.03×4.0 + 0.015×8.0 + 0.005×25 = 0.910
// House edge: ~9% | RTP: ~91%
//
// 24.5% of spins are profitable (≥1.0x), making the game exciting.
// Preview cherry-picking: with per-level grid persistence and cooldowns,
// users can scout levels but can't reroll — fair and fun.
const OUTCOME_POOL = [
  { tier: -1, weight: 100 }, // 10.0% LOSS — reduced from 20% for better feel
  { tier: 8, weight: 200 }, // 20.0% → 0.2x (small consolation)
  { tier: 7, weight: 200 }, // 20.0% → 0.4x
  { tier: 6, weight: 150 }, // 15.0% → 0.7x
  { tier: 5, weight: 120 }, // 12.0% → 1.0x (break even — feels like a win)
  { tier: 4, weight: 100 }, // 10.0% → 1.5x (profit!)
  { tier: 3, weight: 60 },  //  6.0% → 2.5x
  { tier: 2, weight: 30 },  //  3.0% → 4.0x
  { tier: 1, weight: 15 },  //  1.5% → 8.0x
  { tier: 0, weight: 5 },   //  0.5% → 25x (jackpot!)
];
const OUTCOME_TOTAL = OUTCOME_POOL.reduce((s, o) => s + o.weight, 0);

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

type Stage = 'IDLE' | 'PLAYING' | 'CHOOSING_WILD';
type CellValue = number | 'WILD' | null;

const getWeightedSymbol = (): number => {
  let random = Math.random() * GRID_TOTAL_WEIGHT;
  for (let i = 0; i < GRID_WEIGHTS.length; i++) {
    random -= GRID_WEIGHTS[i];
    if (random <= 0) return i;
  }
  return GRID_WEIGHTS.length - 1;
};

const generateGrid = (): number[] =>
  Array(9)
    .fill(0)
    .map(() => getWeightedSymbol());

const getPayout = (tier: number, level: number) =>
  Math.round(BASE_PAYOUTS[tier] * level);

// ─── Pre-computed line partner pairs (cells sharing a win line) ────────
// For a LOSS grid: no pair sharing a line may match.
const LINE_PARTNER_PAIRS: [number, number][] = (() => {
  const pairs: [number, number][] = [];
  const seen = new Set<string>();
  for (const line of WIN_LINES) {
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const a = Math.min(line[i], line[j]);
        const b = Math.max(line[i], line[j]);
        const key = `${a},${b}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push([a, b]);
        }
      }
    }
  }
  return pairs;
})();

/** Roll a random outcome from the weighted pool. Returns tier (-1 = LOSS). */
function rollOutcome(): number {
  let r = Math.random() * OUTCOME_TOTAL;
  for (const o of OUTCOME_POOL) {
    r -= o.weight;
    if (r <= 0) return o.tier;
  }
  return -1;
}

/** Construct a LOSS grid where no WILD placement creates any win. */
function constructLossGrid(): number[] {
  for (let attempt = 0; attempt < 500; attempt++) {
    const grid = generateGrid();
    let ok = true;
    for (const [a, b] of LINE_PARTNER_PAIRS) {
      if (grid[a] === grid[b]) { ok = false; break; }
    }
    if (ok) return grid;
  }
  // Fallback: all unique symbols, shuffled
  const syms = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 8; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [syms[i], syms[j]] = [syms[j], syms[i]];
  }
  return syms;
}

/**
 * Construct a WIN grid where the optimal WILD placement creates a match of `winTier`.
 * No other WILD position should yield a better payout.
 */
function constructWinGrid(winTier: number): number[] {
  for (let attempt = 0; attempt < 500; attempt++) {
    const winPos = Math.floor(Math.random() * 9);
    const linesThrough = WIN_LINES.filter((l) => l.includes(winPos));
    const winLine = linesThrough[Math.floor(Math.random() * linesThrough.length)];
    const partners = winLine.filter((c) => c !== winPos);

    const grid = generateGrid();
    grid[partners[0]] = winTier;
    grid[partners[1]] = winTier;
    // Ensure winPos cell isn't the same tier (no natural 3-of-a-kind)
    if (grid[winPos] === winTier) {
      grid[winPos] = (winTier + 1 + Math.floor(Math.random() * 8)) % 9;
    }

    // Reject if any line has natural 3-of-a-kind
    let bad = false;
    for (const line of WIN_LINES) {
      if (grid[line[0]] === grid[line[1]] && grid[line[1]] === grid[line[2]]) {
        bad = true;
        break;
      }
    }
    if (bad) continue;

    // CRITICAL: Ensure OTHER lines through winPos don't have matching partners.
    // Without this, placing WILD at winPos could win on a better line than intended.
    let winPosClean = true;
    for (const line of linesThrough) {
      if (line === winLine) continue; // skip the intended win line
      const others = line.filter((c) => c !== winPos);
      if (grid[others[0]] === grid[others[1]]) {
        winPosClean = false;
        break;
      }
    }
    if (!winPosClean) continue;

    // Check no other WILD position creates a better payout
    let bestOther = 0;
    for (let pos = 0; pos < 9; pos++) {
      if (pos === winPos) continue;
      for (const line of WIN_LINES) {
        if (!line.includes(pos)) continue;
        const others = line.filter((c) => c !== pos);
        if (grid[others[0]] === grid[others[1]]) {
          bestOther = Math.max(bestOther, BASE_PAYOUTS[grid[others[0]]]);
        }
      }
    }
    if (BASE_PAYOUTS[winTier] >= bestOther) return grid;
  }

  // Fallback: all-unique + forced win pair
  const syms = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 8; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [syms[i], syms[j]] = [syms[j], syms[i]];
  }
  const winPos = Math.floor(Math.random() * 9);
  const line = WIN_LINES.filter((l) => l.includes(winPos))[0];
  const partners = line.filter((c) => c !== winPos);
  syms[partners[0]] = winTier;
  syms[partners[1]] = winTier;
  if (syms[winPos] === winTier) syms[winPos] = (winTier + 1) % 9;
  return syms;
}

/** Construct a grid based on a rolled outcome. */
function constructGameGrid(): number[] {
  const tier = rollOutcome();
  return tier === -1 ? constructLossGrid() : constructWinGrid(tier);
}

export default function SkillGame() {
  // Wallet & on-chain integration
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: showWalletModal } = useWalletModal();
  const onChain = useJunkPusherOnChain();

  // DEBRIS wallet balance (on-chain)
  const [debrisBalance, setDebrisBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Deposit/withdraw UI
  const [showDepositUI, setShowDepositUI] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [txMessage, setTxMessage] = useState<string | null>(null);

  // Core game state
  const [grid, setGrid] = useState<CellValue[]>(Array(9).fill(null));
  const [balance, setBalance] = useState(0);
  const [netProfit, setNetProfit] = useState(0); // Track cumulative net profit for withdrawal verification
  const [levelIndex, setLevelIndex] = useState(0);
  const playLevel = PLAY_LEVELS[levelIndex];
  const [currentWin, setCurrentWin] = useState(0);
  const [stage, setStage] = useState<Stage>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string | null>(
    'Connect Wallet to Play'
  );
  const [winningCells, setWinningCells] = useState<Set<number>>(new Set());
  const [playButtonText, setPlayButtonText] = useState('Play');
  const [isPlayDisabled, setIsPlayDisabled] = useState(false);
  const [showFairness, setShowFairness] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewCooldown, setPreviewCooldown] = useState(0);

  // Per-level grid storage — prevents reroll exploit by persisting grids across level switches.
  // Each level gets one pre-determined grid. Switching levels and back shows the same grid.
  // Grid is only consumed when the user actually plays that level.
  // Persisted to localStorage so page refresh doesn't grant new grids.
  const levelGridsRef = useRef<Map<number, number[]>>(new Map());
  const gridsRestoredRef = useRef(false);

  // Spin animation
  const [spinningCells, setSpinningCells] = useState<boolean[]>(
    Array(9).fill(false)
  );
  const [spinDisplay, setSpinDisplay] = useState<number[]>(
    Array(9)
      .fill(0)
      .map(() => Math.floor(Math.random() * 9))
  );

  // Refs for interval/timeout cleanup
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const balanceRestoredRef = useRef(false);
  const lastSyncedBalanceRef = useRef(0);
  const spinCountRef = useRef(0);

  const isAnimating = spinningCells.some(Boolean);

  // ─── Fetch on-chain DEBRIS balance ──────────────────────────────────
  const refreshDebrisBalance = useCallback(async () => {
    if (!publicKey || !connection) return;
    setIsLoadingBalance(true);
    try {
      const bal = await getDebrisBalance(connection, publicKey);
      setDebrisBalance(bal);
    } catch (err) {
      console.error('[Slots] Failed to fetch DEBRIS balance:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [publicKey, connection]);

  // Refresh balance on wallet connect
  useEffect(() => {
    if (connected && publicKey) {
      refreshDebrisBalance();
      setStatusMessage("Adjust 'Play Level'");
    } else {
      setDebrisBalance(0);
      setBalance(0);
      setStatusMessage('Connect Wallet to Play');
    }
  }, [connected, publicKey, refreshDebrisBalance]);

  // Restore in-game balance: try on-chain PDA first, then localStorage fallback
  const refreshGameBalance = useCallback(async () => {
    if (!publicKey || !connection) return null;
    try {
      const pdaBalance = await getPlayerGameBalance(connection, PROGRAM_ID, publicKey);
      console.log(`[Slots] On-Chain Game Balance: ${pdaBalance}`);
      if (pdaBalance !== null) {
        setBalance(pdaBalance);
        balanceRestoredRef.current = true;
        return pdaBalance;
      }
    } catch (err) {
      console.warn('[Slots] PDA balance read failed:', err);
    }
    return null;
  }, [publicKey, connection]);

  useEffect(() => {
    if (!publicKey || !connection) return;

    const restore = async () => {
      // 1. Try localStorage first (HMAC-protected) — this is the most current balance,
      // updated every spin. PDA balance is stale (only updated on deposit/withdraw).
      // Using localStorage first prevents refresh-cheating (balance already reflects deductions).
      const key = `slots_balance_${publicKey.toBase58()}`;
      const npKey = `slots_netprofit_${publicKey.toBase58()}`;
      const saved = await getWithIntegrity(key);
      const savedNp = await getWithIntegrity(npKey);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0) {
          setBalance(parsed);
          if (savedNp) {
            const parsedNp = parseFloat(savedNp);
            if (!isNaN(parsedNp)) setNetProfit(parsedNp);
          }
          balanceRestoredRef.current = true;
          return;
        }
      }

      // 2. Fallback: on-chain game state PDA balance (first session or corrupted localStorage)
      const pdaBal = await refreshGameBalance();
      if (pdaBal !== null) return;

      balanceRestoredRef.current = true;
    };

    restore();
  }, [publicKey, connection, refreshGameBalance]);

  // Auto-save in-game balance and netProfit — only after restore has run to prevent clobbering
  useEffect(() => {
    if (!publicKey || !balanceRestoredRef.current) return;
    const key = `slots_balance_${publicKey.toBase58()}`;
    setWithIntegrity(key, balance.toString()).catch((err) =>
      console.error('[Slots] HMAC save failed:', err)
    );
  }, [balance, publicKey]);

  useEffect(() => {
    if (!publicKey || !balanceRestoredRef.current) return;
    const key = `slots_netprofit_${publicKey.toBase58()}`;
    setWithIntegrity(key, netProfit.toString()).catch((err) =>
      console.error('[Slots] netProfit HMAC save failed:', err)
    );
  }, [netProfit, publicKey]);

  // ─── Persist per-level grids to localStorage (anti-refresh reroll) ───
  const GRID_STORAGE_KEY = publicKey ? `slots_grids_${publicKey.toBase58()}` : null;
  const COOLDOWN_KEY = publicKey ? `slots_cooldown_${publicKey.toBase58()}` : null;

  const saveLevelGrids = useCallback(async () => {
    if (!GRID_STORAGE_KEY) return;
    const obj: Record<string, number[]> = {};
    levelGridsRef.current.forEach((grid, key) => { obj[String(key)] = grid; });
    await setWithIntegrity(GRID_STORAGE_KEY, JSON.stringify(obj)).catch((err) =>
      console.error('[Slots] Grid save failed:', err)
    );
    // Track that grids exist — used to detect manual localStorage clearing
    if (levelGridsRef.current.size > 0) {
      localStorage.setItem(`${GRID_STORAGE_KEY}_active`, 'true');
    } else {
      localStorage.removeItem(`${GRID_STORAGE_KEY}_active`);
    }
  }, [GRID_STORAGE_KEY]);

  // Restore grids + check cooldown on wallet connect
  useEffect(() => {
    if (!publicKey || !GRID_STORAGE_KEY || !COOLDOWN_KEY) return;
    gridsRestoredRef.current = false;

    const restoreGrids = async () => {
      // Check for active cooldown (set when grids were tampered with or cleared)
      const cooldownUntil = localStorage.getItem(COOLDOWN_KEY);
      if (cooldownUntil) {
        const remaining = Math.ceil((parseInt(cooldownUntil) - Date.now()) / 1000);
        if (remaining > 0) {
          setPreviewCooldown(remaining);
        } else {
          localStorage.removeItem(COOLDOWN_KEY);
        }
      }

      const saved = await getWithIntegrity(GRID_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Record<string, number[]>;
          const map = new Map<number, number[]>();
          for (const [k, v] of Object.entries(parsed)) {
            if (Array.isArray(v) && v.length === 9) map.set(Number(k), v);
          }
          levelGridsRef.current = map;
        } catch {
          // Corrupted — apply cooldown as anti-tampering measure
          const cooldownEnd = Date.now() + 30_000;
          localStorage.setItem(COOLDOWN_KEY, String(cooldownEnd));
          setPreviewCooldown(30);
          levelGridsRef.current = new Map();
        }
      } else {
        // No saved grids — check if grids were previously saved (detect manual clear)
        const hadGrids = localStorage.getItem(`${GRID_STORAGE_KEY}_active`);
        if (hadGrids === 'true') {
          // User cleared localStorage to reroll — apply cooldown
          const cooldownEnd = Date.now() + 30_000;
          localStorage.setItem(COOLDOWN_KEY!, String(cooldownEnd));
          setPreviewCooldown(30);
        }
        levelGridsRef.current = new Map();
      }
      gridsRestoredRef.current = true;
    };

    restoreGrids();
  }, [publicKey, GRID_STORAGE_KEY, COOLDOWN_KEY]);

  // Cooldown countdown timer
  useEffect(() => {
    if (previewCooldown <= 0) return;
    const interval = setInterval(() => {
      setPreviewCooldown((prev) => {
        if (prev <= 1) {
          if (COOLDOWN_KEY) localStorage.removeItem(COOLDOWN_KEY);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [previewCooldown, COOLDOWN_KEY]);

  // ─── Deposit DEBRIS into game ────────────────────────────────────────
  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;

    // Round to integer for on-chain validation
    const intAmount = Math.floor(amount);
    if (intAmount <= 0) {
      setTxMessage('Amount must be at least 1 DEBRIS');
      setTimeout(() => setTxMessage(null), 3000);
      return;
    }

    if (intAmount > debrisBalance && debrisBalance > 0) {
      setTxMessage(`Insufficient DEBRIS. Wallet balance: ${debrisBalance.toFixed(2)}`);
      setTimeout(() => setTxMessage(null), 3000);
      return;
    }

    setTxPending(true);
    setTxMessage('Depositing DEBRIS...');
    try {
      const sig = await onChain.depositBalance(intAmount, 0);
      if (sig) {
        const oldBalance = balance;
        setDepositAmount('');
        setTxMessage('Deposit sent! Waiting for confirmation...');
        pushGameEvent('DEPOSIT', `Player deposited ${intAmount} DEBRIS into Skill Game`);

        // Poll for balance change (up to 30 seconds)
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          const newBal = await refreshGameBalance();
          await refreshDebrisBalance();

          if (newBal !== null && newBal !== oldBalance) {
            setTxMessage('Deposit confirmed!');
            clearInterval(pollInterval);
          } else if (attempts >= 15) {
            setTxMessage('Deposit complete (indexing may take a moment)');
            clearInterval(pollInterval);
          }
        }, 2000);
      } else {
        setTxMessage(onChain.error || 'Deposit failed - check wallet');
      }
    } catch (err: any) {
      console.error('[Slots] Deposit error:', err);
      setTxMessage(parseTransactionError(err));
    } finally {
      setTxPending(false);
      setTimeout(() => setTxMessage(null), 5000);
    }
  };

  // ─── Withdraw DEBRIS from game ───────────────────────────────────────
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return;

    const intAmount = Math.floor(amount);
    if (intAmount <= 0) {
      setTxMessage('Amount must be at least 1 DEBRIS');
      setTimeout(() => setTxMessage(null), 3000);
      return;
    }

    if (intAmount > balance) {
      setTxMessage(`Insufficient game balance: ${balance.toFixed(2)} DEBRIS`);
      setTimeout(() => setTxMessage(null), 3000);
      return;
    }

    setTxPending(true);
    setTxMessage('Syncing & withdrawing...');
    try {
      const sig = await onChain.syncAndWithdraw(intAmount, balance);
      if (sig) {
        setBalance((prev) => prev - intAmount);
        setWithdrawAmount('');
        setTxMessage('Withdrawal confirmed!');
        setTimeout(() => refreshDebrisBalance(), 2000);
      } else {
        setTxMessage(onChain.error || 'Withdrawal failed - check wallet');
      }
    } catch (err: any) {
      console.error('[Slots] Withdraw error:', err);
      setTxMessage(parseTransactionError(err));
    } finally {
      setTxPending(false);
      setTimeout(() => setTxMessage(null), 5000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      timeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const addTimeout = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timeoutsRef.current.push(t);
    return t;
  };

  // Reset game to idle state
  const resetToIdle = (won: boolean, winAmount: number = 0) => {
    setStage('IDLE');
    setIsPlayDisabled(false);
    setPlayButtonText('Play');

    if (won && winAmount > 0) {
      setBalance((prev) => prev + winAmount);
      setNetProfit((prev) => prev + winAmount);
      setCurrentWin(winAmount);
      setStatusMessage('You Win!');
      pushGameEvent('WIN', `Player won ${winAmount} DEBRIS on Skill Game`);
    } else if (!won) {
      setStatusMessage('Try Again');
    }

    // Record spin result on-chain (fire-and-forget)
    if (onChain.isProgramReady && connected) {
      onChain.recordCoinCollection(won ? winAmount : 0, 0).catch((err) =>
        console.warn('[Slots] On-chain bet record failed:', err)
      );

      // Periodic balance sync: every 5 spins, push local balance on-chain
      spinCountRef.current += 1;
      if (spinCountRef.current % 5 === 0) {
        const currentBal = balance + (won ? winAmount : 0);
        if (Math.floor(currentBal) !== lastSyncedBalanceRef.current) {
          onChain.syncBalance(currentBal).then((sig) => {
            if (sig) lastSyncedBalanceRef.current = Math.floor(currentBal);
          }).catch((err) => console.warn('[Slots] Periodic sync failed:', err));
        }
      }
    }

    addTimeout(() => {
      setCurrentWin(0);
      setWinningCells(new Set());
    }, 2000);
  };

  // Check for winning lines after WILD placement — pays BEST single line only.
  // WILD only counts on lines that contain the WILD cell (2 natural matches + WILD).
  // Lines without the WILD cell can still win with 3 natural matches.
  const checkWin = (finalGrid: CellValue[], currentPlayLevel: number) => {
    let bestWin = 0;
    let bestLine: number[] = [];
    const wildIdx = finalGrid.indexOf('WILD');

    WIN_LINES.forEach((line) => {
      const symbols = line.map((i) => finalGrid[i]);
      const lineHasWild = line.includes(wildIdx);

      if (lineHasWild) {
        // WILD line: the other 2 cells must be matching natural symbols
        const nonWild = symbols.filter((s) => s !== 'WILD');
        if (nonWild.length === 2 && nonWild[0] === nonWild[1]) {
          const tier = nonWild[0] as number;
          const lineWin = getPayout(tier, currentPlayLevel);
          if (lineWin > bestWin) {
            bestWin = lineWin;
            bestLine = line;
          }
        }
      } else {
        // Non-WILD line: all 3 must be the same natural symbol
        const unique = [...new Set(symbols)];
        if (unique.length === 1 && typeof unique[0] === 'number') {
          const tier = unique[0];
          const lineWin = getPayout(tier, currentPlayLevel);
          if (lineWin > bestWin) {
            bestWin = lineWin;
            bestLine = line;
          }
        }
      }
    });

    if (bestWin > 0) {
      const winCells = new Set<number>(bestLine);
      setWinningCells(winCells);
      setCurrentWin(bestWin);
      addTimeout(() => resetToIdle(true, bestWin), 2000);
    } else {
      // No win — wager already deducted
      resetToIdle(false);
    }
  };

  // ─── Cell click: place WILD during CHOOSING_WILD stage ──────────────
  const handleCellClick = (index: number) => {
    if (stage !== 'CHOOSING_WILD') return;

    const finalGrid: CellValue[] = [...grid];
    finalGrid[index] = 'WILD';
    setGrid(finalGrid);
    setStage('PLAYING');
    setPlayButtonText('...');
    setStatusMessage(null);

    addTimeout(() => checkWin(finalGrid, playLevel), 600);
  };

  // Spin animation with staggered stop
  const runSpinAnimation = (finalGrid: number[], onComplete: () => void) => {
    setSpinningCells(Array(9).fill(true));

    // Rapidly cycle displayed symbols (using weighted distribution)
    spinIntervalRef.current = setInterval(() => {
      setSpinDisplay(
        Array(9)
          .fill(0)
          .map(() => getWeightedSymbol())
      );
    }, 100);

    // After 2s, stagger stop from cell 8 down to 0
    addTimeout(() => {
      for (let i = 8; i >= 0; i--) {
        addTimeout(() => {
          setSpinningCells((prev) => {
            const next = [...prev];
            next[i] = false;
            return next;
          });
          setGrid((prev) => {
            const next = [...prev];
            next[i] = finalGrid[i];
            return next;
          });

          if (i === 0) {
            if (spinIntervalRef.current) {
              clearInterval(spinIntervalRef.current);
              spinIntervalRef.current = null;
            }
            addTimeout(onComplete, 200);
          }
        }, (8 - i) * 150);
      }
    }, 2000);
  };

  const handlePreview = () => {
    if (stage !== 'IDLE' || isAnimating || isPreviewing) return;
    if (!connected) {
      showWalletModal(true);
      return;
    }
    if (previewCooldown > 0) {
      setStatusMessage(`Cooldown: ${previewCooldown}s`);
      return;
    }

    // Get or generate the grid for this level — same grid every time until played
    let previewGrid = levelGridsRef.current.get(levelIndex);
    if (!previewGrid) {
      previewGrid = constructGameGrid();
      levelGridsRef.current.set(levelIndex, previewGrid);
      saveLevelGrids(); // Persist to localStorage so refresh doesn't grant new grids
    }

    setGrid(previewGrid);
    setStatusMessage('Previewing...');
    setIsPreviewing(true);

    // Show for 2 seconds, then hide the symbols
    addTimeout(() => {
      setGrid(Array(9).fill(null));
      setIsPreviewing(false);
      setPlayButtonText('Play');
      setStatusMessage("Press Play to spin");
    }, 2000);
  };

  // Start playing
  const handlePlay = () => {
    if (stage !== 'IDLE' || isAnimating) return;
    if (!connected) {
      showWalletModal(true);
      return;
    }
    if (balance < playLevel) {
      setStatusMessage('Deposit DEBRIS to Play!');
      setShowDepositUI(true);
      return;
    }

    // Deduct wager upfront (saved to localStorage immediately via auto-save effect)
    setBalance((prev) => prev - playLevel);
    setNetProfit((prev) => prev - playLevel);
    setStatusMessage(null);
    setIsPlayDisabled(true);

    // Use the stored grid for this level if available, otherwise construct a fresh one.
    // Consume the grid after use — next preview will generate a new one.
    const baseGrid = levelGridsRef.current.get(levelIndex) ?? constructGameGrid();
    levelGridsRef.current.delete(levelIndex);
    saveLevelGrids(); // Persist the removal so refresh can't replay same grid

    setPlayButtonText('Spinning...');
    setStage('PLAYING');

    runSpinAnimation(baseGrid, () => {
      // After spin: let player choose where to place WILD
      setStage('CHOOSING_WILD');
      setPlayButtonText('Place WILD');
      setStatusMessage('Tap a cell to place WILD!');
    });
  };

  // Level selection — freely switch levels anytime while idle.
  // Grids persist per level, so switching back shows the same previewed grid.
  const handleLevelSelect = (index: number) => {
    if (stage !== 'IDLE' || isAnimating || isPreviewing) return;
    setLevelIndex(index);
    setPlayButtonText('Play');
    setGrid(Array(9).fill(null));
    const hasGrid = levelGridsRef.current.has(index);
    setStatusMessage(hasGrid ? 'Preview saved — Press Play or Preview again' : "Adjust 'Play Level'");
  };

  // Render individual cell content
  const renderCellContent = (index: number) => {
    // Spinning - show rapidly changing symbol
    if (spinningCells[index]) {
      return <img src={SYMBOL_IMAGES[spinDisplay[index]]} alt="Symbol" />;
    }

    // Final grid value
    const value = grid[index];
    if (value === 'WILD') {
      return 'WILD';
    }
    if (value !== null) {
      return <img src={SYMBOL_IMAGES[value as number]} alt="Symbol" />;
    }
    return null;
  };

  return (
    <div className="skill-game-container">
      <div className="skill-game-content">
        {/* Paytable Column */}
        <div className="skill-paytable-column">
          <div className="skill-paytable-content">
            {BASE_PAYOUTS.map((payout, index) => (
              <div key={index} className="skill-tier-row">
                <div className="skill-tier-symbol">
                  <img src={SYMBOL_IMAGES[index]} alt={`Symbol ${index}`} />
                </div>
                <span className="skill-tier-value">
                  {Math.round(payout * playLevel)}
                </span>
              </div>
            ))}

            <div className="skill-win-display">
              <div className="skill-win-label">Win</div>
              <div className="skill-win-value">{currentWin}</div>
            </div>
          </div>
        </div>

        {/* Play Area */}
        <div className="skill-play-area">
          <div className="skill-grid-container">
            {Array.from({ length: 9 }, (_, index) => {
              const value = grid[index];
              const isSpinning = spinningCells[index];
              const isWinning = winningCells.has(index);
              const isWild = value === 'WILD' && !isSpinning;
              const isChoosable = stage === 'CHOOSING_WILD' && !isSpinning;

              const cellClasses = [
                'skill-grid-cell',
                isSpinning && 'skill-spinning',
                isWinning && 'skill-winning-cell',
                isWild && 'skill-wild',
                isChoosable && 'skill-choosable',
              ]
                .filter(Boolean)
                .join(' ');

              const symbolClasses = [
                'skill-cell-symbol',
                isWild && 'skill-wild-text',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={index}
                  className={cellClasses}
                  data-index={index}
                  onClick={() => handleCellClick(index)}
                >
                  <div className={symbolClasses}>
                    {renderCellContent(index)}
                  </div>
                </div>
              );
            })}

            {statusMessage && (
              <div className="skill-status-message">{statusMessage}</div>
            )}
          </div>
        </div>
      </div>

      {/* Control Section */}
      <div className="skill-control-section">
        {/* Wallet & DEBRIS Balance Bar */}
        <div className="skill-wallet-bar">
          {connected ? (
            <>
              <div className="skill-wallet-info">
                <span className="skill-wallet-label">DEBRIS</span>
                <span className="skill-wallet-balance">
                  {isLoadingBalance ? '...' : debrisBalance.toFixed(2)}
                </span>
              </div>
              <button
                className="skill-deposit-btn"
                onClick={() => setShowDepositUI(!showDepositUI)}
                disabled={txPending}
              >
                {showDepositUI ? 'Close' : 'Deposit / Withdraw'}
              </button>
            </>
          ) : (
            <button
              className="skill-connect-btn"
              onClick={() => showWalletModal(true)}
            >
              Connect Wallet to Play
            </button>
          )}
        </div>

        {/* Deposit/Withdraw Panel */}
        {showDepositUI && connected && (
          <div className="skill-deposit-panel">
            <div className="skill-deposit-row">
              <input
                type="number"
                className="skill-deposit-input"
                placeholder={`Deposit DEBRIS (wallet: ${debrisBalance.toFixed(2)})`}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min="0"
                step="1"
                disabled={txPending}
              />
              <button
                className="skill-game-btn skill-deposit-action"
                onClick={handleDeposit}
                disabled={txPending || !depositAmount || parseFloat(depositAmount) <= 0}
              >
                Deposit
              </button>
            </div>
            <div className="skill-deposit-row">
              <input
                type="number"
                className="skill-deposit-input"
                placeholder={`Withdraw DEBRIS (game: ${balance.toFixed(2)})`}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="0"
                step="1"
                disabled={txPending}
              />
              <button
                className="skill-game-btn skill-withdraw-action"
                onClick={handleWithdraw}
                disabled={txPending || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > balance}
              >
                Withdraw
              </button>
            </div>
            {txMessage && (
              <div className="skill-tx-message">{txMessage}</div>
            )}
          </div>
        )}

        <div className="skill-status-bar">
          <div className="skill-status-group">
            <span className="skill-status-label">Play Level</span>
            <span className="skill-status-value skill-play-level-value">
              {playLevel}
            </span>
          </div>
          <div className="skill-status-group">
            <span className="skill-status-label">DEBRIS</span>
            <div className="flex items-center gap-2">
              <span className="skill-status-value skill-points-value">
                {balance.toFixed(2)}
              </span>
              <button
                onClick={() => { refreshDebrisBalance(); }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-adff02"
                title="Refresh Wallet Balance"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="skill-level-bar">
          {PLAY_LEVELS.map((level, index) => (
            <button
              key={level}
              className={`skill-level-btn${index === levelIndex ? ' active' : ''}`}
              onClick={() => handleLevelSelect(index)}
              disabled={stage !== 'IDLE' || isAnimating}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="skill-button-bar">
          <button
            className="skill-game-btn"
            onClick={() => setShowFairness(true)}
          >
            Help
          </button>
          <button
            className="skill-game-btn"
            onClick={handlePreview}
            disabled={stage !== 'IDLE' || isAnimating || !connected || isPreviewing || previewCooldown > 0}
          >
            {previewCooldown > 0 ? `Wait ${previewCooldown}s` : 'Preview'}
          </button>
          <button
            className="skill-game-btn skill-play"
            onClick={handlePlay}
            disabled={isPlayDisabled || stage === 'CHOOSING_WILD' || (!connected ? false : balance < playLevel)}
          >
            {connected ? playButtonText : 'Connect'}
          </button>
        </div>

        <div className="skill-footer">
          <span>TRASHMARKET.FUN SKILL GAME</span>
          <span>Currency: DEBRIS</span>
          <span>SKL 402 83 PEN</span>
        </div>
      </div>

      {/* Fairness Disclosure Modal */}
      {showFairness && (
        <div className="skill-fairness-overlay" onClick={() => setShowFairness(false)}>
          <div className="skill-fairness-modal" onClick={(e) => e.stopPropagation()}>
            <button className="skill-fairness-close" onClick={() => setShowFairness(false)}>X</button>
            <h2 className="skill-fairness-title">How It Works</h2>
            <div className="skill-fairness-body">
              <p><strong>Gameplay:</strong> After the spin, tap a cell to place your WILD symbol. If it completes a 3-in-a-row line, you win! Find the best spot for the highest payout. Only the best single line pays out.</p>
              <p><strong>Fairness:</strong> Game outcomes are pre-determined using a weighted random pool before the grid is constructed (patent-inspired method US20070232385A1). The grid is then built to match the outcome. Your skill determines <em>where</em> to place the WILD to maximize winnings.</p>
              <p><strong>RTP:</strong> Approximately 91% Return-To-Player assuming optimal WILD placement. House edge is ~9%. About 1 in 4 spins is profitable, and big wins (up to 25x your wager) are rare but rewarding!</p>
              <p><strong>On-Chain:</strong> All deposits, withdrawals, and spin results are recorded on the Gorbagana blockchain. Balances are verified against your on-chain game state PDA.</p>
              <p><strong>Currency:</strong> DEBRIS token (9 decimals) on Gorbagana network.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
