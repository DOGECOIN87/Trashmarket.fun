import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { GameEngine } from '../../lib/GameEngine';
import { Overlay } from './Overlay';
import AudioPlayer from './AudioPlayer';
import { GameState } from '../../types/types';
import { useGameWallet } from './WalletAdapter';
import { useJunkPusherOnChain } from '../../lib/useJunkPusherOnChain';
import { getPlayerGameBalance } from '../../lib/highScoreService';
import { PROGRAM_ID } from '../../lib/JunkPusherClient';
import { setupAutoSave, loadGameState, clearGameState } from '../../lib/statePersistence';
import { soundManager } from '../../lib/soundManager';
import { pushGameEvent } from '../../services/activityService';
import { PublicKey } from '@solana/web3.js';

const JunkPusherGame: React.FC = () => {
    const gameCanvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const wallet = useGameWallet();
    const { connection } = useConnection();

    // On-chain integration hook
    const onChain = useJunkPusherOnChain();

    const [gameState, setGameState] = useState<GameState>({
        score: 0,
        balance: 100, // Start with 100 free DEBRIS tokens to try the game
        netProfit: 0,
        fps: 0,
        isPaused: false,
    });
    const gameStateRef = useRef(gameState);
    gameStateRef.current = gameState;

    const walletKeyRef = useRef(wallet.publicKey);
    walletKeyRef.current = wallet.publicKey;

    // Stable refs for on-chain methods to avoid re-render cascades
    const onChainRef = useRef(onChain);
    onChainRef.current = onChain;

    const lastScoreMilestoneRef = useRef(0);
    const handleUpdate = useCallback((partialState: Partial<GameState>) => {
        setGameState(prev => {
            const next = { ...prev, ...partialState };
            // Emit a WIN event every 10 coins collected
            if (next.score > 0 && Math.floor(next.score / 10) > lastScoreMilestoneRef.current) {
                lastScoreMilestoneRef.current = Math.floor(next.score / 10);
                pushGameEvent('WIN', `Player hit ${next.score} coins on Junk Pusher (+${next.netProfit > 0 ? next.netProfit : 0} DEBRIS)`);
            }
            return next;
        });
    }, []);

    // Silently restore saved state on mount to protect player coins
    // Priority: 1) On-chain PDA balance  2) localStorage fallback
    const recoveredRef = useRef<{ balance: number; score: number; netProfit: number } | null>(null);
    const hasRestoredRef = useRef(false);
    useEffect(() => {
        if (hasRestoredRef.current) return;
        hasRestoredRef.current = true;

        const restore = async () => {
            // 1. Try reading on-chain game state PDA balance
            if (wallet.publicKey && connection) {
                try {
                    const playerPubkey = new PublicKey(wallet.publicKey);
                    const pdaBalance = await getPlayerGameBalance(connection, PROGRAM_ID, playerPubkey);
                    if (pdaBalance !== null && pdaBalance > 0) {
                        const recovered = { balance: pdaBalance, score: 0, netProfit: 0 };
                        // Also pull score/netProfit from localStorage if available
                        const local = loadGameState(wallet.publicKey);
                        if (local) {
                            recovered.score = local.score;
                            recovered.netProfit = local.netProfit;
                        }
                        recoveredRef.current = recovered;
                        setGameState(prev => ({
                            ...prev,
                            balance: recovered.balance,
                            score: recovered.score,
                            netProfit: recovered.netProfit,
                        }));
                        engineRef.current?.restoreState(recovered.balance, recovered.score, recovered.netProfit);
                        return;
                    }
                } catch (err) {
                    console.warn('[JunkPusher] PDA balance read failed, using localStorage:', err);
                }
            }

            // 2. Fallback: localStorage
            const recovered = loadGameState(wallet.publicKey);
            if (recovered) {
                recoveredRef.current = recovered;
                setGameState(prev => ({
                    ...prev,
                    balance: recovered.balance,
                    score: recovered.score,
                    netProfit: recovered.netProfit,
                }));
                engineRef.current?.restoreState(recovered.balance, recovered.score, recovered.netProfit);
            }
        };

        restore();
    }, [wallet.publicKey, connection]);

    // Initialize sound manager on first user interaction with the game
    useEffect(() => {
        const initSound = () => {
            soundManager.initialize();
            window.removeEventListener('pointerdown', initSound);
        };
        window.addEventListener('pointerdown', initSound);
        return () => window.removeEventListener('pointerdown', initSound);
    }, []);

    // Setup auto-save (uses refs to avoid re-registering on every state change)
    useEffect(() => {
        const cleanup = setupAutoSave(
            () => gameStateRef.current,
            () => walletKeyRef.current
        );
        return cleanup;
    }, []);

    useEffect(() => {
        if (!gameCanvasRef.current) return;

        const canvas = gameCanvasRef.current;
        
        // Use a more robust way to get dimensions that accounts for the parent container
        const updateDimensions = () => {
            const parent = canvas.parentElement;
            const width = parent ? parent.clientWidth : window.innerWidth;
            const height = parent ? parent.clientHeight : window.innerHeight;
            
            canvas.width = width;
            canvas.height = height;
            return { width, height };
        };

        const { width, height } = updateDimensions();

        if (width === 0 || height === 0) return;

        let disposed = false;
        const engine = new GameEngine({
            debugControls: true,
            debugFps: true
        });

        engine.initialize(canvas, handleUpdate).then(() => {
            if (!disposed) {
                engineRef.current = engine;
                // Restore saved state into the engine if we recovered before init
                if (recoveredRef.current) {
                    const r = recoveredRef.current;
                    engine.restoreState(r.balance, r.score, r.netProfit);
                }
                // Force a resize after init to ensure correct aspect ratio
                const dims = updateDimensions();
                engine.resize(dims.width, dims.height);
            } else {
                engine.cleanup();
            }
        }).catch((err) => {
            console.error('GameEngine init failed:', err);
        });

        const handleResize = () => {
            if (engineRef.current) {
                const dims = updateDimensions();
                engineRef.current.resize(dims.width, dims.height);
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
        soundManager.initialize();
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
        if (engineRef.current && !gameStateRef.current.isPaused) {
            const oc = onChainRef.current;
            if (oc.isProgramReady && wallet.isConnected) {
                try {
                    await oc.recordCoinCollection(gameStateRef.current.score);
                } catch (err) {
                    console.warn('[JunkPusher] On-chain bump failed, continuing locally:', err);
                }
            }
            engineRef.current.bump();
            soundManager.play('bump');
        }
    }, [wallet.isConnected]);

    const handleReset = useCallback(async () => {
        if (engineRef.current) {
            const oc = onChainRef.current;
            const currentState = gameStateRef.current;
            if (oc.isProgramReady && wallet.isConnected && currentState.score > 0) {
                try {
                    await oc.recordScore(currentState.score);
                } catch (err) {
                    console.warn('[JunkPusher] Failed to record score on-chain:', err);
                }
            }

            engineRef.current.reset();
            setGameState({
                score: 0,
                balance: 100, // Reset with 100 free DEBRIS tokens
                netProfit: 0,
                fps: currentState.fps,
                isPaused: false,
            });
            clearGameState();
        }
    }, [wallet.isConnected]);

    const handleDeposit = useCallback(async (amount: number): Promise<string | null> => {
        const oc = onChainRef.current;
        if (oc.isProgramReady && wallet.isConnected) {
            try {
                const sig = await oc.depositBalance(amount);
                if (sig) {
                    // Credit the engine's internal balance so it stays in sync
                    engineRef.current?.addBalance(amount);
                    pushGameEvent('DEPOSIT', `Player deposited ${amount} DEBRIS into Junk Pusher`);
                }
                return sig;
            } catch (err) {
                console.error('[JunkPusher] Deposit failed:', err);
                return null;
            }
        }
        return null;
    }, [wallet.isConnected]);

    const handleWithdraw = useCallback(async (amount: number): Promise<string | null> => {
        const oc = onChainRef.current;
        const currentBalance = gameStateRef.current.balance;
        if (!oc.isProgramReady || !wallet.isConnected) return null;
        if (amount <= 0 || amount > currentBalance) return null;

        try {
            const intAmount = Math.floor(amount);
            const sig = await oc.withdrawBalance(intAmount, intAmount, Math.floor(currentBalance));
            if (sig) {
                // Deduct from engine balance
                if (engineRef.current) {
                    engineRef.current.addBalance(-intAmount);
                } else {
                    setGameState(prev => ({ ...prev, balance: prev.balance - intAmount }));
                }
                pushGameEvent('WIN', `Player withdrew ${intAmount} DEBRIS from Junk Pusher`);
            }
            return sig;
        } catch (err) {
            console.error('[JunkPusher] Withdraw failed:', err);
            return null;
        }
    }, [wallet.isConnected]);

    const handlePauseToggle = () => {
        if (engineRef.current) {
            engineRef.current.togglePause();
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        soundManager.initialize();
        if (!engineRef.current || gameState.isPaused) return;
        const canvas = gameCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        engineRef.current.dropCoinAtRaycast(ndcX, ndcY);
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-black">
            {/* Floating Background Images */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Trash Character 1 - Top Left */}
                <img
                    src="/assets/backgrounds/trash-character-1.png"
                    alt=""
                    className="absolute w-32 h-32 opacity-20 animate-float-slow"
                    style={{ left: '5%', top: '10%', animationDelay: '0s' }}
                />
                {/* Trash Character 2 - Top Right */}
                <img
                    src="/assets/backgrounds/trash-character-2.png"
                    alt=""
                    className="absolute w-40 h-40 opacity-15 animate-float-slow"
                    style={{ right: '8%', top: '15%', animationDelay: '2s' }}
                />
                {/* Trash Character 3 - Middle Left */}
                <img
                    src="/assets/backgrounds/trash-character-3.png"
                    alt=""
                    className="absolute w-36 h-36 opacity-20 animate-float-slow"
                    style={{ left: '10%', top: '45%', animationDelay: '4s' }}
                />
                {/* Trash Character 4 - Middle Right */}
                <img
                    src="/assets/backgrounds/trash-character-4.png"
                    alt=""
                    className="absolute w-32 h-32 opacity-15 animate-float-slow"
                    style={{ right: '12%', top: '50%', animationDelay: '1s' }}
                />
                {/* Trash Character 5 - Bottom Left */}
                <img
                    src="/assets/backgrounds/trash-character-5.png"
                    alt=""
                    className="absolute w-40 h-40 opacity-20 animate-float-slow"
                    style={{ left: '8%', bottom: '10%', animationDelay: '3s' }}
                />
                {/* Trash Character 6 - Bottom Right */}
                <img
                    src="/assets/backgrounds/trash-character-6.png"
                    alt=""
                    className="absolute w-36 h-36 opacity-15 animate-float-slow"
                    style={{ right: '5%', bottom: '15%', animationDelay: '5s' }}
                />
                {/* Chains - Top Center */}
                <img
                    src="/assets/backgrounds/chains.png"
                    alt=""
                    className="absolute w-48 h-48 opacity-10 animate-float-slow"
                    style={{ left: '50%', top: '5%', transform: 'translateX(-50%)', animationDelay: '2.5s' }}
                />
                {/* Trash Bin - Center */}
                <img
                    src="/assets/backgrounds/trash-bin.png"
                    alt=""
                    className="absolute w-44 h-44 opacity-12 animate-float-slow"
                    style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', animationDelay: '1.5s' }}
                />
            </div>

            {/* On-chain status indicator */}
            {wallet.isConnected && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                    {onChain.isProgramReady ? (
                        <div className="flex items-center gap-1.5 bg-black/80 border border-[#cbf30c]/20 px-2.5 py-1 rounded-full text-[9px] backdrop-blur-sm">
                            <img src="/assets/logo-circle-transparent.png" alt="" className="w-3.5 h-3.5" />
                            <span className="text-[#cbf30c]/70 font-bold tracking-widest uppercase">On-Chain</span>
                            {onChain.debrisBalance > 0 && (
                                <span className="text-white/50 ml-0.5">{onChain.debrisBalance.toFixed(0)} DEBRIS</span>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 bg-black/80 border border-yellow-500/20 px-2.5 py-1 rounded-full text-[9px] backdrop-blur-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            <span className="text-yellow-300/70 font-bold tracking-widest uppercase">Local Mode</span>
                        </div>
                    )}
                </div>
            )}

            {/* Transaction status toast */}
            {onChain.txStatus !== 'idle' && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none w-[340px] max-w-[90vw]">
                    <div className={`relative overflow-hidden rounded-lg shadow-2xl ${
                        onChain.txStatus === 'error'
                            ? 'bg-gradient-to-b from-red-950/95 to-black/95 border border-red-500/40'
                            : onChain.txStatus === 'confirmed'
                            ? 'bg-gradient-to-b from-green-950/95 to-black/95 border border-green-500/40'
                            : 'bg-gradient-to-b from-[#1a1a0a]/95 to-black/95 border border-[#cbf30c]/30'
                    }`}>
                        {/* Progress bar */}
                        <div className="absolute top-0 left-0 h-[2px] bg-[#cbf30c]/60" style={{
                            width: onChain.txStatus === 'building' ? '25%'
                                : onChain.txStatus === 'signing' ? '50%'
                                : onChain.txStatus === 'confirming' ? '75%'
                                : '100%',
                            transition: 'width 0.4s ease-out',
                            ...(onChain.txStatus === 'error' ? { background: 'rgb(239 68 68 / 0.6)' } : {}),
                        }} />

                        <div className="flex items-center gap-3 px-4 py-3">
                            {/* Logo */}
                            <img
                                src="/assets/logo-circle-transparent.png"
                                alt="TM"
                                className={`w-8 h-8 shrink-0 ${
                                    onChain.txStatus === 'confirming' || onChain.txStatus === 'building'
                                        ? 'animate-pulse' : ''
                                }`}
                            />

                            {/* Content */}
                            <div className="flex flex-col min-w-0">
                                {/* Header row: brand + label */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#cbf30c]/80">trashmarket.fun</span>
                                    {onChain.txLabel && (
                                        <>
                                            <span className="text-[#cbf30c]/30 text-[10px]">/</span>
                                            <span className="text-[10px] font-medium tracking-wide uppercase text-white/60">{onChain.txLabel}</span>
                                        </>
                                    )}
                                </div>

                                {/* Status message */}
                                <span className={`text-xs font-medium mt-0.5 ${
                                    onChain.txStatus === 'error' ? 'text-red-300' :
                                    onChain.txStatus === 'confirmed' ? 'text-green-300' :
                                    'text-white/80'
                                }`}>
                                    {onChain.txStatus === 'building' && 'Preparing transaction...'}
                                    {onChain.txStatus === 'signing' && 'Approve in your wallet'}
                                    {onChain.txStatus === 'confirming' && 'Confirming on Gorbagana...'}
                                    {onChain.txStatus === 'confirmed' && 'Transaction confirmed'}
                                    {onChain.txStatus === 'error' && (onChain.error || 'Transaction failed')}
                                </span>
                            </div>

                            {/* Status icon */}
                            <div className="ml-auto shrink-0">
                                {(onChain.txStatus === 'building' || onChain.txStatus === 'signing' || onChain.txStatus === 'confirming') && (
                                    <svg className="animate-spin h-4 w-4 text-[#cbf30c]/60" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                )}
                                {onChain.txStatus === 'confirmed' && (
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {onChain.txStatus === 'error' && (
                                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>
                        </div>
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
                onDeposit={handleDeposit}
                onWithdraw={handleWithdraw}
                onPauseToggle={handlePauseToggle}
                wallet={wallet}
            />
            <AudioPlayer src="/audio/bg-music.mp3" autoPlay={true} />
        </div>
    );
};

export default JunkPusherGame;
