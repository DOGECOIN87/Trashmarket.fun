import React, { useState, useEffect, useCallback } from 'react';
import { Settings, ArrowDownUp, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Search, ExternalLink, ChevronDown, X, Droplets } from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';
import {
  getDexTokens,
  getMarkets,
  calculateSwapEstimate,
  formatPrice,
  GOR_MINT,
  GOR_SYMBOL,
  type DexToken,
  type Market,
} from '../services/dexService';

// Native GOR token (not an SPL token - this is the chain native)
const GOR_TOKEN: DexToken = {
  mint: GOR_MINT,
  symbol: GOR_SYMBOL,
  name: 'Gorbagana',
  logo: '',
  decimals: 9,
  priceUsd: 0,
  priceNative: 1,
  change24h: 0,
  volume24h: 0,
  liquidity: 0,
  marketCap: 0,
  holderCount: 0,
};

const DexPage: React.FC = () => {
  const { getExplorerLink } = useNetwork();

  // Data state
  const [tokens, setTokens] = useState<DexToken[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [gorUsd, setGorUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Swap state
  const [payToken, setPayToken] = useState<DexToken>(GOR_TOKEN);
  const [receiveToken, setReceiveToken] = useState<DexToken | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [slippage, setSlippage] = useState('1.0');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [priceImpact, setPriceImpact] = useState(0);
  const [swapFee, setSwapFee] = useState(0);

  // Token selector state
  const [selectorOpen, setSelectorOpen] = useState<'pay' | 'receive' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Relevant pool for swap
  const [activePool, setActivePool] = useState<Market | null>(null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [tokensData, marketsData] = await Promise.all([
          getDexTokens(),
          getMarkets(),
        ]);

        setTokens(tokensData);
        setMarkets(marketsData);

        // Get GOR/USD from market data
        if (marketsData.length > 0 && marketsData[0].quoteToken?.priceUsd) {
          setGorUsd(marketsData[0].quoteToken.priceUsd);
          GOR_TOKEN.priceUsd = marketsData[0].quoteToken.priceUsd;
        }

        // Default receive token: highest liquidity token
        if (tokensData.length > 0) {
          setReceiveToken(tokensData[0]);
        }
      } catch (err) {
        console.error('Failed to fetch DEX data:', err);
        setError('Failed to load DEX data from gorapi.trashscan.io');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Find relevant pool when token pair changes
  useEffect(() => {
    if (!payToken || !receiveToken || markets.length === 0) {
      setActivePool(null);
      return;
    }

    // Find a pool that contains both tokens
    const pool = markets.find(m => {
      const baseMint = m.baseToken.mint;
      const quoteMint = m.quoteToken.mint;
      return (
        (baseMint === payToken.mint && quoteMint === receiveToken.mint) ||
        (baseMint === receiveToken.mint && quoteMint === payToken.mint) ||
        // GOR is the native token, check for SO1111 mint
        (payToken.mint === GOR_MINT && baseMint === receiveToken.mint) ||
        (receiveToken.mint === GOR_MINT && baseMint === payToken.mint) ||
        (payToken.mint === GOR_MINT && quoteMint === receiveToken.mint) ||
        (receiveToken.mint === GOR_MINT && quoteMint === payToken.mint)
      );
    });

    setActivePool(pool || null);
  }, [payToken, receiveToken, markets]);

  // Calculate swap output
  const calculateOutput = useCallback((inputVal: string) => {
    if (!inputVal || isNaN(Number(inputVal)) || !payToken || !receiveToken) {
      setReceiveAmount('');
      setPriceImpact(0);
      setSwapFee(0);
      return;
    }

    const amount = Number(inputVal);

    if (activePool) {
      // Use pool reserves for calculation
      const isPayBase = activePool.baseToken.mint === payToken.mint ||
        (payToken.mint === GOR_MINT && activePool.quoteToken.mint === GOR_MINT);

      const inputReserve = isPayBase ? activePool.baseToken.amount : activePool.quoteToken.amount;
      const outputReserve = isPayBase ? activePool.quoteToken.amount : activePool.baseToken.amount;

      const result = calculateSwapEstimate(amount, inputReserve, outputReserve);
      setReceiveAmount(result.outputAmount.toFixed(6));
      setPriceImpact(result.priceImpact);
      setSwapFee(result.fee);
    } else if (payToken.priceUsd > 0 && receiveToken.priceUsd > 0) {
      // Fallback: use price ratio
      const rate = payToken.priceUsd / receiveToken.priceUsd;
      setReceiveAmount((amount * rate).toFixed(6));
      setPriceImpact(0);
      setSwapFee(amount * 0.003);
    }
  }, [payToken, receiveToken, activePool]);

  // Handle pay amount change
  const handlePayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPayAmount(val);
    calculateOutput(val);
  };

  // Swap tokens
  const handleSwapTokens = () => {
    if (!receiveToken) return;
    const temp = payToken;
    setPayToken(receiveToken);
    setReceiveToken(temp);
    setPayAmount(receiveAmount);
    setReceiveAmount(payAmount);
  };

  // Select token
  const handleSelectToken = (token: DexToken) => {
    if (selectorOpen === 'pay') {
      if (receiveToken?.mint === token.mint) setReceiveToken(payToken);
      setPayToken(token);
    } else {
      if (payToken.mint === token.mint) setPayToken(receiveToken || GOR_TOKEN);
      setReceiveToken(token);
    }
    setSelectorOpen(null);
    setSearchQuery('');
    setPayAmount('');
    setReceiveAmount('');
  };

  // Filter tokens for selector
  const filteredTokens = searchQuery
    ? tokens.filter(t =>
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.mint.toLowerCase().startsWith(searchQuery.toLowerCase())
      )
    : tokens;

  // Get exchange rate display
  const getRate = () => {
    if (!payToken || !receiveToken) return '';
    if (payToken.priceUsd > 0 && receiveToken.priceUsd > 0) {
      const rate = payToken.priceUsd / receiveToken.priceUsd;
      return `1 ${payToken.symbol} ≈ ${formatPrice(rate)} ${receiveToken.symbol}`;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="text-magic-green animate-pulse uppercase tracking-widest text-lg">
          LOADING TRASH DEX...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-magic-red text-lg mb-2">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-magic-green text-magic-green hover:bg-magic-green/10 text-sm uppercase"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-black via-gray-900 to-black">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-magic-green tracking-tighter">TRASH_DEX</h1>
            <span className="text-[10px] text-gray-500 border border-gray-800 px-2 py-0.5">V1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span className="w-2 h-2 bg-magic-green rounded-full animate-pulse"></span>
              gorapi.trashscan.io
            </div>
            <div className="text-[10px] text-gray-400">
              GOR: <span className="text-magic-green">${gorUsd.toFixed(6)}</span>
            </div>
            <div className="text-[10px] text-gray-400">
              {tokens.length} tokens | {markets.length} pools
            </div>
          </div>
        </div>
      </div>

      {/* Token Ticker */}
      <div className="border-b border-white/10 bg-black overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap py-2">
          {tokens.slice(0, 15).map((token, i) => (
            <div key={i} className="flex items-center gap-2 mx-6 text-[10px]">
              <span className="text-white font-bold">{token.symbol}</span>
              <span className="text-gray-400">${formatPrice(token.priceUsd)}</span>
              <span className={token.change24h >= 0 ? 'text-magic-green' : 'text-magic-red'}>
                {token.change24h >= 0 ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                {' '}{token.change24h.toFixed(1)}%
              </span>
            </div>
          ))}
          {/* Duplicate for seamless scroll */}
          {tokens.slice(0, 15).map((token, i) => (
            <div key={`dup-${i}`} className="flex items-center gap-2 mx-6 text-[10px]">
              <span className="text-white font-bold">{token.symbol}</span>
              <span className="text-gray-400">${formatPrice(token.priceUsd)}</span>
              <span className={token.change24h >= 0 ? 'text-magic-green' : 'text-magic-red'}>
                {token.change24h >= 0 ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
                {' '}{token.change24h.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row min-h-[calc(100vh-120px)]">

        {/* Left - Markets & Pools */}
        <div className="flex-1 flex flex-col border-r border-white/10 min-w-0">
          {/* Pool Table Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-magic-green" />
              <span className="text-sm font-bold uppercase tracking-wider">LIQUIDITY_POOLS</span>
              <span className="text-[10px] text-gray-500 border border-gray-800 px-1.5 py-0.5">{markets.length}</span>
            </div>
            <div className="text-[10px] text-gray-500 uppercase">
              TVL: ${markets.reduce((sum, m) => sum + m.liquidityUsd, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Pool Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-black border-b border-white/10">
                <tr className="text-gray-500 uppercase">
                  <th className="text-left px-4 py-2 font-normal">PAIR</th>
                  <th className="text-left px-2 py-2 font-normal">TYPE</th>
                  <th className="text-right px-2 py-2 font-normal">LIQUIDITY</th>
                  <th className="text-right px-4 py-2 font-normal">BASE_RESERVE</th>
                  <th className="text-right px-4 py-2 font-normal hidden md:table-cell">QUOTE_RESERVE</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market, i) => (
                  <tr
                    key={market.marketId}
                    className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${
                      activePool?.marketId === market.marketId ? 'bg-magic-green/5 border-magic-green/20' : ''
                    }`}
                    onClick={() => {
                      // Set pay/receive tokens from this pool
                      const baseToken = tokens.find(t => t.mint === market.baseToken.mint);
                      if (baseToken) {
                        setReceiveToken(baseToken);
                        setPayToken(GOR_TOKEN);
                        setPayAmount('');
                        setReceiveAmount('');
                      }
                    }}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold">{market.baseToken.symbol}</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-gray-400">{market.quoteToken.symbol === 'SO1111' ? 'GOR' : market.quoteToken.symbol}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`px-1.5 py-0.5 text-[9px] border ${
                        market.type.includes('DAMM') ? 'border-purple-500/30 text-purple-400' :
                        market.type.includes('SAMM') ? 'border-blue-500/30 text-blue-400' :
                        'border-magic-green/30 text-magic-green'
                      }`}>
                        {market.type}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span className="text-magic-green font-bold">${formatPrice(market.liquidityUsd)}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">
                      {market.baseToken.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell">
                      {market.quoteToken.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right - Swap Interface */}
        <div className="w-full lg:w-[420px] xl:w-[460px] flex flex-col border-l border-white/10">
          <div className="p-4 flex-1">
            {/* Swap Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white tracking-tight">SWAP_TOKEN</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { setPayAmount(''); setReceiveAmount(''); }} className="text-gray-500 hover:text-white transition-colors">
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`transition-colors ${isSettingsOpen ? 'text-magic-green' : 'text-gray-500 hover:text-white'}`}>
                  <Settings size={14} />
                </button>
              </div>
            </div>

            {/* Settings */}
            {isSettingsOpen && (
              <div className="mb-4 p-3 border border-gray-700 bg-black/50 text-[10px]">
                <div className="flex justify-between mb-2 text-gray-400">
                  <span>MAX_SLIPPAGE</span>
                  <span className="text-magic-green">{slippage}%</span>
                </div>
                <div className="flex gap-2">
                  {['0.1', '0.5', '1.0', '2.5'].map(s => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={`flex-1 py-1 border ${slippage === s ? 'border-magic-green text-magic-green bg-magic-green/10' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pay Input */}
            <div className="space-y-1 mb-1">
              <div className="flex justify-between text-[10px] text-gray-500 px-1">
                <span>YOU_PAY</span>
              </div>
              <div className="bg-black border border-gray-700 p-3 focus-within:border-magic-green transition-colors">
                <div className="flex justify-between items-center">
                  <input
                    type="number"
                    value={payAmount}
                    onChange={handlePayChange}
                    placeholder="0.00"
                    className="bg-transparent border-none outline-none text-2xl font-bold text-white w-2/3 placeholder-gray-800"
                  />
                  <button
                    onClick={() => setSelectorOpen('pay')}
                    className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 border border-gray-800 hover:border-gray-600 transition-colors"
                  >
                    {payToken.logo && <img src={payToken.logo} alt="" className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    <span className="font-bold text-sm">{payToken.symbol}</span>
                    <ChevronDown size={12} className="text-gray-500" />
                  </button>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  ≈ ${payAmount ? (Number(payAmount) * payToken.priceUsd).toFixed(4) : '0.00'}
                </div>
              </div>
            </div>

            {/* Swap Direction */}
            <div className="flex justify-center my-4 relative z-10">
              <button
                onClick={handleSwapTokens}
                className="bg-gray-900 border border-gray-700 p-1.5 hover:border-magic-green hover:text-magic-green transition-all active:scale-95"
              >
                <ArrowDownUp size={16} className="text-gray-400" />
              </button>
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-gray-800 -z-10"></div>
            </div>

            {/* Receive Input */}
            <div className="space-y-1 mb-6">
              <div className="flex justify-between text-[10px] text-gray-500 px-1">
                <span>YOU_RECEIVE</span>
              </div>
              <div className="bg-black border border-gray-700 p-3 focus-within:border-magic-green transition-colors">
                <div className="flex justify-between items-center">
                  <input
                    type="number"
                    value={receiveAmount}
                    readOnly
                    placeholder="0.00"
                    className="bg-transparent border-none outline-none text-2xl font-bold text-white w-2/3 placeholder-gray-800"
                  />
                  <button
                    onClick={() => setSelectorOpen('receive')}
                    className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 border border-gray-800 hover:border-gray-600 transition-colors"
                  >
                    {receiveToken?.logo && <img src={receiveToken.logo} alt="" className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    <span className="font-bold text-sm">{receiveToken?.symbol || 'Select'}</span>
                    <ChevronDown size={12} className="text-gray-500" />
                  </button>
                </div>
                <div className="text-[10px] text-gray-600 mt-1">
                  ≈ ${receiveAmount && receiveToken ? (Number(receiveAmount) * receiveToken.priceUsd).toFixed(4) : '0.00'}
                </div>
              </div>
            </div>

            {/* Swap Info */}
            {payAmount && receiveAmount && (
              <div className="mb-4 p-2 bg-gray-900/50 border border-gray-700 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">RATE</span>
                  <span className="text-gray-300">{getRate()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">PRICE_IMPACT</span>
                  <span className={priceImpact > 5 ? 'text-magic-red' : priceImpact > 1 ? 'text-yellow-500' : 'text-magic-green'}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                {activePool && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">POOL</span>
                    <span className="text-gray-300">{activePool.type}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">FEE</span>
                  <span className="text-gray-300">{swapFee.toFixed(6)} {payToken.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">MIN_RECEIVED</span>
                  <span className="text-gray-300">
                    {(Number(receiveAmount) * (1 - Number(slippage) / 100)).toFixed(6)} {receiveToken?.symbol}
                  </span>
                </div>
              </div>
            )}

            {/* No pool warning */}
            {payToken && receiveToken && !activePool && payToken.mint !== receiveToken.mint && (
              <div className="mb-4 p-2 border border-yellow-500/30 bg-yellow-500/5 text-[10px] flex items-center gap-2">
                <AlertTriangle size={12} className="text-yellow-500 flex-shrink-0" />
                <span className="text-yellow-500">NO_DIRECT_POOL — rate estimated from prices. Swap may route through GOR.</span>
              </div>
            )}

            {/* Pool info link */}
            {activePool && (
              <div className="mb-4 text-[10px] text-gray-500 flex items-center gap-1">
                <a
                  href={getExplorerLink('address', activePool.marketId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-magic-green transition-colors flex items-center gap-1"
                >
                  VIEW_POOL_ON_TRASHSCAN <ExternalLink size={10} />
                </a>
              </div>
            )}

            <button
              className="w-full bg-magic-green text-black font-bold py-3 text-sm hover:bg-white transition-colors uppercase tracking-wider"
              disabled={!payAmount || !receiveAmount}
              onClick={() => {
                alert('Swap execution requires wallet connection. Connect via Backpack or Gorbag Wallet.');
              }}
            >
              {!payAmount ? 'ENTER_AMOUNT' : !receiveToken ? 'SELECT_TOKEN' : 'EXECUTE_SWAP'}
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-600">
              <AlertTriangle size={10} />
              <span>ALWAYS_VERIFY_TOKEN_CONTRACTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Token Selector Modal */}
      {selectorOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => { setSelectorOpen(null); setSearchQuery(''); }}>
          <div className="bg-gray-900 border border-white/20 w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="text-sm font-bold uppercase tracking-wider">
                SELECT_{selectorOpen === 'pay' ? 'PAY' : 'RECEIVE'}_TOKEN
              </span>
              <button onClick={() => { setSelectorOpen(null); setSearchQuery(''); }} className="text-gray-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="SEARCH_TOKEN_OR_PASTE_MINT..."
                  className="w-full bg-black border border-gray-700 pl-10 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-magic-green focus:outline-none font-mono uppercase"
                  autoFocus
                />
              </div>
            </div>

            {/* Quick select: GOR + top tokens */}
            <div className="px-3 py-2 flex gap-2 flex-wrap border-b border-white/10">
              <button
                onClick={() => handleSelectToken(GOR_TOKEN)}
                className="px-3 py-1 text-[10px] font-bold border border-gray-700 hover:border-magic-green hover:text-magic-green transition-colors uppercase"
              >
                GOR
              </button>
              {tokens.slice(0, 5).map(t => (
                <button
                  key={t.mint}
                  onClick={() => handleSelectToken(t)}
                  className="px-3 py-1 text-[10px] font-bold border border-gray-700 hover:border-magic-green hover:text-magic-green transition-colors uppercase"
                >
                  {t.symbol}
                </button>
              ))}
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-auto">
              {/* GOR native token always at top */}
              {(!searchQuery || 'gor'.includes(searchQuery.toLowerCase())) && (
                <button
                  onClick={() => handleSelectToken(GOR_TOKEN)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-magic-green/20 border border-magic-green/30 flex items-center justify-center text-magic-green text-xs font-bold">G</div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">GOR</div>
                      <div className="text-[10px] text-gray-500">Gorbagana (Native)</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">${gorUsd.toFixed(6)}</div>
                  </div>
                </button>
              )}

              {filteredTokens.slice(0, 50).map(token => (
                <button
                  key={token.mint}
                  onClick={() => handleSelectToken(token)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
                >
                  <div className="flex items-center gap-3">
                    {token.logo ? (
                      <img
                        src={token.logo}
                        alt=""
                        className="w-8 h-8 rounded-full bg-gray-800"
                        onError={(e) => {
                          const el = e.target as HTMLImageElement;
                          el.style.display = 'none';
                          el.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-8 h-8 bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-bold ${token.logo ? 'hidden' : ''}`}>
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">{token.symbol}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[150px]">{token.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">${formatPrice(token.priceUsd)}</div>
                    <div className={`text-[10px] ${token.change24h >= 0 ? 'text-magic-green' : 'text-magic-red'}`}>
                      {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(1)}%
                    </div>
                  </div>
                </button>
              ))}

              {filteredTokens.length === 0 && searchQuery && (
                <div className="p-8 text-center text-gray-500 text-sm">
                  NO_TOKENS_FOUND
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DexPage;
