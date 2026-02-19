/**
 * Generated Client SDK for Junk Pusher Game Program
 * Configured for Gorbagana (Solana fork) deployment
 */

import { PublicKey, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';

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
}

export interface WithdrawBalanceParams {
  amount: number;
}

/**
 * Junk Pusher Game Program Client
 * Provides typed instruction builders and account readers.
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
   */
  async recordScore(
    player: PublicKey,
    params: RecordScoreParams
  ): Promise<TransactionInstruction> {
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
   * Build: Deposit SOL/GOR into game balance
   */
  async depositBalance(
    player: PublicKey,
    params: DepositBalanceParams
  ): Promise<TransactionInstruction> {
    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);

    const discriminator = await this.getDiscriminator('deposit_balance');
    const data = Buffer.alloc(16);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.amount), 8);

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
   * Build: Withdraw balance from game
   */
  async withdrawBalance(
    player: PublicKey,
    params: WithdrawBalanceParams
  ): Promise<TransactionInstruction> {
    const [gameStatePDA] = JunkPusherClient.getGameStatePDA(player, this.programId);

    const discriminator = await this.getDiscriminator('withdraw_balance');
    const data = Buffer.alloc(16);
    discriminator.copy(data, 0);
    data.writeBigUInt64LE(BigInt(params.amount), 8);

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
   * Build: Reset game state
   */
  async resetGame(player: PublicKey): Promise<TransactionInstruction> {
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
