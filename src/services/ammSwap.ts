/**
 * AMM Swap Service for Gorbagana DEX
 *
 * Handles on-chain pool discovery and swap transaction building for:
 * - CPAMM pools (SPL Token Swap style, 113+ pools) — direct token vaults
 * - DAMM pools (Meteora AMM style, 4 pools) — vault-based architecture
 */
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  NATIVE_MINT,
} from '@solana/spl-token';
import { createTransferInstruction } from '@solana/spl-token';
import ammIdl from '../idl/meteora_amm.json';

// Trashmarket platform fee: 0.5% of output tokens sent to treasury
const PLATFORM_FEE_BPS = 50; // 0.5%
const TREASURY_WALLET = new PublicKey('77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb');

// Gorbagana AMM Program IDs
export const CPAMM_PROGRAM_ID = new PublicKey('xYBN2zddsqSy41tg1yD9nJScCmqquZnHUyzXBfLEqC8');
export const DAMM_PROGRAM_ID = new PublicKey('cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG');

// Wrapped GOR (native token) - same as wrapped SOL address on SVM chains
export const WRAPPED_GOR_MINT = new PublicKey('So11111111111111111111111111111111111111112');

/**
 * Pool data decoded from on-chain.
 * Unified interface for both CPAMM and DAMM pools.
 */
export interface PoolInfo {
  address: PublicKey;
  programId: PublicKey;
  poolType: 'CPAMM' | 'DAMM';
  enabled: boolean;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  // CPAMM fields (SPL Token Swap)
  tokenAVault?: PublicKey;   // Direct token account for token A
  tokenBVault?: PublicKey;   // Direct token account for token B
  poolMint?: PublicKey;      // LP token mint
  feeAccount?: PublicKey;    // Fee collection account
  bumpSeed?: number;         // Pool authority bump
  tradeFeeNumerator?: number;
  tradeFeeDenominator?: number;
  // DAMM fields (Meteora AMM)
  aVault?: PublicKey;
  bVault?: PublicKey;
  aVaultLp?: PublicKey;
  bVaultLp?: PublicKey;
  protocolTokenAFee?: PublicKey;
  protocolTokenBFee?: PublicKey;
}

// Pool cache
let poolCache: PoolInfo[] = [];
let poolCacheTimestamp = 0;
const POOL_CACHE_TTL = 60_000; // 1 minute

// ─── CPAMM Pool Parsing (SPL Token Swap layout) ───

/**
 * Parse a CPAMM pool account (SPL Token Swap format, 324 bytes).
 *
 * Layout:
 *   0:   version (u8)
 *   1:   is_initialized (u8)
 *   2:   bump_seed (u8)
 *   3:   token_program (Pubkey)
 *   35:  token_a (Pubkey) — vault account holding token A
 *   67:  token_b (Pubkey) — vault account holding token B
 *   99:  pool_mint (Pubkey) — LP token mint
 *   131: token_a_mint (Pubkey)
 *   163: token_b_mint (Pubkey)
 *   195: fee_account (Pubkey)
 *   227: trade_fee_numerator (u64)
 *   235: trade_fee_denominator (u64)
 *   243: owner_trade_fee_numerator (u64)
 *   251: owner_trade_fee_denominator (u64)
 *   ... more fee fields + curve type + calculator
 */
function parseCpammPool(address: PublicKey, data: Buffer): PoolInfo | null {
  if (data.length < 292) return null;

  const initialized = data[1];
  if (!initialized) return null;

  const bumpSeed = data[2];
  const pk = (off: number) => new PublicKey(data.subarray(off, off + 32));

  const tokenAVault = pk(35);
  const tokenBVault = pk(67);
  const poolMint = pk(99);
  const tokenAMint = pk(131);
  const tokenBMint = pk(163);
  const feeAccount = pk(195);

  const tradeFeeNum = Number(data.readBigUInt64LE(227));
  const tradeFeeDen = Number(data.readBigUInt64LE(235));

  return {
    address,
    programId: CPAMM_PROGRAM_ID,
    poolType: 'CPAMM',
    enabled: true,
    tokenAMint,
    tokenBMint,
    tokenAVault,
    tokenBVault,
    poolMint,
    feeAccount,
    bumpSeed,
    tradeFeeNumerator: tradeFeeNum,
    tradeFeeDenominator: tradeFeeDen,
  };
}

