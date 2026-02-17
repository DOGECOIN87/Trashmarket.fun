import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Solana service for managing wallet connections, RPC calls, and transactions.
 * Configured for Gorbagana (Solana fork) network.
 */

export interface SolanaConfig {
  rpcUrl: string;
  programId: string;
  cluster: 'devnet' | 'testnet' | 'mainnet' | 'gorbagana';
}

export interface WalletState {
  publicKey: PublicKey | null;
  isConnected: boolean;
  provider: any | null;
}

export interface TransactionResult {
  signature: string;
  confirmed: boolean;
  error?: string;
}

let connection: Connection | null = null;
let config: SolanaConfig | null = null;
let walletState: WalletState = {
  publicKey: null,
  isConnected: false,
  provider: null,
};

/**
 * Initialize Solana service with configuration
 */
export function initializeSolana(cfg: SolanaConfig): void {
  config = cfg;
  connection = new Connection(cfg.rpcUrl, 'confirmed');
  console.log(`[SolanaService] Initialized — RPC: ${cfg.rpcUrl}, Cluster: ${cfg.cluster}`);
}

/**
 * Get the active Connection instance
 */
export function getConnection(): Connection {
  if (!connection) throw new Error('Solana service not initialized. Call initializeSolana() first.');
  return connection;
}

/**
 * Detect a Solana-compatible wallet provider (Phantom, Solflare, etc.)
 */
export function detectWalletProvider(): any | null {
  if (typeof window === 'undefined') return null;

  // Phantom
  if ((window as any).phantom?.solana?.isPhantom) {
    return (window as any).phantom.solana;
  }
  // Solflare
  if ((window as any).solflare?.isSolflare) {
    return (window as any).solflare;
  }
  // Generic Solana provider (backpack, etc.)
  if ((window as any).solana?.isPhantom || (window as any).solana) {
    return (window as any).solana;
  }
  return null;
}

/**
 * Connect wallet to dApp via browser wallet extension
 */
export async function connectWallet(): Promise<WalletState> {
  const provider = detectWalletProvider();
  if (!provider) {
    throw new Error('No Solana wallet found. Please install Phantom or another Solana-compatible wallet.');
  }

  try {
    // Request connection — Phantom will show approval popup
    const response = await provider.connect();
    const publicKey = new PublicKey(response.publicKey.toString());

    walletState = {
      publicKey,
      isConnected: true,
      provider,
    };

    console.log(`[SolanaService] Wallet connected: ${publicKey.toBase58()}`);
    return walletState;
  } catch (error) {
    console.error('[SolanaService] Failed to connect wallet:', error);
    throw error;
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  try {
    if (walletState.provider?.disconnect) {
      await walletState.provider.disconnect();
    }
  } catch (e) {
    // Ignore disconnect errors
  }
  walletState = {
    publicKey: null,
    isConnected: false,
    provider: null,
  };
  console.log('[SolanaService] Wallet disconnected');
}

/**
 * Get current wallet state
 */
export function getWalletState(): WalletState {
  return { ...walletState };
}

/**
 * Get SOL/GOR balance of an address (in lamports)
 */
export async function getBalance(address?: PublicKey): Promise<number> {
  if (!connection) throw new Error('Solana service not initialized');

  const target = address || walletState.publicKey;
  if (!target) throw new Error('No address provided and wallet not connected');

  try {
    const balanceLamports = await connection.getBalance(target);
    return balanceLamports;
  } catch (error) {
    console.error('[SolanaService] Failed to get balance:', error);
    throw error;
  }
}

/**
 * Sign and send a transaction using the connected wallet
 */
export async function sendTransaction(transaction: Transaction): Promise<TransactionResult> {
  if (!connection) throw new Error('Solana service not initialized');
  if (!walletState.provider || !walletState.publicKey) {
    throw new Error('Wallet not connected');
  }

  try {
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletState.publicKey;

    // Sign via wallet extension (Phantom handles the UI popup)
    const signed = await walletState.provider.signTransaction(transaction);

    // Send the signed transaction
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    if (confirmation.value.err) {
      return {
        signature,
        confirmed: false,
        error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
      };
    }

    console.log(`[SolanaService] Transaction confirmed: ${signature}`);
    return { signature, confirmed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SolanaService] Failed to send transaction:', error);
    return {
      signature: '',
      confirmed: false,
      error: message,
    };
  }
}

/**
 * Get program configuration
 */
export function getProgramConfig(): SolanaConfig {
  if (!config) throw new Error('Solana service not initialized');
  return { ...config };
}

/**
 * Get the program PublicKey
 */
export function getProgramId(): PublicKey {
  if (!config) throw new Error('Solana service not initialized');
  return new PublicKey(config.programId);
}

/**
 * Check if wallet is connected
 */
export function isWalletConnected(): boolean {
  return walletState.isConnected && walletState.publicKey !== null;
}

export default {
  initializeSolana,
  getConnection,
  detectWalletProvider,
  connectWallet,
  disconnectWallet,
  getWalletState,
  getBalance,
  sendTransaction,
  getProgramConfig,
  getProgramId,
  isWalletConnected,
};
