/**
 * Generated Client SDK for Junk Pusher Game Program
 * Configured for Gorbagana (Solana fork) deployment
 * 
 * SECURITY: All transactions are validated to ensure:
 * - Only DEBRIS tokens are accepted for deposits
 * - Withdrawals are limited to verified winnings
 * - All inputs are sanitized and validated
 */

import { PublicKey, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  validateDebrisTokenMint,
  validateDepositAmount,
  validateWithdrawalAmount,
  validateGameScore,
  validateWalletAddress,
} from './gameSecurityModule';
import { TOKEN_CONFIG, GAME_TREASURY_WALLET } from './tokenConfig';

const DEBRIS_MINT = new PublicKey(TOKEN_CONFIG.DEBRIS.address);
const TREASURY_WALLET = new PublicKey(GAME_TREASURY_WALLET);

// Derive treasury token account dynamically (PDA-controlled DEBRIS ATA for player payouts)
const TREASURY_TOKEN_ACCOUNT = getAssociatedTokenAddressSync(
  DEBRIS_MINT, TREASURY_WALLET, true, TOKEN_2022_PROGRAM_ID
);

// Program ID from environment, falls back to placeholder
function getProgramId(): PublicKey {
  const envProgramId = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_SOLANA_PROGRAM_ID
    : undefined;

  if (!envProgramId || envProgramId === '11111111111111111111111111111111') {
    console.warn(
      '[JunkPusherClient] Using placeholder Program ID. Deploy the program and set VITE_SOLANA_PROGRAM_ID in .env.local'
    );
  }

  return new PublicKey(envProgramId || '11111111111111111111111111111111');
}

export const PROGRAM_ID = getProgramId();

export interface InitializeGameParams {
  initialBalance: number;
}

export interface RecordCoinCollectionParams {
  amount: number;
}

export interface RecordScoreParams {
  score: number;
}

export interface DepositBalanceParams {
  amount: number;
  tokenMint?: string; // Optional: will validate against DEBRIS token
}

export interface WithdrawBalanceParams {
  amount: number;
  verifiedWinnings: number; // Required: amount player has actually won
  currentBalance: number; // Required: current on-chain balance
}

/**
 * Junk Pusher Game Program Client
 * Provides typed instruction builders and account readers.
 * 
 * SECURITY FEATURES:
 * - Token validation: Only DEBRIS tokens accepted
 * - Amount validation: Prevents overflow/underflow
 * - Wallet validation: Ensures valid Solana addresses
 * - Withdrawal protection: Only allows withdrawal of verified winnings
 */
export class JunkPusherClient {
  private programId: PublicKey;

  constructor(programId?: PublicKey) {
    this.programId = programId || PROGRAM_ID;
  }