/**
 * Fetch all CPAMM pools using getProgramAccounts (raw, no Anchor).
 */
async function fetchCpammPools(connection: Connection): Promise<PoolInfo[]> {
  try {
    const accounts = await connection.getProgramAccounts(CPAMM_PROGRAM_ID, {
      encoding: 'base64',
    });

    const pools: PoolInfo[] = [];
    for (const { pubkey, account } of accounts) {
      const pool = parseCpammPool(pubkey, account.data as Buffer);
      if (pool) pools.push(pool);
    }
    return pools;
  } catch (err) {
    console.warn('Failed to fetch CPAMM pools:', err);
    return [];
  }
}

// ─── DAMM Pool Parsing (Meteora AMM, Anchor) ───

/**
 * Fetch all DAMM pools using Anchor deserialization.
 */
async function fetchDammPools(connection: Connection): Promise<PoolInfo[]> {
  try {
    const provider = new AnchorProvider(
      connection,
      { publicKey: PublicKey.default, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
      { commitment: 'confirmed' }
    );
    const idlWithAddress = { ...ammIdl, address: DAMM_PROGRAM_ID.toBase58() };
    const program = new Program(idlWithAddress as any, provider);
    const accounts = await (program.account as any).pool.all();

    return accounts.map((acc: any) => ({
      address: acc.publicKey,
      programId: DAMM_PROGRAM_ID,
      poolType: 'DAMM' as const,
      enabled: acc.account.enabled,
      tokenAMint: acc.account.tokenAMint,
      tokenBMint: acc.account.tokenBMint,
      aVault: acc.account.aVault,
      bVault: acc.account.bVault,
      aVaultLp: acc.account.aVaultLp,
      bVaultLp: acc.account.bVaultLp,
      protocolTokenAFee: acc.account.protocolTokenAFee,
      protocolTokenBFee: acc.account.protocolTokenBFee,
    }));
  } catch (err) {
    console.warn('Failed to fetch DAMM pools:', err);
    return [];
  }
}

// ─── Pool Discovery ───

/**
 * Fetch all pools from both CPAMM and DAMM programs on Gorbagana.
 */
export async function fetchAllPools(connection: Connection): Promise<PoolInfo[]> {
  if (poolCache.length > 0 && Date.now() - poolCacheTimestamp < POOL_CACHE_TTL) {
    return poolCache;
  }

  const [cpammPools, dammPools] = await Promise.all([
    fetchCpammPools(connection),
    fetchDammPools(connection),
  ]);

  const pools = [...cpammPools, ...dammPools];

  if (pools.length > 0) {
    poolCache = pools;
    poolCacheTimestamp = Date.now();
  }

  return pools;
}

/**
 * Find a pool for a given token pair.
 */
export function findPool(pools: PoolInfo[], mintA: string, mintB: string): PoolInfo | null {
  const matches = pools.filter(
    (p) =>
      p.enabled &&
      ((p.tokenAMint.toBase58() === mintA && p.tokenBMint.toBase58() === mintB) ||
        (p.tokenAMint.toBase58() === mintB && p.tokenBMint.toBase58() === mintA))
  );

  // Prefer CPAMM (simpler swap, more pools)
  return matches.find((p) => p.poolType === 'CPAMM') || matches[0] || null;
}

/**
 * Find a route between two tokens. Direct first, then via GOR.
 */
export function findRoute(
  pools: PoolInfo[],
  inputMint: string,
  outputMint: string
): { pools: PoolInfo[]; hops: 'direct' | 'via-gor' } | null {
  const direct = findPool(pools, inputMint, outputMint);
  if (direct) return { pools: [direct], hops: 'direct' };

  const gorMint = WRAPPED_GOR_MINT.toBase58();
  if (inputMint === gorMint || outputMint === gorMint) return null;

  const pool1 = findPool(pools, inputMint, gorMint);
  const pool2 = findPool(pools, gorMint, outputMint);
  if (pool1 && pool2) return { pools: [pool1, pool2], hops: 'via-gor' };

  return null;
}

// ─── Swap Transaction Building ───

/**
 * Get or create an ATA, returning the address and an optional create instruction.
 */
async function getOrCreateATA(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey
): Promise<{ address: PublicKey; instruction: TransactionInstruction | null }> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  try {
    const account = await connection.getAccountInfo(ata);
    if (account) return { address: ata, instruction: null };
  } catch { /* doesn't exist */ }
  return {
    address: ata,
    instruction: createAssociatedTokenAccountInstruction(payer, ata, owner, mint),
  };
}

