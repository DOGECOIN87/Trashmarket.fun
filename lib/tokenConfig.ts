/**
 * Token Configuration for Gorbagana Junk Pusher
 *
 * DEBRI Token: The sole token used in this dapp
 *
 * CRITICAL: All tokens use 9 decimals (Solana standard)
 */

export const TOKEN_CONFIG = {
  // DEBRI Token - The dapp's token used for all gameplay
  DEBRI: {
    address: '', // To be set when the Debri token is created
    symbol: 'DEBRI',
    decimals: 9,
    name: 'Debri',
  },

  // Game Configuration
  GAME: {
    INITIAL_BALANCE: 100, // Starting DEBRI balance (Default tokens provided)
    BUMP_COST: 50, // Cost in DEBRI to bump the machine
    DROP_COST: 1, // Cost in DEBRI to drop a coin
  },
} as const;
