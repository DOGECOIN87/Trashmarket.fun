/**
 * Token Configuration for Gorbagana Junk Pusher
 *
 * DEBRIS Token: The sole token used in this dapp
 *
 * CRITICAL: All tokens use 9 decimals (Solana standard)
 */

// Game treasury wallet - holds DEBRIS tokens for player payouts
export const GAME_TREASURY_WALLET = '8iKCvwz3tyUp4hzxcyLYtPQghiwiEhiLDd38MEQBF6kR';

export const TOKEN_CONFIG = {
  // DEBRIS Token - The dapp's token used for all gameplay
  DEBRIS: {
    address: 'DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy', // Debris token mint address
    symbol: 'DEBRIS',
    decimals: 9,
    name: 'Debris',
  },

  // Game Treasury
  TREASURY: {
    address: GAME_TREASURY_WALLET,
    tokenAccount: '2FiLdUB55vgDz24Hq12FqHuQpkmwJadeERUJqf32zi9J', // PDA-controlled DEBRIS account
  },

  // Game Configuration
  GAME: {
    INITIAL_BALANCE: 100, // Starting DEBRIS balance (Default tokens provided)
    BUMP_COST: 50, // Cost in DEBRIS to bump the machine
    DROP_COST: 1, // Cost in DEBRIS to drop a coin
  },
} as const;

// Known wallet labels for the top holders display
export const KNOWN_WALLETS: Record<string, string> = {
  '8iKCvwz3tyUp4hzxcyLYtPQghiwiEhiLDd38MEQBF6kR': 'Junk Pusher Treasury',
  'JqmENAh1F16QVzt5U7gjqQCJT4Qk2Ja9J2Pa4L55n6m': 'Junk Pusher Treasury PDA',
  'Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ': 'Platform Operations',
  '77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb': 'NFT Marketplace Treasury',
  'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo': 'Airdrop Pool',
  'GdS8GCrAaVviZE5nxTNGG3pYxxb1UCgUbf23FwCTVirK': 'Main Supply',
  'Eyu7XqQ6WR7czNsGHWbiyYWpniikMYctsAHrvUCXcqtU': 'Slots Treasury',
  'CdaobFF9Sgr6eN1pKMWfx3hZxkf6qqLUut15vVBb2wG6': 'DEX Liquidity',
  '7qrxa4jsxVWrNRmuFNPv5ekCScjdk8gPeFg7xDdEdHzU': 'Reserve',
};
