/**
 * Vanity Mining Payment Hook
 * Manages GOR deposits, batch charging, and withdrawal for vanity address mining.
 * Uses direct GOR transfers to treasury via on-chain program.
 * Program deployed to Gorbagana at: 5YSYX6GX3wD2xTp6poLuP92FT8uiWeRFLwASsULXXYM4
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { gorbaganaRPC } from '../utils/gorbaganaRPC';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import IDL from '../idl/vanity_miner.json';

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
  const { connected, publicKey, signTransaction, wallet } = useWallet();
  const { connection } = useConnection();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [miningAccount, setMiningAccount] = useState<MiningAccount | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track session spending locally
  const sessionSpentRef = useRef(0);
  const sessionMatchesRef = useRef(0);

  const provider = useMemo(() => {
    if (!connection || !publicKey || !signTransaction || !wallet) return null;
    return new AnchorProvider(connection, wallet.adapter as any, { preflightCommitment: 'confirmed' });
  }, [connection, publicKey, signTransaction, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(IDL as any, provider);
  }, [provider]);

  /**
   * Refresh the mining account balance from on-chain.
   */
  const refreshBalance = useCallback(async () => {
    if (!publicKey || !program) return;

    try {
      const [miningAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mining"), publicKey.toBuffer()],
        program.programId
      );

      const accountData = await program.account.miningAccount.fetch(miningAccountPDA);
      
      const balanceLamports = (accountData.balance as BN).toNumber();
      const balanceGOR = balanceLamports / LAMPORTS_PER_GOR;
      const totalSpentLamports = (accountData.totalSpent as BN).toNumber();
      const totalSpentGOR = totalSpentLamports / LAMPORTS_PER_GOR;

      setMiningAccount({
        balance: balanceGOR,
        balanceLamports,
        totalSpent: totalSpentGOR,
        matchesFound: accountData.matchesFound as number,
        isActive: accountData.isActive as boolean,
      });
    } catch (err) {
      console.error('Failed to refresh balance:', err);
      // If account doesn't exist, we keep miningAccount as null or handle accordingly
    }
  }, [publicKey, program]);

  /**
   * Initialize mining session - fetch balance and set up account state.
   */
  const initializeMining = useCallback(async () => {
    if (!connected || !publicKey || !program || !provider) {
      setError('Wallet not connected or program not ready');
      return false;
    }

    setIsInitializing(true);
    setError(null);
    sessionSpentRef.current = 0;
    sessionMatchesRef.current = 0;

    try {
      const [miningAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mining"), publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods.initializeUser()
          .accounts({
            user: publicKey,
            miningAccount: miningAccountPDA,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        console.log("Mining account initialized on-chain.");
      } catch (initErr: any) {
        // Ignore if account already exists
        if (!initErr.message.includes("already in use") && !JSON.stringify(initErr).includes("0x0")) {
          console.error("Failed to initialize mining account on-chain:", initErr);
          throw initErr;
        }
      }

      await refreshBalance();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to initialize mining');
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [connected, publicKey, program, provider, refreshBalance]);

  /**
   * Charge for a mining batch by calling the smart contract.
   * Returns true if payment succeeded, false to stop mining.
   */
  const chargeForBatch = useCallback(async (costLamports: number): Promise<boolean> => {
    if (!connected || !publicKey || !program || !provider) {
      setError('Program or mining account not ready');
      return false;
    }

    try {
      const [miningAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mining"), publicKey.toBuffer()],
        program.programId
      );
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );

      const signature = await program.methods.chargeForBatch(new BN(costLamports))
        .accounts({
          user: publicKey,
          miningAccount: miningAccountPDA,
          vault: vaultPDA,
          treasury: TREASURY_WALLET,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Wait for confirmation with increased timeout
      await gorbaganaRPC.confirmTransaction(signature, 60000);

      // Update local state
      const costGOR = costLamports / LAMPORTS_PER_GOR;
      sessionSpentRef.current += costGOR;
      
      setMiningAccount(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          balance: prev.balance - costGOR,
          balanceLamports: prev.balanceLamports - costLamports,
          totalSpent: prev.totalSpent + costGOR,
        };
      });

      return true;
    } catch (err: any) {
      console.error('Batch payment failed via smart contract:', err);
      setError(`Payment failed: ${err.message || 'Unknown error'}`);
      return false;
    }
  }, [connected, publicKey, program, provider]);

  /**
   * Deposit GOR into the mining account.
   */
  const deposit = useCallback(async (amountGOR: number): Promise<boolean> => {
    if (!connected || !publicKey || !program || !provider) {
      setError('Wallet not connected or program not ready');
      return false;
    }

    setIsDepositing(true);
    setError(null);

    try {
      const amountLamports = new BN(amountGOR * LAMPORTS_PER_GOR);
      const [miningAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mining"), publicKey.toBuffer()],
        program.programId
      );
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );

      await program.methods.deposit(amountLamports)
        .accounts({
          user: publicKey,
          miningAccount: miningAccountPDA,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await refreshBalance();
      return true;
    } catch (err: any) {
      console.error('Deposit failed:', err);
      setError(`Deposit failed: ${err.message || 'Unknown error'}`);
      return false;
    } finally {
      setIsDepositing(false);
    }
  }, [connected, publicKey, program, provider, refreshBalance]);

  /**
   * Withdraw remaining balance back to the user.
   */
  const withdraw = useCallback(async (): Promise<boolean> => {
    if (!connected || !publicKey || !program || !provider || !miningAccount || miningAccount.balance <= 0) {
      setError('Wallet not connected, program not ready, or no balance to withdraw');
      return false;
    }

    setIsWithdrawing(true);
    setError(null);

    try {
      const [miningAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("mining"), publicKey.toBuffer()],
        program.programId
      );
      const [vaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault")],
        program.programId
      );

      await program.methods.withdraw()
        .accounts({
          user: publicKey,
          miningAccount: miningAccountPDA,
          vault: vaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await refreshBalance();
      return true;
    } catch (err: any) {
      console.error('Withdrawal failed:', err);
      setError(`Withdrawal failed: ${err.message || 'Unknown error'}`);
      return false;
    } finally {
      setIsWithdrawing(false);
    }
  }, [connected, publicKey, program, provider, miningAccount, refreshBalance]);

  /**
   * Record a match found during mining.
   */
  const recordMatch = useCallback(async (address: string) => {
    sessionMatchesRef.current += 1;
    setMiningAccount(prev => {
      if (!prev) return prev;
      return { ...prev, matchesFound: sessionMatchesRef.current };
    });

    if (program && publicKey) {
      try {
        const [miningAccountPDA] = PublicKey.findProgramAddressSync(
          [Buffer.from("mining"), publicKey.toBuffer()],
          program.programId
        );
        await program.methods.recordMatch(address)
          .accounts({
            user: publicKey,
            miningAccount: miningAccountPDA,
          })
          .rpc();
        console.log(`Match recorded on-chain: ${address}`);
      } catch (err) {
        console.error('Failed to record match on-chain:', err);
      }
    }
  }, [program, publicKey]);

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
    deposit,
    withdraw,
    calculateBatchCostGOR,
    calculateBatchCostLamports,
    calculateDifficultyMultiplier,
    calculateEstimatedAttempts,
    setError,
  };
}