/**
 * Build SPL Token Swap v2 instruction for CPAMM pools.
 *
 * Gorbagana CPAMM uses a Token Swap v2 format with 14 accounts:
 *   Data: [1, amount_in (u64 LE), minimum_amount_out (u64 LE)]
 *   Accounts:
 *     0:  pool (swap state)
 *     1:  pool authority (PDA)
 *     2:  user transfer authority (signer)
 *     3:  user source token account
 *     4:  pool source vault
 *     5:  pool dest vault
 *     6:  user destination token account
 *     7:  pool LP mint
 *     8:  fee account
 *     9:  source token mint
 *     10: destination token mint
 *     11: source token program
 *     12: destination token program
 *     13: pool LP token program
 */
function buildCpammSwapInstruction(
  pool: PoolInfo,
  userSourceToken: PublicKey,
  userDestToken: PublicKey,
  userAuthority: PublicKey,
  inputMint: PublicKey,
  inputAmount: BN,
  minOutputAmount: BN,
): TransactionInstruction {
  // Derive pool authority PDA
  const [poolAuthority] = PublicKey.findProgramAddressSync(
    [pool.address.toBuffer()],
    pool.programId
  );

  // Determine direction: if inputMint == tokenAMint, swap A→B, else B→A
  const isAToB = inputMint.equals(pool.tokenAMint);
  const sourceVault = isAToB ? pool.tokenAVault! : pool.tokenBVault!;
  const destVault = isAToB ? pool.tokenBVault! : pool.tokenAVault!;
  const sourceMint = isAToB ? pool.tokenAMint : pool.tokenBMint;
  const destMint = isAToB ? pool.tokenBMint : pool.tokenAMint;

  // Build instruction data: [1 (swap), amount_in (u64 LE), min_out (u64 LE)]
  const data = Buffer.alloc(17);
  data[0] = 1; // Swap instruction index
  data.writeBigUInt64LE(BigInt(inputAmount.toString()), 1);
  data.writeBigUInt64LE(BigInt(minOutputAmount.toString()), 9);

  return new TransactionInstruction({
    programId: pool.programId,
    keys: [
      { pubkey: pool.address, isSigner: false, isWritable: false },
      { pubkey: poolAuthority, isSigner: false, isWritable: false },
      { pubkey: userAuthority, isSigner: true, isWritable: false },
      { pubkey: userSourceToken, isSigner: false, isWritable: true },
      { pubkey: sourceVault, isSigner: false, isWritable: true },
      { pubkey: destVault, isSigner: false, isWritable: true },
      { pubkey: userDestToken, isSigner: false, isWritable: true },
      { pubkey: pool.poolMint!, isSigner: false, isWritable: true },
      { pubkey: pool.feeAccount!, isSigner: false, isWritable: true },
      { pubkey: sourceMint, isSigner: false, isWritable: false },
      { pubkey: destMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Build a DAMM (Meteora AMM) swap instruction via Anchor.
 * Requires reading vault accounts to resolve tokenVault and lpMint.
 */
/** Parsed DAMM vault data — cached to avoid duplicate RPC calls */
interface DammVaultData {
  aTokenVault: PublicKey;
  bTokenVault: PublicKey;
  aVaultLpMint: PublicKey;
  bVaultLpMint: PublicKey;
  vaultProgramId: PublicKey;
}

/** Fetch and parse DAMM vault accounts (single RPC call for both vaults) */
async function fetchDammVaultData(connection: Connection, pool: PoolInfo): Promise<DammVaultData> {
  const [aVaultInfo, bVaultInfo] = await connection.getMultipleAccountsInfo([
    pool.aVault!, pool.bVault!,
  ]);
  if (!aVaultInfo || !bVaultInfo) {
    throw new Error('DAMM vault accounts not found');
  }
  return {
    aTokenVault: new PublicKey((aVaultInfo.data as Buffer).subarray(19, 51)),
    bTokenVault: new PublicKey((bVaultInfo.data as Buffer).subarray(19, 51)),
    aVaultLpMint: new PublicKey((aVaultInfo.data as Buffer).subarray(115, 147)),
    bVaultLpMint: new PublicKey((bVaultInfo.data as Buffer).subarray(115, 147)),
    vaultProgramId: aVaultInfo.owner,
  };
}

async function buildDammSwapInstruction(
  connection: Connection,
  pool: PoolInfo,
  userSourceToken: PublicKey,
  userDestToken: PublicKey,
  walletPublicKey: PublicKey,
  inputMint: PublicKey,
  inputAmount: BN,
  minOutputAmount: BN,
  vaultData?: DammVaultData,
): Promise<TransactionInstruction> {
  const { aTokenVault, bTokenVault, aVaultLpMint, bVaultLpMint, vaultProgramId } =
    vaultData || await fetchDammVaultData(connection, pool);

  const isAToB = inputMint.equals(pool.tokenAMint);
  const protocolTokenFee = isAToB ? pool.protocolTokenAFee! : pool.protocolTokenBFee!;

  const provider = new AnchorProvider(
    connection,
    { publicKey: walletPublicKey, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
    { commitment: 'confirmed' }
  );
  const idlWithAddress = { ...ammIdl, address: pool.programId.toBase58() };
  const program = new Program(idlWithAddress as any, provider);

  return await (program.methods as any)
    .swap(inputAmount, minOutputAmount)
    .accounts({
      pool: pool.address,
      userSourceToken,
      userDestinationToken: userDestToken,
      aVault: pool.aVault,
      bVault: pool.bVault,
      aTokenVault,
      bTokenVault,
      aVaultLpMint,
      bVaultLpMint,
      aVaultLp: pool.aVaultLp,
      bVaultLp: pool.bVaultLp,
      protocolTokenFee,
      user: walletPublicKey,
      vaultProgram: vaultProgramId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/**
 * Build a complete swap transaction for a single pool.
 * Combines estimation + instruction building in one pass to minimize RPC calls.
 */
export async function buildSwapTransaction(
  connection: Connection,
  walletPublicKey: PublicKey,
  pool: PoolInfo,
  inputMint: PublicKey,
  inputAmount: BN,
  slippageBps: number = 100,
): Promise<{ transaction: Transaction; estimatedOutput: BN; minOutput: BN }> {
  const isAToB = inputMint.equals(pool.tokenAMint);
  const sourceMint = isAToB ? pool.tokenAMint : pool.tokenBMint;
  const destMint = isAToB ? pool.tokenBMint : pool.tokenAMint;

  // Single parallel batch: ATAs + vault data (for DAMM) + vault balances (for estimate)
  const sourceATAAddr = getAssociatedTokenAddressSync(sourceMint, walletPublicKey, true);
  const destATAAddr = getAssociatedTokenAddressSync(destMint, walletPublicKey, true);
  const treasuryATAAddr = getAssociatedTokenAddressSync(destMint, TREASURY_WALLET, true);

  // Fetch all account info in one parallel batch
  const isDamm = pool.poolType === 'DAMM';
  const [sourceATAInfo, destATAInfo, treasuryATAInfo, vaultData, vaultBalances] = await Promise.all([
    connection.getAccountInfo(sourceATAAddr),
    connection.getAccountInfo(destATAAddr),
    connection.getAccountInfo(treasuryATAAddr),
    isDamm ? fetchDammVaultData(connection, pool) : Promise.resolve(null),
    // For CPAMM, fetch vault balances directly; for DAMM, we'll fetch after vault data
    pool.poolType === 'CPAMM' && pool.tokenAVault && pool.tokenBVault
      ? Promise.all([
          connection.getTokenAccountBalance(isAToB ? pool.tokenAVault : pool.tokenBVault),
          connection.getTokenAccountBalance(isAToB ? pool.tokenBVault : pool.tokenAVault),
        ])
      : Promise.resolve(null),
  ]);

  // Build ATA create instructions if needed
  const sourceATA = { address: sourceATAAddr, instruction: sourceATAInfo ? null : createAssociatedTokenAccountInstruction(walletPublicKey, sourceATAAddr, walletPublicKey, sourceMint) };
  const destATA = { address: destATAAddr, instruction: destATAInfo ? null : createAssociatedTokenAccountInstruction(walletPublicKey, destATAAddr, walletPublicKey, destMint) };
  const treasuryATA = { address: treasuryATAAddr, instruction: treasuryATAInfo ? null : createAssociatedTokenAccountInstruction(walletPublicKey, treasuryATAAddr, TREASURY_WALLET, destMint) };

  // Estimate output from vault balances
  let estimatedOutput = new BN(0);
  let sourceVaultBalances: { reserveIn: BN; reserveOut: BN } | null = null;

  if (vaultBalances) {
    // CPAMM — already have balances
    sourceVaultBalances = {
      reserveIn: new BN(vaultBalances[0].value.amount),
      reserveOut: new BN(vaultBalances[1].value.amount),
    };
  } else if (vaultData) {
    // DAMM — fetch token vault balances using the resolved vault addresses
    const sourceTokenVault = isAToB ? vaultData.aTokenVault : vaultData.bTokenVault;
    const destTokenVault = isAToB ? vaultData.bTokenVault : vaultData.aTokenVault;
    try {
      const [srcBal, dstBal] = await Promise.all([
        connection.getTokenAccountBalance(sourceTokenVault),
        connection.getTokenAccountBalance(destTokenVault),
      ]);
      sourceVaultBalances = {
        reserveIn: new BN(srcBal.value.amount),
        reserveOut: new BN(dstBal.value.amount),
      };
    } catch { /* estimation will fall back to 0 */ }
  }

  if (sourceVaultBalances && !sourceVaultBalances.reserveIn.isZero() && !sourceVaultBalances.reserveOut.isZero()) {
    const feeNum = pool.tradeFeeNumerator || 25;
    const feeDen = pool.tradeFeeDenominator || 10000;
    const inputAfterFee = inputAmount.mul(new BN(feeDen - feeNum)).div(new BN(feeDen));
    estimatedOutput = inputAfterFee.mul(sourceVaultBalances.reserveOut).div(sourceVaultBalances.reserveIn.add(inputAfterFee));
  }

  const minOutput = estimatedOutput.gt(new BN(0))
    ? estimatedOutput.mul(new BN(10000 - slippageBps)).div(new BN(10000))
    : new BN(0);

  // Build instruction arrays
  const preInstructions: TransactionInstruction[] = [];
  const postInstructions: TransactionInstruction[] = [];

  if (sourceATA.instruction) preInstructions.push(sourceATA.instruction);
  if (destATA.instruction) preInstructions.push(destATA.instruction);

  // Wrap native GOR if needed
  if (sourceMint.equals(NATIVE_MINT)) {
    preInstructions.push(
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: sourceATA.address,
        lamports: BigInt(inputAmount.toString()),
      }),
      createSyncNativeInstruction(sourceATA.address)
    );
  }

  // Build swap instruction (pass cached vault data to avoid re-fetching)
  let swapIx: TransactionInstruction;
  if (pool.poolType === 'CPAMM') {
    swapIx = buildCpammSwapInstruction(
      pool, sourceATA.address, destATA.address, walletPublicKey,
      inputMint, inputAmount, minOutput
    );
  } else {
    swapIx = await buildDammSwapInstruction(
      connection, pool, sourceATA.address, destATA.address,
      walletPublicKey, inputMint, inputAmount, minOutput, vaultData!
    );
  }

  // Platform fee: 0.5% of output to treasury
  if (treasuryATA.instruction) postInstructions.push(treasuryATA.instruction);
  if (minOutput.gt(new BN(0))) {
    const feeAmount = minOutput.mul(new BN(PLATFORM_FEE_BPS)).div(new BN(10000));
    if (feeAmount.gt(new BN(0))) {
      postInstructions.push(
        createTransferInstruction(
          destATA.address, treasuryATA.address, walletPublicKey,
          BigInt(feeAmount.toString())
        )
      );
    }
  }

  // Unwrap native GOR after swap + fee if needed
  if (destMint.equals(NATIVE_MINT)) {
    postInstructions.push(
      createCloseAccountInstruction(destATA.address, walletPublicKey, walletPublicKey)
    );
  }

  // Get blockhash LAST to maximize freshness
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: walletPublicKey, blockhash, lastValidBlockHeight });

  for (const ix of preInstructions) tx.add(ix);
  tx.add(swapIx);
  for (const ix of postInstructions) tx.add(ix);

  return { transaction: tx, estimatedOutput, minOutput };
}

// ─── Utilities ───

/**
 * Convert pools to the Market format used by the DEX UI.
 */
export function poolsToMarkets(pools: PoolInfo[]): any[] {
  return pools
    .filter((p) => p.enabled)
    .map((p) => ({
      marketId: p.address.toBase58(),
      type: p.poolType,
      programId: p.programId.toBase58(),
      baseToken: {
        mint: p.tokenAMint.toBase58(),
        symbol: '',
        amount: 0,
        priceUsd: 0,
      },
      quoteToken: {
        mint: p.tokenBMint.toBase58(),
        symbol: '',
        amount: 0,
        priceUsd: 0,
      },
      liquidityUsd: 0,
      liquidityDisplay: '',
    }));
}

/** Invalidate the pool cache. */
export function clearPoolCache(): void {
  poolCache = [];
  poolCacheTimestamp = 0;
}

/**
 * Estimate swap output amount using on-chain vault balances (constant product formula).
 * Returns the estimated output in lamports, accounting for pool trade fees.
 */
export async function estimateSwapOutput(
  connection: Connection,
  pool: PoolInfo,
  inputMint: PublicKey,
  inputAmountLamports: BN,
): Promise<BN> {
  const isAToB = inputMint.equals(pool.tokenAMint);

  let sourceVaultToken: PublicKey;
  let destVaultToken: PublicKey;

  if (pool.poolType === 'CPAMM' && pool.tokenAVault && pool.tokenBVault) {
    sourceVaultToken = isAToB ? pool.tokenAVault : pool.tokenBVault;
    destVaultToken = isAToB ? pool.tokenBVault : pool.tokenAVault;
  } else if (pool.poolType === 'DAMM' && pool.aVault && pool.bVault) {
    // DAMM vaults: read tokenVault addresses from vault account data (offset 19)
    const [aVaultInfo, bVaultInfo] = await connection.getMultipleAccountsInfo([
      pool.aVault, pool.bVault,
    ]);
    if (!aVaultInfo || !bVaultInfo) return new BN(0);
    const aTokenVault = new PublicKey((aVaultInfo.data as Buffer).subarray(19, 51));
    const bTokenVault = new PublicKey((bVaultInfo.data as Buffer).subarray(19, 51));
    sourceVaultToken = isAToB ? aTokenVault : bTokenVault;
    destVaultToken = isAToB ? bTokenVault : aTokenVault;
  } else {
    return new BN(0);
  }

  // Fetch vault balances
  const [sourceBalance, destBalance] = await Promise.all([
    connection.getTokenAccountBalance(sourceVaultToken),
    connection.getTokenAccountBalance(destVaultToken),
  ]);

  const reserveIn = new BN(sourceBalance.value.amount);
  const reserveOut = new BN(destBalance.value.amount);

  if (reserveIn.isZero() || reserveOut.isZero()) return new BN(0);

  // Apply trade fee (CPAMM has explicit fees; DAMM uses ~0.25% default)
  const feeNum = pool.tradeFeeNumerator || 25;
  const feeDen = pool.tradeFeeDenominator || 10000;
  const inputAfterFee = inputAmountLamports.mul(new BN(feeDen - feeNum)).div(new BN(feeDen));

  // Constant product: output = (inputAfterFee * reserveOut) / (reserveIn + inputAfterFee)
  const numerator = inputAfterFee.mul(reserveOut);
  const denominator = reserveIn.add(inputAfterFee);
  return numerator.div(denominator);
}
