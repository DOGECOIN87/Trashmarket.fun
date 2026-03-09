import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

/**
 * Transaction builder for Junk Pusher game interactions on Gorbagana.
 * Builds real Anchor-compatible instructions.
 */

const PROGRAM_ID = new PublicKey(
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SOLANA_PROGRAM_ID : undefined)
  || '11111111111111111111111111111111'
);

export interface BumpTransactionParams {
  playerAddress: string;
  amount: number;
}

export interface RecordScoreTransactionParams {
  playerAddress: string;
  score: number;
}

/**
 * Derive the game state PDA for a player
 */
function getGameStatePDA(playerPubkey: PublicKey, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('game_state'), playerPubkey.toBuffer()],
    programId
  );
}

/**
 * Build an Anchor instruction discriminator from the instruction name
 * Anchor uses SHA256("global:<instruction_name>")[0..8] as the discriminator
 */
async function getInstructionDiscriminator(name: string): Promise<Buffer> {
  const preimage = `global:${name}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(preimage);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(new Uint8Array(hashBuffer).slice(0, 8));
}

/**
 * Build a transaction to record coin collection (bump) on-chain
 */
export async function buildBumpTransaction(
  params: BumpTransactionParams
): Promise<Transaction> {
  const playerPubkey = new PublicKey(params.playerAddress);
  const [gameStatePDA] = getGameStatePDA(playerPubkey);

  const discriminator = await getInstructionDiscriminator('record_coin_collection');
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(params.amount));
  const instructionData = Buffer.concat([discriminator, amountBuffer]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: gameStatePDA, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  return transaction;
}

/**
 * Build a transaction to initialize a game session for a new player
 */
export async function buildInitializeGameTransaction(
  playerAddress: string,
  initialBalance: number = 100
): Promise<Transaction> {
  const playerPubkey = new PublicKey(playerAddress);
  const [gameStatePDA] = getGameStatePDA(playerPubkey);

  const discriminator = await getInstructionDiscriminator('initialize_game');
  const balanceBuffer = Buffer.alloc(8);
  balanceBuffer.writeBigUInt64LE(BigInt(initialBalance));
  const instructionData = Buffer.concat([discriminator, balanceBuffer]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: gameStatePDA, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  return transaction;
}

/**
 * Build a transaction to record score on-chain
 */
export async function buildRecordScoreTransaction(
  params: RecordScoreTransactionParams
): Promise<Transaction> {
  const playerPubkey = new PublicKey(params.playerAddress);
  const [gameStatePDA] = getGameStatePDA(playerPubkey);

  const discriminator = await getInstructionDiscriminator('record_score');
  const scoreBuffer = Buffer.alloc(8);
  scoreBuffer.writeBigUInt64LE(BigInt(params.score));
  const instructionData = Buffer.concat([discriminator, scoreBuffer]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: gameStatePDA, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);
  return transaction;
}

export default {
  buildBumpTransaction,
  buildInitializeGameTransaction,
  buildRecordScoreTransaction,
};
