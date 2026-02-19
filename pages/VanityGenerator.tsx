import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Terminal, Cpu, Download, Lock, Unlock, Play, Pause, Square, 
  Zap, Trophy, AlertTriangle, Copy, Check, Settings, Sparkles
} from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';
import { useWallet } from '../contexts/WalletContext';
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

// Pricing tiers
const PRICING = {
  BASIC: { price: 0.05, maxPrefixLen: 3, label: 'BASIC' },
  PRO: { price: 0.15, maxPrefixLen: 4, label: 'PRO' },
  PREMIUM: { price: 0.5, maxPrefixLen: 5, label: 'PREMIUM' },
  ULTRA: { price: 1.0, maxPrefixLen: 6, label: 'ULTRA' },
};

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
  const { connected, address: walletAddress } = useWallet();

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

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Worker manager ref
  const workerManagerRef = useRef<WorkerManager | null>(null);

  // Calculate patterns and difficulty
  const patterns = React.useMemo(() => {
    if (!inputName || charVariants.length === 0) return null;

    // Build pattern from selected variants
    const selectedPattern = charVariants.map(cv => 
      cv.selected.length > 0 ? cv.selected[0] : cv.char
    ).join('');

    // Generate all variations based on selected chars
    const prefixPattern = selectedPattern.slice(0, prefixLen);
    const suffixPattern = suffixLen > 0 ? selectedPattern.slice(-suffixLen) : '';

    const prefixes = prefixLen > 0 ? generatePatternVariations(prefixPattern) : [];
    const suffixes = suffixLen > 0 ? generatePatternVariations(suffixPattern) : [];
    const contains = includeContains ? generatePatternVariations(selectedPattern) : [];

    return { prefixes, suffixes, contains };
  }, [inputName, charVariants, prefixLen, suffixLen, includeContains]);

  const difficulty = React.useMemo(() => {
    return estimateDifficulty(prefixLen, suffixLen);
  }, [prefixLen, suffixLen]);

  const pricingTier = React.useMemo(() => {
    const maxLen = Math.max(prefixLen, suffixLen);
    if (maxLen >= 6) return PRICING.ULTRA;
    if (maxLen >= 5) return PRICING.PREMIUM;
    if (maxLen >= 4) return PRICING.PRO;
    return PRICING.BASIC;
  }, [prefixLen, suffixLen]);

  // Initialize character variants when input changes
  useEffect(() => {
    if (!inputName) {
      setCharVariants([]);
      return;
    }

    const newVariants: CharVariant[] = inputName.split('').map((char) => ({
      char,
      variants: BASE58_SUBSTITUTIONS[char] || [char],
      selected: [char], // Start with original char selected
    }));

    setCharVariants(newVariants);
  }, [inputName]);

  // Toggle a variant selection
  const toggleVariant = (charIndex: number, variant: string) => {
    setCharVariants(prev => {
      const updated = [...prev];
      const cv = { ...updated[charIndex] };
      
      if (cv.selected.includes(variant)) {
        // Remove if more than one selected
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

  // Start mining
  const startMining = useCallback(() => {
    if (!patterns || isMining) return;

    const config: PatternConfig = {
      prefixes: patterns.prefixes.slice(0, 100), // Limit for performance
      suffixes: patterns.suffixes.slice(0, 50),
      contains: patterns.contains.slice(0, 20),
      minScore: 10,
    };

    workerManagerRef.current = new WorkerManager({
      workerPath: '../workers/vanityMiner.worker.ts',
      maxWorkers: 8,
      onProgress: (data) => {
        setProgress(data);
      },
      onMatch: (data) => {
        setMatches(prev => [...prev, { ...data, encrypted: true, unlocked: false }]);
      },
      onError: (error) => {
        console.error('Mining error:', error);
      },
    });

    workerManagerRef.current.start(config);
    setWorkerCount(workerManagerRef.current.getOptimalWorkerCount());
    setIsMining(true);
    setIsPaused(false);
  }, [patterns, isMining]);

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
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerManagerRef.current?.terminate();
    };
  }, []);

  // Unlock a match (simulated - in real app would check payment)
  const unlockMatch = async (index: number) => {
    // In real implementation, this would:
    // 1. Request payment transaction
    // 2. Verify on-chain
    // 3. Decrypt the keypair
    
    // For demo, just unlock
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
    return addr.slice(0, 8) + '•'.repeat(24) + addr.slice(-8);
  };

  const accentBorder = accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green';
  const accentBg = accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green';

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-black via-gray-900 to-black">
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className={`w-5 h-5 ${accentColor}`} />
            <h1 className="text-xl font-bold tracking-tighter uppercase">VANITY_GENERATOR</h1>
            <span className="text-[10px] text-gray-500 border border-gray-800 px-2 py-0.5">BETA</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <Cpu className="w-3 h-3" />
              {workerCount > 0 ? `${workerCount} CORES` : 'IDLE'}
            </div>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 border border-gray-800 hover:border-gray-600 ${showSettings ? accentColor : 'text-gray-500'}`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left: Pattern Builder */}
          <div className="space-y-6">
            {/* Name Input */}
            <div className={`border ${accentBorder}/30 bg-black p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className={`w-4 h-4 ${accentColor}`} />
                <span className="text-sm font-bold uppercase tracking-wider">YOUR_NAME</span>
              </div>
              
              <input
                type="text"
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
                        {/* Original char header */}
                        <div className={`w-10 h-10 flex items-center justify-center border-2 ${accentBorder} text-lg font-bold ${accentColor}`}>
                          {cv.char}
                        </div>
                        
                        {/* Variant buttons */}
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

            {/* Start Button */}
            <div className={`border ${accentBorder} p-1`}>
              {!isMining ? (
                <button
                  onClick={startMining}
                  disabled={!inputName || prefixLen === 0}
                  className={`w-full ${accentBg} text-black font-bold py-4 text-sm uppercase tracking-wider flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity`}
                >
                  <Play className="w-4 h-4" />
                  START_MINING
                  <span className="opacity-70">( {pricingTier.price} {currency} per unlock )</span>
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
                    {/* Progress bar simulation */}
                    <div className="w-full h-2 bg-gray-800 overflow-hidden mb-4">
                      <div 
                        className={`h-full ${accentBg} animate-pulse`}
                        style={{ width: isMining && !isPaused ? '100%' : '0%' }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 bg-gray-900/50 border border-gray-800">
                        <div className="text-2xl font-bold text-white">{formatNumber(progress.checked)}</div>
                        <div className="text-[10px] text-gray-500 uppercase">ADDRESSES_CHECKED</div>
                      </div>
                      <div className="p-3 bg-gray-900/50 border border-gray-800">
                        <div className={`text-2xl font-bold ${accentColor}`}>{formatNumber(progress.rate)}/s</div>
                        <div className="text-[10px] text-gray-500 uppercase">HASH_RATE</div>
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
                      key={idx}
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
                              className="px-3 py-2 border border-yellow-500 text-yellow-500 text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-yellow-500/10"
                            >
                              <Unlock className="w-3 h-3" />
                              {pricingTier.price} {currency}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Security Notice */}
            <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-yellow-500/80">
                <span className="font-bold uppercase">SECURITY_NOTICE:</span> All keypairs are generated 
                client-side in your browser. Private keys never leave your device. Always backup 
                your keypair files securely.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VanityGenerator;
