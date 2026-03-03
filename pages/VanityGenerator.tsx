import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Terminal, Cpu, Download, Lock, Unlock, Play, Pause, Square,
  Zap, Trophy, AlertTriangle, Copy, Check, Settings, Sparkles,
  Wallet, ArrowDownToLine, ArrowUpFromLine, DollarSign, Plus, Minus
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
    isDepositing,
    isWithdrawing,
    error: paymentError,
    initializeMining,
    chargeForBatch,
    refreshBalance,
    recordMatch: recordMatchPayment,
    setMiningActive,
    resetSession,
    setError: setPaymentError,
    deposit,
    withdraw,
  } = useVanityPayment();

  // Input state
  const [inputName, setInputName] = useState('');
  const [charVariants, setCharVariants] = useState<CharVariant[]>([]);
  const [prefixLen, setPrefixLen] = useState(4);
  const [suffixLen, setSuffixLen] = useState(0);
  const [includeContains, setIncludeContains] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0.1);

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
  }, [connected, walletAddress, miningAccount, initializeMining]);

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

    // Calculate batchesPerPayment as 1/4th of the deposit amount
    // This means the user will be charged every 1/4th of their deposit worth of batches
    const batchesPerPayment = Math.max(1, Math.floor(depositAmount / 4 / batchCostGOR));

    workerManagerRef.current = new WorkerManager({
      workerPath: '../workers/vanityMiner.worker.ts',
      maxWorkers: 8,
      batchesPerPayment: batchesPerPayment,
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
        recordMatchPayment(data.address);
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
  }, [patterns, isMining, connected, walletAddress, miningAccount, batchCostGOR, batchCostLamports, chargeForBatch, currency, initializeMining, recordMatchPayment, setMiningActive, setPaymentError, depositAmount]);

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
  }, [refreshBalance, setMiningActive]);

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

  // Determine if both prefix and suffix are selected (invalid state)
  const isBothPrefixAndSuffix = prefixLen > 0 && suffixLen > 0;

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
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${accentBg} text-black rounded`}>
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">VANITY_MINER_v1.0</h1>
              <p className="text-[10px] text-gray-500 uppercase">Gorbagana L2 Network • Proof of Work</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {miningAccount && (
              <div className="text-right">
                <div className="text-[10px] text-gray-500 uppercase">MINING_BALANCE</div>
                <div className={`text-lg font-bold ${accentColor}`}>
                  {formatGOR(miningAccount.balance)} {currency}
                </div>
              </div>
            )}
            <div className={`h-10 w-[1px] bg-white/10 mx-2`} />
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 uppercase">NETWORK_STATUS</span>
              <span className="text-xs text-magic-green font-bold uppercase flex items-center gap-1">
                <span className="w-2 h-2 bg-magic-green rounded-full animate-pulse" />
                CONNECTED
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Configuration */}
        <div className="space-y-6">
          {/* Account Management */}
          <div className="border border-white/10 bg-black p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Wallet className={`w-4 h-4 ${accentColor}`} />
                <span className="text-sm font-bold uppercase tracking-wider">ACCOUNT_MANAGEMENT</span>
              </div>
              {miningAccount && (
                <button 
                  onClick={() => refreshBalance()}
                  className="text-[10px] text-gray-500 hover:text-white transition-colors uppercase"
                >
                  Refresh
                </button>
              )}
            </div>

            {!connected ? (
              <div className="text-center py-4 border border-dashed border-white/20">
                <p className="text-xs text-gray-500 uppercase mb-2">Connect wallet to manage mining account</p>
              </div>
            ) : !miningAccount ? (
              <button
                onClick={initializeMining}
                disabled={isInitializing}
                className={`w-full py-3 border ${accentBorder} ${accentColor} hover:${accentBg} hover:text-black transition-all font-bold text-xs uppercase flex items-center justify-center gap-2`}
              >
                {isInitializing ? <Cpu className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                INITIALIZE_MINING_ACCOUNT
              </button>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-900/50 border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase mb-1">BALANCE</div>
                    <div className={`text-xl font-bold ${accentColor}`}>{formatGOR(miningAccount.balance)} {currency}</div>
                  </div>
                  <div className="p-3 bg-gray-900/50 border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase mb-1">TOTAL_SPENT</div>
                    <div className="text-xl font-bold text-white">{formatGOR(miningAccount.totalSpent)} {currency}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center bg-gray-900 border border-gray-800 px-3 py-2">
                      <input 
                        type="number" 
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
                        className="bg-transparent border-none outline-none text-sm w-full"
                        step="0.1"
                        min="0.01"
                      />
                      <span className="text-[10px] text-gray-500 ml-2">{currency}</span>
                    </div>
                    <button
                      onClick={() => deposit(depositAmount)}
                      disabled={isDepositing || depositAmount <= 0}
                      className={`px-4 py-2 ${accentBg} text-black font-bold text-xs uppercase flex items-center gap-2 disabled:opacity-50`}
                    >
                      {isDepositing ? <Cpu className="w-3 h-3 animate-spin" /> : <ArrowDownToLine className="w-3 h-3" />}
                      DEPOSIT
                    </button>
                  </div>
                  
                  <button
                    onClick={withdraw}
                    disabled={isWithdrawing || miningAccount.balance <= 0}
                    className="w-full py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-white transition-all font-bold text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isWithdrawing ? <Cpu className="w-3 h-3 animate-spin" /> : <ArrowUpFromLine className="w-3 h-3" />}
                    WITHDRAW_ALL_FUNDS
                  </button>
                </div>
              </div>
            )}
            
            {paymentError && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 text-red-400 text-[10px] uppercase flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}
          </div>

          {/* Pattern Input */}
          <div className="border border-white/10 bg-black p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className={`w-4 h-4 ${accentColor}`} />
              <span className="text-sm font-bold uppercase tracking-wider">MINING_CONFIGURATION</span>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-2">TARGET_PATTERN</label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    placeholder="ENTER_NAME_OR_PHRASE"
                    className="w-full bg-gray-900 border border-gray-800 px-4 py-3 text-lg font-bold tracking-widest focus:border-magic-purple outline-none transition-colors uppercase"
                    maxLength={12}
                  />
                  <Sparkles className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${accentColor} opacity-50`} />
                </div>
                <p className="text-[10px] text-gray-600 mt-2">Base58 characters only (no 0, O, I, l)</p>
              </div>

              {/* Prefix/Suffix and Character Substitutions Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Prefix Control */}
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-2">PREFIX_LENGTH</label>
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => setPrefixLen(Math.max(0, prefixLen - 1))}
                      className="w-8 h-8 bg-gray-900 border border-gray-800 flex items-center justify-center hover:border-gray-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xl font-bold w-8 text-center">{prefixLen}</span>
                    <button
                      onClick={() => setPrefixLen(Math.min(inputName.length, prefixLen + 1))}
                      className="w-8 h-8 bg-gray-900 border border-gray-800 flex items-center justify-center hover:border-gray-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Character Substitutions for Prefix */}
                  {charVariants.length > 0 && prefixLen > 0 && suffixLen === 0 && !isBothPrefixAndSuffix && (
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase mb-2">CHARACTER_SUBSTITUTIONS</label>
                      <div className="flex gap-2 flex-wrap">
                        {charVariants.slice(0, prefixLen).map((cv, idx) => (
                          <div key={idx} className="flex flex-col gap-1 items-center">
                            <div className="text-sm font-bold text-white mb-1 h-6 flex items-center">
                              {cv.char.toUpperCase()}
                            </div>
                            <div className="flex flex-col gap-1">
                              {cv.variants.map(v => (
                                <button
                                  key={v}
                                  onClick={() => toggleVariant(idx, v)}
                                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold border transition-all ${
                                    cv.selected.includes(v)
                                      ? `${accentBg} text-black border-transparent`
                                      : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'
                                  }`}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Suffix Control */}
                <div>
                  <label className="block text-[10px] text-gray-500 uppercase mb-2">SUFFIX_LENGTH</label>
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => setSuffixLen(Math.max(0, suffixLen - 1))}
                      className="w-8 h-8 bg-gray-900 border border-gray-800 flex items-center justify-center hover:border-gray-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xl font-bold w-8 text-center">{suffixLen}</span>
                    <button
                      onClick={() => setSuffixLen(Math.min(inputName.length - prefixLen, suffixLen + 1))}
                      className="w-8 h-8 bg-gray-900 border border-gray-800 flex items-center justify-center hover:border-gray-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Character Substitutions for Suffix */}
                  {charVariants.length > 0 && suffixLen > 0 && prefixLen === 0 && !isBothPrefixAndSuffix && (
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase mb-2">CHARACTER_SUBSTITUTIONS</label>
                      <div className="flex gap-2 flex-wrap">
                        {charVariants.slice(inputName.length - suffixLen).map((cv, idx) => (
                          <div key={idx} className="flex flex-col gap-1 items-center">
                            <div className="text-sm font-bold text-white mb-1 h-6 flex items-center">
                              {cv.char.toUpperCase()}
                            </div>
                            <div className="flex flex-col gap-1">
                              {cv.variants.map(v => (
                                <button
                                  key={v}
                                  onClick={() => toggleVariant(inputName.length - suffixLen + idx, v)}
                                  className={`w-7 h-7 flex items-center justify-center text-xs font-bold border transition-all ${
                                    cv.selected.includes(v)
                                      ? `${accentBg} text-black border-transparent`
                                      : 'bg-gray-900 border-gray-800 text-gray-500 hover:border-gray-600'
                                  }`}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Invalid State Message */}
              {isBothPrefixAndSuffix && (
                <div className="p-4 bg-red-900/20 border border-red-500/50 rounded">
                  <p className="text-red-400 text-xs uppercase font-bold">
                    Invalid Configuration: Cannot use both PREFIX and SUFFIX simultaneously. Please select only one.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800">
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
                disabled={!inputName || (prefixLen === 0 && suffixLen === 0) || !connected || isInitializing || isBothPrefixAndSuffix}
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
                            <Unlock className="w-3 h-3 text-magic-green" />
                          ) : (
                            <Lock className="w-3 h-3 text-gray-500" />
                          )}
                          <span className="text-[10px] text-gray-500 uppercase">ADDRESS_FOUND</span>
                        </div>
                        <div className="text-sm font-bold break-all text-white">
                          {match.unlocked ? match.address : blurAddress(match.address)}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="text-[10px] text-gray-500">
                            SCORE: <span className="text-white">{match.score}</span>
                          </div>
                          <div className="text-[10px] text-gray-500">
                            TIME: <span className="text-white">{formatDuration(match.timestamp / 1000)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {!match.unlocked ? (
                          <button
                            onClick={() => unlockMatch(idx)}
                            className={`px-3 py-1.5 ${accentBg} text-black text-[10px] font-bold uppercase flex items-center gap-2 hover:opacity-90`}
                          >
                            <Unlock className="w-3 h-3" />
                            UNLOCK
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => copyAddress(match.address)}
                              className="px-3 py-1.5 bg-gray-800 text-white text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-gray-700"
                            >
                              {copiedAddress === match.address ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedAddress === match.address ? 'COPIED' : 'COPY'}
                            </button>
                            <button
                              onClick={() => downloadKeypair(match)}
                              className="px-3 py-1.5 bg-gray-800 text-white text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-gray-700"
                            >
                              <Download className="w-3 h-3" />
                              SAVE
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VanityGenerator;
