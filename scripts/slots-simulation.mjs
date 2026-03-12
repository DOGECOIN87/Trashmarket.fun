/**
 * Slots Skill Game — Monte Carlo RTP Simulation
 * Patent-inspired controlled grid construction (US20070232385A1)
 *
 * Outcome is pre-determined, then grid is constructed to match.
 * Player skill: find the optimal WILD placement on the revealed grid.
 *
 * Usage: node scripts/slots-simulation.mjs [rounds] [strategy]
 *   rounds:   number of rounds to simulate (default: 1,000,000)
 *   strategy: "optimal" | "random" | "worst" (default: optimal)
 */

// ─── Constants (mirrored from SkillGame.tsx) ─────────────────────────

const BASE_PAYOUTS = [30, 10, 5, 3, 2.2, 1.7, 1.2, 0.7, 0.4];
const GRID_WEIGHTS = [3, 5, 8, 11, 13, 15, 17, 19, 20];
const GRID_TOTAL_WEIGHT = GRID_WEIGHTS.reduce((a, b) => a + b, 0);
const PLAY_LEVELS = [10, 25, 50, 100, 250];

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

// Outcome pool (controls RTP ≈ 90%)
const OUTCOME_POOL = [
  { tier: -1, weight: 257 }, // 25.7% LOSS
  { tier: 8,  weight: 300 }, // 30.0% → 0.4x
  { tier: 7,  weight: 150 }, // 15.0% → 0.7x
  { tier: 6,  weight: 120 }, // 12.0% → 1.2x
  { tier: 5,  weight: 65 },  //  6.5% → 1.7x
  { tier: 4,  weight: 50 },  //  5.0% → 2.2x
  { tier: 3,  weight: 30 },  //  3.0% → 3.0x
  { tier: 2,  weight: 20 },  //  2.0% → 5.0x
  { tier: 1,  weight: 6 },   //  0.6% → 10x
  { tier: 0,  weight: 2 },   //  0.2% → 30x
];
const OUTCOME_TOTAL = OUTCOME_POOL.reduce((s, o) => s + o.weight, 0);

// Pre-computed: pairs of cells sharing a win line (24 pairs)
const LINE_PARTNER_PAIRS = (() => {
  const pairs = [];
  const seen = new Set();
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

// ─── Weighted random symbol ──────────────────────────────────────────

function getWeightedSymbol() {
  let r = Math.random() * GRID_TOTAL_WEIGHT;
  for (let i = 0; i < GRID_WEIGHTS.length; i++) {
    r -= GRID_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return GRID_WEIGHTS.length - 1;
}

function generateGrid() {
  return Array.from({ length: 9 }, () => getWeightedSymbol());
}

// ─── Outcome rolling ────────────────────────────────────────────────

function rollOutcome() {
  let r = Math.random() * OUTCOME_TOTAL;
  for (const o of OUTCOME_POOL) {
    r -= o.weight;
    if (r <= 0) return o.tier;
  }
  return -1;
}

// ─── Grid construction ──────────────────────────────────────────────

function constructLossGrid() {
  for (let attempt = 0; attempt < 500; attempt++) {
    const grid = generateGrid();
    let ok = true;
    for (const [a, b] of LINE_PARTNER_PAIRS) {
      if (grid[a] === grid[b]) { ok = false; break; }
    }
    if (ok) return grid;
  }
  // Fallback: all unique
  const syms = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 8; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [syms[i], syms[j]] = [syms[j], syms[i]];
  }
  return syms;
}

function constructWinGrid(winTier) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const winPos = Math.floor(Math.random() * 9);
    const linesThrough = WIN_LINES.filter(l => l.includes(winPos));
    const winLine = linesThrough[Math.floor(Math.random() * linesThrough.length)];
    const partners = winLine.filter(c => c !== winPos);

    const grid = generateGrid();
    grid[partners[0]] = winTier;
    grid[partners[1]] = winTier;
    if (grid[winPos] === winTier) {
      grid[winPos] = (winTier + 1 + Math.floor(Math.random() * 8)) % 9;
    }

    // Reject natural 3-of-a-kind
    let bad = false;
    for (const line of WIN_LINES) {
      if (grid[line[0]] === grid[line[1]] && grid[line[1]] === grid[line[2]]) {
        bad = true; break;
      }
    }
    if (bad) continue;

    // CRITICAL: Ensure OTHER lines through winPos don't have matching partners
    let winPosClean = true;
    for (const line of linesThrough) {
      if (line === winLine) continue;
      const others = line.filter(c => c !== winPos);
      if (grid[others[0]] === grid[others[1]]) {
        winPosClean = false; break;
      }
    }
    if (!winPosClean) continue;

    // Check no other position creates a better payout
    let bestOther = 0;
    for (let pos = 0; pos < 9; pos++) {
      if (pos === winPos) continue;
      for (const line of WIN_LINES) {
        if (!line.includes(pos)) continue;
        const others = line.filter(c => c !== pos);
        if (grid[others[0]] === grid[others[1]]) {
          bestOther = Math.max(bestOther, BASE_PAYOUTS[grid[others[0]]]);
        }
      }
    }
    if (BASE_PAYOUTS[winTier] >= bestOther) return { grid, winPosition: winPos };
  }

  // Fallback
  const syms = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 8; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [syms[i], syms[j]] = [syms[j], syms[i]];
  }
  const winPos = Math.floor(Math.random() * 9);
  const line = WIN_LINES.filter(l => l.includes(winPos))[0];
  const partners = line.filter(c => c !== winPos);
  syms[partners[0]] = winTier;
  syms[partners[1]] = winTier;
  if (syms[winPos] === winTier) syms[winPos] = (winTier + 1) % 9;
  return { grid: syms, winPosition: winPos };
}

