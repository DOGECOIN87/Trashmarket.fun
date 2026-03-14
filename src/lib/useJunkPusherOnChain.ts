/**
 * useJunkPusherOnChain — React hook for on-chain Junk Pusher integration (FEAT-01)
 *
 * Wires the existing JunkPusherClient instruction builders and tokenService
 * into the wallet adapter so that game actions produce real transactions.
 *
 * Capabilities:
 *  - Check on-chain DEBRIS token balance before allowing play
 *  - Send initializeGame, recordCoinCollection, recordScore, depositBalance, withdrawBalance txs
 *  - Fetch high scores from the blockchain
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { JunkPusherClient, PROGRAM_ID } from './JunkPusherClient';
import { getDebrisBalance, TokenBalance } from './tokenService';
import { getHighScores, getPlayerRank, HighScoreEntry } from './highScoreService';
import { TOKEN_CONFIG } from './tokenConfig';
import { parseTransactionError } from '../utils/errorMessages';

export type TxLabel = 'Deposit DEBRIS' | 'Withdraw DEBRIS' | 'Initialize Game' | 'Record Score' | 'Bump' | '';

export interface OnChainState {
  /** On-chain DEBRIS token balance (human-readable) */
  debrisBalance: number;
  /** Whether the on-chain program is available (program ID is not placeholder) */
  programAvailable: boolean;
  /** Loading state for balance fetches */
  isLoadingBalance: boolean;
  /** Last transaction signature */
  lastTxSignature: string | null;
  /** Transaction status */
  txStatus: 'idle' | 'building' | 'signing' | 'confirming' | 'confirmed' | 'error';
  /** Human-readable label for the current transaction */
  txLabel: TxLabel;
  /** Error message */
  error: string | null;
}

