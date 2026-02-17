import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { Overlay } from './components/Overlay';
import { PegboardCanvas } from './components/PegboardCanvas';
import { GameState } from './types';
import { WalletProvider, useWallet } from './context/WalletContext';
import { setupAutoSave, loadGameState, clearGameState, hasRecoverableState, getRecoveryMessage } from './services/statePersistence';
import { soundManager } from './services/soundManager';
import { BackgroundDecorations } from './components/BackgroundDecorations';

const AppContent: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const wallet = useWallet();
  
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    balance: 100,
    netProfit: 0,
    fps: 0,
    isPaused: false,
  });
  const [hasCheckedRecovery, setHasCheckedRecovery] = useState(false);

  const handleUpdate = useCallback((partialState: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...partialState }));
  }, []);

  // Check for recoverable state on mount
  useEffect(() => {
    if (hasCheckedRecovery) return;
    
    const walletAddress = wallet.publicKey;
    if (hasRecoverableState(walletAddress)) {
      const message = getRecoveryMessage(walletAddress);
      if (message && window.confirm(message)) {
        const recovered = loadGameState(walletAddress);
        if (recovered) {
          setGameState(prev => ({
            ...prev,
            balance: recovered.balance,
            score: recovered.score,
            netProfit: recovered.netProfit,
          }));
          
          // Update engine state if it exists
          if (engineRef.current) {
            engineRef.current.reset();
            // Note: We'll need to add a method to restore balance/score
          }
        }
      } else {
        clearGameState();
      }
    }
    setHasCheckedRecovery(true);
  }, [wallet.publicKey, hasCheckedRecovery]);

  // Setup auto-save
  useEffect(() => {
    const cleanup = setupAutoSave(
      () => gameState,
      () => wallet.publicKey
    );
    return cleanup;
  }, [gameState, wallet.publicKey]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Initialize Engine
    const engine = new GameEngine({
        debugControls: true, 
        debugFps: true
    });
    
    engine.initialize(canvasRef.current, handleUpdate).then(() => {
        engineRef.current = engine;
    });

    // Resize Observer
    const handleResize = () => {
        if (canvasRef.current && engineRef.current) {
            engineRef.current.resize(window.innerWidth, window.innerHeight);
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        engine.cleanup();
    };
  }, [handleUpdate]);

  // Save state before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save final state before closing
      const { saveGameState } = require('./services/statePersistence');
      saveGameState(gameState, wallet.publicKey);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleUpdate]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Initialize sound on first user interaction
    soundManager.initialize();
    
    if (!engineRef.current || gameState.isPaused) return;
    
    // Calculate normalized device coordinates (-1 to +1) for x, y
    // We only care about X for drop position really, but let's pass both to engine raycaster
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    engineRef.current.dropCoinAtRaycast(x, y);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Background Decorations */}
      <BackgroundDecorations />
      
      {/* Lumia Pegboard background */}
      <PegboardCanvas />
      {/* Three.js game canvas (transparent background) */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full block cursor-crosshair"
        onPointerDown={handlePointerDown}
      />
      <Overlay
        state={gameState}
        onReset={() => engineRef.current?.reset()}
        onPauseToggle={() => engineRef.current?.togglePause()}
        onBump={() => engineRef.current?.bump()}
        engineRef={engineRef}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
};

export default App;