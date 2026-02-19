/**
 * useJunkPusherOnChain — React hook for on-chain Junk Pusher integration (FEAT-01)
 *
 * Wires the existing JunkPusherClient instruction builders and tokenService
 * into the wallet adapter so that game actions produce real transactions.
 *
 * Capabilities:
 *  - Check on-chain JUNK token balance before allowing play
 *  - Send initializeGame, recordCoinCollection, recordScore, depositBalance, withdrawBalance txs
 *  - Fetch high scores from the blockchain
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { JunkPusherClient, PROGRAM_ID } from './JunkPusherClient';
import { getJunkBalance, getTrashcoinBalance, TokenBalance } from './tokenService';
import { getHighScores, getPlayerRank, HighScoreEntry } from './highScoreService';
import { TOKEN_CONFIG } from './tokenConfig';

export interface OnChainState {
  /** On-chain JUNK token balance (human-readable) */
  junkBalance: number;
  /** On-chain TRASHCOIN balance (human-readable) */
  trashcoinBalance: number;
  /** Whether the on-chain program is available (program ID is not placeholder) */
  programAvailable: boolean;
  /** Loading state for balance fetches */
  isLoadingBalance: boolean;
  /** Last transaction signature */
  lastTxSignature: string | null;
  /** Transaction status */
  txStatus: 'idle' | 'building' | 'signing' | 'confirming' | 'confirmed' | 'error';
  /** Error message */
  error: string | null;
}

