import { Connection } from '@solana/web3.js';

/**
 * Poll transaction signature status until confirmed or timeout.
 * More reliable than blockhash-based confirmTransaction on Gorbagana's RPC,
 * which can be slow enough for the block height to expire before confirmation returns.
 */
export async function confirmTransaction(
  connection: Connection,
  signature: string,
  timeoutMs = 60000,
  intervalMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value?.[0];
    if (status) {
      if (status.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      }
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        return;
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Transaction confirmation timed out — check explorer to verify (sig: ${signature})`);
}