export function useJunkPusherOnChain() {
  const { publicKey, signTransaction, signMessage, connected } = useWallet();
  const { connection } = useConnection();

  const [state, setState] = useState<OnChainState>({
    debrisBalance: 0,
    programAvailable: PROGRAM_ID.toBase58() !== '11111111111111111111111111111111',
    isLoadingBalance: false,
    lastTxSignature: null,
    txStatus: 'idle',
    txLabel: '',
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
      const debris = await getDebrisBalance(connection, publicKey);
      setState((s) => ({
        ...s,
        debrisBalance: debris,
        isLoadingBalance: false,
      }));
    } catch (err: any) {
      console.error('[OnChain] Balance fetch error:', err);
      setState((s) => ({
        ...s,
        isLoadingBalance: false,
        error: parseTransactionError(err) || 'Failed to fetch balances',
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
    async (tx: Transaction, label: TxLabel = ''): Promise<string | null> => {
      if (!publicKey || !signTransaction || !connection) {
        setState((s) => ({ ...s, error: 'Wallet not connected', txStatus: 'error', txLabel: label }));
        return null;
      }

      try {
        setState((s) => ({ ...s, txStatus: 'building', txLabel: label, error: null }));

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
          setState((s) => ({ ...s, txStatus: 'idle', txLabel: '' }));
        }, 3000);

        return signature;
      } catch (err: any) {
        console.error('[OnChain] Transaction error:', err);
        setState((s) => ({
          ...s,
          txStatus: 'error',
          error: parseTransactionError(err),
        }));
        setTimeout(() => {
          setState((s) => ({ ...s, txStatus: 'idle', txLabel: '' }));
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
      console.log(`[OnChain] Initializing game with balance: ${initialBalance}`);
      const ix = await client.initializeGame(publicKey, { initialBalance });
      const tx = new Transaction().add(ix);
      return sendTx(tx, 'Initialize Game');
    },
    [publicKey, sendTx],
  );

  /** Ensure game state PDA is initialized, returns true if already initialized or successfully created */
  const ensureInitialized = useCallback(
    async (initialBalance?: number): Promise<boolean> => {
      if (!publicKey || !connection) return false;
      try {
        const [gameStatePDA] = JunkPusherClient.getGameStatePDA(publicKey);
        const acct = await connection.getAccountInfo(gameStatePDA);
        if (acct) return true; // already initialized
        // Initialize it
        const sig = await initializeGame(initialBalance);
        return sig !== null;
      } catch (err) {
        console.warn('[OnChain] ensureInitialized error:', err);
        return false;
      }
    },
    [publicKey, connection, initializeGame],
  );

  /** Record a coin collection (bump) on-chain */
  const recordCoinCollection = useCallback(
    async (amount: number, initialBalance?: number) => {
      if (!publicKey) return null;
      await ensureInitialized(initialBalance);
      const ix = await client.recordCoinCollection(publicKey, { amount });
      const tx = new Transaction().add(ix);
      return sendTx(tx, 'Bump');
    },
    [publicKey, sendTx, ensureInitialized],
  );

  /** Record final score on-chain */
  const recordScore = useCallback(
    async (score: number, initialBalance?: number) => {
      if (!publicKey) return null;
      await ensureInitialized(initialBalance);
      const ix = await client.recordScore(publicKey, { score });
      const tx = new Transaction().add(ix);
      return sendTx(tx, 'Record Score');
    },
    [publicKey, sendTx, ensureInitialized],
  );

  /** Deposit DEBRIS tokens into game balance */
  const depositBalance = useCallback(
    async (amount: number, initialBalance?: number) => {
      if (!publicKey) return null;
      const initialized = await ensureInitialized(initialBalance);
      if (!initialized) {
        setState((s) => ({ ...s, error: 'Failed to initialize game state', txStatus: 'error', txLabel: 'Deposit DEBRIS' }));
        return null;
      }
      const ix = await client.depositBalance(publicKey, { amount });
      const tx = new Transaction().add(ix);
      return sendTx(tx, 'Deposit DEBRIS');
    },
    [publicKey, sendTx, ensureInitialized],
  );

  /**
   * Withdraw DEBRIS tokens from game balance.
   * verifiedWinnings must be the player's tracked net profit (NOT the withdrawal amount).
   * currentBalance must be the player's actual on-chain game balance.
   */
  const withdrawBalance = useCallback(
    async (amount: number, verifiedWinnings: number, currentBalance: number) => {
      if (!publicKey) return null;
      const ix = await client.withdrawBalance(publicKey, {
        amount,
        verifiedWinnings,
        currentBalance,
      });
      const tx = new Transaction().add(ix);
      return sendTx(tx, 'Withdraw DEBRIS');
    },
    [publicKey, sendTx],
  );

  // ─── Update balance (admin-signed via backend) ──────────────────────

  /**
   * Create a signed auth payload to prove wallet ownership to the backend.
   * The player signs a message containing their wallet + timestamp.
   */
  const createAuthPayload = useCallback(
    async (): Promise<{ message: string; signature: string } | null> => {
      if (!publicKey || !signMessage) return null;
      const message = `Trashmarket Game Auth\nWallet: ${publicKey.toBase58()}\nTimestamp: ${Date.now()}`;
      try {
        const msgBytes = new TextEncoder().encode(message);
        const sigBytes = await signMessage(msgBytes);
        const signature = btoa(String.fromCharCode(...sigBytes));
        return { message, signature };
      } catch (err) {
        console.warn('[OnChain] Failed to sign auth message:', err);
        return null;
      }
    },
    [publicKey, signMessage],
  );

  /** Update game balance via admin-signed backend transaction */
  const updateBalance = useCallback(
    async (newBalance: number, netProfitDelta: number) => {
      if (!publicKey || !signTransaction || !signMessage || !connection) return null;

      try {
        setState((s) => ({ ...s, txStatus: 'building', txLabel: '', error: null }));

        // Sign an auth message to prove wallet ownership
        const auth = await createAuthPayload();
        if (!auth) {
          setState((s) => ({ ...s, error: 'Failed to sign auth message', txStatus: 'error' }));
          return null;
        }

        const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || '';

        // Get the instruction and admin key from backend (with auth)
        const { instruction, adminPublicKey } = await client.updateBalanceViaBackend(
          publicKey,
          newBalance,
          netProfitDelta,
          apiBaseUrl,
          auth,
        );

        // Build the transaction
        const tx = new Transaction().add(instruction);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        // Serialize the transaction message for admin to sign
        const txMessage = tx.serializeMessage();

        // Get admin signature from backend (with auth)
        const { signature: adminSig } = await client.getAdminSignature(
          txMessage,
          apiBaseUrl,
          publicKey.toBase58(),
          auth,
        );

        // Add admin signature to transaction
        tx.addSignature(adminPublicKey, Buffer.from(adminSig));

        // Player signs the transaction
        setState((s) => ({ ...s, txStatus: 'signing' }));
        const signed = await signTransaction(tx);

        // Send
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

        setTimeout(() => refreshBalances(), 2000);
        setTimeout(() => {
          setState((s) => ({ ...s, txStatus: 'idle', txLabel: '' }));
        }, 3000);

        return signature;
      } catch (err: any) {
        console.error('[OnChain] Update balance error:', err);
        setState((s) => ({
          ...s,
          txStatus: 'error',
          error: parseTransactionError(err),
        }));
        setTimeout(() => {
          setState((s) => ({ ...s, txStatus: 'idle', txLabel: '' }));
        }, 3000);
        return null;
      }
    },
    [publicKey, signTransaction, signMessage, connection, refreshBalances, createAuthPayload],
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

  /** Whether the player has enough DEBRIS to play */
  const canPlay = connected && state.debrisBalance > 0;

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
    updateBalance,
    fetchHighScores,
    fetchPlayerRank,
  };
}

export default useJunkPusherOnChain;
