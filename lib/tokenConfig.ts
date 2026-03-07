/**
 * Token Configuration for Gorbagana Junk Pusher
 *
 * DEBRIS Token: The sole token used in this dapp
 *
 * CRITICAL: All tokens use 9 decimals (Solana standard)
 */

export const TOKEN_CONFIG = {
  // DEBRIS Token - The dapp's token used for all gameplay
  DEBRIS: {
    address: 'DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy', // Debris token mint address
    symbol: 'DEBRIS',
    decimals: 9,
    name: 'Debris',
  },

  // Game Configuration
  GAME: {
    INITIAL_BALANCE: 100, // Starting DEBRIS balance (Default tokens provided)
    BUMP_COST: 50, // Cost in DEBRIS to bump the machine
    DROP_COST: 1, // Cost in DEBRIS to drop a coin
  },
} as const;
