import React, { useState, useEffect, useRef, useCallback } from 'react';
import './BonusRound.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID_COLS      = 5;
const GRID_ROWS      = 4;
const GRID_SIZE      = GRID_COLS * GRID_ROWS; // 20 cells
const BASE_SPINS     = 5;   // low on purpose — blackout is hard without buying more spins
const CELLS_PER_SPIN = 2;   // 2 random cells revealed per spin → needs ~10+ for blackout
const CYCLE_MS       = 95;
const AUTO_STOP_MS   = 3500;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const getAmounts = (playLevel: number): number[] => {
  const mults = [0.5, 1, 2, 5, 10, 25, 50, 100];
  return [...new Set(mults.map(m => Math.round(playLevel * m)))];
};

const getTier = (idx: number, total: number): string => {
  const r = idx / (total - 1);
  if (r >= 0.875) return 'c-jackpot';
  if (r >= 0.625) return 'c-high';
  if (r >= 0.375) return 'c-mid';
  return 'c-low';
};

const EXTRA_COSTS = [3, 5, 7, 9];

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  playLevel: number;
  onClose: (totalWin: number) => void;
}

export default function BonusRound({ playLevel, onClose }: Props) {
  const amounts = getAmounts(playLevel);
  const amtLen  = amounts.length;
  const randAmt = () => amounts[Math.floor(Math.random() * amtLen)];

  const jackpots = [
    { name: 'MINOR', val: amounts[0],                          color: '#888' },
    { name: 'MEGA',  val: amounts[Math.floor(amtLen * 0.35)], color: '#adff02' },
    { name: 'GRAND', val: amounts[amtLen - 1],                color: '#ffd700', grand: true },
    { name: 'MAJOR', val: amounts[Math.floor(amtLen * 0.65)], color: '#ff6b35' },
    { name: 'MINI',  val: amounts[Math.min(1, amtLen - 1)],   color: '#888' },
  ];

  // ── State ────────────────────────────────────────────────────────────────────
  const [started,       setStarted]       = useState(false);
  const [spinsLeft,     setSpinsLeft]     = useState(BASE_SPINS);
  const [totalWin,      setTotalWin]      = useState(0);
  const [bonusDone,     setBonusDone]     = useState(false);
  const [blackout,      setBlackout]      = useState(false);
  const [blackoutBonus, setBlackoutBonus] = useState(0);
  const [roundWin,      setRoundWin]      = useState<number | null>(null);
  const [activeCells,   setActiveCells]   = useState<number[]>([]); // currently spinning

  const [cellVals,   setCellVals]   = useState<number[]>(Array(GRID_SIZE).fill(0));
  const [cellKeys,   setCellKeys]   = useState<number[]>(Array(GRID_SIZE).fill(0));
  const [cellLocked, setCellLocked] = useState<boolean[]>(Array(GRID_SIZE).fill(false));
  const [tapStop,    setTapStop]    = useState<boolean[]>(Array(GRID_SIZE).fill(false));

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const spinsRef       = useRef(BASE_SPINS);
  const winRef         = useRef(0);
  const activeCellsRef = useRef<number[]>([]);
  const lockedRef      = useRef<boolean[]>(Array(GRID_SIZE).fill(false));
  const valsRef        = useRef<number[]>(Array(GRID_SIZE).fill(0));
  const cycleRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRefs      = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    cycleRef.current && clearInterval(cycleRef.current);
    autoRef.current  && clearTimeout(autoRef.current);
    timerRefs.current.forEach(clearTimeout);
  }, []);

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timerRefs.current.push(t);
  };

  // Pick CELLS_PER_SPIN unrevealed cells at random
  const pickCells = (): number[] => {
    const pool = Array.from({ length: GRID_SIZE }, (_, i) => i)
      .filter(i => !lockedRef.current[i]);
    const count = Math.min(CELLS_PER_SPIN, pool.length);
    const picked: number[] = [];
    const copy = [...pool];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(idx, 1)[0]);
    }
    return picked;
  };

  // ── Stop the active spin ──────────────────────────────────────────────────────
  const stopSpin = useCallback((byTap: boolean) => {
    if (activeCellsRef.current.length === 0) return;

    cycleRef.current && clearInterval(cycleRef.current);
    autoRef.current  && clearTimeout(autoRef.current);
    cycleRef.current = null;
    autoRef.current  = null;

    const cells = [...activeCellsRef.current];
    activeCellsRef.current = [];
    setActiveCells([]);

    // Lock cells
    const newLocked = [...lockedRef.current];
    cells.forEach(i => { newLocked[i] = true; });
    lockedRef.current = newLocked;
    setCellLocked([...newLocked]);

    // Trigger landing animation via key bump
    setCellKeys(prev => { const n = [...prev]; cells.forEach(i => n[i]++); return n; });
    if (byTap) {
      setTapStop(prev => { const n = [...prev]; cells.forEach(i => { n[i] = true; }); return n; });
    }

    const spinWin = cells.reduce((s, i) => s + valsRef.current[i], 0);
    winRef.current += spinWin;
    setTotalWin(winRef.current);
    setRoundWin(spinWin);

    const allFilled = newLocked.every(Boolean);

    later(() => {
      setRoundWin(null);

      if (allFilled) {
        const bonus = Math.round(winRef.current * 0.5); // +50% blackout bonus
        setBlackoutBonus(bonus);
        winRef.current += bonus;
        setTotalWin(winRef.current);
        setBlackout(true);
        later(() => setBonusDone(true), 3200);
        return;
      }

      const remaining = spinsRef.current - 1;
      spinsRef.current = remaining;
      setSpinsLeft(remaining);

      if (remaining <= 0) {
        later(() => setBonusDone(true), 600);
      } else {
        later(() => fireNextSpin(), 700);
      }
    }, 1200);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start a spin: pick 2 random unrevealed cells ──────────────────────────────
  const fireNextSpin = useCallback(() => {
    const cells = pickCells();
    if (cells.length === 0) {
      later(() => setBonusDone(true), 400);
      return;
    }

    activeCellsRef.current = cells;
    setActiveCells([...cells]);
    setTapStop(prev => { const n = [...prev]; cells.forEach(i => { n[i] = false; }); return n; });

    cycleRef.current = setInterval(() => {
      const newVals = [...valsRef.current];
      cells.forEach(i => {
        newVals[i] = randAmt();
        valsRef.current[i] = newVals[i];
      });
      setCellVals([...newVals]);
      setCellKeys(prev => { const n = [...prev]; cells.forEach(i => n[i]++); return n; });
    }, CYCLE_MS);

    autoRef.current = setTimeout(() => stopSpin(false), AUTO_STOP_MS);
  }, [amounts, stopSpin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGridTap = () => {
    if (activeCellsRef.current.length > 0) stopSpin(true);
  };

  const handleStart = () => {
    if (started) return;
    setStarted(true);
    fireNextSpin();
  };

  const handleAddSpins = (count: number) => {
    const cost = playLevel * EXTRA_COSTS[count - 1];
    if (winRef.current < cost) return;
    winRef.current -= cost;
    setTotalWin(winRef.current);
    const newTotal = spinsRef.current + count;
    spinsRef.current = newTotal;
    setSpinsLeft(newTotal);
    if (bonusDone && !blackout) {
      setBonusDone(false);
      later(() => fireNextSpin(), 400);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="br-overlay">
      <div className="br-modal">

        {/* Jackpot Bar */}
        <div className="br-jackpot-bar">
          {jackpots.map((j, i) => (
            <div key={i} className={`br-jp-tier${j.grand ? ' br-jp-grand' : ''}`}>
              <div className="br-jp-name">{j.name}</div>
              <div className="br-jp-val" style={{ color: j.color }}>{fmt(j.val)}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="br-body">

          {/* Left: machine counter + buy spins */}
          <div className="br-left">
            <div className="br-machine">
              <div className="br-machine-cap" />
              <div className="br-machine-screen">
                <span className="br-machine-num">{spinsLeft}</span>
              </div>
              <div className="br-machine-of">OF</div>
              <div className="br-machine-base"><span>SPINS</span></div>
            </div>

            {started && !bonusDone && (
              <div className="br-extra-spins">
                {[1, 2, 3, 4].map(n => {
                  const cost = playLevel * EXTRA_COSTS[n - 1];
                  return (
                    <button
                      key={n}
                      className="br-extra-btn"
                      onClick={() => handleAddSpins(n)}
                      disabled={winRef.current < cost}
                      title={`Cost: ${fmt(cost)}`}
                    >
                      <span className="br-extra-count">+{n}</span>
                      <span className="br-extra-cost">{fmt(cost)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Center: 5×4 grid */}
          <div className="br-grid-frame">
            <div
              className={`br-grid${activeCells.length > 0 ? ' br-grid-tappable' : ''}`}
              onClick={handleGridTap}
            >
              {Array.from({ length: GRID_SIZE }, (_, i) => {
                const isActive = activeCells.includes(i);
                const isLocked = cellLocked[i];
                const val      = cellVals[i];
                const amtIdx   = isLocked ? Math.max(0, amounts.indexOf(val)) : 0;
                const tier     = getTier(amtIdx >= 0 ? amtIdx : 0, amtLen);
                const wasTap   = tapStop[i];

                return (
                  <div
                    key={i}
                    className={[
                      'br-cell',
                      isActive  && 'br-cell-active',
                      isLocked  && 'br-cell-locked',
                    ].filter(Boolean).join(' ')}
                  >
                    {(isActive || isLocked) && (
                      <div
                        key={cellKeys[i]}
                        className={[
                          'br-chip', tier,
                          isActive             ? 'chip-spin'  : '',
                          isLocked && !wasTap  ? 'chip-land'  : '',
                          isLocked &&  wasTap  ? 'chip-snap'  : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <span>{fmt(val)}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {activeCells.length > 0 && (
                <div className="br-tap-hint">TAP TO STOP</div>
              )}

              {roundWin !== null && roundWin > 0 && (
                <div className="br-round-flash">+{fmt(roundWin)}</div>
              )}

              {blackout && (
                <div className="br-blackout-overlay">
                  <div className="br-blackout-text">BLACKOUT!</div>
                  <div className="br-blackout-bonus">+{fmt(blackoutBonus)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: start / collect */}
          <div className="br-right">
            {!bonusDone ? (
              <button
                className={`br-action-btn${started ? ' btn-active' : ''}`}
                onClick={handleStart}
                disabled={started}
              >
                <span>START</span>
                <span>BONUS</span>
              </button>
            ) : (
              <button
                className="br-action-btn btn-collect"
                onClick={() => onClose(totalWin)}
              >
                <span>COLLECT</span>
                <span className="btn-collect-val">{fmt(totalWin)}</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="br-status">
          <span>SPINS LEFT: <strong>{spinsLeft}</strong></span>
          <span className="br-status-sep">|</span>
          <span>TOTAL WIN: <strong>{fmt(totalWin)}</strong></span>
          <span className="br-status-sep">|</span>
          <span className="br-status-luck">GOOD LUCK!</span>
        </div>
      </div>
    </div>
  );
}
