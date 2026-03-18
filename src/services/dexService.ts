import { parseTransactionError } from '../utils/errorMessages';
import {
  fetchAllPools,
  findPool,
  findRoute,
  buildSwapTransaction,
  poolsToMarkets,
  clearPoolCache,
  type PoolInfo,
} from './ammSwap';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';

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
 * Fetch all tokens with price and market data from gorapi.
 * GOR (native token) is injected manually since gorapi only tracks tokens priced in GOR.
 */
export const getDexTokens = async (): Promise<DexToken[]> => {
  const [tokensResp, statusResp] = await Promise.all([
    fetch(`${GORAPI_BASE}/api/tokens`),
    fetch(`${GORAPI_BASE}/api/status`).catch(() => null),
  ]);

  if (!tokensResp.ok) throw new Error(`Failed to fetch tokens: ${tokensResp.status}`);
  const data = await tokensResp.json();

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error('Invalid API response');
  }

  // Get GOR/USD price from status endpoint
  let gorUsd = 0;
  if (statusResp && statusResp.ok) {
    const statusData = await statusResp.json();
    gorUsd = statusData.gorUsd || 0;
  }

  const tokens: DexToken[] = data.data
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

  // Inject GOR (native token) at the top — gorapi doesn't list it since everything is priced in GOR
  const gorToken: DexToken = {
    mint: GOR_MINT,
    symbol: 'GOR',
    name: 'Gorbagana',
    logo: '/gorbagana-logo-transparent.png',
    decimals: 9,
    priceUsd: gorUsd,
    priceNative: 1,
    change24h: 0,
    volume24h: 0,
    liquidity: Infinity, // Always at top
    marketCap: 0,
    holderCount: 0,
  };

  return [gorToken, ...tokens];
};

/**
 * Fetch all markets (liquidity pools).
 * Tries gorapi first; if empty, fetches pools directly from on-chain programs.
 */
export const getMarkets = async (connection?: any): Promise<Market[]> => {
  // Try gorapi first
  try {
    const response = await fetch(`${GORAPI_BASE}/api/markets`);
    if (response.ok) {
      const data = await response.json();
      if (data.markets && Array.isArray(data.markets) && data.markets.length > 0) {
        return data.markets;
      }
    }
  } catch {
    // gorapi unavailable, fall through to on-chain
  }

  // Fallback: fetch pools from on-chain AMM programs
  if (connection) {
    try {
      const pools = await fetchAllPools(connection);
      return poolsToMarkets(pools);
    } catch (err) {
      console.warn('Failed to fetch on-chain pools:', err);
    }
  }

  return [];
};

/**
 * Fetch markets for a specific token mint.
 * Tries gorapi first; if empty, filters on-chain pools.
 */
