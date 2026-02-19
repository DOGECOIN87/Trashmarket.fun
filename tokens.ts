import { PublicKey } from '@solana/web3.js';

/**
 * Gorbagana Token Configuration
 * ALL tokens use 9 decimals (standard Solana)
 * 
 * CRITICAL: These decimal values have been corrected from 6 to 9
 * to match Solana standard and Gorbagana network requirements
 */

export const GOR_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const TRASHCOIN_MINT = new PublicKey('GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z');
export const JUNK_MINT = new PublicKey('BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF');

export const GOR_DECIMALS = 9;
export const TRASHCOIN_DECIMALS = 9;
export const JUNK_DECIMALS = 9;

export const TREASURY_WALLET = new PublicKey('77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb');

export const GORBAGANA_RPC = 'https://rpc.trashscan.io';
export const GORBAGANA_API = 'https://gorapi.trashscan.io';
export const GORBAGANA_WS = 'wss://rpc.trashscan.io';

export const LAMPORTS_PER_TOKEN = 1_000_000_000; // 10^9 for all tokens

/**
 * Convert human-readable token amount to base units (lamports)
 * @param amount - Token amount in human-readable format (e.g., 1.5)
 * @returns Amount in base units (lamports)
 */
export function toBaseUnits(amount: number): bigint {
  return BigInt(Math.round(amount * LAMPORTS_PER_TOKEN));
}

/**
 * Convert base units (lamports) to human-readable token amount
 * @param lamports - Amount in base units
 * @returns Token amount in human-readable format
 */
export function fromBaseUnits(lamports: bigint | number): number {
  return Number(lamports) / LAMPORTS_PER_TOKEN;
}

/**
 * Token Configuration Object (Legacy compatibility)
 */
export const TOKEN_CONFIG = {
  // JUNK Token - Primary betting currency
  JUNK: {
    address: JUNK_MINT.toString(),
    symbol: 'JUNK',
    decimals: JUNK_DECIMALS,
    name: 'JUNK Token',
  },
  
  // TRASHCOIN - Rare reward token
  TRASHCOIN: {
    address: TRASHCOIN_MINT.toString(),
    symbol: 'TRASH',
    decimals: TRASHCOIN_DECIMALS,
    name: 'TrashCoin',
  },
  
  // GOR - Native token
  GOR: {
    address: GOR_MINT.toString(),
    symbol: 'GOR',
    decimals: GOR_DECIMALS,
    name: 'Gorbagana',
  },
  
  // Game Configuration
  GAME: {
    INITIAL_BALANCE: 100, // Starting JUNK balance
    BUMP_COST: 50, // Cost in JUNK to bump the machine
    DROP_COST: 1, // Cost in JUNK to drop a coin
  },
} as const;
