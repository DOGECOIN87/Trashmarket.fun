const GORAPI_BASE = 'https://gorapi.trashscan.io';

export interface DexToken {
  mint: string;
  symbol: string;
  name: string;
  logo: string;
  decimals: number;
  priceUsd: number;
  priceNative: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  holderCount: number;
}

export interface Market {
  marketId: string;
  type: string;
  baseToken: {
    mint: string;
    symbol: string;
    amount: number;
    priceUsd: number;
  };
  quoteToken: {
    mint: string;
    symbol: string;
    amount: number;
    priceUsd: number;
  };
  liquidityUsd: number;
  liquidityDisplay: string;
}

export interface TokenPrice {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceNative: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
}

/**
 * Fetch all tokens with price and market data from gorapi
 */
export const getDexTokens = async (): Promise<DexToken[]> => {
  const response = await fetch(`${GORAPI_BASE}/api/tokens`);
  if (!response.ok) throw new Error(`Failed to fetch tokens: ${response.status}`);
  const data = await response.json();

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error('Invalid API response');
  }

  return data.data
    .filter((t: any) => t.price?.native > 0 && t.marketData?.liquidity > 0 && t.metadata?.symbol)
    .map((t: any): DexToken => ({
      mint: t.mint,
      symbol: t.metadata.symbol,
      name: t.metadata.name || t.metadata.symbol,
      logo: t.metadata.logo || '',
      decimals: t.metadata.decimals || 6,
      priceUsd: t.price.usd || 0,
      priceNative: t.price.native || 0,
      change24h: t.price.change24h || 0,
      volume24h: t.marketData.volume24h || 0,
      liquidity: t.marketData.liquidity || 0,
      marketCap: t.marketData.marketCap || 0,
      holderCount: t.marketData.holderCount || 0,
    }))
    .sort((a: DexToken, b: DexToken) => b.liquidity - a.liquidity);
};

/**
 * Fetch all markets (liquidity pools)
 */
export const getMarkets = async (): Promise<Market[]> => {
  const response = await fetch(`${GORAPI_BASE}/api/markets`);
  if (!response.ok) throw new Error(`Failed to fetch markets: ${response.status}`);
  const data = await response.json();

  if (!data.markets || !Array.isArray(data.markets)) {
    throw new Error('Invalid markets response');
  }

  return data.markets;
};

/**
 * Fetch markets for a specific token mint
 */
export const getMarketsForToken = async (mint: string): Promise<{ markets: Market[]; gorUsd: number }> => {
  const response = await fetch(`${GORAPI_BASE}/api/markets/${mint}`);
  if (!response.ok) throw new Error(`Failed to fetch markets for ${mint}: ${response.status}`);
  const data = await response.json();

  return {
    markets: data.markets || [],
    gorUsd: data.gorUsd || 0,
  };
};

/**
 * Fetch price data for a specific token
 */
export const getTokenPrice = async (mint: string): Promise<TokenPrice | null> => {
  const response = await fetch(`${GORAPI_BASE}/api/price/${mint}`);
  if (!response.ok) return null;
  const data = await response.json();

  if (!data.success || !data.data) return null;

  const t = data.data;
  return {
    mint: t.mint,
    symbol: t.metadata?.symbol || 'UNKNOWN',
    name: t.metadata?.name || 'Unknown',
    priceUsd: t.price?.usd || 0,
    priceNative: t.price?.native || 0,
    change24h: t.price?.change24h || 0,
    volume24h: t.marketData?.volume24h || 0,
    liquidity: t.marketData?.liquidity || 0,
    marketCap: t.marketData?.marketCap || 0,
  };
};

/**
 * Search tokens by query
 */
export const searchTokens = async (query: string): Promise<DexToken[]> => {
  const response = await fetch(`${GORAPI_BASE}/api/tokens/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  const data = await response.json();

  if (!data.success || !Array.isArray(data.data)) return [];

  return data.data
    .filter((t: any) => t.price?.native > 0 && t.marketData?.liquidity > 0)
    .slice(0, 20)
    .map((t: any): DexToken => ({
      mint: t.mint,
      symbol: t.metadata?.symbol || 'UNKNOWN',
      name: t.metadata?.name || 'Unknown',
      logo: t.metadata?.logo || '',
      decimals: t.metadata?.decimals || 6,
      priceUsd: t.price?.usd || 0,
      priceNative: t.price?.native || 0,
      change24h: t.price?.change24h || 0,
      volume24h: t.marketData?.volume24h || 0,
      liquidity: t.marketData?.liquidity || 0,
      marketCap: t.marketData?.marketCap || 0,
      holderCount: t.marketData?.holderCount || 0,
    }));
};

/**
 * Get API status including GOR/USD price
 */
export const getApiStatus = async (): Promise<{ gorUsd: number; activeTokens: number }> => {
  const response = await fetch(`${GORAPI_BASE}/api/status`);
  if (!response.ok) throw new Error('Failed to fetch status');
  const data = await response.json();

  return {
    gorUsd: data.gorUsd || 0,
    activeTokens: data.activeTokens || 0,
  };
};

/**
 * Calculate swap estimate using pool reserves (constant product formula)
 * For CPAMM: x * y = k, output = (y * dx) / (x + dx) - fee
 */
export const calculateSwapEstimate = (
  inputAmount: number,
  inputReserve: number,
  outputReserve: number,
  feePercent: number = 0.3
): { outputAmount: number; priceImpact: number; fee: number } => {
  if (inputAmount <= 0 || inputReserve <= 0 || outputReserve <= 0) {
    return { outputAmount: 0, priceImpact: 0, fee: 0 };
  }

  const fee = inputAmount * (feePercent / 100);
  const inputAfterFee = inputAmount - fee;
  const outputAmount = (outputReserve * inputAfterFee) / (inputReserve + inputAfterFee);
  const spotPrice = outputReserve / inputReserve;
  const executionPrice = outputAmount / inputAmount;
  const priceImpact = Math.abs((spotPrice - executionPrice) / spotPrice) * 100;

  return { outputAmount, priceImpact, fee };
};

// GOR native token mint (wrapped)
export const GOR_MINT = 'So11111111111111111111111111111111111111112';
export const GOR_SYMBOL = 'GOR';

/**
 * Format price for display
 */
export const formatPrice = (price: number): string => {
  if (price >= 1000) return `${(price / 1000).toFixed(1)}k`;
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.001) return price.toFixed(4);
  if (price >= 0.000001) return price.toFixed(6);
  return price.toExponential(2);
};
