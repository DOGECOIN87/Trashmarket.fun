/**
 * Centralized RPC Configuration
 *
 * Single source of truth for all RPC endpoints used across the dApp.
 * Import from here instead of hardcoding RPC URLs anywhere else.
 *
 * Gorbagana RPC: rpc.trashscan.io (preferred by the project)
 * Solana Mainnet: api.mainnet-beta.solana.com
 * Solana Devnet: api.devnet.solana.com
 */

export const RPC_ENDPOINTS = {
  /** Gorbagana L2 mainnet RPC */
  GORBAGANA: 'https://rpc.trashscan.io',

  /** Gorbagana WebSocket endpoint */
  GORBAGANA_WS: 'wss://rpc.trashscan.io',

  /** Gorbagana REST API */
  GORBAGANA_API: 'https://gorapi.trashscan.io',

  /** Solana mainnet-beta RPC */
  SOLANA_MAINNET: 'https://api.mainnet-beta.solana.com',

  /** Solana devnet RPC */
  SOLANA_DEVNET: 'https://api.devnet.solana.com',
} as const;

/** Gorbagana block explorer */
export const EXPLORER_URLS = {
  GORBAGANA: 'https://trashscan.io',
  SOLANA_MAINNET: 'https://explorer.solana.com',
  SOLANA_DEVNET: 'https://explorer.solana.com',
} as const;

export type RpcEndpoint = (typeof RPC_ENDPOINTS)[keyof typeof RPC_ENDPOINTS];
