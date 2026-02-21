/**
 * Vanity Mining Payment Hook
 * Manages GOR deposits, batch charging, and withdrawal for vanity address mining.
 * Uses direct GOR transfers to treasury via on-chain program.
 * Program deployed to Gorbagana at: 5YSYX6GX3wD2xTp6poLuP92FT8uiWeRFLwASsULXXYM4
 */

import { useState, useCallback, useRef } from 'react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { gorbaganaRPC } from '../utils/gorbaganaRPC';

// Vanity Miner program deployed on Gorbagana
export const VANITY_PROGRAM_ID = new PublicKey('5YSYX6GX3wD2xTp6poLuP92FT8uiWeRFLwASsULXXYM4');

// Treasury wallet receives mining fees
const TREASURY_WALLET = new PublicKey('TMABDMgLHfmmRNyHgbHTP9P5XP1zrAMFfbRAef69o9f');

// GOR has 9 decimals (like SOL)
const GOR_DECIMALS = 9;
const LAMPORTS_PER_GOR = Math.pow(10, GOR_DECIMALS);

// Base cost: 0.01 GOR per 1,000 key attempts
const BASE_BATCH_COST_LAMPORTS = 10_000_000; // 0.01 GOR in lamports

export interface MiningAccount {
  balance: number;        // GOR (human-readable)
  balanceLamports: number; // Raw lamports
  totalSpent: number;     // Session lifetime spent (GOR)
  matchesFound: number;   // Total matches this session
  isActive: boolean;      // Currently mining
}

export interface VanityPaymentState {
  miningAccount: MiningAccount | null;
  isInitializing: boolean;
  isDepositing: boolean;
  isWithdrawing: boolean;
  error: string | null;
}

/**
 * Calculate difficulty multiplier from pattern lengths.
 * Base58 alphabet = 58 chars, so probability = 1 / 58^totalLen.
 * We map this to a multiplier capped at 1000x.
 */
export function calculateDifficultyMultiplier(prefixLen: number, suffixLen: number): number {
  const totalLen = prefixLen + suffixLen;
  if (totalLen <= 0) return 1;
  // Each additional char increases difficulty by ~58x
  // But we use a gentler curve for pricing
  const raw = Math.pow(2, totalLen); // 2^len gives 2, 4, 8, 16, 32, 64...
  return Math.min(Math.ceil(raw), 1000);
}

/**
 * Calculate estimated attempts needed for a match.
 */
export function calculateEstimatedAttempts(prefixLen: number, suffixLen: number): number {
  const totalLen = prefixLen + suffixLen;
  if (totalLen <= 0) return 0;
  return Math.pow(58, totalLen);
}

/**
 * Calculate batch cost in GOR for given difficulty.
 */
export function calculateBatchCostGOR(prefixLen: number, suffixLen: number): number {
  const multiplier = calculateDifficultyMultiplier(prefixLen, suffixLen);
  return (BASE_BATCH_COST_LAMPORTS * multiplier) / LAMPORTS_PER_GOR;
}

/**
 * Calculate batch cost in lamports for given difficulty.
 */
export function calculateBatchCostLamports(prefixLen: number, suffixLen: number): number {
  const multiplier = calculateDifficultyMultiplier(prefixLen, suffixLen);
  return BASE_BATCH_COST_LAMPORTS * multiplier;
}