function constructGameGrid() {
  const tier = rollOutcome();
  if (tier === -1) return { grid: constructLossGrid(), winPosition: -1, tier: -1 };
  const { grid, winPosition } = constructWinGrid(tier);
  return { grid, winPosition, tier };
}

// ─── Win evaluation ──────────────────────────────────────────────────

function evaluateWin(grid, wildIndex, wager) {
  const finalGrid = [...grid];
  finalGrid[wildIndex] = 'WILD';
  let bestWin = 0;

  for (const line of WIN_LINES) {
    const symbols = line.map(i => finalGrid[i]);
    const lineHasWild = line.includes(wildIndex);
    let lineWin = 0;

    if (lineHasWild) {
      const nonWild = symbols.filter(s => s !== 'WILD');
      if (nonWild.length === 2 && nonWild[0] === nonWild[1]) {
        lineWin = Math.round(BASE_PAYOUTS[nonWild[0]] * wager);
      }
    } else {
      const unique = [...new Set(symbols)];
      if (unique.length === 1 && typeof unique[0] === 'number') {
        lineWin = Math.round(BASE_PAYOUTS[unique[0]] * wager);
      }
    }
    if (lineWin > bestWin) bestWin = lineWin;
  }
  return bestWin;
}

// ─── Player strategies ───────────────────────────────────────────────

function findBestWildPlacement(grid, wager) {
  let bestWin = 0;
  let bestCell = 0;
  for (let i = 0; i < 9; i++) {
    const win = evaluateWin(grid, i, wager);
    if (win > bestWin) { bestWin = win; bestCell = i; }
  }
  return { bestCell, bestWin };
}

function findRandomPlacement(grid, wager) {
  const cell = Math.floor(Math.random() * 9);
  return { bestCell: cell, bestWin: evaluateWin(grid, cell, wager) };
}

// ─── Run simulation ──────────────────────────────────────────────────

