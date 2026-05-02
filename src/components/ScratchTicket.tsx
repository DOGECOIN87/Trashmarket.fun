import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { RPC_ENDPOINTS } from '../lib/rpcConfig';

// ─── Sound helpers ────────────────────────────────────────────────────────────
function playSound(src: string, volume = 0.7) {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {}
}
const LOSE_SOUNDS = [
  '/audio/brother ew.mp3',
  '/audio/bruh.mp3',
  '/audio/Dog accepting fate.mp3',
  '/audio/emotional-damage-meme.mp3',
  '/audio/oh-my-god-bro-oh-hell-nah-man.mp3',
];
function randomLoseSound() {
  playSound(LOSE_SOUNDS[Math.floor(Math.random() * LOSE_SOUNDS.length)], 0.75);
}
const SFX = {
  scratch:   () => playSound('/audio/instagram-thud.mp3', 0.4),
  bought:    () => playSound('/audio/metal-gear-solid-alert.mp3', 0.6),
  txFail:    () => randomLoseSound(),
  win:       () => playSound('/audio/anime-wow.mp3', 0.8),
  bigWin:    () => playSound('/audio/anime-wow.mp3', 0.9),
  lose:      () => randomLoseSound(),
  claimed:   () => playSound('/audio/kids cheering yayyyy.mp3', 0.85),
  claimFail: () => randomLoseSound(),
};

const API_BASE = RPC_ENDPOINTS.GORBAGANA_API;
const LOTTERY_TREASURY = new PublicKey('8iKCvwz3tyUp4hzxcyLYtPQghiwiEhiLDd38MEQBF6kR');
const TICKET_COST_GOR = 500;

// ─── Symbol data (mirrors slots — ALON is jackpot) ───────────────────────────
const SYMBOLS = [
  { name: 'ALON',      image: '/symbols/alon.webp',        payout: 50,  weight: 2  },
  { name: 'GORBIOS',   image: '/symbols/gorbios.webp',     payout: 25,  weight: 4  },
  { name: 'DIGIBIN',   image: '/symbols/digibin.webp',     payout: 15,  weight: 4  },
  { name: 'PUMP PILL', image: '/symbols/pump-pill.webp',   payout: 10,  weight: 5  },
  { name: 'OSCAR',     image: '/symbols/oscar.webp',       payout: 8,   weight: 8  },
  { name: 'MATRESS',   image: '/symbols/matress.webp',     payout: 5,   weight: 8  },
  { name: 'SHREDDER',  image: '/symbols/shredder.webp',    payout: 3,   weight: 10 },
  { name: 'SKY-GARB',  image: '/symbols/sky-garbage.webp', payout: 2,   weight: 12 },
  { name: 'BOX',       image: '/symbols/box.webp',         payout: 1.5, weight: 15 },
];
const WIN_LINES = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6],
];

// ─── Client-side win check (for highlighting — backend is authoritative) ──────
function checkWins(grid: number[]): { line: number[]; symIdx: number; payout: number }[] {
  const wins: { line: number[]; symIdx: number; payout: number }[] = [];
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (grid[a] === grid[b] && grid[b] === grid[c]) {
      wins.push({ line, symIdx: grid[a], payout: SYMBOLS[grid[a]].payout });
    }
  }
  return wins;
}

// ─── Scratch Cell (canvas-based drag-to-scratch) ─────────────────────────────
interface ScratchCellProps {
  symIdx: number;
  cellSize: number;
  revealed: boolean;
  onFullyScratch: () => void;
  isWinner: boolean;
}

