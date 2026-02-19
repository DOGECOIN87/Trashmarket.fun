import React, { useState, useEffect, useRef } from 'react';
import { GameState } from '../../types/types';
import type { GameEngine } from '../../lib/GameEngine';
import { HighScoreBoard } from './HighScoreBoard';
import { SoundControl } from './SoundControl';
import { soundManager } from '../../lib/soundManager';

interface OverlayProps {
    gameState: GameState;
    onReset: () => void;
    onPauseToggle: () => void;
    onBump: () => void;
    onDropCoin: () => void;
    wallet: any;
}

export const Overlay: React.FC<OverlayProps> = ({
    gameState,
    onReset,
    onPauseToggle,
    onBump,
    onDropCoin,
    wallet
}) => {
    const walletMenuRef = useRef<HTMLDivElement>(null);
    const [showWalletMenu, setShowWalletMenu] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [txStatus, setTxStatus] = useState<'idle' | 'signing' | 'broadcasting' | 'confirmed' | 'error'>('idle');
    const [showHighScores, setShowHighScores] = useState(false);

    useEffect(() => {
        if (gameState.balance > 0) {
            setIsDismissed(false);
            setTxStatus('idle');
        }
    }, [gameState.balance]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (walletMenuRef.current && !walletMenuRef.current.contains(e.target as Node)) {
                setShowWalletMenu(false);
            }
        };
        if (showWalletMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showWalletMenu]);

    const handleBumpClick = async () => {
        // Prevent multiple clicks during transaction processing
        if (txStatus !== 'idle') {
            console.log('Transaction already in progress, ignoring click');
            return;
        }
        if (!wallet.isConnected) {
            alert('Please connect your Solana wallet first');
            setShowWalletMenu(true);
            return;
        }

        // Initialize sound if needed
        soundManager.initialize();

        try {
            setTxStatus('signing');
            setTimeout(() => {
                setTxStatus('broadcasting');
                setTimeout(() => {
                    setTxStatus('confirmed');
                    onBump();
                    setTimeout(() => { setTxStatus('idle'); }, 1000);
                }, 2000);
            }, 1000);
        } catch (error) {
            console.error('Transaction failed:', error);
            setTxStatus('error');
            setTimeout(() => setTxStatus('idle'), 2000);
        }
    };

    const handleClosePopup = () => {
        soundManager.play('ui_close');
        setIsDismissed(true);
        setTxStatus('idle');
    };

    const showPopup = gameState.balance <= 0 && !gameState.isPaused && !isDismissed;

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden select-none">

            {/* Decorative Background Elements */}
            <div className="absolute inset-0 z-0 opacity-5 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, #00ff00 1px, transparent 1px)', backgroundSize: '30px 30px' }}
            />
            <div className="absolute top-0 left-0 w-full h-20 sm:h-32 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-20 sm:h-32 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />

            {/* --- TOP HUD --- */}
            <div className="relative z-10 w-full px-3 py-2 sm:p-6 flex justify-between items-start gap-2">

                {/* Left: Brand Identity */}
                <div className="flex flex-col justify-center select-none shrink-0">
                    <h1 className="text-xl sm:text-3xl md:text-4xl font-heading">
                        JUNK PUSHER
                    </h1>
                    <div className="flex items-center gap-1.5 mt-0.5 opacity-70">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${wallet.isConnected ? 'bg-green-400 shadow-[0_0_5px_#00ff00]' : 'bg-red-500 shadow-[0_0_5px_red]'}`}></div>
                        <span className="text-[8px] sm:text-[10px] text-green-200 uppercase tracking-[0.2em] sm:tracking-[0.3em] font-medium font-[Inter]">
                            {wallet.isConnected ? 'Wallet Connected' : 'System Online'}
                        </span>
                    </div>
                </div>

                {/* Right: Economy & Wallet */}
                <div className="flex flex-col items-end gap-2 sm:gap-4 pointer-events-auto min-w-0">

                    {/* Wallet Connect Button */}
                    <div className="relative" ref={walletMenuRef}>
                        <button
                            onClick={() => setShowWalletMenu(!showWalletMenu)}
                            className="group relative px-3 sm:px-5 py-1.5 sm:py-2 bg-black/80 border border-green-800 hover:border-purple-500/50 transition-all rounded shadow-lg overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 to-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center gap-2 sm:gap-3 relative z-10">
                                <div className={`w-1.5 h-1.5 rounded-full ${wallet.isConnected ? 'bg-green-400 shadow-[0_0_5px_#00ff00]' : 'bg-red-500 shadow-[0_0_5px_red]'} transition-colors`}></div>
                                <span className="font-heading text-[8px] sm:text-[10px] font-bold tracking-[0.1em] sm:tracking-[0.15em] text-green-300 group-hover:text-white uppercase transition-colors">
                                    {wallet.isConnected ? `${wallet.publicKey?.slice(0, 4)}...${wallet.publicKey?.slice(-4)}` : 'Wallet'}
                                </span>
                            </div>
                        </button>

                        {/* Wallet Menu Dropdown */}
                        {showWalletMenu && (
                            <div className="absolute top-full right-0 mt-2 w-56 sm:w-64 bg-black/95 border border-green-800/60 rounded shadow-xl overflow-hidden z-50 pointer-events-auto">
                                {wallet.isConnected ? (
                                    <>
                                        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-green-800/40">
                                            <div className="text-[10px] sm:text-xs text-green-400/60 mb-1 font-[Inter]">Connected Wallet</div>
                                            <div className="text-xs sm:text-sm font-mono text-green-300 break-all">{wallet.publicKey}</div>
                                        </div>
                                        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-green-800/40">
                                            <div className="text-[10px] sm:text-xs text-green-400/60 mb-1 font-[Inter]">Balance</div>
                                            <div className="text-base sm:text-lg font-bold text-green-300">{wallet.balance !== null ? `${wallet.balance.toFixed(3)} GOR` : '--'}</div>
                                        </div>
                                        <button
                                            onClick={() => { wallet.disconnectWallet(); setShowWalletMenu(false); }}
                                            className="w-full px-3 sm:px-4 py-2 text-left text-xs sm:text-sm text-green-200/70 hover:bg-green-900/30 transition-colors font-[Inter]"
                                        >
                                            Disconnect Wallet
                                        </button>
                                    </>
                                ) : (
                                    <div className="px-3 sm:px-4 py-3 sm:py-4">
                                        <p className="text-xs sm:text-sm text-green-300/50 mb-3 sm:mb-4 font-[Inter]">Wallet connection coming soon. Gorbagana testnet support enabled.</p>
                                        <div className="text-[10px] sm:text-xs text-green-400/40 font-[Inter]">
                                            Network: <span className="text-green-300">Devnet (Gorbagana)</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats Group - Compact on mobile */}
                    <div className="flex flex-row sm:flex-col gap-1.5 sm:gap-2">

                        {/* Junk (Balance) */}
                        <div className="relative group w-[120px] sm:w-[200px]">
                            <div className="absolute inset-0 bg-black/60 skew-x-[-12deg] border-r-2 border-green-500/40 group-hover:border-green-400 transition-colors"></div>
                            <div className="relative flex flex-col items-end pr-3 sm:pr-5 py-1 sm:py-2">
                                <div className="text-[7px] sm:text-[9px] text-green-400 uppercase tracking-[0.2em] sm:tracking-[0.25em] font-bold mb-0.5 opacity-80 font-[Inter]">Junk</div>
                                <div className={`text-lg sm:text-3xl font-bold font-heading tracking-wider sm:tracking-widest drop-shadow-[0_0_10px_rgba(0,255,0,0.3)] ${gameState.balance <= 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                    {gameState.balance}
                                </div>
                            </div>
                        </div>

                        {/* Net Profit */}
                        <div className="relative group w-[120px] sm:w-[200px]">
                            <div className="absolute inset-0 bg-black/60 skew-x-[-12deg] border-r-2 border-purple-500/40 group-hover:border-purple-400 transition-colors"></div>
                            <div className="relative flex flex-col items-end pr-3 sm:pr-5 py-1 sm:py-2">
                                <div className="text-[7px] sm:text-[9px] text-purple-400 uppercase tracking-[0.2em] sm:tracking-[0.25em] font-bold mb-0.5 opacity-80 font-[Inter]">Profit</div>
                                <div className={`text-sm sm:text-xl font-bold font-heading tracking-wide ${gameState.netProfit >= 0 ? 'text-green-400' : 'text-rose-400'} drop-shadow-[0_0_5px_currentColor]`}>
                                    {gameState.netProfit > 0 ? '+' : ''}{gameState.netProfit}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* --- CENTER: Message & Crosshair --- */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {gameState.isPaused ? (
                    <div className="z-50 backdrop-blur-md bg-black/80 border-y border-green-500/30 py-4 px-8 sm:py-8 sm:px-20 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                        <div className="flex flex-col items-center">
                            <div className="text-4xl sm:text-6xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tracking-[0.05em] font-heading drop-shadow-[0_0_20px_rgba(0,255,0,0.4)]">
                                PAUSED
                            </div>
                            <div className="mt-2 sm:mt-4 flex items-center gap-3 sm:gap-4">
                                <div className="h-[1px] w-8 sm:w-12 bg-green-500/50"></div>
                                <div className="text-green-400 tracking-[0.3em] sm:tracking-[0.4em] uppercase text-[8px] sm:text-[10px] font-bold font-[Inter]">System Halted</div>
                                <div className="h-[1px] w-8 sm:w-12 bg-green-500/50"></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-start h-full pt-[12vh] sm:pt-[15vh] opacity-20">
                        <div className="w-[1px] h-8 sm:h-12 bg-green-500/50 mb-1 sm:mb-2"></div>
                        <div className="text-[7px] sm:text-[8px] uppercase tracking-[0.3em] text-green-500/50 font-medium font-[Inter]">Insert Junk</div>
                    </div>
                )}
            </div>

            {/* --- PAYTABLE + BOTTOM HUD wrapper --- */}
            <div className="relative z-20 flex flex-col">
                {/* --- PAYTABLE BAR --- */}
                <div className="w-full bg-black/90 border-t border-green-500/40 backdrop-blur-md pointer-events-auto shadow-[0_-2px_12px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-center gap-4 sm:gap-8 px-3 py-2 sm:py-2.5 overflow-x-auto text-[10px] sm:text-xs font-[Inter]">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <img src="/junk.png" alt="JUNK" className="w-5 h-5 rounded-full ring-1 ring-green-500/40" />
                            <span className="text-green-300 font-bold font-heading tracking-wider">JUNK</span>
                        </div>
                        <div className="h-4 w-px bg-green-500/30 shrink-0" />
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-gray-400">Drop</span>
                            <span className="text-green-200 font-mono font-bold">1</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-gray-400">Collect</span>
                            <span className="text-green-400 font-mono font-bold">+1</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-gray-400">10x Streak</span>
                            <span className="text-green-300 font-mono font-bold">+5</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-gray-400">Bump</span>
                            <span className="text-fuchsia-400 font-mono font-bold">-50</span>
                        </div>
                        <div className="h-4 w-px bg-green-500/30 shrink-0" />
                        <div className="flex items-center gap-1.5 shrink-0">
                            <img src="/trashcoin.png" alt="TRASHCOIN" className="w-5 h-5 rounded-full ring-1 ring-yellow-500/40" />
                            <span className="text-yellow-300 font-bold font-heading tracking-wider">TRASH</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-gray-400">6%</span>
                            <span className="text-yellow-200 font-mono font-bold">5x</span>
                        </div>
                    </div>
                </div>

                {/* --- BOTTOM HUD --- */}
                <div className="w-full px-3 py-3 sm:p-8 flex items-end justify-between gap-2">

                    {/* Controls */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-3 pointer-events-auto">
                        <button
                            onClick={() => {
                                soundManager.initialize();
                                soundManager.play('ui_open');
                                setShowHighScores(true);
                            }}
                            className="group h-9 sm:h-12 min-w-[72px] sm:min-w-[120px] bg-cyan-950/30 border border-cyan-500/30 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all skew-x-[-15deg] backdrop-blur-sm"
                        >
                            <div className="skew-x-[15deg] flex items-center justify-center h-full px-2 sm:px-0">
                                <span className="font-heading text-[8px] sm:text-[10px] text-cyan-200 font-bold tracking-[0.15em] sm:tracking-[0.2em] group-hover:text-white group-hover:drop-shadow-[0_0_5px_#00FFFF] uppercase">
                                    Scores
                                </span>
                            </div>
                        </button>
                        <button
                            onClick={() => {
                                soundManager.initialize();
                                soundManager.play('button_click');
                                onPauseToggle();
                            }}
                            className="group h-9 sm:h-12 min-w-[72px] sm:min-w-[120px] bg-green-950/30 border border-green-500/30 hover:bg-green-900/50 hover:border-green-400 transition-all skew-x-[-15deg] backdrop-blur-sm"
                        >
                            <div className="skew-x-[15deg] flex items-center justify-center h-full px-2 sm:px-0">
                                <span className="font-heading text-[8px] sm:text-[10px] text-green-200 font-bold tracking-[0.15em] sm:tracking-[0.2em] group-hover:text-white group-hover:drop-shadow-[0_0_5px_#00ff00] uppercase">
                                    {gameState.isPaused ? 'Resume' : 'Pause'}
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                soundManager.initialize();
                                soundManager.play('button_click');
                                onReset();
                            }}
                            className="group h-9 sm:h-12 min-w-[72px] sm:min-w-[120px] bg-purple-950/30 border border-purple-500/30 hover:bg-purple-900/50 hover:border-purple-400 transition-all skew-x-[-15deg] backdrop-blur-sm"
                        >
                            <div className="skew-x-[15deg] flex items-center justify-center h-full px-2 sm:px-0">
                                <span className="font-heading text-[8px] sm:text-[10px] text-purple-200 font-bold tracking-[0.15em] sm:tracking-[0.2em] group-hover:text-white group-hover:drop-shadow-[0_0_5px_#9945FF] uppercase">
                                    Reset
                                </span>
                            </div>
                        </button>

                    </div>

                    {/* Sound Control */}
                    <div className="pointer-events-auto">
                        <SoundControl />
                    </div>

                    {/* Footer Info */}
                    <div className="text-right pointer-events-none opacity-50 hidden sm:block shrink-0">
                        <div className="text-[9px] text-green-400/60 uppercase tracking-widest leading-loose font-[Inter]">
                            JUNK Token <br />
                            v3.0.0 <span className="text-purple-600 mx-2">//</span> GORBAGANA
                        </div>
                    </div>
                </div>
            </div>

            {/* --- POPUP: OUT OF JUNK (BUMP) --- */}
            {showPopup && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px] pointer-events-auto animate-in fade-in duration-300 p-4">
                    <div className="relative bg-black/90 border border-green-500/60 p-1 w-full max-w-[420px] shadow-[0_0_100px_rgba(0,255,0,0.15)] transform scale-100 animate-in zoom-in-95 duration-200">

                        {/* Close Button */}
                        <button
                            onClick={handleClosePopup}
                            className="absolute top-2 right-2 z-50 p-1.5 sm:p-2 text-green-500/50 hover:text-green-400 transition-colors"
                            title="Dismiss Warning"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Decoration: Corners */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 sm:w-4 sm:h-4 border-t-2 border-l-2 border-green-400"></div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 border-t-2 border-r-2 border-green-400"></div>
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 sm:w-4 sm:h-4 border-b-2 border-l-2 border-green-400"></div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 border-b-2 border-r-2 border-green-400"></div>

                        <div className="border border-green-500/10 p-5 sm:p-8 flex flex-col items-center text-center relative overflow-hidden bg-[radial-gradient(circle_at_center,_#001a00_0%,_#000000_100%)]">

                            {/* Animated Scanning Line */}
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-green-500/50 animate-[scan_2s_linear_infinite]"></div>

                            <div className="text-green-500 font-mono font-bold tracking-[0.2em] sm:tracking-[0.3em] text-[10px] sm:text-xs mb-3 sm:mb-4 animate-pulse flex items-center gap-2">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span> SYSTEM ALERT // 0xC001
                            </div>

                            <h2 className="text-2xl sm:text-4xl font-bold text-white font-heading mb-1.5 sm:mb-2 tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">
                                OUT OF JUNK
                            </h2>

                            <p className="text-green-200/60 text-xs sm:text-sm mb-5 sm:mb-8 font-[Inter] leading-relaxed max-w-[90%] sm:max-w-[80%]">
                                Resource depletion detected. Production halted. <br />
                                <span className="text-green-400 font-bold">
                                    {wallet.isConnected
                                        ? 'Initiate Treasury Transfer to trigger emergency bump.'
                                        : 'Connect wallet to initiate emergency bump.'}
                                </span>
                            </p>

                            {/* Bump/Pay Button */}
                            <button
                                onClick={handleBumpClick}
                                disabled={txStatus !== 'idle'}
                                className={`group relative w-full h-12 sm:h-16 transition-all clip-path-polygon mb-3 sm:mb-4 overflow-hidden shadow-[0_0_20px_rgba(0,255,0,0.15)] hover:shadow-[0_0_30px_rgba(0,255,0,0.4)] active:scale-[0.98] ${txStatus === 'idle' ? 'bg-gradient-to-r from-green-900 to-emerald-800 hover:from-green-600 hover:to-emerald-500' : 'bg-black border border-green-500/50 cursor-wait'}`}
                            >
                                <div className="absolute inset-0 flex items-center justify-center opacity-10 bg-[linear-gradient(45deg,transparent_25%,#000_25%,#000_50%,transparent_50%,transparent_75%,#000_75%,#000_100%)] bg-[length:10px_10px]"></div>

                                <div className="relative flex flex-col items-center justify-center">
                                    {txStatus === 'idle' && (
                                        <>
                                            <span className="font-heading font-bold text-white tracking-[0.15em] sm:tracking-[0.2em] text-base sm:text-xl group-hover:text-white drop-shadow-md">
                                                {wallet.isConnected ? 'PAY & BUMP' : 'CONNECT WALLET'}
                                            </span>
                                            {wallet.isConnected && (
                                                <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
                                                    <span className="text-[9px] sm:text-[10px] text-green-200 font-mono bg-black/40 px-1.5 py-0.5 rounded border border-green-500/30">
                                                        FEE: 0.001 GOR
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {txStatus === 'signing' && (
                                        <div className="flex items-center gap-2 sm:gap-3 text-green-300">
                                            <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest">Signing...</span>
                                        </div>
                                    )}

                                    {txStatus === 'broadcasting' && (
                                        <div className="flex items-center gap-2 sm:gap-3 text-purple-300">
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce"></div>
                                            </div>
                                            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest">Broadcasting...</span>
                                        </div>
                                    )}

                                    {txStatus === 'confirmed' && (
                                        <div className="flex items-center gap-2 text-green-400">
                                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            <span className="font-heading font-bold text-sm sm:text-lg tracking-widest">CONFIRMED</span>
                                        </div>
                                    )}

                                    {txStatus === 'error' && (
                                        <div className="flex items-center gap-2 text-red-400">
                                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            <span className="font-heading font-bold text-sm sm:text-lg tracking-widest">ERROR</span>
                                        </div>
                                    )}
                                </div>
                            </button>

                            <button
                                onClick={onReset}
                                className="text-[9px] sm:text-[10px] text-gray-500 hover:text-green-300 transition-colors uppercase tracking-[0.2em] border-b border-transparent hover:border-green-400/50 pb-0.5 font-[Inter]"
                            >
                                Perform System Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* High Score Board Modal */}
            <HighScoreBoard isOpen={showHighScores} onClose={() => setShowHighScores(false)} />

        </div>
    );
};
