// Decimal conversion utilities for Gorbagana token architecture
// Decimal conversion utilities for Gorbagana token architecture
// GOR can be native (6 decimals) or wrapped (9 decimals)

export const WRAPPED_GOR_DECIMALS = 9;
export const WRAPPED_GOR_DIVISOR = 1_000_000_000;
export const NATIVE_GOR_DECIMALS = 6;
export const NATIVE_GOR_DIVISOR = 1_000_000;

/** Convert human-readable amount to base units based on decimals */
export function humanToAmount(amount: number, decimals: number): bigint {
  const divisor = Math.pow(10, decimals);
  return BigInt(Math.round(amount * divisor));
}

/** Convert base units back to human-readable amount based on decimals */
export function amountToHuman(amount: bigint, decimals: number): number {
  const divisor = Math.pow(10, decimals);
  return Number(amount) / divisor;
}

/** Legacy: Convert human-readable amount to Wrapped GOR base units (9 decimals) */
export function humanToTradingAmount(amount: number): bigint {
  return humanToAmount(amount, WRAPPED_GOR_DECIMALS);
}

/** Legacy: Convert Wrapped GOR base units back to human-readable amount */
export function tradingAmountToHuman(amount: bigint): number {
  return amountToHuman(amount, WRAPPED_GOR_DECIMALS);
}

/** Convert human-readable amount to Native GOR base units (6 decimals) */
export function humanToGasAmount(amount: number): bigint {
  return humanToAmount(amount, NATIVE_GOR_DECIMALS);
}

/** Format a trading amount for display with specified decimal places */
export function formatTradingAmount(amount: bigint, decimals: number = 2): string {
  return tradingAmountToHuman(amount).toFixed(decimals);
}
