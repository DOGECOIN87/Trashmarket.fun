import React, { useState, useEffect, useRef } from 'react';
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

// Payout multipliers per winning line (×wager). Common symbols pay sub-1x
// (partial recovery), rare symbols pay big. Tuned for ~90-93% RTP overall.
const BASE_PAYOUTS = [50, 12, 7, 4, 2.5, 1.8, 1.2, 0.8, 0.5];

// Weighted symbol frequency for grid generation. Alon is ultra-rare jackpot
// tier. Common symbols (high index) appear often but pay little.
const GRID_WEIGHTS = [1, 3, 5, 7, 10, 13, 16, 20, 25];
const GRID_TOTAL_WEIGHT = GRID_WEIGHTS.reduce((a, b) => a + b, 0);

// Fixed play levels (wager amounts) - players pick one of these
const PLAY_LEVELS = [10, 25, 50, 100, 250];

// Memory game consolation: 25% of wager returned (was 105% — guaranteed profit)
const MEMORY_RETURN = 0.25;

const MEMORY_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];

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

type Stage = 'IDLE' | 'PLAYING' | 'MEMORY';
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

export default function SkillGame() {
  // Core game state
  const [grid, setGrid] = useState<CellValue[]>(Array(9).fill(null));
  const [balance, setBalance] = useState(1000);
  const [levelIndex, setLevelIndex] = useState(0);
  const playLevel = PLAY_LEVELS[levelIndex];
  const [currentWin, setCurrentWin] = useState(0);
  const [stage, setStage] = useState<Stage>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string | null>(
    "Adjust 'Play Level'"
  );
  const [winningCells, setWinningCells] = useState<Set<number>>(new Set());
  const [previewShown, setPreviewShown] = useState(false);
  const [playButtonText, setPlayButtonText] = useState('Play');
  const [isPlayDisabled, setIsPlayDisabled] = useState(false);

  // Timer
  const [timerPercent, setTimerPercent] = useState(100);
  const [showTimer, setShowTimer] = useState(false);

  // Spin animation
  const [spinningCells, setSpinningCells] = useState<boolean[]>(
    Array(9).fill(false)
  );
  const [spinDisplay, setSpinDisplay] = useState<number[]>(
    Array(9)
      .fill(0)
      .map(() => Math.floor(Math.random() * 9))
  );

  // Memory game
  const [memorySequence, setMemorySequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [memoryFlash, setMemoryFlash] = useState<number | null>(null);
  const [acceptingMemoryInput, setAcceptingMemoryInput] = useState(false);

  // Refs for interval/timeout cleanup
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memoryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isAnimating = spinningCells.some(Boolean);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      if (memoryIntervalRef.current) clearInterval(memoryIntervalRef.current);
      timeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const addTimeout = (fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timeoutsRef.current.push(t);
    return t;
  };

  const clearGameTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Reset game to idle state
  const resetToIdle = (won: boolean, winAmount: number = 0) => {
    clearGameTimer();
    setShowTimer(false);
    setAcceptingMemoryInput(false);
    setStage('IDLE');
    setIsPlayDisabled(false);
    setPlayButtonText('Play');
    setPreviewShown(false);

    if (won && winAmount > 0) {
      setBalance((prev) => prev + winAmount);
      setCurrentWin(winAmount);
      setStatusMessage('You Win!');
    } else if (!won) {
      setStatusMessage('Try Again');
    }

    addTimeout(() => {
      setCurrentWin(0);
      setWinningCells(new Set());
    }, 2000);
  };

  // Timer - uses only setState inside interval (no stale closures)
  const startTimer = () => {
    clearGameTimer();
    let timerValue = 30;
    setShowTimer(true);
    setTimerPercent(100);

    timerIntervalRef.current = setInterval(() => {
      timerValue -= 0.1;
      setTimerPercent((timerValue / 30) * 100);

      if (timerValue <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        // Timer expired - lose (wager already deducted at game start)
        setShowTimer(false);
        setAcceptingMemoryInput(false);
        setStatusMessage('Try Again');
        setStage('IDLE');
        setIsPlayDisabled(false);
        setPlayButtonText('Play');
        setPreviewShown(false);
      }
    }, 100);
  };

  // Check for winning lines after WILD placement
  const checkWin = (finalGrid: CellValue[], currentPlayLevel: number) => {
    let totalWin = 0;
    const winCells = new Set<number>();

    WIN_LINES.forEach((line) => {
      const symbols = line.map((i) => finalGrid[i]);
      const unique = [...new Set(symbols)];

      if (unique.length === 1 && unique[0] !== null) {
        const tier = unique[0] === 'WILD' ? 0 : (unique[0] as number);
        totalWin += getPayout(tier, currentPlayLevel);
        line.forEach((i) => winCells.add(i));
      } else if (unique.length === 2 && unique.includes('WILD')) {
        const tier = unique.find((s) => s !== 'WILD') as number;
        totalWin += getPayout(tier, currentPlayLevel);
        line.forEach((i) => winCells.add(i));
      }
    });

    if (totalWin > 0) {
      setWinningCells(winCells);
      setCurrentWin(totalWin);
      addTimeout(() => resetToIdle(true, totalWin), 2000);
    } else {
      startMemoryGame();
    }
  };

  // Memory game
  const startMemoryGame = () => {
    const sequence = Array(5)
      .fill(0)
      .map(() => Math.floor(Math.random() * 9));
    setMemorySequence(sequence);
    setPlayerSequence([]);
    setStage('MEMORY');
    setStatusMessage('Watch the pattern...');

    let i = 0;
    memoryIntervalRef.current = setInterval(() => {
      if (i >= sequence.length) {
        if (memoryIntervalRef.current) clearInterval(memoryIntervalRef.current);
        setStatusMessage('Your turn!');
        setAcceptingMemoryInput(true);
        return;
      }
      setMemoryFlash(sequence[i]);
      addTimeout(() => setMemoryFlash(null), 400);
      i++;
    }, 800);
  };

  // Cell click - always has fresh closure since it's in JSX onClick
  const handleCellClick = (index: number) => {
    if (stage === 'PLAYING') {
      // Place WILD symbol
      clearGameTimer();
      setShowTimer(false);
      const newGrid = [...grid];
      newGrid[index] = 'WILD';
      setGrid(newGrid);
      checkWin(newGrid, playLevel);
    } else if (stage === 'MEMORY' && acceptingMemoryInput) {
      // Memory input
      setMemoryFlash(index);
      addTimeout(() => setMemoryFlash(null), 400);

      const newPlayerSeq = [...playerSequence, index];
      setPlayerSequence(newPlayerSeq);
      const currentIdx = newPlayerSeq.length - 1;

      if (newPlayerSeq[currentIdx] !== memorySequence[currentIdx]) {
        // Wrong sequence - lose (wager already deducted)
        resetToIdle(false);
        return;
      }

      if (newPlayerSeq.length === memorySequence.length) {
        // Completed sequence - consolation return
        const winAmount = Math.round(playLevel * MEMORY_RETURN);
        setAcceptingMemoryInput(false);
        setCurrentWin(winAmount);
        addTimeout(() => resetToIdle(true, winAmount), 1000);
      }
    }
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

  // Preview generates a unique grid per level so switching levels shows a different board
  const previewGridsRef = useRef<number[][] | null>(null);

  const handlePreview = () => {
    if (stage !== 'IDLE' || isAnimating) return;

    // Generate one grid per level
    const grids = PLAY_LEVELS.map(() => generateGrid());
    previewGridsRef.current = grids;
    setGrid(grids[levelIndex]);
    setStatusMessage('Memorize the board...');

    // Show for 2 seconds, then hide the symbols
    addTimeout(() => {
      setGrid(Array(9).fill(null));
      setPreviewShown(true);
      setPlayButtonText('Confirm');
      setStatusMessage('Select level & Press Play');
    }, 2000);
  };

  // Start playing
  const handlePlay = () => {
    if (stage !== 'IDLE' || isAnimating) return;
    if (balance < playLevel) {
      setStatusMessage('Insufficient Balance!');
      return;
    }

    // Deduct wager upfront
    setBalance((prev) => prev - playLevel);
    setStatusMessage(null);
    setIsPlayDisabled(true);

    if (previewShown && previewGridsRef.current) {
      // Reveal the stored preview grid for the current level and start playing
      const storedGrid = previewGridsRef.current[levelIndex];
      previewGridsRef.current = null;
      setGrid(storedGrid);
      setPreviewShown(false);
      setStage('PLAYING');
      startTimer();
      setPlayButtonText('Playing...');
    } else {
      // Generate and spin a new grid
      const newGrid = generateGrid();
      setPlayButtonText('Spinning...');

      runSpinAnimation(newGrid, () => {
        setStage('PLAYING');
        startTimer();
        setPlayButtonText('Playing...');
      });
    }
  };

  // Level selection - during preview, switching levels briefly flashes that level's grid
  const handleLevelSelect = (index: number) => {
    if (stage !== 'IDLE' || isAnimating) return;
    setLevelIndex(index);

    if (previewShown && previewGridsRef.current) {
      // Flash the new level's grid for 2 seconds then hide again
      setGrid(previewGridsRef.current[index]);
      setStatusMessage('Memorize the board...');
      setPreviewShown(false);
      setPlayButtonText('Play');

      addTimeout(() => {
        setGrid(Array(9).fill(null));
        setPreviewShown(true);
        setPlayButtonText('Confirm');
        setStatusMessage('Select level & Press Play');
      }, 2000);
    }
  };

  // Render individual cell content
  const renderCellContent = (index: number) => {
    // Memory flash takes priority
    if (memoryFlash === index) {
      return (
        <div
          className="skill-memory-circle active"
          style={{ background: MEMORY_COLORS[index % 4] }}
        />
      );
    }

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
          <div
            className={`skill-timer-container${showTimer ? ' active' : ''}`}
          >
            <div
              className="skill-timer-bar"
              style={{ width: `${timerPercent}%` }}
            />
          </div>

          <div className="skill-grid-container">
            {Array.from({ length: 9 }, (_, index) => {
              const value = grid[index];
              const isSpinning = spinningCells[index];
              const isWinning = winningCells.has(index);
              const isWild = value === 'WILD' && !isSpinning;

              const cellClasses = [
                'skill-grid-cell',
                isSpinning && 'skill-spinning',
                isWinning && 'skill-winning-cell',
                isWild && 'skill-wild',
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
        <div className="skill-status-bar">
          <div className="skill-status-group">
            <span className="skill-status-label">Play Level</span>
            <span className="skill-status-value skill-play-level-value">
              {playLevel}
            </span>
          </div>
          <div className="skill-status-group">
            <span className="skill-status-label">Points</span>
            <span className="skill-status-value skill-points-value">
              {balance}
            </span>
          </div>
        </div>

        <div className="skill-level-bar">
          {PLAY_LEVELS.map((level, index) => (
            <button
              key={level}
              className={`skill-level-btn${index === levelIndex ? ' active' : ''}`}
              onClick={() => handleLevelSelect(index)}
              disabled={stage !== 'IDLE' || isAnimating || balance < level}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="skill-button-bar">
          <button
            className="skill-game-btn"
            onClick={() =>
              alert(
                'Place the WILD symbol to complete 3-in-a-row lines. Use Next Puzzle to preview the board. Complete the memory game for a 25% consolation return!'
              )
            }
          >
            Help
          </button>
          <button
            className="skill-game-btn"
            onClick={handlePreview}
            disabled={stage !== 'IDLE' || isAnimating}
          >
            Preview
          </button>
          <button
            className="skill-game-btn skill-play"
            onClick={handlePlay}
            disabled={isPlayDisabled || balance < playLevel}
          >
            {playButtonText}
          </button>
        </div>

        <div className="skill-footer">
          <span>TRASHMARKET.FUN SKILL GAME</span>
          <span>&copy; 2026 All Rights Reserved</span>
          <span>SKL 402 83 PEN</span>
        </div>
      </div>
    </div>
  );
}
