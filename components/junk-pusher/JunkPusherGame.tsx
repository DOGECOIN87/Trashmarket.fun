import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from '../../lib/GameEngine';
import { Overlay } from './Overlay';
import { GameState } from '../../types/types';
import { useGameWallet } from './WalletAdapter';
import { setupAutoSave, loadGameState, clearGameState, hasRecoverableState, getRecoveryMessage } from '../../lib/statePersistence';
import { soundManager } from '../../lib/soundManager';

const JunkPusherGame: React.FC = () => {
    const gameCanvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const wallet = useGameWallet();

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

                    if (engineRef.current) {
                        engineRef.current.reset();
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
        if (!gameCanvasRef.current) return;

        const canvas = gameCanvasRef.current;
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        if (width === 0 || height === 0) return;

        let disposed = false;
        const engine = new GameEngine({
            debugControls: true,
            debugFps: true
        });

        engine.initialize(canvas, handleUpdate).then(() => {
            if (!disposed) {
                engineRef.current = engine;
            } else {
                engine.cleanup();
            }
        }).catch((err) => {
            console.error('GameEngine init failed:', err);
        });

        const handleResize = () => {
            if (engineRef.current) {
                const w = canvas.clientWidth || window.innerWidth;
                const h = canvas.clientHeight || window.innerHeight;
                engineRef.current.resize(w, h);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            disposed = true;
            window.removeEventListener('resize', handleResize);
            engineRef.current = null;
            engine.cleanup();
        };
    }, [handleUpdate]);

    const handleDropCoin = () => {
        if (engineRef.current && !gameState.isPaused) {
            const x = (Math.random() - 0.5) * 6;
            engineRef.current.dropUserCoin(x);
        }
    };

    const handleBump = () => {
        if (engineRef.current && !gameState.isPaused) {
            engineRef.current.bump();
            soundManager.play('bump');
        }
    };

    const handleReset = () => {
        if (engineRef.current) {
            engineRef.current.reset();
            setGameState({
                score: 0,
                balance: 100,
                netProfit: 0,
                fps: gameState.fps,
                isPaused: false,
            });
            clearGameState();
        }
    };

    const handlePauseToggle = () => {
        if (engineRef.current) {
            engineRef.current.togglePause();
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!engineRef.current || gameState.isPaused) return;
        const canvas = gameCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        engineRef.current.dropCoinAtRaycast(ndcX, ndcY);
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black">
            <canvas
                ref={gameCanvasRef}
                onClick={handleCanvasClick}
                className="absolute inset-0 w-full h-full"
                style={{ cursor: 'crosshair' }}
            />
            <Overlay
                gameState={gameState}
                onDropCoin={handleDropCoin}
                onBump={handleBump}
                onReset={handleReset}
                onPauseToggle={handlePauseToggle}
                wallet={wallet}
            />
        </div>
    );
};

export default JunkPusherGame;