function simulate(rounds, strategy = 'optimal') {
  const results = {
    totalWagered: 0, totalReturned: 0, wins: 0, totalLosses: 0,
    biggestWin: 0, biggestWinMultiplier: 0, winDistribution: {},
    lossGrids: 0, winGrids: 0, playerFoundWin: 0, playerMissedWin: 0,
  };

  const levelResults = PLAY_LEVELS.map(level => ({
    level, wagered: 0, returned: 0, rounds: 0, wins: 0,
  }));

  for (let r = 0; r < rounds; r++) {
    const levelIdx = r % PLAY_LEVELS.length;
    const wager = PLAY_LEVELS[levelIdx];

    // Construct outcome-controlled grid
    const { grid, winPosition, tier } = constructGameGrid();

    if (tier === -1) {
      results.lossGrids++;
    } else {
      results.winGrids++;
    }

    // Player places WILD
    let win;
    if (strategy === 'optimal') {
      // Optimal player scans all positions
      win = findBestWildPlacement(grid, wager).bestWin;
    } else if (strategy === 'random') {
      // Random placement
      win = findRandomPlacement(grid, wager).bestWin;
    } else {
      // Worst case
      win = 0;
    }

    // Track whether player found the intended win
    if (tier !== -1) {
      if (win > 0) results.playerFoundWin++;
      else results.playerMissedWin++;
    }

    results.totalWagered += wager;
    levelResults[levelIdx].wagered += wager;
    levelResults[levelIdx].rounds++;

    if (win > 0) {
      results.totalReturned += win;
      results.wins++;
      levelResults[levelIdx].returned += win;
      levelResults[levelIdx].wins++;

      const multiplier = win / wager;
      if (win > results.biggestWin) {
        results.biggestWin = win;
        results.biggestWinMultiplier = multiplier;
      }

      const bucket = multiplier >= 10 ? '10x+' :
                     multiplier >= 5 ? '5-10x' :
                     multiplier >= 2 ? '2-5x' :
                     multiplier >= 1 ? '1-2x' : '<1x';
      results.winDistribution[bucket] = (results.winDistribution[bucket] || 0) + 1;
    } else {
      results.totalLosses++;
    }
  }

  return { results, levelResults };
}

// ─── Theoretical RTP calculation ─────────────────────────────────────

function calculateTheoreticalRTP() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  THEORETICAL RTP (Outcome Pool Analysis)');
  console.log('══════════════════════════════════════════════════════\n');

  let totalRTP = 0;
  console.log('  Outcome      | Prob%  | Payout | RTP Contribution');
  console.log('  ─────────────|────────|────────|─────────────────');

  for (const o of OUTCOME_POOL) {
    const prob = o.weight / OUTCOME_TOTAL;
    const pct = (prob * 100).toFixed(1);
    if (o.tier === -1) {
      console.log(`  LOSS          | ${pct.padStart(5)}% |   0.0x |   0.000%`);
    } else {
      const payout = BASE_PAYOUTS[o.tier];
      const contribution = prob * payout;
      totalRTP += contribution;
      console.log(`  Tier ${o.tier} (${payout.toString().padEnd(4)}x) | ${pct.padStart(5)}% | ${payout.toFixed(1).padStart(5)}x | ${(contribution * 100).toFixed(3).padStart(7)}%`);
    }
  }

  console.log('  ─────────────|────────|────────|─────────────────');
  console.log(`  TOTAL RTP (optimal play):          ${(totalRTP * 100).toFixed(2)}%`);
  console.log(`  House Edge (optimal play):         ${((1 - totalRTP) * 100).toFixed(2)}%`);

  return totalRTP;
}

// ─── Grid construction analysis ──────────────────────────────────────

function analyzeGridConstruction(samples = 100000) {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  GRID CONSTRUCTION ANALYSIS');
  console.log(`  Samples: ${samples.toLocaleString()}`);
  console.log('══════════════════════════════════════════════════════\n');

  let lossGridFallbacks = 0;
  let winGridFallbacks = 0;
  let lossAttempts = 0;
  let winAttempts = 0;

  // Test LOSS grid construction success rate
  for (let i = 0; i < samples; i++) {
    const grid = generateGrid();
    let ok = true;
    for (const [a, b] of LINE_PARTNER_PAIRS) {
      if (grid[a] === grid[b]) { ok = false; break; }
    }
    if (ok) lossAttempts++;
  }

  console.log(`  Random grids that qualify as LOSS: ${(lossAttempts / samples * 100).toFixed(1)}%`);
  console.log(`  (≈${Math.ceil(samples / lossAttempts)} attempts needed on avg for LOSS grid)`);

  // Test optimal player detection rate on WIN grids
  let detected = 0;
  const testRounds = Math.min(samples, 50000);
  for (let i = 0; i < testRounds; i++) {
    const tier = OUTCOME_POOL[1 + Math.floor(Math.random() * 9)].tier; // random win tier
    const { grid, winPosition } = constructWinGrid(tier);
    const { bestCell } = findBestWildPlacement(grid, 100);
    // Did optimal player find a winning position?
    const win = evaluateWin(grid, bestCell, 100);
    if (win > 0) detected++;
  }

  console.log(`  Optimal player finds win on WIN grids: ${(detected / testRounds * 100).toFixed(1)}%`);
}

