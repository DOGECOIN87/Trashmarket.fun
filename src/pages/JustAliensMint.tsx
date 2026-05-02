import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Twitter,
  Globe,
  MessageCircle,
  Send,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  X,
} from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { useNotificationStore } from '../stores/useAppStore';
import {
  fetchCollectionState,
  mintJustAlien,
  JUST_ALIENS_CONFIG,
  type CollectionState,
  type MintResult,
} from '../services/launchpadService';

// ============================================================
// TYPES
// ============================================================

type MintStatus = 'idle' | 'preparing' | 'signing' | 'confirming' | 'success' | 'error';

// ============================================================
// HELPERS
// ============================================================

/** Get signTransaction from the active wallet provider */
function getWalletSignTransaction(walletType: string | null) {
  if (!walletType || typeof window === 'undefined') return null;
  const provider =
    walletType === 'backpack'
      ? (window as any).backpack?.gorbagana || (window as any).backpack
      : (window as any).gorbag || (window as any).gorbagWallet;
  if (!provider?.signTransaction) return null;
  return provider.signTransaction.bind(provider);
}

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-gray-800 bg-[#080808] px-4 py-3 flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      <span className={`text-lg font-black ${accent ? 'text-magic-blue' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}

function RarityCard({
  name,
  count,
  percentage,
  description,
  color,
}: {
  name: string;
  count: number;
  percentage: number;
  description: string;
  color: string;
}) {
  return (
    <div
      className="border bg-[#080808] p-5 flex flex-col gap-3"
      style={{ borderColor: `${color}33` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>
          {name}
        </span>
        <span className="text-xs font-bold text-gray-500">{percentage}%</span>
      </div>
      <div className="text-2xl font-black text-white">{count.toLocaleString()} / 10,000</div>
      <div
        className="h-1 w-full bg-gray-800 overflow-hidden"
      >
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function SocialLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="flex items-center gap-2 px-4 py-2 border border-gray-800 text-gray-400 hover:text-magic-blue hover:border-magic-blue/40 transition-all text-xs font-bold uppercase tracking-wider"
    >
      {icon}
      {label}
    </a>
  );
}

// Image carousel with fallback
function PreviewCarousel({ images }: { images: readonly string[] }) {
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % images.length);
    }, 3000);
  }, [images.length]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const go = (dir: 1 | -1) => {
    setCurrent((c) => (c + dir + images.length) % images.length);
    startTimer();
  };

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto border border-gray-800 bg-[#080808] overflow-hidden">
      {images.map((src, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          {failed[i] ? (
            <AlienPlaceholder index={i} />
          ) : (
            <img
              src={src}
              alt={`JUST ALIENS preview ${i}`}
              className={`w-full h-full object-cover transition-opacity duration-300 ${loaded[i] ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded((l) => ({ ...l, [i]: true }))}
              onError={() => setFailed((f) => ({ ...f, [i]: true }))}
            />
          )}
          {!loaded[i] && !failed[i] && <AlienPlaceholder index={i} />}
        </div>
      ))}

      {/* Navigation */}
      <button
        onClick={() => go(-1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/70 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-magic-blue hover:border-magic-blue/40 transition-all"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => go(1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/70 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-magic-blue hover:border-magic-blue/40 transition-all"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); startTimer(); }}
            className={`w-1.5 h-1.5 transition-all ${i === current ? 'bg-magic-blue w-4' : 'bg-gray-600'}`}
          />
        ))}
      </div>

      {/* Corner accent */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-magic-blue" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-magic-blue" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-magic-blue" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-magic-blue" />
    </div>
  );
}

function AlienPlaceholder({ index }: { index: number }) {
  // Cycle through accent colors for visual variety
  const colors = ['#adff02', '#9945ff', '#ff00ff', '#adff02', '#ff00ff'];
  const color = colors[index % colors.length];
  const glyphs = ['👽', '🛸', '🌌', '⚡', '💫'];

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-[#050505]"
      style={{ boxShadow: `inset 0 0 40px ${color}15` }}
    >
      <div className="text-6xl mb-3 opacity-60">{glyphs[index % glyphs.length]}</div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
        JUST ALIENS #{index + 1}
      </p>
    </div>
  );
}

// ============================================================
// SUCCESS MODAL
// ============================================================

function SuccessModal({
  result,
  onClose,
  onMintAnother,
}: {
  result: MintResult;
  onClose: () => void;
  onMintAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-md border border-magic-blue/40 bg-[#050505] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-magic-blue" />
            <span className="text-sm font-black uppercase tracking-wider text-magic-blue">
              Mint Successful!
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* NFT Preview */}
        <div className="p-5">
          <div className="w-full aspect-square bg-[#080808] border border-gray-800 mb-4 overflow-hidden flex items-center justify-center">
            {result.imageUri ? (
              <img
                src={result.imageUri}
                alt={result.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <AlienPlaceholder index={0} />
            )}
          </div>

          {result.name && (
            <h3 className="text-white font-black text-lg text-center mb-1">{result.name}</h3>
          )}

          {/* Mint address */}
          {result.mintAddress && result.mintAddress !== 'PENDING' && (
            <div className="flex items-center gap-2 bg-[#080808] border border-gray-800 px-3 py-2 mb-4">
              <span className="text-xs text-gray-500 font-mono flex-1 truncate">
                {truncateAddress(result.mintAddress)}
              </span>
              <button
                onClick={() => copy(result.mintAddress!)}
                className="text-gray-500 hover:text-magic-blue transition-colors flex-shrink-0"
                title="Copy address"
              >
                {copied ? (
                  <CheckCircle className="w-3.5 h-3.5 text-magic-blue" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {result.imageUri && (
              <a
                href={result.imageUri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-magic-blue text-black font-black text-sm uppercase tracking-wider hover:brightness-110 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                View NFT on IPFS
              </a>
            )}
            {result.signature && (
              <a
                href={`https://trashscan.io/tx/${result.signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-bold uppercase tracking-wider transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Transaction on TrashScan
              </a>
            )}
            <button
              onClick={onMintAnother}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-magic-blue/40 text-magic-blue text-xs font-bold uppercase tracking-wider hover:bg-magic-blue/10 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              Mint Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

const JustAliensMint: React.FC = () => {
  const { connected, address, walletType, connect, availableWallets } = useWallet();
  const { addNotification } = useNotificationStore();

  const [state, setState] = useState<CollectionState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [mintStatus, setMintStatus] = useState<MintStatus>('idle');
  const [lastResult, setLastResult] = useState<MintResult | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);

  // Load collection state on mount
  useEffect(() => {
    fetchCollectionState()
      .then((s) => setState(s))
      .finally(() => setLoadingState(false));
  }, []);

  const progress = state
    ? Math.round((state.itemsMinted / state.totalSupply) * 100)
    : 0;
  const remaining = state ? state.totalSupply - state.itemsMinted : 0;
  const isSoldOut = state ? state.itemsMinted >= state.totalSupply : false;

  // ── Mint handler ──────────────────────────────────────────

  const handleMint = useCallback(async () => {
    if (!connected || !address) return;

    const signTx = getWalletSignTransaction(walletType);
    if (!signTx) {
      addNotification({
        type: 'error',
        title: 'Wallet Error',
        message: 'Could not access wallet signing function. Please reconnect your wallet.',
      });
      return;
    }

    setMintStatus('preparing');
    setLastResult(null);

    try {
      setMintStatus('signing');
      const result = await mintJustAlien(address, signTx);

      if (!result.success) {
        setMintStatus('error');
        setLastResult(result);
        addNotification({
          type: 'error',
          title: 'Mint Failed',
          message: result.error || 'Unknown error occurred.',
        });
        setTimeout(() => setMintStatus('idle'), 3000);
        return;
      }

      setMintStatus('confirming');

      // Brief delay to allow the UI to show the confirming state
      await new Promise((r) => setTimeout(r, 500));

      setMintStatus('success');
      setLastResult(result);
      setShowSuccess(true);

      addNotification({
        type: 'success',
        title: 'NFT Minted!',
        message: result.name ? `${result.name} is now in your wallet.` : 'Your alien has landed.',
        txSignature: result.signature,
      });

      // Refresh collection state
      fetchCollectionState().then((s) => setState(s));
    } catch (err: any) {
      setMintStatus('error');
      const msg = err?.message || 'Unknown error';
      setLastResult({ success: false, error: msg });
      addNotification({
        type: 'error',
        title: 'Mint Error',
        message: msg,
      });
      setTimeout(() => setMintStatus('idle'), 3000);
    }
  }, [connected, address, walletType, addNotification]);

  const handleMintAnother = () => {
    setShowSuccess(false);
    setMintStatus('idle');
    setLastResult(null);
  };

  // ── Mint button label & state ─────────────────────────────

  const mintButtonLabel = () => {
    if (isSoldOut) return 'SOLD OUT';
    if (!state?.isLive) return 'COMING SOON';
    switch (mintStatus) {
      case 'preparing': return 'PREPARING...';
      case 'signing': return 'SIGN IN WALLET...';
      case 'confirming': return 'CONFIRMING...';
      case 'success': return 'MINTED!';
      case 'error': return 'RETRY MINT';
      default: return `MINT NOW — ${JUST_ALIENS_CONFIG.mintPrice} GOR`;
    }
  };

  const mintButtonDisabled =
    !connected ||
    !state?.isLive ||
    isSoldOut ||
    mintStatus === 'preparing' ||
    mintStatus === 'signing' ||
    mintStatus === 'confirming';

  const isMinting =
    mintStatus === 'preparing' ||
    mintStatus === 'signing' ||
    mintStatus === 'confirming';

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen selection:bg-magic-blue selection:text-black">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="border-b border-white/10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: text */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span className="px-2 py-0.5 bg-magic-blue text-black text-[10px] font-black uppercase tracking-widest">
                  {state?.isLive ? 'LIVE NOW' : 'COMING SOON'}
                </span>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Gorbagana Chain
                </span>
              </div>

              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-1">
                BRUH, IT'S
              </p>
              <h1
                className="text-5xl md:text-7xl font-black tracking-tight text-white mb-1 leading-none"
                style={{ textShadow: '0 0 30px rgba(0,212,255,0.35)' }}
              >
                JUST ALIENS
              </h1>
              <h2
                className="text-3xl md:text-5xl font-black tracking-tight mb-6 leading-none"
              >
                <span className="text-white">DUDE </span>
                <span className="text-magic-blue" style={{ textShadow: '0 0 20px rgba(0,212,255,0.6)' }}>RELAX</span>
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed max-w-md mb-6">
                {JUST_ALIENS_CONFIG.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-gray-600 font-mono">
                <span>10,000 unique NFTs</span>
                <span className="text-gray-800">·</span>
                <span>{JUST_ALIENS_CONFIG.mintPrice} GOR per mint</span>
                <span className="text-gray-800">·</span>
                <span>5% royalty</span>
              </div>
            </div>

            {/* Right: carousel */}
            <div className="w-full max-w-sm mx-auto lg:ml-auto">
              <PreviewCarousel images={JUST_ALIENS_CONFIG.previewImages} />
            </div>
          </div>
        </div>
      </section>

      {/* ── MINT PANEL ───────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-12">
          {/* Stats row */}
          {loadingState ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-magic-blue animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                <StatBox label="Price" value={`${JUST_ALIENS_CONFIG.mintPrice} GOR`} accent />
                <StatBox
                  label="Minted"
                  value={`${(state?.itemsMinted ?? 0).toLocaleString()} / ${(state?.totalSupply ?? 10000).toLocaleString()}`}
                />
                <StatBox label="Remaining" value={String(remaining)} />
                <StatBox
                  label="Status"
                  value={isSoldOut ? 'SOLD OUT' : state?.isLive ? 'LIVE' : 'SOON'}
                  accent={state?.isLive && !isSoldOut}
                />
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-[10px] text-gray-600 font-mono uppercase tracking-widest mb-1.5">
                  <span>Mint Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-900 border border-gray-800 overflow-hidden">
                  <div
                    className="h-full bg-magic-blue transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Wallet / Mint button */}
              {!connected ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setShowWalletPicker((v) => !v)}
                    className="w-full py-4 bg-magic-blue text-black font-black text-sm uppercase tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-4 h-4" />
                    Connect Wallet to Mint
                  </button>

                  {showWalletPicker && (
                    <div className="border border-gray-800 bg-[#080808] p-4 flex flex-col gap-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">
                        Select Wallet
                      </p>
                      {availableWallets.map((w) => (
                        <button
                          key={w.id}
                          onClick={() => {
                            connect(w.id);
                            setShowWalletPicker(false);
                          }}
                          className={`flex items-center gap-3 px-4 py-3 border text-sm font-bold transition-all ${
                            w.installed
                              ? 'border-gray-700 text-white hover:border-magic-blue/50 hover:text-magic-blue'
                              : 'border-gray-800 text-gray-600 cursor-not-allowed'
                          }`}
                          disabled={!w.installed}
                        >
                          <span className="text-xl">{w.icon}</span>
                          <span>{w.name}</span>
                          {!w.installed && (
                            <span className="ml-auto text-[10px] text-gray-700 uppercase tracking-wider">
                              Not Installed
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Connected wallet info */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 font-mono mb-1">
                    <span className="w-2 h-2 bg-magic-blue inline-block" />
                    <span>{address ? truncateAddress(address) : 'Connected'}</span>
                  </div>

                  <button
                    onClick={handleMint}
                    disabled={mintButtonDisabled}
                    className={`w-full py-4 font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                      mintButtonDisabled
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : mintStatus === 'error'
                        ? 'bg-red-900/50 border border-red-800 text-red-400 hover:bg-red-900/70'
                        : 'bg-magic-blue text-black hover:brightness-110'
                    }`}
                  >
                    {isMinting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : mintStatus === 'success' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : mintStatus === 'error' ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {mintButtonLabel()}
                  </button>

                  {/* Error message */}
                  {mintStatus === 'error' && lastResult?.error && (
                    <p className="text-xs text-red-400 font-mono text-center">
                      {lastResult.error}
                    </p>
                  )}

                  {/* Go-live date */}
                  {!state?.isLive && state?.goLiveDate && (
                    <p className="text-xs text-gray-600 font-mono text-center">
                      Goes live:{' '}
                      {state.goLiveDate.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── ABOUT ────────────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Description */}
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">
                About the Collection
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Born from the buzz surrounding recent UFO disclosures and Alien speculation.
                In a time when Aliens are dominating headlines, we offer a fun way to explore
                the mystery, reminding everyone to chill out and enjoy the ride.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {JUST_ALIENS_CONFIG.traitCategories.map((trait) => (
                  <div
                    key={trait}
                    className="border border-gray-800 bg-[#080808] px-3 py-2 text-center"
                  >
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-0.5">
                      Trait
                    </p>
                    <p className="text-xs text-magic-blue font-black">{trait}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Collection details */}
            <div className="border border-gray-800 bg-[#080808] p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">
                Collection Details
              </h3>
              <dl className="space-y-3">
                {[
                  ["Collection", "BRUH, IT'S JUST ALIENS"],
                  ['Symbol', JUST_ALIENS_CONFIG.symbol],
                  ['Chain', 'Gorbagana (GOR)'],
                  ['Total Supply', '10,000 NFTs'],
                  ['Mint Price', `${JUST_ALIENS_CONFIG.mintPrice} GOR`],
                  ['Royalty', '5% (500 bps)'],
                  ['Standard', 'Metaplex Token Metadata'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-gray-900">
                    <dt className="text-xs text-gray-600 font-mono uppercase tracking-wider">
                      {label}
                    </dt>
                    <dd className="text-xs text-white font-black">{value}</dd>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2">
                  <dt className="text-xs text-gray-600 font-mono uppercase tracking-wider">
                    Treasury
                  </dt>
                  <dd className="text-xs text-gray-400 font-mono">
                    {truncateAddress(JUST_ALIENS_CONFIG.treasury)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── RARITY TIERS ─────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
            Rarity Tiers
          </h2>
          <p className="text-gray-500 text-xs font-mono mb-8">
            10,000 total NFTs across 3 rarity levels
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {JUST_ALIENS_CONFIG.rarityTiers.map((tier, i) => (
              <React.Fragment key={i}>
                <RarityCard
                  name={tier.name}
                  count={tier.count}
                  percentage={tier.percentage}
                  description={tier.description}
                  color={tier.color}
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL LINKS ─────────────────────────────────── */}
      <section>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6">
            Community
          </h2>
          <div className="flex flex-wrap gap-3">
            {JUST_ALIENS_CONFIG.website && (
              <SocialLink
                href={JUST_ALIENS_CONFIG.website}
                icon={<Globe className="w-3.5 h-3.5" />}
                label="Website"
              />
            )}
            {JUST_ALIENS_CONFIG.twitter && (
              <SocialLink
                href={JUST_ALIENS_CONFIG.twitter}
                icon={<Twitter className="w-3.5 h-3.5" />}
                label="X / Twitter"
              />
            )}
            {JUST_ALIENS_CONFIG.discord && (
              <SocialLink
                href={JUST_ALIENS_CONFIG.discord}
                icon={<MessageCircle className="w-3.5 h-3.5" />}
                label="Discord"
              />
            )}
            {JUST_ALIENS_CONFIG.telegram && (
              <SocialLink
                href={JUST_ALIENS_CONFIG.telegram}
                icon={<Send className="w-3.5 h-3.5" />}
                label="Telegram"
              />
            )}
          </div>
        </div>
      </section>

      {/* ── SUCCESS MODAL ─────────────────────────────────── */}
      {showSuccess && lastResult && lastResult.success && (
        <SuccessModal
          result={lastResult}
          onClose={() => setShowSuccess(false)}
          onMintAnother={handleMintAnother}
        />
      )}
    </div>
  );
};

export default JustAliensMint;
