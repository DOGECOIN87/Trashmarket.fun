// Trading fee configuration for Gorid marketplace
// All prices are in Wrapped GOR (9 decimals)

export const TRADING_CONFIG = {
  // Token addresses (Gorbagana chain)
  WRAPPED_GOR_MINT: 'So1111111111111111111111111111111111111112',
  NATIVE_GOR_MINT: 'So1111111111111111111111111111111111111111',

  // Platform fee recipient wallet
  FEE_RECIPIENT: 'TraSHxRcoUvwMTBR3U7EMnNFjbqAi4sBT5YBCpz2dnkR', // TrashMarket platform wallet

  // Fee structure (basis points: 100 = 1%)
  PLATFORM_FEE_BPS: 250,    // 2.5%
  CREATOR_ROYALTY_BPS: 500,  // 5% (optional, per-domain)

  // Minimum fee in base units (9 decimals)
  MINIMUM_FEE: 1_000_000n,  // 0.001 Wrapped GOR

  // Transaction limits (human-readable)
  MIN_PRICE: 0.001,         // Minimum listing price in GOR
  MAX_PRICE: 1_000_000,     // Maximum listing price in GOR
} as const;

export interface TradeFees {
  platformFee: bigint;
  creatorRoyalty: bigint;
  sellerReceives: bigint;
  total: bigint;
}

/** Calculate fee breakdown for a sale price (in base units) */
export function calculateFees(salePrice: bigint): TradeFees {
  const platformFee = (salePrice * BigInt(TRADING_CONFIG.PLATFORM_FEE_BPS)) / 10000n;
  const creatorRoyalty = (salePrice * BigInt(TRADING_CONFIG.CREATOR_ROYALTY_BPS)) / 10000n;

  // Enforce minimum platform fee
  const finalPlatformFee = platformFee < TRADING_CONFIG.MINIMUM_FEE
    ? TRADING_CONFIG.MINIMUM_FEE
    : platformFee;

  return {
    platformFee: finalPlatformFee,
    creatorRoyalty,
    sellerReceives: salePrice - finalPlatformFee - creatorRoyalty,
    total: salePrice,
  };
}

/** Calculate fees from a human-readable price */
export function calculateFeesFromHuman(priceHuman: number): {
  platformFee: number;
  creatorRoyalty: number;
  sellerReceives: number;
  total: number;
} {
  const total = priceHuman;
  const platformFee = Math.max(total * TRADING_CONFIG.PLATFORM_FEE_BPS / 10000, 0.001);
  const creatorRoyalty = total * TRADING_CONFIG.CREATOR_ROYALTY_BPS / 10000;
  const sellerReceives = total - platformFee - creatorRoyalty;

  return { platformFee, creatorRoyalty, sellerReceives, total };
}