// ─── Main ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const ROUNDS = parseInt(args[0]) || 1_000_000;

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║   TRASHMARKET.FUN SLOTS — PATENT-BASED SIMULATION  ║');
console.log('║   Controlled Grid Construction (US20070232385A1)   ║');
console.log('╚══════════════════════════════════════════════════════╝');

// 1. Theoretical RTP
const theoreticalRTP = calculateTheoreticalRTP();

// 2. Grid construction analysis
analyzeGridConstruction();

// 3. Full simulation — optimal player + random player
console.log('\n══════════════════════════════════════════════════════');
console.log(`  MONTE CARLO SIMULATION — ${ROUNDS.toLocaleString()} ROUNDS`);
console.log('══════════════════════════════════════════════════════');

for (const strat of ['optimal', 'random']) {
  const { results, levelResults } = simulate(ROUNDS, strat);

  const rtp = (results.totalReturned / results.totalWagered * 100).toFixed(2);
  const houseEdge = (100 - parseFloat(rtp)).toFixed(2);
  const winRate = (results.wins / ROUNDS * 100).toFixed(2);

  console.log(`\n─── Player Strategy: ${strat.toUpperCase()} ───`);
  console.log(`  RTP:                  ${rtp}%`);
  console.log(`  House Edge:           ${houseEdge}%`);
  console.log(`  Win Rate:             ${winRate}%`);
  console.log(`  Loss Rate:            ${(100 - parseFloat(winRate)).toFixed(2)}%`);
  console.log(`  LOSS grids dealt:     ${results.lossGrids.toLocaleString()} (${(results.lossGrids/ROUNDS*100).toFixed(1)}%)`);
  console.log(`  WIN grids dealt:      ${results.winGrids.toLocaleString()} (${(results.winGrids/ROUNDS*100).toFixed(1)}%)`);
  if (results.winGrids > 0) {
    console.log(`  Player found win:     ${results.playerFoundWin.toLocaleString()} / ${results.winGrids.toLocaleString()} (${(results.playerFoundWin/results.winGrids*100).toFixed(1)}%)`);
    console.log(`  Player missed win:    ${results.playerMissedWin.toLocaleString()} / ${results.winGrids.toLocaleString()} (${(results.playerMissedWin/results.winGrids*100).toFixed(1)}%)`);
  }
  console.log(`  Total Wagered:        ${results.totalWagered.toLocaleString()} DEBRIS`);
  console.log(`  Total Returned:       ${results.totalReturned.toLocaleString()} DEBRIS`);
  console.log(`  House Profit:         ${(results.totalWagered - results.totalReturned).toLocaleString()} DEBRIS`);
  console.log(`  Biggest Win:          ${results.biggestWin.toLocaleString()} DEBRIS (${results.biggestWinMultiplier.toFixed(1)}x)`);

  if (Object.keys(results.winDistribution).length > 0) {
    console.log('\n  Win Distribution:');
    for (const [bucket, count] of Object.entries(results.winDistribution).sort()) {
      const pct = (count / results.wins * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(parseFloat(pct) / 2));
      console.log(`    ${bucket.padEnd(6)} ${String(count).padStart(8)} (${pct.padStart(5)}%) ${bar}`);
    }
  }

  console.log('\n  Per-Level Breakdown:');
  console.log('  Level | Wagered       | Returned      | RTP     | House Profit');
  console.log('  ──────|───────────────|───────────────|─────────|─────────────');
  for (const lr of levelResults) {
    const lrtp = (lr.returned / lr.wagered * 100).toFixed(2);
    const profit = lr.wagered - lr.returned;
    console.log(`  ${String(lr.level).padStart(5)} | ${lr.wagered.toLocaleString().padStart(13)} | ${lr.returned.toLocaleString().padStart(13)} | ${lrtp.padStart(6)}% | ${profit.toLocaleString().padStart(11)}`);
  }
}