export function useVanityPayment() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [miningAccount, setMiningAccount] = useState<MiningAccount | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track session spending locally (no smart contract yet)
  const sessionSpentRef = useRef(0);
  const sessionMatchesRef = useRef(0);

  /**
   * Refresh the mining account balance from on-chain.
   */
  const refreshBalance = useCallback(async () => {
    if (!walletAddress) return;

    try {
      const balanceGOR = await gorbaganaRPC.getBalance(walletAddress);
      const balanceLamports = Math.round(balanceGOR * LAMPORTS_PER_GOR);

      setMiningAccount(prev => ({
        balance: balanceGOR,
        balanceLamports,
        totalSpent: prev?.totalSpent ?? sessionSpentRef.current,
        matchesFound: prev?.matchesFound ?? sessionMatchesRef.current,
        isActive: prev?.isActive ?? false,
      }));
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, [walletAddress]);

  /**
   * Initialize mining session - fetch balance and set up account state.
   */
  const initializeMining = useCallback(async () => {
    if (!connected || !walletAddress) {
      setError('Wallet not connected');
      return false;
    }

    setIsInitializing(true);
    setError(null);
    sessionSpentRef.current = 0;
    sessionMatchesRef.current = 0;

    try {
      const balanceGOR = await gorbaganaRPC.getBalance(walletAddress);
      const balanceLamports = Math.round(balanceGOR * LAMPORTS_PER_GOR);

      setMiningAccount({
        balance: balanceGOR,
        balanceLamports,
        totalSpent: 0,
        matchesFound: 0,
        isActive: false,
      });

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize mining');
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [connected, walletAddress]);

  /**
   * Charge for a mining batch by sending GOR to the treasury.
   * Returns true if payment succeeded, false to stop mining.
   */
  const chargeForBatch = useCallback(async (costLamports: number): Promise<boolean> => {
    if (!connected || !publicKey || !signTransaction) return false;

    try {
      // Build SOL system transfer (Gorbagana uses same instruction set)
      const transferIx = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: TREASURY_WALLET,
        lamports: costLamports,
      });

      const transaction = new Transaction().add(transferIx);

      // Get recent blockhash
      const { blockhash } = await gorbaganaRPC.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign via wallet adapter
      const signed = await signTransaction(transaction);

      // Serialize and send
      const serialized = signed.serialize();
      const base64Tx = Buffer.from(serialized).toString('base64');
      const signature = await gorbaganaRPC.sendTransaction(base64Tx);

      // Wait for confirmation
      await gorbaganaRPC.confirmTransaction(signature, 15000);

      // Update local tracking
      const costGOR = costLamports / LAMPORTS_PER_GOR;
      sessionSpentRef.current += costGOR;
      sessionMatchesRef.current = miningAccount?.matchesFound ?? 0;

      setMiningAccount(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          balance: prev.balance - costGOR,
          balanceLamports: prev.balanceLamports - costLamports,
          totalSpent: sessionSpentRef.current,
        };
      });

      return true;
    } catch (err: any) {
      console.error('Batch payment failed:', err);
      setError(`Payment failed: ${err.message || 'Unknown error'}`);
      return false;
    }
  }, [connected, publicKey, signTransaction, miningAccount]);

  /**
   * Record a match found during mining.
   */
  const recordMatch = useCallback(() => {
    sessionMatchesRef.current += 1;
    setMiningAccount(prev => {
      if (!prev) return prev;
      return { ...prev, matchesFound: sessionMatchesRef.current };
    });
  }, []);

  /**
   * Set mining active state.
   */
  const setMiningActive = useCallback((active: boolean) => {
    setMiningAccount(prev => {
      if (!prev) return prev;
      return { ...prev, isActive: active };
    });
  }, []);

  /**
   * Reset session stats.
   */
  const resetSession = useCallback(() => {
    sessionSpentRef.current = 0;
    sessionMatchesRef.current = 0;
    setMiningAccount(prev => {
      if (!prev) return prev;
      return { ...prev, totalSpent: 0, matchesFound: 0, isActive: false };
    });
    setError(null);
  }, []);

  return {
    miningAccount,
    isInitializing,
    isDepositing,
    isWithdrawing,
    error,
    initializeMining,
    chargeForBatch,
    refreshBalance,
    recordMatch,
    setMiningActive,
    resetSession,
    calculateBatchCostGOR,
    calculateBatchCostLamports,
    calculateDifficultyMultiplier,
    calculateEstimatedAttempts,
    setError,
  };
}
