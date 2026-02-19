import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from '../../lib/GameEngine';
import { Overlay } from './Overlay';
import { GameState } from '../../types/types';
import { useGameWallet } from './WalletAdapter';
import { useJunkPusherOnChain } from '../../lib/useJunkPusherOnChain';
import { setupAutoSave, loadGameState, clearGameState, hasRecoverableState, getRecoveryMessage } from '../../lib/statePersistence';
import { soundManager } from '../../lib/soundManager';

const JunkPusherGame: React.FC = () => {
    const gameCanvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const wallet = useGameWallet();

    // On-chain integration hook
    const onChain = useJunkPusherOnChain();

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

    /**
     * FEAT-01: Bump now attempts a real on-chain transaction when:
     *  - The on-chain program is deployed (isProgramReady)
     *  - The wallet is connected
     * Falls back to the local mock flow if the program isn't deployed yet.
     */
    const handleBump = useCallback(async () => {
        if (engineRef.current && !gameState.isPaused) {
            if (onChain.isProgramReady && wallet.isConnected) {
                // Real on-chain bump
                try {
                    const sig = await onChain.recordCoinCollection(gameState.score);
                    if (sig) {
                        console.log('[JunkPusher] On-chain bump recorded:', sig);
                    }
                } catch (err) {
                    console.warn('[JunkPusher] On-chain bump failed, continuing locally:', err);
                }
            }
            engineRef.current.bump();
            soundManager.play('bump');
        }
    }, [gameState.isPaused, gameState.score, onChain, wallet.isConnected]);

    const handleReset = useCallback(async () => {
        if (engineRef.current) {
            // Record final score on-chain before resetting
            if (onChain.isProgramReady && wallet.isConnected && gameState.score > 0) {
                try {
                    await onChain.recordScore(gameState.score);
                    console.log('[JunkPusher] Score recorded on-chain');
                } catch (err) {
                    console.warn('[JunkPusher] Failed to record score on-chain:', err);
                }
            }

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
    }, [gameState.fps, gameState.score, onChain, wallet.isConnected]);

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
            {/* On-chain status indicator */}
            {wallet.isConnected && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                    {onChain.isProgramReady ? (
                        <div className="flex items-center gap-1.5 bg-black/70 border border-green-500/30 px-3 py-1 rounded-full text-[9px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-green-300 font-mono">ON-CHAIN</span>
                            {onChain.junkBalance > 0 && (
                                <span className="text-green-200 ml-1">{onChain.junkBalance.toFixed(0)} JUNK</span>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-black/70 border border-yellow-500/30 px-3 py-1 rounded-full text-[9px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            <span className="text-yellow-300 font-mono">LOCAL MODE</span>
                        </div>
                    )}
                </div>
            )}

            {/* Transaction status toast */}
            {onChain.txStatus !== 'idle' && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-mono ${
                        onChain.txStatus === 'error' ? 'bg-red-900/80 border border-red-500/50 text-red-200' :
                        onChain.txStatus === 'confirmed' ? 'bg-green-900/80 border border-green-500/50 text-green-200' :
                        'bg-black/80 border border-cyan-500/50 text-cyan-200'
                    }`}>
                        {onChain.txStatus === 'building' && '⏳ Building tx...'}
                        {onChain.txStatus === 'signing' && '✍️ Sign in wallet...'}
                        {onChain.txStatus === 'confirming' && '⏳ Confirming...'}
                        {onChain.txStatus === 'confirmed' && '✅ Confirmed!'}
                        {onChain.txStatus === 'error' && `❌ ${onChain.error || 'Failed'}`}
                    </div>
                </div>
            )}

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
