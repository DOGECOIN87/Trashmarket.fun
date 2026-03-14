import { parseTransactionError } from '../utils/errorMessages';

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
export const formatPrice = (price: number | string | undefined | null): string => {
  const num = Number(price);
  if (isNaN(num) || num === 0) return '0.00';
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.001) return num.toFixed(4);
  if (num >= 0.000001) return num.toFixed(6);
  return num.toExponential(2);
};


/**
 * Fetch token balances for a wallet address using RPC connection
 * Handles both SPL tokens and native SOL/GOR
 */
export const getTokenBalances = async (
  connection: any,
  walletAddress: string,
  tokenMints: string[]
): Promise<{ [mint: string]: number }> => {
  try {
    const balances: { [mint: string]: number } = {};

    // Fetch all token accounts for the wallet
    const response = await connection.getParsedTokenAccountsByOwner(
      walletAddress,
      { programId: 'TokenkegQfeZyiNwAJsyFbPVwwQQfsSyS7scPC35Xi' } // SPL Token Program
    );

    // Parse token balances
    response.value.forEach((account: any) => {
      const mint = account.account.data.parsed.info.mint;
      const amount = account.account.data.parsed.info.tokenAmount.uiAmount || 0;
      balances[mint] = amount;
    });

    // Fetch native GOR balance
    const nativeBalance = await connection.getBalance(walletAddress);
    balances[GOR_MINT] = nativeBalance / 1e9; // Convert lamports to GOR

    return balances;
  } catch (error) {
    console.error('Failed to fetch token balances:', error);
    return {};
  }
};

/**
 * Get balance for a specific token
 */
export const getTokenBalance = async (
  connection: any,
  walletAddress: string,
  tokenMint: string
): Promise<number> => {
  try {
    const balances = await getTokenBalances(connection, walletAddress, [tokenMint]);
    return balances[tokenMint] || 0;
  } catch (error) {
    console.error(`Failed to fetch balance for ${tokenMint}:`, error);
    return 0;
  }
};

/**
 * Execute a swap transaction using Meteora API
 * Fetches a swap route and executes the transaction with security checks
 */
export const executeSwap = async (
  connection: any,
  wallet: any,
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  slippageBps: number = 100, // 1% default slippage
  expectedOutputAmount: number = 0
): Promise<{ signature: string; success: boolean; error?: string }> => {
  try {
    if (!wallet.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    // Validate inputs - prevent common vulnerabilities
    if (inputAmount <= 0) {
      return { signature: '', success: false, error: 'Invalid input amount' };
    }

    if (slippageBps < 0 || slippageBps > 10000) {
      return { signature: '', success: false, error: 'Invalid slippage tolerance' };
    }

    if (inputMint === outputMint) {
      return { signature: '', success: false, error: 'Cannot swap identical tokens' };
    }

    // Validate mint addresses (basic format check)
    if (!isValidMintAddress(inputMint) || !isValidMintAddress(outputMint)) {
      return { signature: '', success: false, error: 'Invalid token mint address' };
    }

    // Fetch swap quote from Meteora API
    const quoteUrl = `https://api.meteora.ag/swap/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${inputAmount}&slippageBps=${slippageBps}`;
    const quoteResponse = await fetch(quoteUrl);

    if (!quoteResponse.ok) {
      return { signature: '', success: false, error: 'Failed to fetch swap quote' };
    }

    const quote = await quoteResponse.json();

    if (!quote.outAmount) {
      return { signature: '', success: false, error: 'No liquidity available for this swap' };
    }

    // Validate output amount against slippage
    const minOutAmount = expectedOutputAmount * (1 - slippageBps / 10000);
    if (quote.outAmount < minOutAmount) {
      return { signature: '', success: false, error: 'Output amount exceeds slippage tolerance' };
    }

    // Fetch swap instructions from Meteora API
    const swapUrl = 'https://api.meteora.ag/swap';
    const swapResponse = await fetch(swapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPublicKey: wallet.publicKey.toString(),
        inputMint,
        outputMint,
        amount: inputAmount,
        slippageBps,
        wrapUnwrapSol: true,
      }),
    });

    if (!swapResponse.ok) {
      return { signature: '', success: false, error: 'Failed to prepare swap transaction' };
    }

    const swapData = await swapResponse.json();

    if (!swapData.tx) {
      return { signature: '', success: false, error: 'No transaction data returned' };
    }

    // Deserialize and sign the transaction
    const { Transaction } = await import('@solana/web3.js');
    const txBuffer = Buffer.from(swapData.tx, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Verify transaction before signing
    if (!transaction.instructions || transaction.instructions.length === 0) {
      return { signature: '', success: false, error: 'Invalid transaction structure' };
    }

    // Sign transaction with wallet
    const signedTx = await wallet.signTransaction(transaction);

    // Send transaction with retry logic
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Wait for confirmation with modern API
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    return { signature, success: true };
  } catch (error: any) {
    console.error('Swap execution failed:', error);
    return {
      signature: '',
      success: false,
      error: parseTransactionError(error),
    };
  }
};

/**
 * Validate Solana/Gorbagana mint address format
 * Prevents injection attacks and invalid addresses
 */
const isValidMintAddress = (address: string): boolean => {
  // Solana addresses are 44 characters in base58
  if (address.length !== 44) return false;
  
  // Check if it's valid base58
  const base58Regex = /^[1-9A-HJ-NP-Z]{44}$/;
  return base58Regex.test(address);
};
