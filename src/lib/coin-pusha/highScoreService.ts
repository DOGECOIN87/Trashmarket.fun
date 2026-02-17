import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';

/**
 * High Score Service - Query blockchain for leaderboard data
 * Fetches all game state accounts and ranks them by score
 */

export interface HighScoreEntry {
  rank: number;
  player: string;
  score: number;
  balance: number;
  netProfit: number;
  totalCoinsCollected: number;
  lastUpdated: number;
}

/**
 * Fetch all game state accounts from the blockchain
 */
export async function fetchAllGameStates(
  connection: Connection,
  programId: PublicKey
): Promise<any[]> {
  try {
    // Fetch all accounts owned by the program
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        {
          // Filter for GameState accounts (8 byte discriminator + data)
          dataSize: 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1, // Approximate size
        },
      ],
    });

    return accounts;
  } catch (error) {
    console.error('Error fetching game states:', error);
    return [];
  }
}

/**
 * Parse game state account data
 */
function parseGameState(accountData: Buffer): HighScoreEntry | null {
  try {
    // Skip 8-byte discriminator
    let offset = 8;

    // Parse fields (based on GameState struct in lib.rs)
    const player = new PublicKey(accountData.slice(offset, offset + 32));
    offset += 32;

    const score = accountData.readBigUInt64LE(offset);
    offset += 8;

    const balance = accountData.readBigUInt64LE(offset);
    offset += 8;

    const netProfit = accountData.readBigInt64LE(offset);
    offset += 8;

    const totalCoinsCollected = accountData.readBigUInt64LE(offset);
    offset += 8;

    const createdAt = accountData.readBigInt64LE(offset);
    offset += 8;

    const lastUpdated = accountData.readBigInt64LE(offset);

    return {
      rank: 0, // Will be set when sorting
      player: player.toBase58(),
      score: Number(score),
      balance: Number(balance),
      netProfit: Number(netProfit),
      totalCoinsCollected: Number(totalCoinsCollected),
      lastUpdated: Number(lastUpdated),
    };
  } catch (error) {
    console.error('Error parsing game state:', error);
    return null;
  }
}

/**
 * Get high scores (top players by score)
 */
export async function getHighScores(
  connection: Connection,
  programId: PublicKey,
  limit: number = 100
): Promise<HighScoreEntry[]> {
  try {
    const accounts = await fetchAllGameStates(connection, programId);

    // Parse and filter valid accounts
    const parsedStates = accounts
      .map((account) => parseGameState(account.account.data))
      .filter((state): state is HighScoreEntry => state !== null);

    // Sort by score (descending)
    parsedStates.sort((a, b) => b.score - a.score);

    // Assign ranks and limit results
    const topScores = parsedStates.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return topScores;
  } catch (error) {
    console.error('Error getting high scores:', error);
    return [];
  }
}

/**
 * Get player's rank and stats
 */
export async function getPlayerRank(
  connection: Connection,
  programId: PublicKey,
  playerAddress: PublicKey
): Promise<{ rank: number; total: number; stats: HighScoreEntry | null }> {
  try {
    const accounts = await fetchAllGameStates(connection, programId);

    const parsedStates = accounts
      .map((account) => parseGameState(account.account.data))
      .filter((state): state is HighScoreEntry => state !== null);

    // Sort by score
    parsedStates.sort((a, b) => b.score - a.score);

    // Find player's rank
    const playerAddressStr = playerAddress.toBase58();
    const playerIndex = parsedStates.findIndex(
      (entry) => entry.player === playerAddressStr
    );

    if (playerIndex === -1) {
      return { rank: 0, total: parsedStates.length, stats: null };
    }

    const playerStats = {
      ...parsedStates[playerIndex],
      rank: playerIndex + 1,
    };

    return {
      rank: playerIndex + 1,
      total: parsedStates.length,
      stats: playerStats,
    };
  } catch (error) {
    console.error('Error getting player rank:', error);
    return { rank: 0, total: 0, stats: null };
  }
}

/**
 * Get leaderboard by net profit
 */
export async function getTopProfits(
  connection: Connection,
  programId: PublicKey,
  limit: number = 100
): Promise<HighScoreEntry[]> {
  try {
    const accounts = await fetchAllGameStates(connection, programId);

    const parsedStates = accounts
      .map((account) => parseGameState(account.account.data))
      .filter((state): state is HighScoreEntry => state !== null);

    // Sort by net profit (descending)
    parsedStates.sort((a, b) => b.netProfit - a.netProfit);

    // Assign ranks and limit results
    const topProfits = parsedStates.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    return topProfits;
  } catch (error) {
    console.error('Error getting top profits:', error);
    return [];
  }
}

export default {
  getHighScores,
  getPlayerRank,
  getTopProfits,
};