const ScratchCell: React.FC<ScratchCellProps> = ({ symIdx, cellSize, revealed, onFullyScratch, isWinner }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isScratching = useRef(false);
  const scratched = useRef(false);
  const soundPlayed = useRef(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const sym = SYMBOLS[symIdx];

  // Pre-load symbol image
  useEffect(() => {
    const img = new Image();
    img.src = sym.image;
    imgRef.current = img;
  }, [sym.image]);

  // Draw scratch layer
  const drawScratchLayer = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, cellSize, cellSize);
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, cellSize, cellSize);

    // Blue border
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, cellSize - 1.5, cellSize - 1.5);

    // SCRATCH text
    ctx.fillStyle = '#00d4ff';
    ctx.font = `bold 11px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCRATCH', cellSize / 2, cellSize / 2 - 8);

    ctx.globalAlpha = 0.45;
    ctx.font = `8px 'JetBrains Mono', monospace`;
    ctx.fillText('▼  TAP  ▼', cellSize / 2, cellSize / 2 + 10);
    ctx.globalAlpha = 1;
  }, [cellSize]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (revealed) {
      // Fully clear — show underlying image
      ctx.clearRect(0, 0, cellSize, cellSize);
      scratched.current = true;
    } else {
      drawScratchLayer(ctx);
    }
  }, [revealed, cellSize, drawScratchLayer]);

  const getScratchPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const scratch = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || scratched.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getScratchPos(e, canvas);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      SFX.scratch();
    }

    // Check how much is scratched
    const imageData = ctx.getImageData(0, 0, cellSize, cellSize);
    let transparent = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] < 128) transparent++;
    }
    const pct = transparent / (cellSize * cellSize);
    if (pct > 0.55 && !scratched.current) {
      scratched.current = true;
      ctx.clearRect(0, 0, cellSize, cellSize);
      onFullyScratch();
    }
  };

  return (
    <div
      className="relative"
      style={{ width: cellSize, height: cellSize }}
    >
      {/* Symbol background */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-[#060606] border transition-all duration-300 ${
          isWinner ? 'border-[#00d4ff] shadow-[0_0_12px_#00d4ff60]' : 'border-[#1c1c1c]'
        }`}
      >
        <div className="flex flex-col items-center justify-center w-full h-full gap-1 pb-4">
          <img
            src={sym.image}
            alt={sym.name}
            className="w-[60%] h-[60%] object-contain"
            draggable={false}
          />
        </div>
        <span
          className="absolute bottom-1.5 left-0 right-0 text-center font-mono text-[7px] tracking-widest uppercase"
          style={{ color: '#00d4ff', opacity: 0.6 }}
        >
          {sym.name} · {(sym.payout * TICKET_COST_GOR).toLocaleString()}
        </span>
      </div>

      {/* Scratch canvas overlay */}
      <canvas
        ref={canvasRef}
        width={cellSize}
        height={cellSize}
        className="absolute inset-0 touch-none cursor-crosshair"
        style={{ display: revealed ? 'none' : 'block' }}
        onMouseDown={() => { isScratching.current = true; }}
        onMouseUp={() => { isScratching.current = false; }}
        onMouseLeave={() => { isScratching.current = false; }}
        onMouseMove={(e) => { if (isScratching.current) scratch(e); }}
        onClick={(e) => scratch(e)}
        onTouchStart={(e) => { isScratching.current = true; e.preventDefault(); scratch(e); }}
        onTouchEnd={() => { isScratching.current = false; }}
        onTouchMove={(e) => { e.preventDefault(); scratch(e); }}
      />
    </div>
  );
};

// ─── Main ScratchTicket Modal ─────────────────────────────────────────────────
export interface ScratchTicketProps {
  onClose: () => void;
}

type Phase = 'buy' | 'scratching' | 'result';

