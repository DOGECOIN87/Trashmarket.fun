/**
 * Token Configuration for Gorbagana Junk Pusher
 * 
 * JUNK Token: Primary betting currency (SPL Token on Gorbagana)
 * TRASHCOIN: Rare reward token (SPL Token on Gorbagana)
 * 
 * CRITICAL: All tokens use 9 decimals (Solana standard)
 */

export const TOKEN_CONFIG = {
  // JUNK Token - Primary betting currency
  JUNK: {
    address: 'BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF',
    symbol: 'JUNK',
    decimals: 9,
    name: 'JUNK Token',
  },
  
  // TRASHCOIN - Rare reward token (cannot be used for betting)
  TRASHCOIN: {
    address: 'GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z',
    symbol: 'TRASH',
    decimals: 9,
    name: 'TrashCoin',
  },
  
  // Game Configuration
  GAME: {
    INITIAL_BALANCE: 100, // Starting JUNK balance
    BUMP_COST: 50, // Cost in JUNK to bump the machine
    DROP_COST: 1, // Cost in JUNK to drop a coin
  },
} as const;