export const getMarketsForToken = async (mint: string, connection?: any): Promise<{ markets: Market[]; gorUsd: number }> => {
  let gorUsd = 0;

  // Try gorapi first
  try {
    const response = await fetch(`${GORAPI_BASE}/api/markets/${mint}`);
    if (response.ok) {
      const data = await response.json();
      gorUsd = data.gorUsd || 0;
      if (data.markets && Array.isArray(data.markets) && data.markets.length > 0) {
        return { markets: data.markets, gorUsd };
      }
    }
  } catch {
    // gorapi unavailable
  }

  // Try gorapi status for GOR price
  if (gorUsd === 0) {
    try {
      const statusResp = await fetch(`${GORAPI_BASE}/api/status`);
      if (statusResp.ok) {
        const statusData = await statusResp.json();
        gorUsd = statusData.gorUsd || 0;
      }
    } catch { /* ignore */ }
  }

  // Fallback: filter on-chain pools for this token
  if (connection) {
    try {
      const pools = await fetchAllPools(connection);
      const filtered = pools.filter(
        (p) => p.enabled && (p.tokenAMint.toBase58() === mint || p.tokenBMint.toBase58() === mint)
      );
      return { markets: poolsToMarkets(filtered), gorUsd };
    } catch (err) {
      console.warn('Failed to fetch on-chain pools for token:', err);
    }
  }

  return { markets: [], gorUsd };
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
  const balances: { [mint: string]: number } = {};
  const ownerPubkey = new PublicKey(walletAddress);

  // Fetch native GOR balance first (most reliable)
  try {
    const nativeBalance = await connection.getBalance(ownerPubkey);
    balances[GOR_MINT] = nativeBalance / 1e9;
    console.log('[DEX] Native GOR balance:', balances[GOR_MINT]);
  } catch (error) {
    console.error('[DEX] Failed to fetch native balance:', error);
  }

  // Fetch SPL token balances
  try {
    const response = await connection.getParsedTokenAccountsByOwner(
      ownerPubkey,
      { programId: TOKEN_PROGRAM_ID }
    );

    response.value.forEach((account: any) => {
      const mint = account.account.data.parsed.info.mint;
      const amount = account.account.data.parsed.info.tokenAmount.uiAmount || 0;
      // Don't overwrite native GOR balance with wrapped GOR (same mint)
      if (mint === GOR_MINT) {
        balances[mint] = (balances[mint] || 0) + amount;
      } else {
        balances[mint] = amount;
      }
    });
    console.log('[DEX] SPL token accounts found:', response.value.length);
  } catch (error) {
    console.error('[DEX] Failed to fetch SPL token balances:', error);
    // Fallback: try getTokenAccountsByOwner (non-parsed) if parsed fails
    try {
      const response = await connection.getTokenAccountsByOwner(
        ownerPubkey,
        { programId: TOKEN_PROGRAM_ID }
      );
      for (const { account } of response.value) {
        const data = account.data as Buffer;
        if (data.length >= 72) {
          const mint = new PublicKey(data.subarray(0, 32)).toBase58();
          const rawAmount = data.readBigUInt64LE(64);
          // Rough: assume 9 decimals if we don't know
          balances[mint] = Number(rawAmount) / 1e9;
        }
      }
      console.log('[DEX] Fallback token accounts found:', response.value.length);
    } catch (fallbackError) {
      console.error('[DEX] Fallback balance fetch also failed:', fallbackError);
    }
  }

  return balances;
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
 * Execute a swap transaction against Gorbagana on-chain AMM programs.
 * Finds the best pool, builds the swap instruction, signs, and sends.
 */
export const executeSwap = async (
  connection: any,
  wallet: any,
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  slippageBps: number = 100, // 1% default slippage
  expectedOutputAmount: number = 0,
  inputDecimals: number = 9,
  outputDecimals: number = 9
): Promise<{ signature: string; success: boolean; error?: string }> => {
  try {
    if (!wallet.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    if (inputAmount <= 0) {
      return { signature: '', success: false, error: 'Invalid input amount' };
    }

    if (slippageBps < 0 || slippageBps > 10000) {
      return { signature: '', success: false, error: 'Invalid slippage tolerance' };
    }

    if (inputMint === outputMint) {
      return { signature: '', success: false, error: 'Cannot swap identical tokens' };
    }

    if (!isValidMintAddress(inputMint) || !isValidMintAddress(outputMint)) {
      return { signature: '', success: false, error: 'Invalid token mint address' };
    }

    // 1. Fetch pools and find a route
    const pools = await fetchAllPools(connection);
    if (pools.length === 0) {
      return { signature: '', success: false, error: 'No pools available. RPC may be down.' };
    }

    const route = findRoute(pools, inputMint, outputMint);
    if (!route) {
      return { signature: '', success: false, error: 'No liquidity pool found for this token pair' };
    }

    // 2. Calculate amounts in lamports
    const inputAmountLamports = new BN(
      Math.floor(inputAmount * Math.pow(10, inputDecimals))
    );

    // 3. Build swap transaction with integrated estimation (single pass, minimal RPC calls)
    const pool = route.pools[0];

    const { transaction, estimatedOutput, minOutput } = await buildSwapTransaction(
      connection,
      wallet.publicKey,
      pool,
      new PublicKey(inputMint),
      inputAmountLamports,
      slippageBps
    );

    console.log('[DEX] Swap details:', {
      pool: pool.address.toBase58(),
      poolType: pool.poolType,
      inputMint,
      outputMint,
      inputAmountLamports: inputAmountLamports.toString(),
      estimatedOutput: estimatedOutput.toString(),
      minOutput: minOutput.toString(),
      hops: route.hops,
    });

    // 4. Sign and send
    // Re-fetch blockhash right before signing to maximize validity window
    const { blockhash: freshHash, lastValidBlockHeight: freshHeight } =
      await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = freshHash;
    transaction.lastValidBlockHeight = freshHeight;

    const signedTx = await wallet.signTransaction(transaction);

    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      maxRetries: 5,
    });

    console.log('[DEX] Transaction sent:', signature);

    // 5. Confirm via signature polling (more reliable on Gorbagana)
    try {
      const { confirmTransaction } = await import('../utils/confirmTx');
      await confirmTransaction(connection, signature, 30000);
    } catch (confirmErr: any) {
      // Transaction was sent successfully — return signature even if confirmation is uncertain
      console.warn('[DEX] Confirmation uncertain:', confirmErr?.message);
      return { signature, success: true };
    }

    return { signature, success: true };
  } catch (error: any) {
    console.error('[DEX] Swap execution failed:', error);
    // Extract simulation logs if available
    if (error.logs) {
      console.error('[DEX] Transaction logs:', error.logs);
    }
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
  // Solana/Gorbagana addresses are 32-44 characters in base58
  if (address.length < 32 || address.length > 44) return false;

  // Check if it's valid base58 (includes lowercase a-z minus l)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
};
