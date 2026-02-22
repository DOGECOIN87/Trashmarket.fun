import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Terminal, Cpu, Download, Lock, Unlock, Play, Pause, Square,
  Zap, Trophy, AlertTriangle, Copy, Check, Settings, Sparkles,
  Wallet, ArrowDownToLine, ArrowUpFromLine, DollarSign
} from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  WorkerManager,
  PatternConfig,
  MatchData,
  ProgressData,
  generatePatternVariations,
  estimateDifficulty,
  formatDuration,
  formatNumber,
  BASE58_SUBSTITUTIONS,
} from '../lib/workerManager';
import {
  useVanityPayment,
  calculateBatchCostGOR,
  calculateBatchCostLamports,
  calculateDifficultyMultiplier,
  calculateEstimatedAttempts,
} from '../lib/useVanityPayment';

// Treasury wallet for fees
const TREASURY_WALLET = 'TMABDMgLHfmmRNyHgbHTP9P5XP1zrAMFfbRAef69o9f';

interface CharVariant {
  char: string;
  variants: string[];
  selected: string[];
}

interface StoredMatch extends MatchData {
  encrypted: boolean;
  unlocked: boolean;
}

const VanityGenerator: React.FC = () => {
  const { accentColor, currency } = useNetwork();
  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  // Payment hook
  const {
    miningAccount,
    isInitializing,
    error: paymentError,
    initializeMining,
    chargeForBatch,
    refreshBalance,
    recordMatch,
    setMiningActive,
    resetSession,
    setError: setPaymentError,
  } = useVanityPayment();

  // Input state
  const [inputName, setInputName] = useState('');
  const [charVariants, setCharVariants] = useState<CharVariant[]>([]);
  const [prefixLen, setPrefixLen] = useState(4);
  const [suffixLen, setSuffixLen] = useState(0);
  const [includeContains, setIncludeContains] = useState(false);

  // Mining state
  const [isMining, setIsMining] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [workerCount, setWorkerCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);

  // UI state
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Worker manager ref
  const workerManagerRef = useRef<WorkerManager | null>(null);

  // Calculate patterns and difficulty
  const patterns = useMemo(() => {
    if (!inputName || charVariants.length === 0) return null;

    const selectedPattern = charVariants.map(cv =>
      cv.selected.length > 0 ? cv.selected[0] : cv.char
    ).join('');

    const prefixPattern = selectedPattern.slice(0, prefixLen);
    const suffixPattern = suffixLen > 0 ? selectedPattern.slice(-suffixLen) : '';

    const prefixes = prefixLen > 0 ? generatePatternVariations(prefixPattern) : [];
    const suffixes = suffixLen > 0 ? generatePatternVariations(suffixPattern) : [];
    const contains = includeContains ? generatePatternVariations(selectedPattern) : [];

    return { prefixes, suffixes, contains };
  }, [inputName, charVariants, prefixLen, suffixLen, includeContains]);

  const difficulty = useMemo(() => {
    return estimateDifficulty(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  // Cost calculations
  const batchCostGOR = useMemo(() => {
    return calculateBatchCostGOR(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const batchCostLamports = useMemo(() => {
    return calculateBatchCostLamports(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const difficultyMultiplier = useMemo(() => {
    return calculateDifficultyMultiplier(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const estimatedAttempts = useMemo(() => {
    return calculateEstimatedAttempts(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const estimatedTotalCost = useMemo(() => {
    if (estimatedAttempts <= 0) return 0;
    // Cost = (estimatedAttempts / batchSize) * batchCost
    // batchSize = 500 keys/batch * batchesPerPayment(10) = 5000 keys per payment
    return (estimatedAttempts / 5000) * batchCostGOR;
  }, [estimatedAttempts, batchCostGOR]);

  // Initialize character variants when input changes
  useEffect(() => {
    if (!inputName) {
      setCharVariants([]);
      return;
    }

    const newVariants: CharVariant[] = inputName.split('').map((char) => ({
      char,
      variants: BASE58_SUBSTITUTIONS[char] || [char],
      selected: [char],
    }));

    setCharVariants(newVariants);
  }, [inputName]);

  // Auto-initialize mining account when wallet connects
  useEffect(() => {
    if (connected && walletAddress && !miningAccount) {
      initializeMining();
    }
  }, [connected, walletAddress]);

  // Toggle a variant selection
  const toggleVariant = (charIndex: number, variant: string) => {
    setCharVariants(prev => {
      const updated = [...prev];
      const cv = { ...updated[charIndex] };

      if (cv.selected.includes(variant)) {
        if (cv.selected.length > 1) {
          cv.selected = cv.selected.filter(v => v !== variant);
        }
      } else {
        cv.selected = [...cv.selected, variant];
      }

      updated[charIndex] = cv;
      return updated;
    });
  };

  // Start mining with payment integration
  const startMining = useCallback(async () => {
    if (!patterns || isMining) return;

    if (!connected || !walletAddress) {
      setPaymentError('Please connect your wallet first');
      return;
    }

    // Initialize mining account if needed
    if (!miningAccount) {
      const success = await initializeMining();
      if (!success) return;
    }

    // Check balance covers at least one payment cycle
    if (miningAccount && miningAccount.balance < batchCostGOR) {
      setPaymentError(`Insufficient balance. Need at least ${batchCostGOR.toFixed(4)} ${currency} per payment cycle.`);
      return;
    }

    const config: PatternConfig = {
      prefixes: patterns.prefixes.slice(0, 100),
      suffixes: patterns.suffixes.slice(0, 50),
      contains: patterns.contains.slice(0, 20),
      minScore: 10,
    };

    // Charge for initial batch before starting
    const initialPaymentOk = await chargeForBatch(batchCostLamports);
    if (!initialPaymentOk) {
      setPaymentError('Initial payment failed. Please try again.');
      return;
    }
    setTotalSpent(batchCostGOR);

    workerManagerRef.current = new WorkerManager({
      workerPath: '../workers/vanityMiner.worker.ts',
      maxWorkers: 8,
      batchesPerPayment: 10,
      onBatchComplete: async () => {
        // Charge for next batch cycle
        const success = await chargeForBatch(batchCostLamports);
        if (success) {
          setTotalSpent(prev => prev + batchCostGOR);
        }
        return success;
      },
      onProgress: (data) => {
        setProgress(data);
      },
      onMatch: (data) => {
        setMatches(prev => [...prev, { ...data, encrypted: true, unlocked: false }]);
        recordMatch();
      },
      onError: (error) => {
        console.error('Mining error:', error);
      },
    });

    workerManagerRef.current.start(config);
    setWorkerCount(workerManagerRef.current.getOptimalWorkerCount());
    setIsMining(true);
    setIsPaused(false);
    setMiningActive(true);
  }, [patterns, isMining, connected, walletAddress, miningAccount, batchCostGOR, batchCostLamports, chargeForBatch, currency]);

  // Pause/Resume mining
  const togglePause = useCallback(() => {
    if (!workerManagerRef.current) return;

    if (isPaused) {
      workerManagerRef.current.resume();
    } else {
      workerManagerRef.current.pause();
    }
    setIsPaused(!isPaused);
  }, [isPaused]);

  // Stop mining
  const stopMining = useCallback(() => {
    workerManagerRef.current?.terminate();
    workerManagerRef.current = null;
    setIsMining(false);
    setIsPaused(false);
    setMiningActive(false);
    refreshBalance();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerManagerRef.current?.terminate();
    };
  }, []);

  // Unlock a match
  const unlockMatch = async (index: number) => {
    setMatches(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], encrypted: false, unlocked: true };
      return updated;
    });
  };

  // Download keypair
  const downloadKeypair = (match: StoredMatch) => {
    if (match.encrypted) return;

    const keypairData = {
      publicKey: match.address,
      secretKey: Array.from(match.secretKey),
    };

    const blob = new Blob([JSON.stringify(keypairData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vanity-${match.address.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy address
  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Blur address for locked matches
  const blurAddress = (addr: string) => {
    return addr.slice(0, 8) + '\u2022'.repeat(24) + addr.slice(-8);
  };

  // Format GOR for display
  const formatGOR = (amount: number): string => {
    return amount.toFixed(4);
  };

  const accentBorder = accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green';
  const accentBg = accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green';

  return (
    <div className="min-h-screen text-white font-mono">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30 pointer-events-none"
        src="/gorbagio-video-mattress.mp4"
      />

      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-black via-gray-900 to-black">
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className={`w-5 h-5 ${accentColor}`} />
            <h1 className="text-xl font-bold tracking-tighter uppercase">VANITY_MINER</h1>
            <span className="text-[10px] text-gray-500 border border-gray-800 px-2 py-0.5">PAID</span>
          </div>

          {/* Live GOR Balance */}
          <div className="flex items-center gap-4">
            {connected && miningAccount && (
              <div className={`flex items-center gap-3 border ${accentBorder} px-4 py-2`}>
                <Wallet className={`w-4 h-4 ${accentColor}`} />
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">MINING_BALANCE</div>
                  <div className={`text-lg font-bold ${accentColor}`}>
                    {formatGOR(miningAccount.balance)} {currency}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <Cpu className="w-3 h-3" />
              {workerCount > 0 ? `${workerCount} CORES` : 'IDLE'}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-8">
        {/* Payment Error Banner */}
        {paymentError && (
          <div className="mb-6 border border-magic-red bg-magic-red/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-magic-red flex-shrink-0" />
              <span className="text-sm text-magic-red">{paymentError}</span>
            </div>
            <button
              onClick={() => setPaymentError(null)}
              className="text-magic-red hover:text-white text-xs uppercase"
            >
              DISMISS
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: Pattern Builder + Cost Display */}
          <div className="space-y-6">

            {/* Wallet Not Connected Notice */}
            {!connected && (
              <div className="border border-yellow-500/30 bg-yellow-500/5 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Wallet className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-bold text-yellow-500 uppercase">WALLET_REQUIRED</span>
                </div>
                <p className="text-sm text-yellow-500/80">
                  Connect your wallet to start mining vanity addresses. Mining charges {currency} per batch of attempts. Unused balance stays in your wallet.
                </p>
              </div>
            )}

            {/* Name Input */}
            <div className={`border ${accentBorder}/30 bg-black p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className={`w-4 h-4 ${accentColor}`} />
                <span className="text-sm font-bold uppercase tracking-wider">YOUR_NAME</span>
              </div>

              <input
                type="text"
                name="vanityName"
                value={inputName}
                onChange={(e) => setInputName(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                placeholder="Enter desired name (letters + numbers only)"
                className="w-full bg-gray-900 border border-gray-700 px-4 py-3 text-xl font-bold text-white placeholder-gray-600 focus:border-magic-green focus:outline-none"
                maxLength={12}
              />

              <div className="mt-2 text-[10px] text-gray-500 flex justify-between">
                <span>Base58 ONLY (no 0, O, I, l)</span>
                <span>{inputName.length}/12 chars</span>
              </div>
            </div>

            {/* Character Variant Grid */}
            {charVariants.length > 0 && (
              <div className="border border-white/10 bg-black p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold uppercase tracking-wider">CHAR_VARIANTS</span>
                  <span className="text-[10px] text-gray-500">Click to toggle</span>
                </div>

                <div className="overflow-x-auto">
                  <div className="flex gap-1 min-w-max">
                    {charVariants.map((cv, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className={`w-10 h-10 flex items-center justify-center border-2 ${accentBorder} text-lg font-bold ${accentColor}`}>
                          {cv.char}
                        </div>
                        {cv.variants.map((variant, vIdx) => (
                          <button
                            key={vIdx}
                            onClick={() => toggleVariant(idx, variant)}
                            className={`w-10 h-10 flex items-center justify-center border text-sm font-bold transition-all ${
                              cv.selected.includes(variant)
                                ? `${accentBorder} ${accentColor} ${accentBg}/20`
                                : 'border-gray-700 text-gray-500 hover:border-gray-500'
                            }`}
                          >
                            {variant}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 text-[10px] text-gray-500">
                  SELECTED: {charVariants.map(cv => cv.selected.join('/')).join(' ')}
                </div>
              </div>
            )}

            {/* Mining Config */}
            <div className="border border-white/10 bg-black p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-bold uppercase tracking-wider">MINING_CONFIG</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase block mb-2">PREFIX_LENGTH</label>
                  <div className="flex gap-px">
                    {[0, 2, 3, 4, 5, 6].map(len => (
                      <button
                        key={len}
                        onClick={() => setPrefixLen(len)}
                        className={`flex-1 py-2 text-xs font-bold ${
                          prefixLen === len
                            ? `${accentBg} text-black`
                            : 'bg-gray-900 text-gray-500 hover:text-white'
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase block mb-2">SUFFIX_LENGTH</label>
                  <div className="flex gap-px">
                    {[0, 2, 3, 4].map(len => (
                      <button
                        key={len}
                        onClick={() => setSuffixLen(len)}
                        className={`flex-1 py-2 text-xs font-bold ${
                          suffixLen === len
                            ? `${accentBg} text-black`
                            : 'bg-gray-900 text-gray-500 hover:text-white'
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Difficulty Display */}
              <div className="mt-6 p-3 bg-gray-900/50 border border-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] text-gray-500 uppercase">DIFFICULTY</span>
                  <span className={`text-xs font-bold uppercase ${
                    difficulty.difficulty === 'easy' ? 'text-magic-green' :
                    difficulty.difficulty === 'medium' ? 'text-yellow-500' :
                    difficulty.difficulty === 'hard' ? 'text-orange-500' :
                    'text-magic-red'
                  }`}>
                    {difficulty.difficulty}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      difficulty.difficulty === 'easy' ? 'bg-magic-green w-1/4' :
                      difficulty.difficulty === 'medium' ? 'bg-yellow-500 w-2/4' :
                      difficulty.difficulty === 'hard' ? 'bg-orange-500 w-3/4' :
                      'bg-magic-red w-full'
                    }`}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                  <span>EST_TIME: {formatDuration(difficulty.estimatedSeconds)}</span>
                  <span>PATTERNS: {patterns?.prefixes.length || 0}</span>
                </div>
              </div>
            </div>

            {/* NON-REFUNDABLE DEPOSIT NOTICE */}
            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded">
              <h4 className="text-red-400 font-bold text-sm mb-2 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                NON-REFUNDABLE DEPOSIT
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Deposits are used to pay for mining computation and are committed to the platform.
                <span className="text-red-400 font-semibold"> No withdrawals are permitted — all funds are non-refundable once deposited.</span>
              </p>
            </div>

            {/* LIVE COST DISPLAY */}
            <div className={`border-2 ${accentBorder} bg-black p-6`}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className={`w-4 h-4 ${accentColor}`} />
                  <span className="text-sm font-bold uppercase tracking-wider">LIVE_MINING_COST</span>
                </div>
                <div className={`text-[10px] ${accentBg} text-black px-2 py-0.5 font-bold`}>
                  PER 5,000 ATTEMPTS
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">BATCH_COST</div>
                  <div className="text-3xl font-bold text-white">
                    {formatGOR(batchCostGOR)} <span className={`text-lg ${accentColor}`}>{currency}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase">MULTIPLIER</div>
                  <div className="text-3xl font-bold text-white">
                    {difficultyMultiplier}x
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Pattern Complexity:</span>
                  <span className="text-white uppercase">{difficulty.difficulty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Attempts for Match:</span>
                  <span className="text-white">{formatNumber(estimatedAttempts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Cost for Match:</span>
                  <span className={`${accentColor} font-bold`}>
                    ~{estimatedTotalCost > 1000 ? formatNumber(estimatedTotalCost) : estimatedTotalCost.toFixed(2)} {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time per Batch:</span>
                  <span className="text-white">~20ms</span>
                </div>
              </div>

              {/* Real-time cost accumulator during mining */}
              {isMining && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs uppercase">SESSION_SPENT:</span>
                    <span className={`text-2xl font-bold ${accentColor}`}>
                      {formatGOR(totalSpent)} {currency}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {progress?.checked ? formatNumber(progress.checked) : '0'} addresses checked
                  </div>
                </div>
              )}
            </div>

            {/* Mining Controls */}
            <div className={`border ${accentBorder} p-1`}>
              {!isMining ? (
                <button
                  onClick={startMining}
                  disabled={!inputName || prefixLen === 0 || !connected || isInitializing}
                  className={`w-full ${accentBg} text-black font-bold py-4 text-sm uppercase tracking-wider flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity`}
                >
                  {isInitializing ? (
                    <>
                      <Cpu className="w-4 h-4 animate-spin" />
                      INITIALIZING...
                    </>
                  ) : !connected ? (
                    <>
                      <Wallet className="w-4 h-4" />
                      CONNECT_WALLET
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      START_MINING
                      <span className="opacity-70">( {formatGOR(batchCostGOR)} {currency}/cycle )</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex gap-1">
                  <button
                    onClick={togglePause}
                    className="flex-1 bg-yellow-500 text-black font-bold py-4 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isPaused ? 'RESUME' : 'PAUSE'}
                  </button>
                  <button
                    onClick={stopMining}
                    className="flex-1 bg-magic-red text-black font-bold py-4 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    STOP
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Progress & Results */}
          <div className="space-y-6">
            {/* Mining Progress */}
            {(isMining || progress) && (
              <div className={`border ${isMining ? accentBorder : 'border-white/10'} bg-black p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Cpu className={`w-4 h-4 ${isMining ? accentColor + ' animate-pulse' : 'text-gray-500'}`} />
                    <span className="text-sm font-bold uppercase tracking-wider">
                      {isMining ? (isPaused ? 'PAUSED' : 'MINING_IN_PROGRESS') : 'MINING_STOPPED'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {workerCount} THREADS
                  </span>
                </div>

                {progress && (
                  <>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-gray-800 overflow-hidden mb-4">
                      <div
                        className={`h-full ${accentBg} transition-all duration-300`}
                        style={{
                          width: `${Math.min((progress.checked / Math.max(estimatedAttempts, 1)) * 100, 100)}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-4">
                      <span>{formatNumber(progress.checked)} checked</span>
                      <span>Est. {formatNumber(estimatedAttempts)} for match</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 bg-gray-900/50 border border-gray-800">
                        <div className={`text-2xl font-bold ${accentColor}`}>{formatNumber(progress.rate)}/s</div>
                        <div className="text-[10px] text-gray-500 uppercase">HASH_RATE</div>
                      </div>
                      <div className="p-3 bg-gray-900/50 border border-gray-800">
                        <div className={`text-2xl font-bold ${accentColor}`}>
                          {formatGOR(totalSpent)}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase">{currency}_SPENT</div>
                      </div>
                      <div className="p-3 bg-gray-900/50 border border-gray-800">
                        <div className="text-2xl font-bold text-white">{formatDuration(progress.elapsed)}</div>
                        <div className="text-[10px] text-gray-500 uppercase">TIME_ELAPSED</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Matches Found */}
            <div className="border border-white/10 bg-black p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className={`w-4 h-4 ${matches.length > 0 ? 'text-yellow-500' : 'text-gray-500'}`} />
                  <span className="text-sm font-bold uppercase tracking-wider">MATCHES_FOUND</span>
                  <span className={`text-xs font-bold px-2 py-0.5 ${accentBg} text-black`}>
                    {matches.length}
                  </span>
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <Zap className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm uppercase">No matches yet</p>
                  <p className="text-[10px] mt-1">Start mining to find vanity addresses</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {matches.map((match, idx) => (
                    <div
                      key={match.address}
                      className={`p-4 border ${match.unlocked ? accentBorder : 'border-gray-700'} bg-gray-900/50`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {match.unlocked ? (
                              <Unlock className="w-3 h-3 text-magic-green flex-shrink-0" />
                            ) : (
                              <Lock className="w-3 h-3 text-gray-500 flex-shrink-0" />
                            )}
                            <code className={`text-sm font-bold truncate ${match.unlocked ? 'text-white' : 'text-gray-500'}`}>
                              {match.unlocked ? match.address : blurAddress(match.address)}
                            </code>
                            {match.unlocked && (
                              <button
                                onClick={() => copyAddress(match.address)}
                                className="text-gray-500 hover:text-white flex-shrink-0"
                              >
                                {copiedAddress === match.address ? (
                                  <Check className="w-3 h-3 text-magic-green" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={`text-[10px] px-2 py-0.5 ${accentBg} text-black font-bold`}>
                              SCORE: {match.score}
                            </span>
                            {match.matches.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="text-[10px] px-2 py-0.5 border border-gray-600 text-gray-400"
                              >
                                {m.type}: {m.pattern}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {match.unlocked ? (
                            <button
                              onClick={() => downloadKeypair(match)}
                              className={`px-3 py-2 ${accentBg} text-black text-[10px] font-bold uppercase flex items-center gap-1`}
                            >
                              <Download className="w-3 h-3" />
                              DOWNLOAD
                            </button>
                          ) : (
                            <button
                              onClick={() => unlockMatch(idx)}
                              className={`px-3 py-2 border ${accentBorder} ${accentColor} text-[10px] font-bold uppercase flex items-center gap-1 hover:${accentBg}/10`}
                            >
                              <Unlock className="w-3 h-3" />
                              UNLOCK
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Session Summary */}
            {totalSpent > 0 && (
              <div className="border border-white/10 bg-black p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">SESSION_SUMMARY</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Spent:</span>
                    <span className={`${accentColor} font-bold`}>{formatGOR(totalSpent)} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Addresses Checked:</span>
                    <span className="text-white">{formatNumber(progress?.checked || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cost per Cycle:</span>
                    <span className="text-white">{formatGOR(batchCostGOR)} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Matches Found:</span>
                    <span className="text-white">{matches.length}</span>
                  </div>
                  {miningAccount && (
                    <div className="flex justify-between pt-2 border-t border-gray-800">
                      <span className="text-gray-400">Remaining Balance:</span>
                      <span className={`${accentColor} font-bold`}>{formatGOR(miningAccount.balance)} {currency}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-yellow-500/80">
                <span className="font-bold uppercase">SECURITY_NOTICE:</span> All keypairs are generated
                client-side in your browser. Private keys never leave your device. {currency} payments
                are processed on-chain to the platform treasury.{' '}
                <span className="font-bold text-red-400">
                  Mining charges are strictly non-refundable. No withdrawals are permitted once funds are deposited.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VanityGenerator;
