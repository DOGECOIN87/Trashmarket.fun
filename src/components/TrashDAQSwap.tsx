import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ArrowDownUp, RefreshCw, HelpCircle, Settings, X, AlertCircle, CheckCircle } from 'lucide-react';
import { getDexTokens, getMarketsForToken, calculateSwapEstimate, formatPrice, getTokenBalance, executeSwap, type DexToken } from '../services/dexService';
import { fetchAllPools, findRoute } from '../services/ammSwap';
import { audioManager } from '../lib/audioManager';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { parseTransactionError } from '../utils/errorMessages';

interface SwapState {
    sellToken: DexToken | null;
    buyToken: DexToken | null;
    sellAmount: string;
    buyAmount: string;
    loading: boolean;
    markets: any[];
    gorUsd: number;
    route: string[];
    sellBalance: number;
    buyBalance: number;
    priceImpact: number;
}

interface SwapSettings {
    slippage: number;
    customSlippage: string;
    priorityFee: 'none' | 'low' | 'medium' | 'high' | 'custom';
    customPriorityFee: string;
    autoRefresh: boolean;
}

interface TransactionStatus {
    status: 'idle' | 'pending' | 'success' | 'error';
    message: string;
    signature?: string;
}

export default function TrashDAQSwap() {
    const { publicKey, connected, signTransaction } = useWallet();
    const { connection } = useConnection();
    const [tokens, setTokens] = useState<DexToken[]>([]);
    const [state, setState] = useState<SwapState>({
        sellToken: null,
        buyToken: null,
        sellAmount: '',
        buyAmount: '0',
        loading: true,
        markets: [],
        gorUsd: 0,
        route: [],
        sellBalance: 0,
        buyBalance: 0,
        priceImpact: 0
    });
    const [settings, setSettings] = useState<SwapSettings>({
        slippage: 1,
        customSlippage: '',
        priorityFee: 'medium',
        customPriorityFee: '',
        autoRefresh: true
    });
    const [showSellSelect, setShowSellSelect] = useState(false);
    const [showBuySelect, setShowBuySelect] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [txStatus, setTxStatus] = useState<TransactionStatus>({ status: 'idle', message: '' });
    const txInFlightRef = useRef(false);

    // Load tokens on mount
    useEffect(() => {
        loadTokens();
        const interval = settings.autoRefresh ? setInterval(loadTokens, 30000) : null;
        return () => { if (interval) clearInterval(interval); };
    }, [settings.autoRefresh]);

    // Load wallet balances when wallet connects or tokens change
    useEffect(() => {
        if (connected && publicKey && (state.sellToken || state.buyToken)) {
            loadTokenBalances();
        }
    }, [connected, publicKey, state.sellToken, state.buyToken]);

    const loadTokens = useCallback(async () => {
        try {
            const tokenList = await getDexTokens();
            setTokens(tokenList);

            // Set default tokens (TRASHCOIN and GOR)
            const trashcoin = tokenList.find(t => t.symbol === 'TRASHCOIN' || t.symbol === 'TRASH');
            const gor = tokenList.find(t => t.symbol === 'GOR');

            if (trashcoin && gor) {
                setState(prev => ({
                    ...prev,
                    sellToken: trashcoin,
                    buyToken: gor,
                    loading: false
                }));
            } else {
                setState(prev => ({ ...prev, loading: false }));
            }
        } catch (error) {
            console.error('Failed to load tokens:', error);
            setState(prev => ({ ...prev, loading: false }));
        }
    }, []);

    const loadTokenBalances = useCallback(async () => {
        if (!publicKey || !connected || !connection) return;

        try {
            const sellBalance = state.sellToken
                ? await getTokenBalance(connection, publicKey.toString(), state.sellToken.mint)
                : 0;

            const buyBalance = state.buyToken
                ? await getTokenBalance(connection, publicKey.toString(), state.buyToken.mint)
                : 0;

            setState(prev => ({
                ...prev,
                sellBalance,
                buyBalance
            }));
        } catch (error) {
            console.error('Failed to load balances:', error);
        }
    }, [publicKey, connected, connection, state.sellToken, state.buyToken]);

    const calculateSwap = useCallback(async (sellToken: DexToken, buyToken: DexToken, amount: string) => {
        if (!amount || parseFloat(amount) <= 0) {
            setState(prev => ({ ...prev, buyAmount: '0', priceImpact: 0 }));
            return;
        }

        try {
            // Try fetching markets from gorapi (with on-chain fallback)
            const { markets, gorUsd } = await getMarketsForToken(sellToken.mint, connection);

            // Find a market that includes our buy token
            const market = markets.find((m: any) =>
                m.baseToken.mint === buyToken.mint || m.quoteToken.mint === buyToken.mint
            );

            if (market && market.baseToken.amount > 0 && market.quoteToken.amount > 0) {
                // gorapi has reserve data - use constant product estimate
                const isBuyBase = market.baseToken.mint === buyToken.mint;
                const inputReserve = isBuyBase ? market.quoteToken.amount : market.baseToken.amount;
                const outputReserve = isBuyBase ? market.baseToken.amount : market.quoteToken.amount;

                const { outputAmount, priceImpact } = calculateSwapEstimate(
                    parseFloat(amount),
                    inputReserve,
                    outputReserve,
                    0.25 // 0.25% fee (Meteora CPAMM default)
                );

                if (priceImpact > 5) audioManager.play('price_impact_warning');

                const poolType = market.type || 'AMM';
                setState(prev => ({
                    ...prev,
                    buyAmount: outputAmount.toFixed(6),
                    markets,
                    gorUsd,
                    priceImpact,
                    route: [poolType, sellToken.symbol, buyToken.symbol]
                }));
            } else {
                // Check on-chain pools for route info
                let routeLabel = 'AMM';
                if (connection) {
                    try {
                        const pools = await fetchAllPools(connection);
                        const onChainRoute = findRoute(pools, sellToken.mint, buyToken.mint);
                        if (onChainRoute) {
                            routeLabel = onChainRoute.pools[0].poolType;
                        }
                    } catch { /* ignore - use price estimate */ }
                }

                // Estimate via price ratio (less accurate but works without reserve data)
                if (sellToken.priceNative > 0 && buyToken.priceNative > 0) {
                    const sellToGor = parseFloat(amount) * sellToken.priceNative;
                    const outputAmount = sellToGor / buyToken.priceNative;

                    setState(prev => ({
                        ...prev,
                        buyAmount: outputAmount.toFixed(6),
                        gorUsd,
                        priceImpact: 0,
                        route: [routeLabel, sellToken.symbol, 'GOR', buyToken.symbol]
                    }));
                } else {
                    setState(prev => ({
                        ...prev,
                        buyAmount: '0',
                        gorUsd,
                        priceImpact: 0,
                        route: []
                    }));
                }
            }
        } catch (error) {
            console.error('Swap calculation failed:', error);
        }
    }, [connection]);

    const handleSellAmountChange = (value: string) => {
        // Validate input - prevent negative or non-numeric values
        if (!/^\d*\.?\d*$/.test(value)) return;

        setState(prev => ({ ...prev, sellAmount: value }));
        if (state.sellToken && state.buyToken) {
            calculateSwap(state.sellToken, state.buyToken, value);
        }
    };

    const handleMaxClick = () => {
        if (state.sellBalance > 0) {
            const maxAmount = Math.max(0, state.sellBalance - 0.001).toString(); // Reserve for fees
            handleSellAmountChange(maxAmount);
        }
    };

    const handleTokenSwap = () => {
        setState(prev => ({
            ...prev,
            sellToken: prev.buyToken,
            buyToken: prev.sellToken,
            sellAmount: prev.buyAmount,
            buyAmount: prev.sellAmount,
            sellBalance: prev.buyBalance,
            buyBalance: prev.sellBalance
        }));
    };

    const selectSellToken = (token: DexToken) => {
        setState(prev => ({ ...prev, sellToken: token }));
        setShowSellSelect(false);
        if (state.buyToken && token.mint !== state.buyToken.mint) {
            calculateSwap(token, state.buyToken, state.sellAmount);
        }
    };

    const selectBuyToken = (token: DexToken) => {
        setState(prev => ({ ...prev, buyToken: token }));
        setShowBuySelect(false);
        if (state.sellToken && token.mint !== state.sellToken.mint) {
            calculateSwap(state.sellToken, token, state.sellAmount);
        }
    };

    const getSlippageValue = () => {
        if (settings.slippage === -1 && settings.customSlippage) {
            return parseFloat(settings.customSlippage);
        }
        return settings.slippage;
    };

    const getPriorityFeeValue = () => {
        const fees = { none: 0, low: 0.00001, medium: 0.00005, high: 0.0001 };
        if (settings.priorityFee === 'custom' && settings.customPriorityFee) {
            return parseFloat(settings.customPriorityFee);
        }
        return fees[settings.priorityFee] || fees.medium;
    };

    const handleSwap = async () => {
        if (!state.sellToken || !state.buyToken || !state.sellAmount || !publicKey || !connection) {
            setTxStatus({ status: 'error', message: 'Missing required swap parameters' });
            return;
        }

        // Guard against double-click
        if (txInFlightRef.current) {
            setTxStatus({ status: 'error', message: 'Transaction already in progress' });
            return;
        }

        const sellAmount = parseFloat(state.sellAmount);
        if (sellAmount <= 0) {
            setTxStatus({ status: 'error', message: 'Enter a valid amount' });
            return;
        }
        // Only block if we have a confirmed balance and it's insufficient
        // If balance is 0 (possibly failed to fetch), let on-chain program reject
        if (state.sellBalance > 0 && sellAmount > state.sellBalance) {
            setTxStatus({ status: 'error', message: 'Insufficient balance for swap' });
            return;
        }

        txInFlightRef.current = true;
        setTxStatus({ status: 'pending', message: 'Processing swap...' });

        try {
            const slippageBps = Math.round(getSlippageValue() * 100);
            const expectedOutput = parseFloat(state.buyAmount);

            const result = await executeSwap(
                connection,
                { publicKey, signTransaction },
                state.sellToken.mint,
                state.buyToken.mint,
                sellAmount,
                slippageBps,
                expectedOutput,
                state.sellToken.decimals,
                state.buyToken.decimals
            );

            if (result.success) {
                audioManager.play('swap_success');
                setTxStatus({
                    status: 'success',
                    message: `Swap successful! Signature: ${result.signature.slice(0, 20)}...`,
                    signature: result.signature
                });

                // Reset form and reload balances
                setState(prev => ({
                    ...prev,
                    sellAmount: '',
                    buyAmount: '0'
                }));

                setTimeout(() => {
                    loadTokenBalances();
                    setTxStatus({ status: 'idle', message: '' });
                }, 3000);
            } else {
                const isExpired = (result.error || '').toLowerCase().includes('expired');
                audioManager.play(isExpired ? 'swap_expired' : 'swap_fail');
                setTxStatus({
                    status: 'error',
                    message: result.error || 'Swap failed'
                });
            }
        } catch (error: any) {
            console.error('Swap error:', error);
            const msg = parseTransactionError(error);
            const isExpired = msg.toLowerCase().includes('expired');
            audioManager.play(isExpired ? 'swap_expired' : 'swap_fail');
            setTxStatus({
                status: 'error',
                message: msg
            });
        } finally {
            txInFlightRef.current = false;
        }
    };

    const slippagePercent = getSlippageValue();
    const priceImpact = state.priceImpact;
    const platformFee = 0.20;
    const networkFee = 0.000005 + getPriorityFeeValue();

    return (
        <div className="w-full max-w-[480px] mx-auto bg-gradient-to-b from-gray-900 via-black to-gray-900 border border-magic-green/20 rounded-lg shadow-2xl shadow-magic-green/5 overflow-hidden">
            {/* Header */}
            <div className="bg-black/50 border-b border-magic-green/10 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-magic-green rounded-full animate-pulse shadow-[0_0_8px_#adff02]" />
                    <span className="text-magic-green font-mono text-xs font-bold tracking-wider">TRASH_SWAP</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadTokens}
                        className="p-1.5 hover:bg-white/5 rounded transition-colors"
                        title="Refresh prices"
                    >
                        <RefreshCw size={14} className="text-gray-500 hover:text-magic-green" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-1.5 hover:bg-white/5 rounded transition-colors"
                        title="Settings"
                    >
                        <Settings size={14} className="text-gray-500 hover:text-magic-green" />
                    </button>
                </div>
            </div>

            {/* Transaction Status Alert */}
            {txStatus.status !== 'idle' && (
                <div className={`px-4 py-3 border-b ${txStatus.status === 'success' ? 'bg-green-900/20 border-green-500/30' :
                        txStatus.status === 'error' ? 'bg-red-900/20 border-red-500/30' :
                            'bg-blue-900/20 border-blue-500/30'
                    }`}>
                    <div className="flex items-center gap-2">
                        {txStatus.status === 'success' && <CheckCircle size={16} className="text-green-500" />}
                        {txStatus.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                        {txStatus.status === 'pending' && <RefreshCw size={16} className="text-blue-500 animate-spin" />}
                        <span className={`text-sm ${txStatus.status === 'success' ? 'text-green-400' :
                                txStatus.status === 'error' ? 'text-red-400' :
                                    'text-blue-400'
                            }`}>
                            {txStatus.message}
                        </span>
                    </div>
                </div>
            )}

            {/* Swap Interface */}
            <div className="p-4 space-y-1">
                {/* Selling Section */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Selling</div>
                        {connected && state.sellBalance > 0 && (
                            <div className="text-[10px] text-gray-500">
                                Balance: {state.sellBalance.toFixed(4)}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setShowSellSelect(!showSellSelect)}
                            className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 px-3 py-2 rounded transition-all group"
                        >
                            {state.sellToken ? (
                                <>
                                    {state.sellToken.logo && (
                                        <img src={state.sellToken.logo} alt={state.sellToken.symbol} className="w-5 h-5 rounded-full" />
                                    )}
                                    <span className="text-white font-bold text-sm">{state.sellToken.symbol}</span>
                                </>
                            ) : (
                                <span className="text-gray-500 text-sm">Select token</span>
                            )}
                            <ChevronDown size={14} className="text-gray-500 group-hover:text-magic-green" />
                        </button>

                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    value={state.sellAmount}
                                    onChange={(e) => handleSellAmountChange(e.target.value)}
                                    className="bg-transparent text-white text-3xl font-bold text-right outline-none w-32"
                                    placeholder="0"
                                    disabled={!state.sellToken}
                                />
                                {connected && state.sellBalance > 0 && (
                                    <button
                                        onClick={handleMaxClick}
                                        className="text-[10px] text-magic-green hover:text-white font-bold px-2 py-1 bg-magic-green/10 hover:bg-magic-green/20 rounded border border-magic-green/30 transition-all"
                                    >
                                        MAX
                                    </button>
                                )}
                            </div>
                            {state.sellToken && state.sellAmount && (
                                <span className="text-xs text-gray-500">
                                    ${(parseFloat(state.sellAmount || '0') * state.sellToken.priceUsd).toFixed(4)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center -my-2 relative z-10">
                    <button
                        onClick={handleTokenSwap}
                        className="bg-gray-900 border-2 border-gray-700 hover:border-magic-green p-2 rounded-full transition-all hover:rotate-180 duration-300"
                    >
                        <ArrowDownUp size={16} className="text-gray-500 hover:text-magic-green" />
                    </button>
                </div>

                {/* Buying Section */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Buying</div>
                        {connected && state.buyBalance > 0 && (
                            <div className="text-[10px] text-gray-500">
                                Balance: {state.buyBalance.toFixed(4)}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setShowBuySelect(!showBuySelect)}
                            className="flex items-center gap-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 px-3 py-2 rounded transition-all group"
                        >
                            {state.buyToken ? (
                                <>
                                    {state.buyToken.logo && (
                                        <img src={state.buyToken.logo} alt={state.buyToken.symbol} className="w-5 h-5 rounded-full" />
                                    )}
                                    <span className="text-white font-bold text-sm">{state.buyToken.symbol}</span>
                                </>
                            ) : (
                                <span className="text-gray-500 text-sm">Select token</span>
                            )}
                            <ChevronDown size={14} className="text-gray-500 group-hover:text-magic-green" />
                        </button>

                        <div className="flex flex-col items-end">
                            <div className="text-white text-3xl font-bold text-right">
                                {state.buyAmount}
                            </div>
                            {state.buyToken && state.buyAmount && parseFloat(state.buyAmount) > 0 && (
                                <span className="text-xs text-gray-500 mt-1">
                                    ${(parseFloat(state.buyAmount || '0') * state.buyToken.priceUsd).toFixed(4)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exchange Details */}
            <div className="px-4 pb-4 space-y-3">
                <div className="bg-black/30 border border-gray-800 rounded-lg p-3 space-y-2">
                    {/* Exchange Rate */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                            {state.sellToken?.symbol && state.buyToken?.symbol && parseFloat(state.sellAmount || '0') > 0 &&
                                `1 ${state.sellToken.symbol} = ${(parseFloat(state.buyAmount || '0') / parseFloat(state.sellAmount || '1')).toFixed(6)} ${state.buyToken.symbol}`
                            }
                        </span>
                        <button className="p-0.5 hover:bg-white/5 rounded" onClick={loadTokens}>
                            <RefreshCw size={10} className="text-gray-600" />
                        </button>
                    </div>

                    {/* Platform Fee */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Platform Fee</span>
                        <span className="text-white font-mono">{platformFee}%</span>
                    </div>

                    {/* Network Fee */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                            Network Fee
                            <HelpCircle size={10} className="text-gray-600" />
                        </span>
                        <span className="text-white font-mono">≈{networkFee.toFixed(6)} GOR</span>
                    </div>

                    {/* Route */}
                    {state.route.length > 0 && (
                        <div className="pt-2 border-t border-gray-800">
                            <div className="text-[10px] text-gray-500 uppercase mb-1">Route:</div>
                            <div className="flex items-center gap-1 flex-wrap">
                                {state.route.map((step, i) => (
                                    <React.Fragment key={i}>
                                        <div className="flex items-center gap-1 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">
                                            {i === 0 ? (
                                                <span className="text-[10px] text-magic-green font-bold">{step}</span>
                                            ) : (
                                                <>
                                                    {tokens.find(t => t.symbol === step)?.logo && (
                                                        <img
                                                            src={tokens.find(t => t.symbol === step)?.logo}
                                                            alt={step}
                                                            className="w-3 h-3 rounded-full"
                                                        />
                                                    )}
                                                    <span className="text-[10px] text-white font-medium">{step}</span>
                                                </>
                                            )}
                                        </div>
                                        {i < state.route.length - 1 && (
                                            <span className="text-gray-600 text-xs">→</span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Price Impact */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                            Price Impact
                            <HelpCircle size={10} className="text-gray-600" />
                        </span>
                        <span className={`font-mono ${priceImpact > 5 ? 'text-red-500' : priceImpact > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                            {priceImpact.toFixed(2)}%
                        </span>
                    </div>

                    {/* Slippage Tolerance */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                            Slippage Tolerance
                            <HelpCircle size={10} className="text-gray-600" />
                        </span>
                        <span className="text-white font-mono">{slippagePercent}%</span>
                    </div>

                    {/* Expected Output */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                            Expected Output
                            <HelpCircle size={10} className="text-gray-600" />
                        </span>
                        <span className="text-white font-mono">
                            {state.buyAmount} {state.buyToken?.symbol || ''}
                        </span>
                    </div>

                    {/* Minimum Received */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1">
                            Minimum received
                            <HelpCircle size={10} className="text-gray-600" />
                        </span>
                        <span className="text-white font-mono">
                            {(parseFloat(state.buyAmount || '0') * (1 - slippagePercent / 100)).toFixed(6)} {state.buyToken?.symbol || ''}
                        </span>
                    </div>
                </div>

                {/* Swap Button */}
                <button
                    onClick={handleSwap}
                    disabled={!state.sellToken || !state.buyToken || !state.sellAmount || parseFloat(state.sellAmount) <= 0 || !connected || txInFlightRef.current}
                    className="w-full bg-magic-green hover:bg-magic-green/90 disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold py-3 px-4 rounded-lg transition-all uppercase tracking-wider text-sm shadow-lg shadow-magic-green/20 hover:shadow-magic-green/40 disabled:shadow-none"
                >
                    {!connected ? 'Connect Wallet' : !state.sellToken || !state.buyToken ? 'Select Tokens' : txInFlightRef.current ? 'Processing...' : 'Swap'}
                </button>
            </div>

            {/* Powered by TrashDAQ */}
            <div className="bg-black/80 border-t border-magic-green/10 px-4 py-3 flex items-center justify-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Powered by</span>
                <a
                    href="https://explorer.gorbagana.wtf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 group"
                >
                    <img
                        src="/assets/trashdaq-logo.png"
                        alt="TrashDAQ"
                        className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                        onError={(e) => {
                            console.error('Failed to load TrashDAQ logo');
                        }}
                    />
                    <span className="text-sm font-bold text-yellow-400 group-hover:text-yellow-300 tracking-tight transition-colors">
                        TrashDAQ
                    </span>
                </a>
            </div>

            {/* Token Select Modals */}
            {showSellSelect && (
                <TokenSelectModal
                    tokens={tokens}
                    onSelect={selectSellToken}
                    onClose={() => setShowSellSelect(false)}
                    title="Select Token to Sell"
                />
            )}
            {showBuySelect && (
                <TokenSelectModal
                    tokens={tokens}
                    onSelect={selectBuyToken}
                    onClose={() => setShowBuySelect(false)}
                    title="Select Token to Buy"
                />
            )}

            {/* Settings Modal */}
            {showSettings && (
                <SwapSettingsModal
                    settings={settings}
                    onSave={(newSettings) => {
                        setSettings(newSettings);
                        setShowSettings(false);
                    }}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
}

// Token Select Modal Component
function TokenSelectModal({
    tokens,
    onSelect,
    onClose,
    title
}: {
    tokens: DexToken[];
    onSelect: (token: DexToken) => void;
    onClose: () => void;
    title: string;
}) {
    const [search, setSearch] = useState('');

    const filteredTokens = tokens.filter(t =>
        t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.mint.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-magic-green/20 rounded-lg max-w-md w-full max-h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="border-b border-gray-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-bold text-sm">{title}</h3>
                        <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">×</button>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or paste address"
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-magic-green/50"
                        autoFocus
                    />
                </div>

                {/* Token List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredTokens.map(token => (
                        <button
                            key={token.mint}
                            onClick={() => onSelect(token)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-800 rounded transition-colors"
                        >
                            {token.logo ? (
                                <img src={token.logo} alt={token.symbol} className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-600">
                                    {token.symbol.slice(0, 2)}
                                </div>
                            )}
                            <div className="flex-1 text-left">
                                <div className="text-white font-bold text-sm">{token.symbol}</div>
                                <div className="text-gray-500 text-xs">{token.name}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-white text-sm">${formatPrice(token.priceUsd)}</div>
                                <div className={`text-xs ${token.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Settings Modal Component
function SwapSettingsModal({
    settings,
    onSave,
    onClose
}: {
    settings: SwapSettings;
    onSave: (settings: SwapSettings) => void;
    onClose: () => void;
}) {
    const [localSettings, setLocalSettings] = useState(settings);

    const slippagePresets = [0.1, 0.5, 1, 2, 5];
    const priorityPresets: Array<{ label: string; value: 'none' | 'low' | 'medium' | 'high' }> = [
        { label: 'None', value: 'none' },
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
    ];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-magic-green/20 rounded-lg max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="border-b border-gray-800 p-4 flex items-center justify-between">
                    <h3 className="text-white font-bold text-base">Swap Settings</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Settings Content */}
                <div className="p-4 space-y-6">
                    {/* Slippage Tolerance */}
                    <div>
                        <label className="text-white text-sm font-semibold mb-2 block">Slippage Tolerance</label>
                        <div className="flex gap-2 mb-2">
                            {slippagePresets.map(preset => (
                                <button
                                    key={preset}
                                    onClick={() => setLocalSettings({ ...localSettings, slippage: preset, customSlippage: '' })}
                                    className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${localSettings.slippage === preset && !localSettings.customSlippage
                                        ? 'bg-magic-green text-black'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    {preset}%
                                </button>
                            ))}
                        </div>
                        <input
                            type="number"
                            value={localSettings.customSlippage}
                            onChange={(e) => setLocalSettings({ ...localSettings, slippage: -1, customSlippage: e.target.value })}
                            placeholder="Custom %"
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-magic-green/50"
                        />
                    </div>

                    {/* Transaction Priority */}
                    <div>
                        <label className="text-white text-sm font-semibold mb-2 block">Transaction Priority</label>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            {priorityPresets.map(preset => (
                                <button
                                    key={preset.value}
                                    onClick={() => setLocalSettings({ ...localSettings, priorityFee: preset.value, customPriorityFee: '' })}
                                    className={`py-2 px-3 rounded text-sm font-medium transition-all ${localSettings.priorityFee === preset.value && !localSettings.customPriorityFee
                                        ? 'bg-magic-green text-black'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="number"
                            value={localSettings.customPriorityFee}
                            onChange={(e) => setLocalSettings({ ...localSettings, priorityFee: 'custom', customPriorityFee: e.target.value })}
                            placeholder="Custom fee (GOR)"
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-magic-green/50"
                        />
                    </div>

                    {/* Auto Refresh */}
                    <div className="flex items-center justify-between">
                        <label className="text-white text-sm font-semibold">Auto-refresh prices</label>
                        <button
                            onClick={() => setLocalSettings({ ...localSettings, autoRefresh: !localSettings.autoRefresh })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.autoRefresh ? 'bg-magic-green' : 'bg-gray-700'
                                }`}
                        >
                            <div
                                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${localSettings.autoRefresh ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-800 p-4 flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(localSettings)}
                        className="flex-1 bg-magic-green hover:bg-magic-green/90 text-black font-bold py-2 px-4 rounded transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
