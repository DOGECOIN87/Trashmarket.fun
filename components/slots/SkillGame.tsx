import React, { useState, useEffect, useRef } from 'react';
import './SkillGame.css';

interface GameState {
  balance: number;
  playLevel: number;
  currentWin: number;
  stage: 'IDLE' | 'PLAYING' | 'MEMORY';
  grid: (number | string | null)[];
  nextGrid: (number | string | null)[];
  timer: number;
  timerInterval: NodeJS.Timeout | null;
  memorySequence: number[];
  playerSequence: number[];
  canPreview: boolean;
  previewShown: boolean;
}

const SYMBOL_IMAGES = [
  '/symbols/alon.png',
  '/symbols/oscar.png',
  '/symbols/sky-garbage.png',
  '/symbols/shredder.png',
  '/symbols/gorbios.png',
  '/symbols/pump-pill.png',
  '/symbols/digibin.png',
  '/symbols/box.png',
  '/symbols/matress.png'
];

const BASE_PAYOUTS = [20000, 4000, 2000, 400, 200, 80, 40, 20, 10];
const MEMORY_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];

export default function SkillGame() {
  const [gameState, setGameState] = useState<GameState>({
    balance: 1000,
    playLevel: 40,
    currentWin: 0,
    stage: 'IDLE',
    grid: Array(9).fill(null),
    nextGrid: Array(9).fill(null),
    timer: 30,
    timerInterval: null,
    memorySequence: [],
    playerSequence: [],
    canPreview: true,
    previewShown: false,
  });

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const statusMessageRef = useRef<HTMLDivElement>(null);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const spinIntervalsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Initialize grid cells
  useEffect(() => {
    initGrid();
  }, []);

  const initGrid = () => {
    if (!gridContainerRef.current) return;
    gridContainerRef.current.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'skill-grid-cell';
      cell.dataset.index = String(i);
      cell.onclick = () => handleCellClick(i);

      const symbol = document.createElement('div');
      symbol.className = 'skill-cell-symbol';
      symbol.id = `cell-${i}`;

      cell.appendChild(symbol);
      gridContainerRef.current.appendChild(cell);
    }
  };

  const generateGrid = () => {
    return Array(9)
      .fill(0)
      .map(() => Math.floor(Math.random() * 9));
  };

  const handleCellClick = (index: number) => {
    if (gameState.stage === 'PLAYING') {
      placeWild(index);
    } else if (gameState.stage === 'MEMORY') {
      handleMemoryInput(index);
    }
  };

  const placeWild = (index: number) => {
    if (gameState.timerInterval) {
      clearInterval(gameState.timerInterval);
    }

    const newGrid = [...gameState.grid];
    newGrid[index] = 'WILD';
    setGameState((prev) => ({ ...prev, grid: newGrid }));

    setTimeout(() => {
      renderGrid(newGrid);
      checkWin(newGrid);
    }, 0);
  };

  const checkWin = (grid: (number | string | null)[]) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    let totalWin = 0;
    const winningLines: number[][] = [];

    lines.forEach((line) => {
      const symbols = line.map((i) => grid[i]);
      const unique = [...new Set(symbols)];

      if (unique.length === 1 && unique[0] !== null) {
        const tier = unique[0] === 'WILD' ? 0 : (unique[0] as number);
        totalWin += getPayout(tier, gameState.playLevel);
        winningLines.push(line);
      } else if (unique.length === 2 && unique.includes('WILD')) {
        const tier = unique.find((s) => s !== 'WILD') as number;
        totalWin += getPayout(tier, gameState.playLevel);
        winningLines.push(line);
      }
    });

    if (totalWin > 0) {
      setGameState((prev) => ({ ...prev, currentWin: totalWin }));
      highlightWinningLines(winningLines);
      setTimeout(() => endGame(true), 2000);
    } else {
      startMemoryGame();
    }
  };

  const getPayout = (tier: number, level: number) => {
    return BASE_PAYOUTS[tier] * level;
  };

  const highlightWinningLines = (lines: number[][]) => {
    lines.flat().forEach((index) => {
      const cell = document.querySelector(`[data-index="${index}"]`);
      cell?.classList.add('skill-winning-cell');
    });
  };

  const startMemoryGame = () => {
    const sequence = Array(5)
      .fill(0)
      .map(() => Math.floor(Math.random() * 9));

    setGameState((prev) => ({
      ...prev,
      stage: 'MEMORY',
      memorySequence: sequence,
      playerSequence: [],
    }));

    showStatus('Watch the pattern...');
    playMemorySequence(sequence);
  };

  const playMemorySequence = (sequence: number[]) => {
    let i = 0;
    const interval = setInterval(() => {
      if (i >= sequence.length) {
        clearInterval(interval);
        showStatus('Your turn!');
        return;
      }

      flashCell(sequence[i]);
      i++;
    }, 800);
  };

  const flashCell = (index: number) => {
    const cell = document.querySelector(`[data-index="${index}"]`);
    const circle = document.createElement('div');
    circle.className = 'skill-memory-circle';
    circle.style.background = MEMORY_COLORS[index % 4];
    circle.classList.add('active');

    const cellSymbol = cell?.querySelector('.skill-cell-symbol') as HTMLElement;
    const originalContent = cellSymbol?.innerHTML || '';
    if (cellSymbol) {
      cellSymbol.innerHTML = '';
      cellSymbol.appendChild(circle);
    }

    setTimeout(() => {
      if (cellSymbol) {
        cellSymbol.innerHTML = originalContent;
      }
    }, 400);
  };

  const handleMemoryInput = (index: number) => {
    flashCell(index);

    const newPlayerSequence = [...gameState.playerSequence, index];
    const current = newPlayerSequence.length - 1;

    if (newPlayerSequence[current] !== gameState.memorySequence[current]) {
      endGame(false);
      return;
    }

    if (newPlayerSequence.length === gameState.memorySequence.length) {
      const winAmount = Math.floor(gameState.playLevel * 1.05);
      setGameState((prev) => ({ ...prev, currentWin: winAmount }));
      setTimeout(() => endGame(true), 1000);
    } else {
      setGameState((prev) => ({ ...prev, playerSequence: newPlayerSequence }));
    }
  };

  const endGame = (won: boolean) => {
    setGameState((prev) => {
      const newBalance = won
        ? prev.balance + prev.currentWin
        : prev.balance - prev.playLevel;

      if (won) {
        showStatus('You Win!');
      } else {
        showStatus('Try Again');
      }

      return {
        ...prev,
        stage: 'IDLE',
        balance: newBalance,
        currentWin: 0,
      };
    });

    if (playBtnRef.current) {
      playBtnRef.current.textContent = 'Play';
      playBtnRef.current.disabled = false;
    }
  };

  const showStatus = (text: string) => {
    if (statusMessageRef.current) {
      statusMessageRef.current.textContent = text;
      statusMessageRef.current.classList.remove('skill-hidden');
    }
  };

  const hideStatus = () => {
    if (statusMessageRef.current) {
      statusMessageRef.current.classList.add('skill-hidden');
    }
  };

  const renderGrid = (grid: (number | string | null)[]) => {
    grid.forEach((symbol, index) => {
      const cell = document.getElementById(`cell-${index}`);
      if (!cell) return;

      if (symbol === 'WILD') {
        cell.className = 'skill-cell-symbol skill-wild-text';
        cell.textContent = 'WILD';
      } else if (symbol !== null) {
        cell.className = 'skill-cell-symbol';
        cell.innerHTML = `<img src="${SYMBOL_IMAGES[symbol as number]}" alt="Symbol">`;
      } else {
        cell.className = 'skill-cell-symbol';
        cell.innerHTML = '';
      }
    });
  };

  const startSpinAnimation = () => {
    for (let i = 0; i < 9; i++) {
      const cellDiv = document.querySelector(`[data-index="${i}"]`);

      setTimeout(() => {
        cellDiv?.classList.add('skill-spinning');

        const cell = document.getElementById(`cell-${i}`);
        let spinCount = 0;
        const maxSpins = 20 + Math.floor(Math.random() * 15);

        const spinInterval = setInterval(() => {
          const randomSymbol = Math.floor(Math.random() * 9);
          if (cell) {
            cell.innerHTML = `<img src="${SYMBOL_IMAGES[randomSymbol]}" alt="Symbol">`;
          }

          spinCount++;
          if (spinCount >= maxSpins) {
            clearInterval(spinInterval);
            spinIntervalsRef.current.delete(i);
          }
        }, 80 + Math.random() * 40);

        spinIntervalsRef.current.set(i, spinInterval);
      }, i * 100);
    }
  };

  const stopSpinAnimation = (grid: (number | string | null)[]) => {
    for (let i = 8; i >= 0; i--) {
      setTimeout(() => {
        const cellDiv = document.querySelector(`[data-index="${i}"]`);
        cellDiv?.classList.remove('skill-spinning');

        const interval = spinIntervalsRef.current.get(i);
        if (interval) {
          clearInterval(interval);
          spinIntervalsRef.current.delete(i);
        }

        const cell = document.getElementById(`cell-${i}`);
        const finalSymbol = grid[i];
        if (finalSymbol !== null && cell) {
          cell.innerHTML =
            finalSymbol === 'WILD'
              ? '<span class="skill-wild-text">WILD</span>'
              : `<img src="${SYMBOL_IMAGES[finalSymbol as number]}" alt="Symbol">`;

          cell.style.transform = 'scale(1.1)';
          setTimeout(() => {
            cell.style.transform = 'scale(1)';
          }, 150);
        }
      }, (8 - i) * 150);
    }
  };

  const startTimer = () => {
    let timer = 30;
    if (gameState.timerInterval) {
      clearInterval(gameState.timerInterval);
    }

    const interval = setInterval(() => {
      timer -= 0.1;
      if (timerBarRef.current) {
        timerBarRef.current.style.width = `${(timer / 30) * 100}%`;
      }

      if (timer <= 0) {
        clearInterval(interval);
        endGame(false);
      }
    }, 100);

    setGameState((prev) => ({ ...prev, timerInterval: interval }));
  };

  const handleNextPuzzle = () => {
    if (!gameState.canPreview || gameState.stage !== 'IDLE') return;

    const newGrid = generateGrid();
    setGameState((prev) => ({ ...prev, grid: newGrid, nextGrid: newGrid }));

    startSpinAnimation();

    setTimeout(() => {
      stopSpinAnimation(newGrid);
      setTimeout(() => {
        showStatus('Preview - Press Play to confirm');
        setGameState((prev) => ({ ...prev, previewShown: true }));
        if (playBtnRef.current) {
          playBtnRef.current.textContent = 'Confirm';
        }
      }, 1200);
    }, 2000);
  };

  const handleLevelDown = () => {
    if (gameState.playLevel > 1) {
      setGameState((prev) => ({ ...prev, playLevel: prev.playLevel - 1 }));
    }
  };

  const handleLevelUp = () => {
    setGameState((prev) => ({ ...prev, playLevel: prev.playLevel + 1 }));
  };

  const handleMaxLevel = () => {
    setGameState((prev) => ({
      ...prev,
      playLevel: Math.floor(prev.balance),
    }));
  };

  const handlePlay = () => {
    if (gameState.stage !== 'IDLE') return;
    if (gameState.balance < gameState.playLevel) {
      showStatus('Insufficient Balance!');
      return;
    }

    if (gameState.previewShown) {
      setGameState((prev) => ({ ...prev, previewShown: false, stage: 'PLAYING' }));
      hideStatus();
      startTimer();
      if (playBtnRef.current) {
        playBtnRef.current.textContent = 'Playing...';
        playBtnRef.current.disabled = true;
      }
    } else {
      const newGrid = generateGrid();
      setGameState((prev) => ({ ...prev, grid: newGrid }));

      startSpinAnimation();

      setTimeout(() => {
        stopSpinAnimation(newGrid);
        setTimeout(() => {
          setGameState((prev) => ({ ...prev, stage: 'PLAYING' }));
          hideStatus();
          startTimer();
          if (playBtnRef.current) {
            playBtnRef.current.textContent = 'Playing...';
            playBtnRef.current.disabled = true;
          }
        }, 1200);
      }, 2500);
    }
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
                  {payout * gameState.playLevel}
                </span>
              </div>
            ))}

            <div className="skill-win-display">
              <div className="skill-win-label">Win</div>
              <div className="skill-win-value">{gameState.currentWin}</div>
            </div>
          </div>
        </div>

        {/* Play Area */}
        <div className="skill-play-area">
          <div className="skill-timer-container">
            <div className="skill-timer-bar" ref={timerBarRef}></div>
          </div>

          <div className="skill-grid-container" ref={gridContainerRef}>
            <div className="skill-status-message skill-hidden" ref={statusMessageRef}>
              Adjust 'Play Level'
            </div>
          </div>
        </div>
      </div>

      {/* Control Section */}
      <div className="skill-control-section">
        <div className="skill-status-bar">
          <div className="skill-status-group">
            <span className="skill-status-label">Play Level</span>
            <span className="skill-status-value skill-play-level-value">
              {gameState.playLevel}
            </span>
          </div>
          <div className="skill-status-group">
            <span className="skill-status-label">Points</span>
            <span className="skill-status-value skill-points-value">
              {gameState.balance}
            </span>
          </div>
        </div>

        <div className="skill-button-bar">
          <button
            className="skill-game-btn"
            onClick={() => alert('Place the WILD symbol to complete 3-in-a-row lines. Use Next Puzzle to preview the board. Complete the memory game for guaranteed 105% return!')}
          >
            Help
          </button>
          <button className="skill-game-btn" onClick={handleNextPuzzle}>
            Next Puzzle
          </button>
          <button
            className="skill-game-btn"
            onClick={handleLevelDown}
            disabled={gameState.playLevel <= 1}
          >
            Level Down
          </button>
          <button className="skill-game-btn" onClick={handleLevelUp}>
            Level Up
          </button>
          <button className="skill-game-btn" onClick={handleMaxLevel}>
            Max
          </button>
          <button
            className="skill-game-btn skill-play"
            onClick={handlePlay}
            ref={playBtnRef}
            disabled={gameState.balance < gameState.playLevel}
          >
            Play
          </button>
        </div>

        <div className="skill-footer">
          <span>TRASHMARKET.FUN SKILL GAME</span>
          <span>© 2026 All Rights Reserved</span>
          <span>SKL 402 83 PEN</span>
        </div>
      </div>
    </div>
  );
}
