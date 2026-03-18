/**
 * Shared constants and configuration for DEBRIS Airdrop Registration
 */

export const ASSETS = {
  LOGO: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663232456814/AJxYCiGr64HuKrGvb5joU8/logo_000e1da4.svg',
  PATTERN: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663232456814/AJxYCiGr64HuKrGvb5joU8/enhanced_logo_v6_03c1c13b.svg',
  HERO: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663232456814/AJxYCiGr64HuKrGvb5joU8/grok_image_1773355968590_07ac522a.jpg',
} as const;

export const BRAND = {
  NAME: 'DEBRIS',
  SUBTITLE: 'Airdrop Registration',
  DESCRIPTION: 'Register your Gorbagana wallet for the DEBRIS airdrop',
} as const;

export const COLORS = {
  BLACK: '#000000',
  DARK_CARD: '#080808',
  DARK_HOVER: '#111111',
  NEON_GREEN: '#adff02',
  LOGO_GREEN: '#cbf30c',
  MAGENTA: '#ff00ff',
  PURPLE: '#9945ff',
  RED: '#ff2222',
  MUTED_TEXT: '#666666',
  WHITE: '#FFFFFF',
  GLOW_GREEN: '#00ff00',
  GLOW_CYAN: '#00ffff',
} as const;

export const GORBAGANA = {
  RPC: 'https://rpc.trashscan.io',
  EXPLORER: 'https://trashscan.io',
  CHAIN_ID: 'gorbagana-mainnet',
} as const;

// Gorbagana wallet address validation (Base58 format)
export const WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidGorbaganaWallet(address: string): boolean {
  return WALLET_REGEX.test(address.trim());
}
