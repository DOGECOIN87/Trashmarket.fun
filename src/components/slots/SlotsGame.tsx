import React, { useState, useRef, useEffect } from 'react';
import { SYMBOLS, getRandomSymbol, Symbol } from '../../lib/slots/symbols';
import './SlotsGame.css';
import { Zap, Volume2, VolumeX } from 'lucide-react';

interface Reel {
  symbols: Symbol[];
  isSpinning: boolean;
}

export default function SlotsGame() {
  const [reels, setReels] = useState<Reel[]>([
    { symbols: [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()], isSpinning: false },
    { symbols: [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()], isSpinning: false },
    { symbols: [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()], isSpinning: false },
  ]);

  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState(10);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'win' | 'lose' | 'info'>('info');
  const [isSpinning, setIsSpinning] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const spinReels = () => {
    if (balance < bet) {
      setMessage('Insufficient balance!');
      setMessageType('lose');
      return;
    }

    setIsSpinning(true);
    setMessage('');
    setBalance(balance - bet);

    // Animate spinning
    const newReels = reels.map(() => ({
      symbols: [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
      isSpinning: true,
    }));
    setReels(newReels);

    // Stop spinning after 2 seconds
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current);
    }

    spinTimeoutRef.current = setTimeout(() => {
      const finalReels = reels.map(() => ({
        symbols: [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
        isSpinning: false,
      }));
      setReels(finalReels);
      setIsSpinning(false);

      // Check for wins
      checkWin(finalReels);
    }, 2000);
  };

  const checkWin = (finalReels: Reel[]) => {
    const middleSymbols = finalReels.map((reel) => reel.symbols[1]);

    // Check if all three middle symbols match
    if (
      middleSymbols[0].id === middleSymbols[1].id &&
      middleSymbols[1].id === middleSymbols[2].id
    ) {
      const winAmount = bet * middleSymbols[0].payout;
      setBalance((prev) => prev + winAmount);
      setMessage(`🎉 WIN! ${middleSymbols[0].name} x3! Won ${winAmount} credits!`);
      setMessageType('win');
    } else {
      setMessage('No match. Try again!');
      setMessageType('lose');
    }
  };

  const handleBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBet = parseInt(e.target.value);
    if (newBet > 0 && newBet <= balance) {
      setBet(newBet);
    }
  };

  const handleMaxBet = () => {
    setBet(Math.min(balance, 100));
  };

  const addBalance = (amount: number) => {
    setBalance(prev => prev + amount);
  };

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="slots-game-container">
      {/* Header */}
      <div className="slots-header">
        <div className="slots-title-section">
          <h1 className="slots-title">SLOTS</h1>
          <p className="slots-subtitle">Arcade Skill Game</p>
        </div>
        <button 
          className="slots-sound-btn"
          onClick={() => setIsMuted(!isMuted)}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Balance Display */}
      <div className="slots-balance-section">
        <div className="slots-balance-display">
          <span className="slots-balance-label">BALANCE:</span>
          <span className="slots-balance-amount">{balance}</span>
          <span className="slots-balance-unit">CREDITS</span>
        </div>
      </div>

      {/* Reels */}
      <div className="slots-reels-container">
        {reels.map((reel, reelIndex) => (
          <div key={reelIndex} className={`slots-reel ${reel.isSpinning ? 'spinning' : ''}`}>
            {reel.symbols.map((symbol, symbolIndex) => (
              <div
                key={symbolIndex}
                className={`slots-symbol-slot ${symbolIndex === 1 ? 'active' : ''}`}
              >
                <img src={symbol.image} alt={symbol.name} className="slots-symbol-image" />
                <div className="slots-symbol-label">{symbol.name}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Message Display */}
      {message && (
        <div className={`slots-message slots-message-${messageType}`}>
          {message}
        </div>
      )}

      {/* Controls */}
      <div className="slots-controls-section">
        <div className="slots-bet-control">
          <label htmlFor="slots-bet-input" className="slots-bet-label">BET:</label>
          <input
            id="slots-bet-input"
            type="number"
            min="1"
            max={balance}
            value={bet}
            onChange={handleBetChange}
            disabled={isSpinning}
            className="slots-bet-input"
          />
          <button 
            onClick={handleMaxBet} 
            disabled={isSpinning} 
            className="slots-max-bet-btn"
          >
            MAX
          </button>
        </div>

        <button
          onClick={spinReels}
          disabled={isSpinning || balance < bet}
          className="slots-spin-button"
        >
          <Zap className="w-5 h-5" />
          {isSpinning ? 'SPINNING...' : 'SPIN'}
        </button>
      </div>

      {/* Quick Add Balance Buttons */}
      <div className="slots-add-balance-section">
        <button onClick={() => addBalance(100)} className="slots-add-btn">+100</button>
        <button onClick={() => addBalance(500)} className="slots-add-btn">+500</button>
        <button onClick={() => addBalance(1000)} className="slots-add-btn">+1000</button>
      </div>

      {/* Payout Info */}
      <div className="slots-info-section">
        <h3 className="slots-info-title">SYMBOL PAYOUTS</h3>
        <div className="slots-payout-grid">
          {SYMBOLS.map((symbol) => (
            <div key={symbol.id} className="slots-payout-item">
              <img src={symbol.image} alt={symbol.name} className="slots-payout-symbol" />
              <div className="slots-payout-info">
                <span className="slots-payout-name">{symbol.name}</span>
                <span className="slots-payout-value">x{symbol.payout}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
