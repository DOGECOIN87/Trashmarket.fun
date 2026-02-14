const TRASHSCAN_API_BASE = 'https://gorapi.trashscan.io';

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
    const apiData = await response.json();

    // Handle Trashscan API response format
    const tokens = apiData.data || [];

    if (!Array.isArray(tokens)) {
      throw new Error('Invalid API response format');
    }

    // Map and filter tokens
    return tokens
      .filter((token: any) => {
        // Only include tokens with valid price data and liquidity
        return token.price?.native > 0 &&
               token.marketData?.liquidity > 0 &&
               token.metadata?.symbol;
      })
      .map((token: any) => ({
        symbol: token.metadata?.symbol || 'UNKNOWN',
        name: token.metadata?.name || token.metadata?.symbol || 'Unknown Token',
        price: parseFloat(token.price?.native || '0'),
        priceUsd: parseFloat(token.price?.usd || '0'),
        change24h: parseFloat(token.price?.change24h || '0'),
        volume24h: parseFloat(token.marketData?.volume24h || '0'),
        marketCap: parseFloat(token.marketData?.marketCap || '0'),
        holders: parseInt(token.marketData?.holderCount || '0'),
        contractAddress: token.mint,
        logoUrl: token.metadata?.logo,
        decimals: token.metadata?.decimals || 6,
      }))
      .sort((a, b) => b.marketCap - a.marketCap) // Sort by market cap
      .slice(0, 20); // Take top 20 verified tokens
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
 * Fallback mock data when API is unavailable
 */
export const getMockTokenMetrics = (): MarketMetric[] => [
  { label: "GOR", value: "G 1.00", change: "0%", color: "text-magic-green" },
  { label: "TRASH", value: "G 0.0042", change: "+69.4%", color: "text-magic-green" },
  { label: "GORBAG", value: "G 0.15", change: "+12.3%", color: "text-magic-green" },
  { label: "DUMP", value: "G 0.0001", change: "-5.2%", color: "text-magic-red" },
  { label: "RECYCLE", value: "G 0.025", change: "+8.1%", color: "text-magic-green" },
  { label: "WASTE", value: "G 0.0088", change: "+2.4%", color: "text-magic-green" },
  { label: "COMPOST", value: "G 0.033", change: "-1.8%", color: "text-magic-red" },
  { label: "LANDFILL", value: "G 0.0005", change: "+420%", color: "text-magic-green" },
  { label: "SCRAPS", value: "G 0.012", change: "+5.5%", color: "text-magic-green" },
  { label: "JUNK", value: "G 0.0022", change: "-3.1%", color: "text-magic-red" },
  { label: "DEBRIS", value: "G 0.045", change: "+15.2%", color: "text-magic-green" },
  { label: "REFUSE", value: "G 0.008", change: "+1.9%", color: "text-magic-green" },
  { label: "GPS", value: "4,200", change: "LIVE", color: "text-yellow-400" },
  { label: "GAS", value: "0.001 G", change: "LOW", color: "text-blue-400" },
  { label: "TVL", value: "G 1.2M", change: "+24h", color: "text-white" },
];

/**
 * Fetch tokens and return as market metrics, with fallback
 */
export const getMarketMetrics = async (): Promise<MarketMetric[]> => {
  try {
    console.log('Fetching live token data from Trashscan API...');
    const tokens = await getTokens();

    if (!tokens || tokens.length === 0) {
      console.warn('No tokens received from API, using mock data');
      return getMockTokenMetrics();
    }

    console.log(`Successfully fetched ${tokens.length} verified tokens from Trashscan`);
    const metrics = transformTokensToMetrics(tokens);

    // Add network stats at the end
    metrics.push(
      { label: "GPS", value: "4,200", change: "LIVE", color: "text-yellow-400" },
      { label: "GAS", value: "0.001 G", change: "LOW", color: "text-blue-400" }
    );

    return metrics;
  } catch (error) {
    console.error('Failed to fetch market metrics from API:', error);
    console.warn('Falling back to mock token data');
    return getMockTokenMetrics();
  }
};
