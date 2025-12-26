import { GORBAGANA_CONFIG } from '../contexts/NetworkContext';

const TRASHSCAN_API_BASE = `${GORBAGANA_CONFIG.explorerUrl}`;

export interface Token {
  symbol: string;
  name: string;
  price: number;
  priceUsd?: number;
  change24h: number;
  volume24h?: number;
  marketCap?: number;
  holders?: number;
  contractAddress?: string;
  logoUrl?: string;
  decimals?: number;
}

export interface TokenApiResponse {
  tokens?: Token[];
  data?: Token[];
  items?: Token[];
  success?: boolean;
  total?: number;
}

export interface MarketMetric {
  label: string;
  value: string;
  change: string;
  color: string;
}

/**
 * Fetch all tokens from Trashscan API
 */
export const getTokens = async (): Promise<Token[]> => {
  try {
    const response = await fetch(`${TRASHSCAN_API_BASE}/api/tokens`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tokens: ${response.status}`);
    }
    const data: TokenApiResponse = await response.json();

    // Handle various possible response formats
    const tokens = data.tokens || data.data || data.items || (Array.isArray(data) ? data : []);

    return tokens.map((token: any) => ({
      symbol: token.symbol || token.ticker || 'UNKNOWN',
      name: token.name || token.symbol || 'Unknown Token',
      price: parseFloat(token.price || token.priceGor || '0'),
      priceUsd: parseFloat(token.priceUsd || token.price_usd || '0'),
      change24h: parseFloat(token.change24h || token.priceChange24h || token.change_24h || '0'),
      volume24h: parseFloat(token.volume24h || token.volume_24h || '0'),
      marketCap: parseFloat(token.marketCap || token.market_cap || '0'),
      holders: parseInt(token.holders || token.holderCount || '0'),
      contractAddress: token.contractAddress || token.address || token.contract,
      logoUrl: token.logoUrl || token.logo || token.image,
      decimals: token.decimals || 9,
    }));
  } catch (error) {
    console.error('Error fetching tokens:', error);
    throw error;
  }
};

/**
 * Get a specific token by symbol
 */
export const getTokenBySymbol = async (symbol: string): Promise<Token | null> => {
  try {
    const tokens = await getTokens();
    return tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase()) || null;
  } catch (error) {
    console.error('Error fetching token by symbol:', error);
    throw error;
  }
};

/**
 * Transform tokens into market metrics format for ticker display
 */
export const transformTokensToMetrics = (tokens: Token[]): MarketMetric[] => {
  return tokens.map(token => {
    const isPositive = token.change24h >= 0;
    const changeStr = token.change24h !== 0
      ? `${isPositive ? '+' : ''}${token.change24h.toFixed(1)}%`
      : '0%';

    // Format price based on magnitude
    let priceStr: string;
    if (token.price >= 1000) {
      priceStr = `${(token.price / 1000).toFixed(1)}k`;
    } else if (token.price >= 1) {
      priceStr = token.price.toFixed(2);
    } else if (token.price >= 0.001) {
      priceStr = token.price.toFixed(4);
    } else {
      priceStr = token.price.toExponential(2);
    }

    return {
      label: token.symbol,
      value: `G ${priceStr}`,
      change: changeStr,
      color: isPositive ? 'text-magic-green' : 'text-magic-red',
    };
  });
};

/**
 * Fetch tokens and return as market metrics
 */
export const getMarketMetrics = async (): Promise<MarketMetric[]> => {
  try {
    const tokens = await getTokens();
    if (tokens.length === 0) {
      return [];
    }

    const metrics = transformTokensToMetrics(tokens);
    return metrics;
  } catch (error) {
    console.error('Failed to fetch market metrics:', error);
    return [];
  }
};
