import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine } from '../../../lib/junk-pusher/GameEngine';
import { Overlay } from './Overlay';
import { PegboardCanvas } from './PegboardCanvas';
import { GameState } from '../../../types/junk-pusher/types';
import { WalletProvider, useWallet } from './WalletContext';
import { setupAutoSave, loadGameState, clearGameState, hasRecoverableState, getRecoveryMessage } from '../../../lib/junk-pusher/statePersistence';
import { soundManager } from '../../../lib/junk-pusher/soundManager';
import { BackgroundDecorations } from './BackgroundDecorations';

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

        return () => {
            engine.dispose();
        };
    }, [handleUpdate]);

    const handleDropCoin = () => {
        if (engineRef.current && !gameState.isPaused) {
            engineRef.current.dropCoin();
            soundManager.play('drop');
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
            const newPausedState = !gameState.isPaused;
            engineRef.current.setPaused(newPausedState);
            setGameState(prev => ({ ...prev, isPaused: newPausedState }));
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-gradient-to-b from-gray-900 via-gray-800 to-black">
            <BackgroundDecorations />
            <PegboardCanvas canvasRef={canvasRef} />
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

const JunkPusherGame: React.FC = () => {
    return (
        <WalletProvider>
            <AppContent />
        </WalletProvider>
    );
};

export default JunkPusherGame;