const ScratchTicket: React.FC<ScratchTicketProps> = ({ onClose }) => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  // Always use Gorbagana RPC directly — avoids "Plugin Closed" from wrong network
  const gorConn = useMemo(
    () => new Connection(RPC_ENDPOINTS.GORBAGANA, 'confirmed'),
    []
  );

  const [phase, setPhase] = useState<Phase>('buy');
  const currency = 'GOR';
  const [grid, setGrid] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [wins, setWins] = useState<{ line: number[]; symIdx: number; payout: number }[]>([]);
  const [totalPayout, setTotalPayout] = useState(0);
  const [scratchedCount, setScratchedCount] = useState(0);
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [txMsg, setTxMsg] = useState('');
  const [claimStatus, setClaimStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [claimMsg, setClaimMsg] = useState('');
  const ticketTxRef = useRef<string>('');

  const CELL = 110;
  const GAP = 12;

  const handleBuy = async () => {
    if (!connected || !publicKey) { setVisible(true); return; }
    setTxStatus('loading');
    setTxMsg('Building transaction...');

    let signature = '';
    try {
      // ── 1. Send 500 GOR to lottery treasury ──────────────────────────────
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: LOTTERY_TREASURY,
          lamports: TICKET_COST_GOR * LAMPORTS_PER_SOL,
        })
      );
      const { blockhash, lastValidBlockHeight } = await gorConn.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setTxMsg('Awaiting wallet signature...');
      signature = await sendTransaction(tx, gorConn);
      ticketTxRef.current = signature;

      setTxMsg('Confirming payment...');
      try {
        await gorConn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      } catch (_confirmErr) {
        // "Plugin Closed" can fire here even when tx landed — verify manually
        const status = await gorConn.getSignatureStatus(signature);
        if (!status.value || status.value.err) {
          throw new Error('Transaction failed on-chain. Please try again.');
        }
        // status OK — continue
      }

      // ── 2. Ask backend to verify + generate grid ─────────────────────────
      setTxMsg('Generating ticket...');
      const resp = await fetch(`${API_BASE}/api/lottery/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txSignature: signature, playerWallet: publicKey.toBase58() }),
      });
      const data = await resp.json() as any;
      if (!resp.ok) throw new Error(data.error || 'Server error');

      setGrid(data.grid as number[]);
      setRevealed(Array(9).fill(false));
      setScratchedCount(0);
      setWins([]);
      setTotalPayout(data.winAmount ?? 0);
      setPhase('scratching');
      setTxStatus('idle');
      setTxMsg('');
      SFX.bought();
    } catch (err: any) {
      setTxStatus('error');
      SFX.txFail();
      // If we got a signature, show it so user can recover via claim
      const msg = err?.message ?? 'Transaction failed';
      setTxMsg(signature ? `${msg} — TX: ${signature.slice(0, 8)}… (keep this)` : msg);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !ticketTxRef.current) return;
    setClaimStatus('loading');
    setClaimMsg('Sending DEBRIS to your wallet...');
    try {
      const resp = await fetch(`${API_BASE}/api/lottery/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txSignature: ticketTxRef.current, playerWallet: publicKey.toBase58() }),
      });
      const data = await resp.json() as any;
      if (!resp.ok) throw new Error(data.error || 'Claim failed');
      setClaimStatus('done');
      setClaimMsg(`${data.winAmount.toLocaleString()} DEBRIS sent! TX: ${data.claimTx.slice(0, 8)}...`);
      SFX.claimed();
    } catch (err: any) {
      setClaimStatus('error');
      setClaimMsg(err?.message ?? 'Claim failed');
      SFX.claimFail();
    }
  };

  const handleCellScratched = useCallback((idx: number) => {
    setRevealed(prev => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
    setScratchedCount(prev => prev + 1);
  }, []);

  // Evaluate wins once all 9 are revealed
  useEffect(() => {
    if (scratchedCount === 9 && grid.length === 9) {
      const w = checkWins(grid);
      setWins(w);
      setPhase('result');
      if (w.length === 0) {
        SFX.lose();
      } else {
        // Big win = ALON jackpot (50×) or GORBIOS (25×)
        const isBig = w.some(win => SYMBOLS[win.symIdx].payout >= 25);
        setTimeout(() => isBig ? SFX.bigWin() : SFX.win(), 300);
      }
    }
  }, [scratchedCount, grid]);

  const revealAll = () => {
    setRevealed(Array(9).fill(true));
    setScratchedCount(9);
  };

  const winCells = new Set(wins.flatMap(w => w.line));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div
        className="relative overflow-hidden"
        style={{
          width: 450,
          maxWidth: '100%',
          background: '#000',
          border: '1.5px solid #00d4ff',
          boxShadow: '0 0 40px #00d4ff30, inset 0 0 60px #00000080',
        }}
      >
        {/* Animated background pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'url("/assets/enhanced_logo_v6.svg")',
            backgroundSize: '280px 280px',
            opacity: 0.12,
          }}
        />

        {/* Scanline */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="w-full h-1 bg-[#00d4ff] opacity-[0.04]"
            style={{ animation: 'scanline-ticket 4s linear infinite' }}
          />
        </div>

        <style>{`
          @keyframes scanline-ticket {
            0%   { transform: translateY(-4px); }
            100% { transform: translateY(700px); }
          }
          @keyframes win-pulse {
            0%, 100% { box-shadow: 0 0 12px #00d4ff60; }
            50%       { box-shadow: 0 0 28px #00d4ffcc; }
          }
          @keyframes flicker {
            0%, 100% { opacity: 1; }
            48% { opacity: 0.8; }
            50% { opacity: 1; }
          }
        `}</style>

        {/* ── HEADER ── */}
        <div
          className="relative z-10 flex flex-col items-center pt-5 pb-4 px-6"
          style={{ borderBottom: '1px solid #00d4ff40', background: '#00000070' }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-600 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Logo + title */}
          <div className="flex flex-col items-center gap-2">
            <img
              src="/assets/logo.svg"
              alt="TM"
              className="w-12 h-12"
              style={{ filter: 'drop-shadow(0 0 8px #00d4ff)' }}
            />
            <span
              className="font-mono font-black tracking-[3px] text-[#00d4ff] text-lg"
              style={{ textShadow: '0 0 10px #00d4ff80' }}
            >
              TRASHMARKET.FUN
            </span>
            <div
              className="font-mono text-[9px] tracking-[2.5px] text-[#00d4ff] opacity-60 border border-[#00d4ff40] px-3 py-0.5"
            >
              SCRATCH TICKET
            </div>
          </div>

          {/* Serial */}
          <p className="font-mono text-[7px] text-[#333] tracking-[1.5px] mt-2 uppercase">
            Gorbagana Protocol · Series 01 · ID: {Math.floor(Math.random() * 9999).toString().padStart(4, '0')}-DEBRIS
          </p>
        </div>

        {/* ── LEGEND BAR ── */}
        <div
          className="relative z-10 text-center py-1.5"
          style={{ background: '#080808', borderBottom: '1px solid #00d4ff20' }}
        >
          <span className="font-mono text-[9px] text-[#00d4ff] tracking-[2px] font-bold">
            MATCH 3 IN A LINE — WIN UP TO 25,000 DEBRIS
          </span>
        </div>

        {/* ── BODY ── */}
        <div className="relative z-10 px-6 py-5">

          {/* ── THE TICKET — always visible ── */}
          <div className="flex flex-col items-center gap-3">

            {/* 3×3 scratch grid */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${CELL}px)`, gap: GAP }}>
              {phase === 'buy'
                // Before purchase: show 9 dummy locked cells
                ? Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-center bg-[#060606] border border-[#1c1c1c]"
                      style={{ width: CELL, height: CELL }}
                    >
                      <div
                        className="w-full h-full flex flex-col items-center justify-center"
                        style={{ background: '#111', border: '1.5px solid #00d4ff' }}
                      >
                        <span className="font-mono font-bold text-[11px] text-[#00d4ff] tracking-widest">SCRATCH</span>
                        <span className="font-mono text-[8px] text-[#adff02] opacity-45 mt-1">▼  TAP  ▼</span>
                      </div>
                    </div>
                  ))
                // After purchase: real scratch cells
                : grid.map((symIdx, i) => (
                    <ScratchCell
                      key={i}
                      symIdx={symIdx}
                      cellSize={CELL}
                      revealed={phase === 'result' ? true : revealed[i]}
                      onFullyScratch={() => phase === 'scratching' && handleCellScratched(i)}
                      isWinner={phase === 'result' && winCells.has(i)}
                    />
                  ))
              }
            </div>

            {/* Progress bar (scratch phase only) */}
            {phase === 'scratching' && (
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-0.5 bg-[#111]">
                  <div
                    className="h-full bg-[#adff02] transition-all duration-300"
                    style={{ width: `${(scratchedCount / 9) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-gray-600 shrink-0">{scratchedCount}/9</span>
                <button
                  onClick={revealAll}
                  className="font-mono text-[9px] text-gray-600 hover:text-[#adff02] transition-colors uppercase tracking-widest underline underline-offset-2 shrink-0"
                >
                  Reveal All
                </button>
              </div>
            )}

            {/* ── BUY PHASE actions ── */}
            {phase === 'buy' && (
              <>
                {/* Payout table */}
                <div className="w-full" style={{ borderTop: '1px solid #ffffff08', paddingTop: 8 }}>
                  <p className="font-mono text-[8px] text-gray-600 uppercase tracking-widest text-center mb-2">
                    Match 3 in a line · Prizes in DEBRIS
                  </p>
                  <div className="w-full grid grid-cols-3 gap-1">
                    {[...SYMBOLS].sort((a, b) => b.payout - a.payout).map(sym => (
                      <div key={sym.name} className="flex items-center gap-1.5 px-2 py-1.5 bg-[#080808] border border-[#ffffff06]">
                        <img src={sym.image} alt={sym.name} className="w-5 h-5 object-contain shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-[7px] text-gray-500 uppercase truncate leading-tight">{sym.name}</span>
                          <span className="font-mono text-[9px] text-[#adff02] font-bold leading-tight">
                            {(sym.payout * TICKET_COST_GOR).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {txStatus === 'loading' ? (
                  <div className="flex items-center gap-2 text-[#adff02] font-mono text-sm w-full justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {txMsg}
                  </div>
                ) : (
                  <button
                    onClick={handleBuy}
                    className="w-full py-4 bg-[#adff02] hover:bg-white text-black font-black font-mono text-sm tracking-widest uppercase transition-all"
                    style={{ boxShadow: '0 0 20px #adff0240' }}
                  >
                    {connected ? `BUY TICKET — ${TICKET_COST_GOR} GOR` : 'CONNECT WALLET'}
                  </button>
                )}

                {txStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 font-mono text-xs w-full">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {txMsg}
                  </div>
                )}
              </>
            )}

            {/* ── RESULT PHASE actions ── */}
            {phase === 'result' && (
              <>
                {wins.length > 0 ? (
                  <div className="text-center">
                    <p className="font-mono font-black text-2xl text-[#adff02]" style={{ textShadow: '0 0 20px #adff02' }}>YOU WIN!</p>
                    <p className="font-mono text-sm text-white mt-1">
                      <span className="text-[#adff02] font-black text-xl">{totalPayout.toLocaleString()}</span>
                      <span className="text-gray-400 ml-1 text-xs">DEBRIS</span>
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-mono font-black text-xl text-gray-500">NO MATCH</p>
                    <p className="font-mono text-xs text-gray-700 mt-1 tracking-widest uppercase">Better luck next time</p>
                  </div>
                )}

                {/* Win breakdown */}
                {wins.length > 0 && (
                  <div className="w-full space-y-1">
                    {wins.map((w, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[#adff0210] border border-[#adff0230] font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <img src={SYMBOLS[w.symIdx].image} className="w-4 h-4 object-contain" alt="" />
                          <span className="text-[#adff02] uppercase tracking-wider">{SYMBOLS[w.symIdx].name} × 3</span>
                        </div>
                        <span className="text-white font-bold">{w.payout}× = {(w.payout * TICKET_COST_GOR).toLocaleString()} DEBRIS</span>
                      </div>
                    ))}
                  </div>
                )}

                {wins.length > 0 && claimStatus !== 'done' && (
                  <button
                    onClick={handleClaim}
                    disabled={claimStatus === 'loading'}
                    className="w-full py-3 bg-[#adff02] hover:bg-white text-black font-black font-mono text-sm tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ boxShadow: '0 0 20px #adff0240' }}
                  >
                    {claimStatus === 'loading'
                      ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{claimMsg}</span>
                      : `CLAIM ${totalPayout.toLocaleString()} DEBRIS`
                    }
                  </button>
                )}
                {claimStatus === 'done' && (
                  <div className="w-full text-center font-mono text-xs text-[#adff02] bg-[#adff0210] border border-[#adff0230] px-3 py-2">
                    ✓ {claimMsg}
                  </div>
                )}
                {claimStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 font-mono text-xs">
                    <AlertCircle className="w-4 h-4" />{claimMsg}
                  </div>
                )}

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => {
                      setPhase('buy');
                      setGrid([]);
                      setRevealed(Array(9).fill(false));
                      setWins([]);
                      setTotalPayout(0);
                      setScratchedCount(0);
                      setClaimStatus('idle');
                      setClaimMsg('');
                      ticketTxRef.current = '';
                    }}
                    className="flex-1 py-3 bg-transparent border border-[#adff0240] hover:border-[#adff02] text-[#adff02] font-mono text-sm tracking-widest uppercase transition-all"
                  >
                    BUY AGAIN
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-transparent border border-white/10 hover:border-white/30 text-gray-500 hover:text-white font-mono text-sm tracking-widest uppercase transition-all"
                  >
                    CLOSE
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── FOOTER BAR ── */}
        <div
          className="relative z-10 flex items-center justify-between px-6 py-2"
          style={{ borderTop: '1px solid #adff0220', background: '#00000060' }}
        >
          {/* Barcode decorative */}
          <svg width="64" height="16" viewBox="0 0 64 16">
            <rect x="0"  y="0" width="2"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="5"  y="0" width="2"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="10" y="0" width="1"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="14" y="0" width="3"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="21" y="0" width="1"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="25" y="0" width="3"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="32" y="0" width="1"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="36" y="0" width="3"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="43" y="0" width="2"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="48" y="0" width="2"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="53" y="0" width="2"  height="14" fill="#adff02" opacity="0.5"/>
            <rect x="58" y="0" width="4"  height="14" fill="#adff02" opacity="0.5"/>
          </svg>

          <span
            className="font-mono text-[7px] text-[#adff02] tracking-wider opacity-40"
          >
            CHAIN-VERIFIED
          </span>

          <span
            className="font-mono text-[9px] text-[#adff02]"
            style={{ textShadow: '0 0 6px #adff02', animation: 'flicker 3s infinite' }}
          >
            ● ONLINE
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScratchTicket;