export function useJunkPusherOnChain() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [state, setState] = useState<OnChainState>({
    junkBalance: 0,
    trashcoinBalance: 0,
    programAvailable: PROGRAM_ID.toBase58() !== '11111111111111111111111111111111',
    isLoadingBalance: false,
    lastTxSignature: null,
    txStatus: 'idle',
    error: null,
  });

  // Stable client reference — never recreated on re-render
  const clientRef = useRef<JunkPusherClient | null>(null);
  if (!clientRef.current) clientRef.current = new JunkPusherClient();
  const client = clientRef.current;

  // ─── Fetch on-chain balances ──────────────────────────────────────────

  const refreshBalances = useCallback(async () => {
    if (!publicKey || !connection) return;
    setState((s) => ({ ...s, isLoadingBalance: true, error: null }));
    try {
      const [junk, trash] = await Promise.all([
        getJunkBalance(connection, publicKey),
        getTrashcoinBalance(connection, publicKey),
      ]);
      setState((s) => ({
        ...s,
        junkBalance: junk,
        trashcoinBalance: trash,
        isLoadingBalance: false,
      }));
    } catch (err: any) {
      console.error('[OnChain] Balance fetch error:', err);
      setState((s) => ({
        ...s,
        isLoadingBalance: false,
        error: err.message || 'Failed to fetch balances',
      }));
    }
  }, [publicKey, connection]);

  // Keep a stable ref to refreshBalances so the effect below doesn't re-fire
  // every time the connection object identity changes.
  const refreshBalancesRef = useRef(refreshBalances);
  useEffect(() => { refreshBalancesRef.current = refreshBalances; }, [refreshBalances]);

  // Auto-refresh balances on wallet connect — only re-run when connected/publicKey changes
  const publicKeyStr = publicKey?.toBase58() ?? null;
  useEffect(() => {
    if (connected && publicKeyStr) {
      refreshBalancesRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKeyStr]);

  // ─── Send a transaction helper ────────────────────────────────────────

  const sendTx = useCallback(
    async (tx: Transaction): Promise<string | null> => {
      if (!publicKey || !signTransaction || !connection) {
        setState((s) => ({ ...s, error: 'Wallet not connected', txStatus: 'error' }));
        return null;
      }

      try {
        setState((s) => ({ ...s, txStatus: 'building', error: null }));

        // Set recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        setState((s) => ({ ...s, txStatus: 'signing' }));
        const signed = await signTransaction(tx);

        setState((s) => ({ ...s, txStatus: 'confirming' }));
        const signature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        await connection.confirmTransaction(
          { blockhash, lastValidBlockHeight, signature },
          'confirmed',
        );

        setState((s) => ({
          ...s,
          txStatus: 'confirmed',
          lastTxSignature: signature,
        }));

        // Refresh balances after successful tx
        setTimeout(() => refreshBalances(), 2000);

        // Reset status after a short delay
        setTimeout(() => {
          setState((s) => ({ ...s, txStatus: 'idle' }));
        }, 3000);

        return signature;
      } catch (err: any) {
        console.error('[OnChain] Transaction error:', err);
        setState((s) => ({
          ...s,
          txStatus: 'error',
          error: err.message || 'Transaction failed',
        }));
        setTimeout(() => {
          setState((s) => ({ ...s, txStatus: 'idle' }));
        }, 3000);
        return null;
      }
    },
    [publicKey, signTransaction, connection, refreshBalances],
  );

  // ─── Game actions ─────────────────────────────────────────────────────

  /** Initialize a new game session on-chain */
  const initializeGame = useCallback(
    async (initialBalance: number = TOKEN_CONFIG.GAME.INITIAL_BALANCE) => {
      if (!publicKey) return null;
      const ix = await client.initializeGame(publicKey, { initialBalance });
      const tx = new Transaction().add(ix);
      return sendTx(tx);
    },
    [publicKey, sendTx],
  );

  /** Record a coin collection (bump) on-chain */
  const recordCoinCollection = useCallback(
    async (amount: number) => {
      if (!publicKey) return null;
      const ix = await client.recordCoinCollection(publicKey, { amount });
      const tx = new Transaction().add(ix);
      return sendTx(tx);
    },
    [publicKey, sendTx],
  );

  /** Record final score on-chain */
  const recordScore = useCallback(
    async (score: number) => {
      if (!publicKey) return null;
      const ix = await client.recordScore(publicKey, { score });
      const tx = new Transaction().add(ix);
      return sendTx(tx);
    },
    [publicKey, sendTx],
  );

  /** Deposit JUNK tokens into game balance */
  const depositBalance = useCallback(
    async (amount: number) => {
      if (!publicKey) return null;
      const ix = await client.depositBalance(publicKey, { amount });
      const tx = new Transaction().add(ix);
      return sendTx(tx);
    },
    [publicKey, sendTx],
  );

  /** Withdraw JUNK tokens from game balance */
  const withdrawBalance = useCallback(
    async (amount: number) => {
      if (!publicKey) return null;
      const ix = await client.withdrawBalance(publicKey, { amount });
      const tx = new Transaction().add(ix);
      return sendTx(tx);
    },
    [publicKey, sendTx],
  );

  // ─── High scores ─────────────────────────────────────────────────────

  const fetchHighScores = useCallback(
    async (limit = 100): Promise<HighScoreEntry[]> => {
      if (!connection || !state.programAvailable) return [];
      return getHighScores(connection, PROGRAM_ID, limit);
    },
    [connection, state.programAvailable],
  );

  const fetchPlayerRank = useCallback(async () => {
    if (!connection || !publicKey || !state.programAvailable) return null;
    return getPlayerRank(connection, PROGRAM_ID, publicKey);
  }, [connection, publicKey, state.programAvailable]);

  // ─── Checks ───────────────────────────────────────────────────────────

  /** Whether the player has enough JUNK to play */
  const canPlay = connected && state.junkBalance > 0;

  /** Whether the on-chain program is deployed and ready */
  const isProgramReady = state.programAvailable;

  return {
    ...state,
    canPlay,
    isProgramReady,
    refreshBalances,
    initializeGame,
    recordCoinCollection,
    recordScore,
    depositBalance,
    withdrawBalance,
    fetchHighScores,
    fetchPlayerRank,
  };
}

export default useJunkPusherOnChain;
