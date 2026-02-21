// Decimal conversion utilities for Gorbagana token architecture
// CRITICAL: Wrapped GOR (9 decimals) is used for ALL trading
// Native GOR (6 decimals) is only for gas fees

export const WRAPPED_GOR_DECIMALS = 9;
export const WRAPPED_GOR_DIVISOR = 1_000_000_000;
export const NATIVE_GOR_DECIMALS = 6;
export const NATIVE_GOR_DIVISOR = 1_000_000;

/** Convert human-readable amount to Wrapped GOR base units (9 decimals) - for trading */
export function humanToTradingAmount(amount: number): bigint {
  return BigInt(Math.round(amount * WRAPPED_GOR_DIVISOR));
}

/** Convert Wrapped GOR base units back to human-readable amount */
export function tradingAmountToHuman(amount: bigint): number {
  return Number(amount) / WRAPPED_GOR_DIVISOR;
}

/** Convert human-readable amount to Native GOR base units (6 decimals) - for gas only */
export function humanToGasAmount(amount: number): bigint {
  return BigInt(Math.round(amount * NATIVE_GOR_DIVISOR));
}

/** Format a trading amount for display with specified decimal places */
export function formatTradingAmount(amount: bigint, decimals: number = 2): string {
  return tradingAmountToHuman(amount).toFixed(decimals);
}
