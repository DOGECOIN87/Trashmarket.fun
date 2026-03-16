import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { audioManager } from '../lib/audioManager';
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
  generatePatternVariationsFromSelected,
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
  calculateCostPerAttemptGOR,
  calculateCostPerAttemptLamports,
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
  useEffect(() => audioManager.playOnInteraction('page_vanity'), []);
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
    chargeForAttempt,
    refreshBalance,
    recordMatch: recordMatchPayment,
    setMiningActive,
    resetSession,
    setError: setPaymentError,
    deposit,
    withdraw,
    isMiningRef,
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
  const [showMatchPrompt, setShowMatchPrompt] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<StoredMatch | null>(null);
  const [depositDepleted, setDepositDepleted] = useState(false);

  // Worker manager ref
  const workerManagerRef = useRef<WorkerManager | null>(null);
  const costPerAttemptLamportsRef = useRef(0);

  // Calculate patterns and difficulty
  const patterns = useMemo(() => {
    if (!inputName || charVariants.length === 0) return null;

    const selectedPattern = charVariants.map(cv =>
      cv.selected.length > 0 ? cv.selected[0] : cv.char
    ).join('');

    // Build a map of selected variants for each character
    const selectedVariantsMap: Record<string, string[]> = {};
    charVariants.forEach((cv) => {
      selectedVariantsMap[cv.char] = cv.selected.length > 0 ? cv.selected : [cv.char];
    });

    const prefixPattern = selectedPattern.slice(0, prefixLen);
    const suffixPattern = suffixLen > 0 ? selectedPattern.slice(-suffixLen) : '';

    // Use only the selected variants, not all Base58 substitutions
    const prefixes = prefixLen > 0 ? generatePatternVariationsFromSelected(prefixPattern, selectedVariantsMap) : [];
    const suffixes = suffixLen > 0 ? generatePatternVariationsFromSelected(suffixPattern, selectedVariantsMap) : [];
    const contains = includeContains ? generatePatternVariationsFromSelected(selectedPattern, selectedVariantsMap) : [];

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

  const costPerAttemptGOR = useMemo(() => {
    return calculateCostPerAttemptGOR(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const costPerAttemptLamports = useMemo(() => {
    return calculateCostPerAttemptLamports(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const difficultyMultiplier = useMemo(() => {
    return calculateDifficultyMultiplier(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const estimatedAttempts = useMemo(() => {
    return calculateEstimatedAttempts(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const estimatedTotalCost = useMemo(() => {
    if (estimatedAttempts <= 0) return 0;
    // Cost = estimatedAttempts * costPerAttempt
    return estimatedAttempts * costPerAttemptGOR;
  }, [estimatedAttempts, costPerAttemptGOR]);

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

  // Play audio notification
  const playMatchSound = useCallback(() => {
    try {
      const audio = new Audio('/fawwwwwwwk.mp3');
      audio.play().catch(err => console.error('Failed to play audio:', err));
    } catch (err) {
      console.error('Audio error:', err);
    }
  }, []);

  // Handle match found - show prompt to continue or stop
  const handleMatchFound = useCallback((data: MatchData) => {
    playMatchSound();
    setPendingMatch({ ...data, encrypted: true, unlocked: false });
    setShowMatchPrompt(true);
    
    // Pause mining while waiting for user response
    if (workerManagerRef.current) {
      workerManagerRef.current.pause();
      setIsPaused(true);
    }
  }, [playMatchSound]);

  // User chooses to continue mining after match
  const handleContinueMining = useCallback(() => {
    if (pendingMatch) {
      setMatches(prev => [...prev, pendingMatch]);
      recordMatchPayment(pendingMatch.address);
    }
    setShowMatchPrompt(false);
    setPendingMatch(null);
    
    // Resume mining
    if (workerManagerRef.current) {
      workerManagerRef.current.resume();
      setIsPaused(false);
    }
  }, [pendingMatch, recordMatchPayment]);

  // User chooses to stop mining after match
  const handleStopMining = useCallback(() => {
    if (pendingMatch) {
      setMatches(prev => [...prev, pendingMatch]);
      recordMatchPayment(pendingMatch.address);
    }
    setShowMatchPrompt(false);
    setPendingMatch(null);
    stopMining();
  }, [pendingMatch, recordMatchPayment]);

  // Handle deposit depleted
  const handleDepositDepleted = useCallback(async (): Promise<boolean> => {
    setDepositDepleted(true);
    
    // Pause mining
    if (workerManagerRef.current) {
      workerManagerRef.current.pause();
      setIsPaused(true);
    }

    // Show notification - user can add funds and resume
    // Return true if user adds funds and wants to continue, false otherwise
    return false; // Will be updated when user adds funds
  }, []);

  // Check balance callback for worker manager
  const checkBalance = useCallback(async (): Promise<boolean> => {
    if (!miningAccount) return false;
    
    // Check if balance is sufficient for at least one more attempt
    return miningAccount.balanceLamports >= costPerAttemptLamportsRef.current;
  }, [miningAccount]);

  // Start mining with continuous charging
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

    // Check balance covers at least one attempt
    if (miningAccount && miningAccount.balanceLamports < costPerAttemptLamportsRef.current) {
      setPaymentError(`Insufficient balance. Need at least ${costPerAttemptGOR.toFixed(6)} ${currency} per attempt.`);
      return;
    }

    const config: PatternConfig = {
      prefixes: patterns.prefixes.slice(0, 100),
      suffixes: patterns.suffixes.slice(0, 50),
      contains: patterns.contains.slice(0, 20),
      minScore: 10,
    };

    // Store cost per attempt for reference
    costPerAttemptLamportsRef.current = costPerAttemptLamports;

    workerManagerRef.current = new WorkerManager({
      workerPath: '../workers/vanityMiner.worker.ts',
      maxWorkers: 8,
      onProgress: (data) => {
        setProgress(data);
        
        // Charge for attempts since last update (approximately)
        // This is a simplified approach - in production, you'd want more granular charging
        // For now, we'll charge periodically based on progress
      },
      onMatch: (data) => {
        handleMatchFound(data);
      },
      onError: (error) => {
        console.error('Mining error:', error);
        setPaymentError(error.message);
      },
      checkBalance: checkBalance,
      onDepositDepleted: handleDepositDepleted,
    });

    workerManagerRef.current.start(config);
    setWorkerCount(workerManagerRef.current.getOptimalWorkerCount());
    setIsMining(true);
    setIsPaused(false);
    setDepositDepleted(false);
    setMiningActive(true);
    isMiningRef.current = true;
  }, [patterns, isMining, connected, walletAddress, miningAccount, costPerAttemptGOR, costPerAttemptLamports, currency, initializeMining, handleMatchFound, checkBalance, handleDepositDepleted, setMiningActive, setPaymentError, isMiningRef]);

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
    setDepositDepleted(false);
    setMiningActive(false);
    isMiningRef.current = false;
    refreshBalance();
  }, [refreshBalance, setMiningActive, isMiningRef]);

  // Resume mining after deposit added
  const resumeMiningAfterDeposit = useCallback(async () => {
    await refreshBalance();
    
    if (miningAccount && miningAccount.balanceLamports >= costPerAttemptLamportsRef.current) {
      setDepositDepleted(false);
      if (workerManagerRef.current) {
        workerManagerRef.current.resume();
        setIsPaused(false);
      }
    }
  }, [miningAccount, costPerAttemptLamports, refreshBalance]);

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

  // Copy address to clipboard
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Blur address for display
  const blurAddress = (address: string) => {
    return address.slice(0, 8) + '...' + address.slice(-8);
  };

  // Format GOR for display
  const formatGOR = (value: number) => {
    if (value >= 1) return value.toFixed(4);
    if (value >= 0.0001) return value.toFixed(6);
    return value.toExponential(2);
  };

  const isBothPrefixAndSuffix = prefixLen > 0 && suffixLen > 0;
  const accentBg = accentColor.replace('text-', 'bg-');
  const accentBorder = accentColor.replace('text-', 'border-');

  return (
    <div className="vanity-generator bg-black text-white min-h-screen p-6 font-mono">
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30 pointer-events-none"
        src="/gorbagio-video-meeting.mp4"
      />
      {/* Match Found Prompt Modal */}
      {showMatchPrompt && pendingMatch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-yellow-500 p-8 max-w-md w-full">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold">MATCH FOUND!</h2>
            </div>
            
            <div className="bg-gray-800 p-4 mb-6 rounded border border-gray-700">
              <div className="text-sm text-gray-400 mb-2">ADDRESS</div>
              <div className="text-lg font-bold break-all">{pendingMatch.address}</div>
              <div className="text-sm text-gray-400 mt-3">SCORE: {pendingMatch.score}</div>
            </div>

            <p className="text-gray-300 mb-6">
              Would you like to continue mining for more addresses or stop here?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleContinueMining}
                className="flex-1 bg-magic-green text-black font-bold py-3 hover:opacity-90"
              >
                <Play className="w-4 h-4 inline mr-2" />
                CONTINUE
              </button>
              <button
                onClick={handleStopMining}
                className="flex-1 bg-magic-red text-black font-bold py-3 hover:opacity-90"
              >
                <Square className="w-4 h-4 inline mr-2" />
                STOP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Depleted Notification */}
      {depositDepleted && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-red-500 p-8 max-w-md w-full">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h2 className="text-2xl font-bold">DEPOSIT DEPLETED</h2>
            </div>
            
            <p className="text-gray-300 mb-6">
              Your mining deposit has run out. Add more funds to continue mining.
            </p>

            <div className="bg-gray-800 p-4 mb-6 rounded border border-gray-700">
              <div className="text-sm text-gray-400 mb-2">CURRENT BALANCE</div>
              <div className="text-2xl font-bold text-red-500">
                {miningAccount ? formatGOR(miningAccount.balance) : '0'} {currency}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDepositDepleted(false)}
                className="flex-1 bg-gray-700 text-white font-bold py-3 hover:bg-gray-600"
              >
                CLOSE
              </button>
              <button
                onClick={() => {
                  // This would trigger deposit UI
                  setDepositDepleted(false);
                }}
                className="flex-1 bg-magic-green text-black font-bold py-3 hover:opacity-90"
              >
                ADD FUNDS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Live Stats */}
      <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <Terminal className={`w-6 h-6 ${accentColor}`} />
          <h1 className="text-3xl font-bold uppercase tracking-wider">VANITY_MINER_V1.0</h1>
        </div>
        
        {/* Live GOR Balance Display */}
        {connected && miningAccount && (
          <div className="bg-gray-900 rounded-lg p-4 border border-[#adff02]">
            <div className="text-xs text-gray-500 uppercase">Mining Balance</div>
            <div className="text-2xl font-bold text-[#adff02]">
              {formatGOR(miningAccount.balance)} G
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Spent: {formatGOR(miningAccount.totalSpent)}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Management */}
          {connected ? (
            <div className={`border-2 ${accentBorder} bg-black p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Wallet className={`w-4 h-4 ${accentColor}`} />
                <h2 className="text-sm font-bold uppercase tracking-wider">ACCOUNT_MANAGEMENT</h2>
              </div>

              {miningAccount ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900 p-4 border border-gray-800">
                      <div className="text-xs text-gray-500 uppercase">Balance</div>
                      <div className={`text-2xl font-bold ${accentColor}`}>
                        {formatGOR(miningAccount.balance)} G
                      </div>
                    </div>
                    <div className="bg-gray-900 p-4 border border-gray-800">
                      <div className="text-xs text-gray-500 uppercase">Total Spent</div>
                      <div className="text-2xl font-bold text-white">
                        {formatGOR(miningAccount.totalSpent)} G
                      </div>
                    </div>
                  </div>

                  {/* Deposit Input */}
                  <div>
                    <label className="block text-xs text-gray-500 uppercase mb-2">Deposit Amount (GOR)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(Math.max(0.01, parseFloat(e.target.value) || 0))}
                        className="flex-1 bg-gray-900 border border-gray-800 text-white px-3 py-2 font-mono text-sm"
                        min="0.01"
                        step="0.01"
                      />
                      <button
                        onClick={() => deposit(depositAmount)}
                        disabled={isDepositing || !miningAccount || depositAmount <= 0}
                        className={`${accentBg} text-black font-bold px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90`}
                      >
                        {isDepositing ? 'DEPOSITING...' : 'DEPOSIT'}
                      </button>
                    </div>
                  </div>

                  {/* Withdraw Button */}
                  {miningAccount.balance > 0 && !isMining && (
                    <button
                      onClick={withdraw}
                      disabled={isWithdrawing || isMining}
                      className="w-full border border-gray-700 text-gray-400 py-2 text-sm hover:border-[#adff02] hover:text-[#adff02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isWithdrawing ? 'WITHDRAWING...' : `WITHDRAW ALL ${formatGOR(miningAccount.balance)} G`}
                    </button>
                  )}

                  {isMining && (
                    <div className="bg-yellow-900/20 border border-yellow-600 p-3 rounded text-yellow-500 text-xs">
                      ⚠️ Withdrawals disabled during mining
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Loading account...</div>
              )}

              {paymentError && (
                <div className="mt-4 bg-red-900/20 border border-red-500 p-3 rounded text-red-400 text-xs">
                  {paymentError}
                </div>
              )}
            </div>
          ) : null}

          {/* Mining Configuration */}
          <div className={`border-2 ${accentBorder} bg-black p-6`}>
            <div className="flex items-center gap-2 mb-4">
              <Settings className={`w-4 h-4 ${accentColor}`} />
              <h2 className="text-sm font-bold uppercase tracking-wider">MINING_CONFIGURATION</h2>
            </div>

            {/* Input Field */}
            <div className="mb-6">
              <label className="block text-xs text-gray-500 uppercase mb-2">Target Pattern</label>
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value.toUpperCase())}
                placeholder="Enter vanity pattern (e.g., BAGS)"
                className="w-full bg-gray-900 border border-gray-800 text-white px-4 py-3 font-mono text-lg focus:outline-none focus:border-[#adff02]"
              />
            </div>

            {/* Prefix/Suffix Controls */}
            <div className="grid grid-cols-2 gap-6 mb-6">
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
              <div className="p-4 bg-red-900/20 border border-red-500/50 rounded mb-6">
                <p className="text-red-400 text-xs uppercase font-bold">
                  Invalid Configuration: Cannot use both PREFIX and SUFFIX simultaneously. Please select only one.
                </p>
              </div>
            )}

            {/* Difficulty Display */}
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
              <div className="w-full h-2 bg-gray-800 overflow-hidden mb-2">
                <div
                  className={`h-full transition-all ${
                    difficulty.difficulty === 'easy' ? 'bg-magic-green w-1/4' :
                    difficulty.difficulty === 'medium' ? 'bg-yellow-500 w-2/4' :
                    difficulty.difficulty === 'hard' ? 'bg-orange-500 w-3/4' :
                    'bg-magic-red w-full'
                  }`}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>EST_TIME: {formatDuration(difficulty.estimatedSeconds)}</span>
                <span>PATTERNS: {patterns?.prefixes.length || 0}</span>
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
                CONTINUOUS MODE
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-[10px] text-gray-500 uppercase">COST_PER_ATTEMPT</div>
                <div className="text-3xl font-bold text-white">
                  {formatGOR(costPerAttemptGOR)} <span className={`text-lg ${accentColor}`}>{currency}</span>
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
                <span className="text-gray-500">Est. Total Cost:</span>
                <span className={`${accentColor} font-bold`}>
                  ~{estimatedTotalCost > 1000 ? formatNumber(estimatedTotalCost) : estimatedTotalCost.toFixed(4)} {currency}
                </span>
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
                disabled={!inputName || (prefixLen === 0 && suffixLen === 0) || !connected || isInitializing || isBothPrefixAndSuffix || !miningAccount || miningAccount.balance <= 0}
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
                ) : !miningAccount || miningAccount.balance <= 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    ADD_DEPOSIT_TO_START
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    START_MINING
                    <span className="opacity-70">( {formatGOR(costPerAttemptGOR)} {currency}/attempt )</span>
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