// 4. Profit projections
console.log('\n══════════════════════════════════════════════════════');
console.log('  PROFIT PROJECTIONS');
console.log('══════════════════════════════════════════════════════\n');

const { results: optResults } = simulate(ROUNDS, 'optimal');
const optRTP = optResults.totalReturned / optResults.totalWagered;
const optHouseEdge = 1 - optRTP;

const scenarios = [
  { label: '100 players × 50 rounds/day × 50 avg wager', dailyVolume: 100 * 50 * 50 },
  { label: '500 players × 50 rounds/day × 50 avg wager', dailyVolume: 500 * 50 * 50 },
  { label: '1000 players × 100 rounds/day × 75 avg wager', dailyVolume: 1000 * 100 * 75 },
];

console.log(`  House Edge (optimal players): ${(optHouseEdge * 100).toFixed(2)}%`);
console.log(`  (Random players → even higher profit)\n`);

console.log('  Scenario                                        | Daily Volume  | Daily Profit | Monthly Profit');
console.log('  ────────────────────────────────────────────────|───────────────|──────────────|──────────────');
for (const s of scenarios) {
  const dailyProfit = Math.round(s.dailyVolume * optHouseEdge);
  const monthlyProfit = dailyProfit * 30;
  console.log(`  ${s.label.padEnd(48)} | ${s.dailyVolume.toLocaleString().padStart(13)} | ${dailyProfit.toLocaleString().padStart(12)} | ${monthlyProfit.toLocaleString().padStart(12)}`);
}

// 5. Variance analysis
console.log('\n══════════════════════════════════════════════════════');
console.log('  VARIANCE & RISK ANALYSIS');
console.log('══════════════════════════════════════════════════════\n');

const SESSION_ROUNDS = 100;
const NUM_SESSIONS = 10000;
let sessionProfits = [];

for (let s = 0; s < NUM_SESSIONS; s++) {
  const { results: sr } = simulate(SESSION_ROUNDS, 'optimal');
  const profit = sr.totalWagered - sr.totalReturned;
  sessionProfits.push(profit);
}

sessionProfits.sort((a, b) => a - b);
const mean = sessionProfits.reduce((a, b) => a + b, 0) / NUM_SESSIONS;
const variance = sessionProfits.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / NUM_SESSIONS;
const stdDev = Math.sqrt(variance);
const worstSession = sessionProfits[0];
const bestSession = sessionProfits[NUM_SESSIONS - 1];
const p5 = sessionProfits[Math.floor(NUM_SESSIONS * 0.05)];
const p95 = sessionProfits[Math.floor(NUM_SESSIONS * 0.95)];
const losingSessions = sessionProfits.filter(p => p < 0).length;

console.log(`  Per ${SESSION_ROUNDS}-round session (optimal player):`);
console.log(`  Mean house profit:      ${mean.toFixed(0)} DEBRIS`);
console.log(`  Std deviation:          ${stdDev.toFixed(0)} DEBRIS`);
console.log(`  Best session (house):   ${bestSession.toLocaleString()} DEBRIS profit`);
console.log(`  Worst session (house):  ${worstSession.toLocaleString()} DEBRIS (${worstSession < 0 ? 'LOSS' : 'profit'})`);
console.log(`  5th percentile:         ${p5.toLocaleString()} DEBRIS`);
console.log(`  95th percentile:        ${p95.toLocaleString()} DEBRIS`);
console.log(`  Sessions where house loses: ${losingSessions} / ${NUM_SESSIONS} (${(losingSessions/NUM_SESSIONS*100).toFixed(1)}%)`);
console.log(`\n  Recommended treasury reserve: ${Math.abs(Math.min(worstSession * 3, -10000)).toLocaleString()} DEBRIS`);

console.log('\n══════════════════════════════════════════════════════');
console.log('  SIMULATION COMPLETE');
console.log('══════════════════════════════════════════════════════\n');