  /**
   * Derive the game state PDA for a player
   */
  static getGameStatePDA(
    playerAddress: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('game_state'), playerAddress.toBuffer()],
      programId
    );
  }

  /**
   * Derive the treasury authority PDA (controls treasury token account)
   */
  static getTreasuryAuthorityPDA(
    programId: PublicKey = PROGRAM_ID
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('treasury_authority')],
      programId
    );
  }

  /**
   * Derive the game config PDA (stores admin authority)
   */
  static getGameConfigPDA(
    programId: PublicKey = PROGRAM_ID
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('game_config')],
      programId
    );
  }

  /**
   * Build an Anchor instruction discriminator
   */
  private async getDiscriminator(name: string): Promise<Buffer> {
    const preimage = `global:${name}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(preimage);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
  }

  /**
   * Build: Initialize game session for a player
   */
  async initializeGame(
    player: PublicKey,
    params: InitializeGameParams
  ): Promise<TransactionInstruction> {
    // Validate player address
    if (!validateWalletAddress(player)) {
      throw new Error('[Security] Invalid player wallet address');
    }

    // Validate initial balance
    const balanceValidation = validateDepositAmount(params.initialBalance);
    if (!balanceValidation.valid) {
      throw new Error(`[Security] ${balanceValidation.error}`);
    }

    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);

    const discriminator = await this.getDiscriminator('initialize_game');
    const data = Buffer.alloc(16);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.initialBalance), 8);

    return new TransactionInstruction({
      keys: [
        { pubkey: gameStatePDA, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });
  }

  /**
   * Build: Record a coin collection (bump action)
   */
  async recordCoinCollection(
    player: PublicKey,
    params: RecordCoinCollectionParams
  ): Promise<TransactionInstruction> {
    // Validate player address
    if (!validateWalletAddress(player)) {
      throw new Error('[Security] Invalid player wallet address');
    }

    // Validate amount
    const amountValidation = validateDepositAmount(params.amount);
    if (!amountValidation.valid) {
      throw new Error(`[Security] ${amountValidation.error}`);
    }

    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);

    const discriminator = await this.getDiscriminator('record_coin_collection');
    const data = Buffer.alloc(16);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.amount), 8);

    return new TransactionInstruction({
      keys: [
        { pubkey: gameStatePDA, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data,
    });
  }

  /**
   * Build: Record player score
   * SECURITY: Validates score integrity
   */
  async recordScore(
    player: PublicKey,
    params: RecordScoreParams
  ): Promise<TransactionInstruction> {
    // Validate player address
    if (!validateWalletAddress(player)) {
      throw new Error('[Security] Invalid player wallet address');
    }

    // Validate score
    const scoreValidation = validateGameScore(params.score);
    if (!scoreValidation.valid) {
      throw new Error(`[Security] ${scoreValidation.error}`);
    }

    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);

    const discriminator = await this.getDiscriminator('record_score');
    const data = Buffer.alloc(16);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.score), 8);

    return new TransactionInstruction({
      keys: [
        { pubkey: gameStatePDA, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data,
    });
  }

  /**
   * Build: Deposit DEBRIS tokens into game balance
   * SECURITY: Only DEBRIS tokens are accepted
   */
  async depositBalance(
    player: PublicKey,
    params: DepositBalanceParams
  ): Promise<TransactionInstruction> {
    // Validate player address
    if (!validateWalletAddress(player)) {
      throw new Error('[Security] Invalid player wallet address');
    }

    // Validate deposit amount
    const amountValidation = validateDepositAmount(params.amount);
    if (!amountValidation.valid) {
      throw new Error(`[Security] ${amountValidation.error}`);
    }

    // Validate token mint (if provided)
    if (params.tokenMint && !validateDebrisTokenMint(params.tokenMint)) {
      throw new Error('[Security] Only DEBRIS tokens are accepted for deposits');
    }

    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);

    // Derive player's DEBRIS token account (Token-2022 ATA)
    const playerTokenAccount = getAssociatedTokenAddressSync(
      DEBRIS_MINT, player, false, TOKEN_2022_PROGRAM_ID
    );

    const discriminator = await this.getDiscriminator('deposit_balance');
    const data = Buffer.alloc(16);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.amount), 8);

    const [treasuryAuthority] = JunkPusherClient.getTreasuryAuthorityPDA(this.programId);

    return new TransactionInstruction({
      keys: [
        { pubkey: gameStatePDA, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: true, isWritable: true },
        { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TREASURY_TOKEN_ACCOUNT, isSigner: false, isWritable: true },
        { pubkey: DEBRIS_MINT, isSigner: false, isWritable: false },
        { pubkey: treasuryAuthority, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });
  }

  /**
   * Build: Withdraw DEBRIS tokens from game
   * SECURITY: Only allows withdrawal of verified winnings
   */
  async withdrawBalance(
    player: PublicKey,
    params: WithdrawBalanceParams
  ): Promise<TransactionInstruction> {
    // Validate player address
    if (!validateWalletAddress(player)) {
      throw new Error('[Security] Invalid player wallet address');
    }

    // Validate withdrawal amount against verified winnings
    const withdrawalValidation = validateWithdrawalAmount(
      params.amount,
      params.verifiedWinnings,
      params.currentBalance
    );
    if (!withdrawalValidation.valid) {
      throw new Error(`[Security] ${withdrawalValidation.error}`);
    }

    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);

    // Derive player's DEBRIS token account and treasury authority PDA
    const playerTokenAccount = getAssociatedTokenAddressSync(
      DEBRIS_MINT, player, false, TOKEN_2022_PROGRAM_ID
    );
    const [treasuryAuthority] = JunkPusherClient.getTreasuryAuthorityPDA(this.programId);

    const discriminator = await this.getDiscriminator('withdraw_balance');
    const data = Buffer.alloc(16);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.amount), 8);

    return new TransactionInstruction({
      keys: [
        { pubkey: gameStatePDA, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: true, isWritable: true },
        { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TREASURY_TOKEN_ACCOUNT, isSigner: false, isWritable: true },
        { pubkey: DEBRIS_MINT, isSigner: false, isWritable: false },
        { pubkey: treasuryAuthority, isSigner: false, isWritable: false },
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });
  }

  /**
   * Build: Update balance via admin-signed backend
   * Returns the instruction + admin public key for building a multi-signer tx
   */
  async updateBalanceViaBackend(
    player: PublicKey,
    newBalance: number,
    netProfitDelta: number,
    apiBaseUrl: string,
    auth?: { message: string; signature: string },
  ): Promise<{ instruction: TransactionInstruction; adminPublicKey: PublicKey }> {
    // Call backend to get instruction data and admin key
    const response = await fetch(`${apiBaseUrl}/api/game/update-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerWallet: player.toBase58(),
        newBalance,
        netProfitDelta,
        ...(auth ? { message: auth.message, signature: auth.signature } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.json() as any;
      throw new Error(err.error || 'Failed to get update balance instruction');
    }

    const result = await response.json() as any;
    const adminPubkey = new PublicKey(result.instruction.adminPublicKey);

    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);
    const [gameConfigPDA] = JunkPusherClient.getGameConfigPDA(this.programId);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: gameStatePDA, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: false, isWritable: false },
        { pubkey: gameConfigPDA, isSigner: false, isWritable: false },
        { pubkey: adminPubkey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(result.instruction.data),
    });

    return { instruction: ix, adminPublicKey: adminPubkey };
  }

  /**
   * Request admin signature on a transaction message
   */
  async getAdminSignature(
    transactionMessage: Uint8Array,
    apiBaseUrl: string,
    playerWallet?: string,
    auth?: { message: string; signature: string },
  ): Promise<{ signature: Uint8Array; adminPublicKey: PublicKey }> {
    const response = await fetch(`${apiBaseUrl}/api/game/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction: btoa(String.fromCharCode(...transactionMessage)),
        ...(playerWallet ? { playerWallet } : {}),
        ...(auth ? { message: auth.message, signature: auth.signature } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.json() as any;
      throw new Error(err.error || 'Failed to get admin signature');
    }

    const result = await response.json() as any;
    const sigBytes = Uint8Array.from(atob(result.signature), c => c.charCodeAt(0));
    return {
      signature: sigBytes,
      adminPublicKey: new PublicKey(result.adminPublicKey),
    };
  }

  /**
   * Build: Reset game state
   */
  async resetGame(player: PublicKey): Promise<TransactionInstruction> {
    // Validate player address
    if (!validateWalletAddress(player)) {
      throw new Error('[Security] Invalid player wallet address');
    }

    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);

    const discriminator = await this.getDiscriminator('reset_game');

    return new TransactionInstruction({
      keys: [
        { pubkey: gameStatePDA, isSigner: false, isWritable: true },
        { pubkey: player, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from(discriminator),
    });
  }
}

export default JunkPusherClient;
