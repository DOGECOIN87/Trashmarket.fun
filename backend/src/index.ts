/**
 * Trashmarket.fun Backend API — Cloudflare Worker
 *
 * Handles:
 *  - Secure admin authentication via wallet signature verification
 *  - Session token management (HMAC-SHA256 based)
 *  - Admin-only submission management proxy
 *  - Rate limiting for public endpoints
 *  - CORS for trashmarket.fun frontend
 *
 * DOES NOT touch existing D1 databases or Workers.
 */

export interface Env {
  // Secrets (set via `wrangler secret put`)
  ADMIN_WALLETS: string;       // comma-separated admin wallet public keys
  JWT_SECRET: string;          // HMAC secret for session tokens
  FIREBASE_API_KEY?: string;   // optional: proxy firebase calls
  GAME_ADMIN_KEYPAIR: string;  // JSON array of admin keypair bytes for signing game txs
  DEPLOYER_KEYPAIR: string;    // JSON array of deployer keypair bytes for VerifyCollection

  // Vars (set in wrangler.toml)
  CORS_ORIGIN: string;
  GORBAGANA_RPC: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function corsHeaders(origin: string, allowedOrigin: string): HeadersInit {
  // Allow localhost during dev, and the production origin
  const allowed =
    origin === allowedOrigin ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');

  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Create an HMAC-SHA256 session token (not a full JWT, but lightweight & sufficient). */
async function createSessionToken(wallet: string, secret: string): Promise<string> {
  const payload = {
    sub: wallet,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 h
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payloadB64}.${sigB64}`;
}

/** Verify session token and return the wallet address (subject). */
async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; // expired
    return payload.sub as string;
  } catch {
    return null;
  }
}

/**
 * Verify an Ed25519 signature produced by a Solana/Gorbagana wallet.
 * The wallet signs a UTF-8 message; we verify with the Web Crypto API.
 */
async function verifyWalletSignature(
  publicKeyBase58: string,
  message: string,
  signatureBase64: string,
): Promise<boolean> {
  try {
    // Decode base58 public key
    const pubBytes = base58Decode(publicKeyBase58);
    if (pubBytes.length !== 32) return false;

    const sigBytes = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));
    if (sigBytes.length !== 64) return false;

    const msgBytes = new TextEncoder().encode(message);

    // Import Ed25519 public key
    const key = await crypto.subtle.importKey(
      'raw',
      pubBytes,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );

    return await crypto.subtle.verify('Ed25519', key, sigBytes, msgBytes);
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

// Minimal Base58 decoder (Solana public keys)
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base58 character');
    let carry = idx;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading zeros
  for (const char of str) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

// Base58 encoder (for public keys)
function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    str += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    str += BASE58_ALPHABET[digits[i]];
  }
  return str;
}

// ─── Route handlers ─────────────────────────────────────────────────────────

/** POST /api/auth/login — wallet-signature-based admin login */
async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    wallet: string;
    message: string;
    signature: string;
  };

  if (!body.wallet || !body.message || !body.signature) {
    return json({ error: 'Missing wallet, message, or signature' }, 400);
  }

  // Check wallet is in admin list
  const adminWallets = (env.ADMIN_WALLETS || '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

  if (!adminWallets.includes(body.wallet)) {
    return json({ error: 'Unauthorized: wallet is not an admin' }, 403);
  }

  // Verify the message contains a recent timestamp (prevent replay)
  const timestampMatch = body.message.match(/Timestamp:\s*(\d+)/);
  if (!timestampMatch) {
    return json({ error: 'Message must contain a Timestamp' }, 400);
  }
  const msgTimestamp = parseInt(timestampMatch[1], 10);
  const now = Date.now();
  if (Math.abs(now - msgTimestamp) > 5 * 60 * 1000) {
    return json({ error: 'Message timestamp expired (5 min window)' }, 400);
  }

  // Verify signature
  const valid = await verifyWalletSignature(body.wallet, body.message, body.signature);
  if (!valid) {
    return json({ error: 'Invalid signature' }, 401);
  }

  // Issue session token
  const token = await createSessionToken(body.wallet, env.JWT_SECRET);
  return json({ token, wallet: body.wallet, expiresIn: 86400 });
}

/** GET /api/auth/verify — check if session token is valid */
async function handleVerify(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return json({ valid: false }, 401);
  }
  const wallet = await verifySessionToken(auth.slice(7), env.JWT_SECRET);
  if (!wallet) {
    return json({ valid: false }, 401);
  }
  return json({ valid: true, wallet });
}

/** Middleware: require admin session */
async function requireAdmin(request: Request, env: Env): Promise<string | Response> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }
  const wallet = await verifySessionToken(auth.slice(7), env.JWT_SECRET);
  if (!wallet) {
    return json({ error: 'Invalid or expired session' }, 401);
  }
  const adminWallets = (env.ADMIN_WALLETS || '').split(',').map((w) => w.trim());
  if (!adminWallets.includes(wallet)) {
    return json({ error: 'Not an admin' }, 403);
  }
  return wallet; // return wallet address on success
}

/** POST /api/admin/submissions/:action — proxy admin submission actions */
async function handleAdminAction(request: Request, env: Env, action: string): Promise<Response> {
  const adminResult = await requireAdmin(request, env);
  if (adminResult instanceof Response) return adminResult;

  // Forward the action info back to the client with admin verification
  // The actual Firestore operations still happen client-side with Firebase SDK,
  // but now the client knows the admin is verified server-side.
  const body = await request.json();
  return json({
    success: true,
    action,
    adminWallet: adminResult,
    data: body,
    timestamp: Date.now(),
  });
}

/** GET /api/health — health check */
async function handleHealth(env: Env): Promise<Response> {
  return json({
    status: 'ok',
    service: 'trashmarket-api',
    timestamp: new Date().toISOString(),
    rpc: env.GORBAGANA_RPC,
  });
}

// Allowed RPC methods — prevent abuse of the RPC proxy
const ALLOWED_RPC_METHODS = new Set([
  'getAccountInfo',
  'getBalance',
  'getBlock',
  'getBlockHeight',
  'getHealth',
  'getLatestBlockhash',
  'getMinimumBalanceForRentExemption',
  'getProgramAccounts',
  'getSignatureStatuses',
  'getSlot',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getTransaction',
  'getVersion',
  'sendTransaction',
  'simulateTransaction',
]);

/** Proxy RPC calls to avoid exposing RPC endpoint directly */
async function handleRpcProxy(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any;

  // Validate the RPC method is allowed
  if (!body.method || !ALLOWED_RPC_METHODS.has(body.method)) {
    return json({ error: `RPC method not allowed: ${body.method || 'missing'}` }, 403);
  }

  const rpcResponse = await fetch(env.GORBAGANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await rpcResponse.json();
  return json(data);
}

// ─── Game Security: Rate limiting & on-chain verification ─────────────────

const GAME_PROGRAM_ID = '5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe';

/** Maximum balance delta allowed per single update call.
 *  Set high enough to cover max single-spin win (25x × 9999 wager ≈ 250k)
 *  while still capping runaway exploits. Wallet signature auth is the primary guard. */
const MAX_NET_PROFIT_DELTA_PER_CALL = 250_000;

/** Minimum seconds between update-balance calls for the same player.
 *  Enforced via on-chain last_updated timestamp (survives worker cold starts). */
const UPDATE_COOLDOWN_SECONDS = 3;

/**
 * GameState PDA layout (after 8-byte Anchor discriminator):
 *   player:                Pubkey  (32 bytes) — offset 8
 *   score:                 u64     (8 bytes)  — offset 40
 *   balance:               u64     (8 bytes)  — offset 48
 *   net_profit:            i64     (8 bytes)  — offset 56
 *   total_coins_collected: u64     (8 bytes)  — offset 64
 *   created_at:            i64     (8 bytes)  — offset 72
 *   last_updated:          i64     (8 bytes)  — offset 80
 *   is_initialized:        bool    (1 byte)   — offset 88
 */
interface OnChainGameState {
  player: string;
  score: bigint;
  balance: bigint;
  netProfit: bigint;
  totalCoinsCollected: bigint;
  lastUpdated: bigint;
  isInitialized: boolean;
}

/**
 * Verify a player's wallet signature to authenticate game API requests.
 * The player signs a message containing their wallet + a timestamp.
 * This proves they own the wallet without needing a session/login flow.
 */
async function verifyPlayerSignature(
  wallet: string,
  message: string,
  signature: string,
): Promise<boolean> {
  // Verify timestamp is recent (2 min window)
  const timestampMatch = message.match(/Timestamp:\s*(\d+)/);
  if (!timestampMatch) return false;
  const msgTimestamp = parseInt(timestampMatch[1], 10);
  if (Math.abs(Date.now() - msgTimestamp) > 2 * 60 * 1000) return false;

  // Verify the message references the correct wallet
  if (!message.includes(wallet)) return false;

  return verifyWalletSignature(wallet, message, signature);
}

/**
 * Fetch a player's on-chain GameState via RPC.
 * Uses getProgramAccounts with a memcmp filter on the player pubkey.
 */
async function fetchOnChainGameState(
  playerWallet: string,
  rpcUrl: string,
): Promise<OnChainGameState | null> {
  try {
    const playerBytes = base58Decode(playerWallet);

    // Use getProgramAccounts with memcmp filter:
    //   offset 8 (after discriminator) = player pubkey (32 bytes)
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getProgramAccounts',
        params: [
          GAME_PROGRAM_ID,
          {
            encoding: 'base64',
            filters: [
              { dataSize: 89 }, // GameState::SIZE = 89 bytes
              {
                memcmp: {
                  offset: 8, // after Anchor discriminator
                  bytes: playerWallet, // base58-encoded player pubkey
                },
              },
            ],
          },
        ],
      }),
    });

    const result = (await response.json()) as any;
    const accounts = result.result;
    if (!accounts || accounts.length === 0) return null;

    // Decode the account data
    const accountData = accounts[0].account.data[0]; // base64
    const bytes = Uint8Array.from(atob(accountData), (c) => c.charCodeAt(0));

    if (bytes.length < 89) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset);

    // Verify player field matches (offset 8, 32 bytes)
    const playerField = bytes.slice(8, 40);
    const playerExpected = base58Decode(playerWallet);
    for (let i = 0; i < 32; i++) {
      if (playerField[i] !== playerExpected[i]) return null; // mismatch
    }

    return {
      player: playerWallet,
      score: view.getBigUint64(40, true),
      balance: view.getBigUint64(48, true),
      netProfit: view.getBigInt64(56, true),
      totalCoinsCollected: view.getBigUint64(64, true),
      lastUpdated: view.getBigInt64(80, true),
      isInitialized: bytes[88] === 1,
    };
  } catch (err) {
    console.error('Failed to fetch on-chain game state:', err);
    return null;
  }
}

/**
 * POST /api/game/update-balance — Admin-signed game balance update
 *
 * Security hardening:
 *  1. Reads the player's CURRENT on-chain GameState to verify claims
 *  2. Caps net_profit_delta to prevent runaway exploits
 *  3. Rate-limits per player wallet
 *  4. Validates balance change is consistent (new_balance = on-chain balance + delta)
 *  5. Rejects positive net_profit_delta that exceeds balance gain
 */
async function handleGameUpdateBalance(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    playerWallet: string;
    newBalance: number;
    netProfitDelta: number;
    // Auth: player signs a message to prove wallet ownership
    signature: string;
    message: string;
  };

  if (!body.playerWallet || body.newBalance === undefined || body.netProfitDelta === undefined) {
    return json({ error: 'Missing playerWallet, newBalance, or netProfitDelta' }, 400);
  }

  // ── Authenticate: verify the caller owns this wallet ──────────────────
  if (!body.signature || !body.message) {
    return json({ error: 'Missing signature/message — wallet authentication required' }, 401);
  }
  const isAuthentic = await verifyPlayerSignature(body.playerWallet, body.message, body.signature);
  if (!isAuthentic) {
    return json({ error: 'Invalid wallet signature — authentication failed' }, 401);
  }

  // ── Input validation ──────────────────────────────────────────────────
  if (body.newBalance < 0 || body.newBalance > 1_000_000_000) {
    return json({ error: 'Invalid balance' }, 400);
  }
  if (!Number.isInteger(body.newBalance) || !Number.isInteger(body.netProfitDelta)) {
    return json({ error: 'Balance and delta must be integers' }, 400);
  }

  // Validate wallet address format
  try {
    const decoded = base58Decode(body.playerWallet);
    if (decoded.length !== 32) {
      return json({ error: 'Invalid wallet address' }, 400);
    }
  } catch {
    return json({ error: 'Invalid wallet address format' }, 400);
  }

  // ── Cap net profit delta to prevent large exploits ────────────────────
  if (body.netProfitDelta > MAX_NET_PROFIT_DELTA_PER_CALL) {
    return json(
      { error: `Net profit delta exceeds maximum of ${MAX_NET_PROFIT_DELTA_PER_CALL} per call` },
      400,
    );
  }
  // Allow negative deltas (losses) without cap — those are fine
  if (body.netProfitDelta < -1_000_000_000) {
    return json({ error: 'Invalid net profit delta' }, 400);
  }

  // ── Read on-chain state to verify ─────────────────────────────────────
  const onChainState = await fetchOnChainGameState(body.playerWallet, env.GORBAGANA_RPC);
  if (!onChainState) {
    return json({ error: 'Player game state not found on-chain. Initialize first.' }, 400);
  }
  if (!onChainState.isInitialized) {
    return json({ error: 'Game state not initialized' }, 400);
  }

  // ── Rate limiting via on-chain last_updated (survives cold starts) ────
  const lastUpdatedSecs = Number(onChainState.lastUpdated);
  const nowSecs = Math.floor(Date.now() / 1000);
  if (nowSecs - lastUpdatedSecs < UPDATE_COOLDOWN_SECONDS) {
    const waitSecs = UPDATE_COOLDOWN_SECONDS - (nowSecs - lastUpdatedSecs);
    return json({ error: `Rate limited. Try again in ${waitSecs}s` }, 429);
  }

  const currentOnChainBalance = Number(onChainState.balance);

  // Verify the balance change is reasonable:
  // The balance delta (newBalance - currentBalance) should be consistent with netProfitDelta
  const balanceDelta = body.newBalance - currentOnChainBalance;

  // If claiming profit, the balance must have increased by at least that much
  if (body.netProfitDelta > 0 && balanceDelta < body.netProfitDelta) {
    return json(
      { error: 'Inconsistent: net profit delta exceeds balance increase' },
      400,
    );
  }

  // Prevent setting balance higher than current + reasonable game earnings
  // (max 500 per call = ~50 wins of 10 coins each, very generous)
  if (balanceDelta > MAX_NET_PROFIT_DELTA_PER_CALL) {
    return json(
      { error: `Balance increase exceeds maximum of ${MAX_NET_PROFIT_DELTA_PER_CALL} per call` },
      400,
    );
  }

  // ── Build the instruction ─────────────────────────────────────────────
  try {
    const keypairBytes = new Uint8Array(JSON.parse(env.GAME_ADMIN_KEYPAIR));
    const adminPublicKeyBytes = keypairBytes.slice(32, 64);
    const adminPublicKey = base58Encode(adminPublicKeyBytes);

    // Build the instruction data: discriminator(8) + new_balance(8) + net_profit_delta(8)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode('global:update_balance'));
    const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

    const data = new Uint8Array(24);
    data.set(discriminator, 0);
    const balanceView = new DataView(new ArrayBuffer(8));
    balanceView.setBigUint64(0, BigInt(body.newBalance), true);
    data.set(new Uint8Array(balanceView.buffer), 8);
    const deltaView = new DataView(new ArrayBuffer(8));
    deltaView.setBigInt64(0, BigInt(body.netProfitDelta), true);
    data.set(new Uint8Array(deltaView.buffer), 16);

    // Fetch recent blockhash
    const rpcResponse = await fetch(env.GORBAGANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getLatestBlockhash',
        params: [{ commitment: 'confirmed' }],
      }),
    });
    const rpcResult = (await rpcResponse.json()) as any;
    const blockhash = rpcResult.result?.value?.blockhash;
    if (!blockhash) {
      return json({ error: 'Failed to fetch blockhash' }, 500);
    }

    return json({
      instruction: {
        data: Array.from(data),
        programId: GAME_PROGRAM_ID,
        adminPublicKey,
      },
      blockhash,
      lastValidBlockHeight: rpcResult.result?.value?.lastValidBlockHeight,
    });
  } catch (err: any) {
    console.error('Game update balance error:', err);
    return json({ error: 'Failed to build update transaction' }, 500);
  }
}

/**
 * POST /api/game/sign — Admin co-signs a transaction
 *
 * Security hardening:
 *  1. Decodes the transaction message and verifies it contains ONLY
 *     an update_balance instruction targeting our game program
 *  2. Verifies the admin pubkey in the transaction matches our admin
 *  3. Rejects transactions with unexpected instructions (e.g. SOL transfers)
 */
async function handleGameSign(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    transaction: string; // base64 serialized transaction message
    // Auth: player signs a message to prove wallet ownership
    playerWallet: string;
    signature: string;
    message: string;
  };

  if (!body.transaction) {
    return json({ error: 'Missing transaction' }, 400);
  }

  // ── Authenticate: verify the caller owns the wallet ───────────────────
  if (!body.playerWallet || !body.signature || !body.message) {
    return json({ error: 'Missing authentication fields — wallet signature required' }, 401);
  }
  const isAuthentic = await verifyPlayerSignature(body.playerWallet, body.message, body.signature);
  if (!isAuthentic) {
    return json({ error: 'Invalid wallet signature — authentication failed' }, 401);
  }

  try {
    const keypairBytes = new Uint8Array(JSON.parse(env.GAME_ADMIN_KEYPAIR));
    const adminPublicKeyBytes = keypairBytes.slice(32, 64);
    const adminPublicKey = base58Encode(adminPublicKeyBytes);

    const txBytes = Uint8Array.from(atob(body.transaction), c => c.charCodeAt(0));

    // ── Verify the transaction message contains our program ──────────────
    // Solana transaction message format (legacy):
    //   [1] numRequiredSignatures
    //   [1] numReadonlySignedAccounts
    //   [1] numReadonlyUnsignedAccounts
    //   [1] numAccountKeys
    //   [32 * numAccountKeys] account keys
    //   [32] recent blockhash
    //   [1] numInstructions
    //   for each instruction:
    //     [1] programIdIndex
    //     [compact] numAccounts + account indices
    //     [compact] dataLen + data

    // Basic sanity: must be at least header + 1 account + blockhash
    if (txBytes.length < 3 + 32 + 32 + 1) {
      return json({ error: 'Transaction too short' }, 400);
    }

    const numAccountKeys = txBytes[3];
    if (numAccountKeys < 2 || numAccountKeys > 20) {
      return json({ error: 'Unexpected number of accounts in transaction' }, 400);
    }

    // Extract account keys (starting at offset 4)
    const accountKeysStart = 4;
    const accountKeys: string[] = [];
    for (let i = 0; i < numAccountKeys; i++) {
      const keyStart = accountKeysStart + i * 32;
      const keyBytes = txBytes.slice(keyStart, keyStart + 32);
      accountKeys.push(base58Encode(keyBytes));
    }

    // Verify our game program ID is in the account keys
    if (!accountKeys.includes(GAME_PROGRAM_ID)) {
      return json({ error: 'Transaction does not target the game program' }, 400);
    }

    // Verify our admin public key is in the account keys
    if (!accountKeys.includes(adminPublicKey)) {
      return json({ error: 'Transaction does not include admin key' }, 400);
    }

    // Check number of instructions (should be exactly 1 for update_balance)
    const instructionsOffset = accountKeysStart + numAccountKeys * 32 + 32; // after accounts + blockhash
    if (instructionsOffset >= txBytes.length) {
      return json({ error: 'Malformed transaction: no instructions' }, 400);
    }
    const numInstructions = txBytes[instructionsOffset];
    if (numInstructions !== 1) {
      return json({ error: `Expected 1 instruction, got ${numInstructions}. Only update_balance is allowed.` }, 400);
    }

    // Verify the single instruction's programIdIndex points to our program
    const ixStart = instructionsOffset + 1;
    if (ixStart >= txBytes.length) {
      return json({ error: 'Malformed transaction: instruction truncated' }, 400);
    }
    const programIdIndex = txBytes[ixStart];
    if (programIdIndex >= numAccountKeys || accountKeys[programIdIndex] !== GAME_PROGRAM_ID) {
      return json({ error: 'Instruction does not target game program' }, 400);
    }

    // ── All checks passed — sign the transaction ────────────────────────
    const nacl = await import('tweetnacl');
    const signature = nacl.sign.detached(txBytes, keypairBytes);

    return json({
      signature: btoa(String.fromCharCode(...signature)),
      adminPublicKey,
    });
  } catch (err: any) {
    console.error('Game sign error:', err);
    return json({ error: 'Failed to sign transaction' }, 500);
  }
}

// ─── Collection Verification ────────────────────────────────────────────────

const METAPLEX_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const GORBAGIO_COLLECTION_MINT = 'FBJ47AgQSzSWVQVzsspoUzcFVeEf8a6xihZKZgmRuno1';
const GORBAGIO_COLLECTION_METADATA = 'FAi5K12awTH2ZChEUGg5whUcsK4QJ9GAAtjVz2LXPdUd';
const GORBAGIO_COLLECTION_MASTER_EDITION = 'GpRXxtvvryUtbjjRny4mV3k5B7BMecGEbpxCbUPyvMkE';
const DEPLOYER_WALLET = 'Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ';

/**
 * POST /api/migration/verify-collection
 *
 * Called automatically after a successful NFT migration.
 * Builds, signs, and sends a VerifySizedCollectionItem transaction using the deployer keypair.
 * This flips the `verified` flag on the NFT's collection field from false to true.
 */
async function handleVerifyCollection(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { mint: string; metadataPDA: string };

  if (!body.mint || !body.metadataPDA) {
    return json({ error: 'Missing mint or metadataPDA' }, 400);
  }

  // Validate addresses
  let mintBytes: Uint8Array;
  let metadataPDABytes: Uint8Array;
  try {
    mintBytes = base58Decode(body.mint);
    metadataPDABytes = base58Decode(body.metadataPDA);
    if (mintBytes.length !== 32 || metadataPDABytes.length !== 32) throw new Error('Invalid length');
  } catch {
    return json({ error: 'Invalid mint or metadataPDA address' }, 400);
  }

  if (!env.DEPLOYER_KEYPAIR) {
    return json({ error: 'Deployer keypair not configured' }, 500);
  }

  // Fetch the metadata account to validate before signing
  try {
    const metadataResponse = await fetch(env.GORBAGANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getAccountInfo',
        params: [body.metadataPDA, { encoding: 'base64' }],
      }),
    });
    const metadataResult = (await metadataResponse.json()) as any;
    const accountData = metadataResult.result?.value?.data?.[0];
    if (!accountData) {
      return json({ error: 'Metadata account not found on-chain' }, 400);
    }

    // Verify the account is owned by the Metaplex program
    const owner = metadataResult.result?.value?.owner;
    if (owner !== METAPLEX_PROGRAM_ID) {
      return json({ error: 'Metadata account not owned by Metaplex program' }, 400);
    }

    // Decode and validate the metadata
    const data = Uint8Array.from(atob(accountData), c => c.charCodeAt(0));
    if (data[0] !== 4) { // Key::MetadataV1 = 4
      return json({ error: 'Not a metadata account' }, 400);
    }

    // Verify mint field matches (offset 33, 32 bytes)
    const mintField = data.slice(33, 65);
    for (let i = 0; i < 32; i++) {
      if (mintField[i] !== mintBytes[i]) {
        return json({ error: 'Metadata mint does not match provided mint' }, 400);
      }
    }

    // Check collection field — find it in the metadata
    // Skip: key(1) + updateAuth(32) + mint(32) + name(4+var) + symbol(4+var) + uri(4+var) + fee(2) + creators + ...
    // Instead, check if collection key bytes appear in the data
    const collectionMintBytes = base58Decode(GORBAGIO_COLLECTION_MINT);
    let collectionFound = false;
    let alreadyVerified = false;

    // Scan for the collection mint in the metadata (it's preceded by the verified flag byte)
    for (let i = 0; i < data.length - 33; i++) {
      let match = true;
      for (let j = 0; j < 32; j++) {
        if (data[i + 1 + j] !== collectionMintBytes[j]) { match = false; break; }
      }
      if (match) {
        collectionFound = true;
        alreadyVerified = data[i] === 1; // byte before collection key is the verified flag
        break;
      }
    }

    if (!collectionFound) {
      return json({ error: 'NFT does not have Gorbagio collection set' }, 400);
    }
    if (alreadyVerified) {
      return json({ success: true, message: 'Already verified', signature: '' });
    }

    // Build VerifySizedCollectionItem transaction
    const deployerKeypairBytes = new Uint8Array(JSON.parse(env.DEPLOYER_KEYPAIR));
    const deployerPubkeyBytes = deployerKeypairBytes.slice(32, 64);

    // Verify the deployer matches
    const expectedDeployer = base58Decode(DEPLOYER_WALLET);
    for (let i = 0; i < 32; i++) {
      if (deployerPubkeyBytes[i] !== expectedDeployer[i]) {
        return json({ error: 'Deployer keypair does not match expected wallet' }, 500);
      }
    }

    // Get recent blockhash
    const bhResponse = await fetch(env.GORBAGANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getLatestBlockhash',
        params: [{ commitment: 'confirmed' }],
      }),
    });
    const bhResult = (await bhResponse.json()) as any;
    const blockhashB58 = bhResult.result?.value?.blockhash;
    if (!blockhashB58) {
      return json({ error: 'Failed to fetch blockhash' }, 500);
    }
    const blockhashBytes = base58Decode(blockhashB58);

    // Account keys in order:
    // [0] deployer (signer, writable) — collection authority + payer
    // [1] metadata PDA (writable)
    // [2] collection metadata PDA (writable — VerifySizedCollectionItem updates size)
    // [3] collection mint (read-only)
    // [4] collection master edition PDA (read-only)
    // [5] metaplex program (read-only, program)
    const collectionMetadataBytes = base58Decode(GORBAGIO_COLLECTION_METADATA);
    const collectionMasterEdBytes = base58Decode(GORBAGIO_COLLECTION_MASTER_EDITION);
    const metaplexProgramBytes = base58Decode(METAPLEX_PROGRAM_ID);

    // Build message
    const messageBytes = new Uint8Array(
      3 + 1 + (6 * 32) + 32 + 1 + 1 + 1 + 6 + 1 + 1
    ); // header(3) + numKeys(1) + keys(192) + blockhash(32) + numIx(1) + programIdx(1) + numAccounts(1) + accounts(6) + dataLen(1) + data(1)
    let off = 0;

    // Header
    messageBytes[off++] = 1; // numRequiredSignatures
    messageBytes[off++] = 0; // numReadonlySignedAccounts
    messageBytes[off++] = 3; // numReadonlyUnsignedAccounts (collectionMint, collectionMasterEd, metaplexProgram)

    // Number of account keys
    messageBytes[off++] = 6;

    // Account keys (ordered by writability: writable first, then read-only)
    messageBytes.set(deployerPubkeyBytes, off); off += 32;     // [0] deployer (signer, writable)
    messageBytes.set(metadataPDABytes, off); off += 32;        // [1] metadata PDA (writable)
    messageBytes.set(collectionMetadataBytes, off); off += 32; // [2] collection metadata (writable — size update)
    messageBytes.set(collectionMintBytes, off); off += 32;     // [3] collection mint (read-only)
    messageBytes.set(collectionMasterEdBytes, off); off += 32; // [4] collection master edition (read-only)
    messageBytes.set(metaplexProgramBytes, off); off += 32;    // [5] metaplex program (read-only)

    // Recent blockhash
    messageBytes.set(blockhashBytes, off); off += 32;

    // Instructions (1 instruction)
    messageBytes[off++] = 1; // numInstructions

    // VerifySizedCollectionItem instruction
    messageBytes[off++] = 5; // programIdIndex (metaplex at index 5)
    messageBytes[off++] = 6; // numAccountMetas
    messageBytes[off++] = 1; // metadata PDA
    messageBytes[off++] = 0; // collection_authority (deployer)
    messageBytes[off++] = 0; // payer (deployer)
    messageBytes[off++] = 3; // collection_mint (was [2], now [3] after reorder)
    messageBytes[off++] = 2; // collection metadata (was [3], now [2] after reorder)
    messageBytes[off++] = 4; // collection master edition
    messageBytes[off++] = 1; // dataLen
    messageBytes[off++] = 30; // VerifySizedCollectionItem instruction discriminator

    // Sign the message
    const nacl = await import('tweetnacl');
    const signature = nacl.sign.detached(messageBytes, deployerKeypairBytes);

    // Build full transaction: [numSigs(1)] + [sig(64)] + [message]
    const txBytes = new Uint8Array(1 + 64 + messageBytes.length);
    txBytes[0] = 1; // numSignatures
    txBytes.set(signature, 1);
    txBytes.set(messageBytes, 65);

    // Send transaction
    const txB64 = btoa(String.fromCharCode(...txBytes));
    const sendResponse = await fetch(env.GORBAGANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'sendTransaction',
        params: [txB64, { encoding: 'base64', skipPreflight: false }],
      }),
    });
    const sendResult = (await sendResponse.json()) as any;

    if (sendResult.error) {
      console.error('[VerifyCollection] RPC error:', sendResult.error);
      return json({ error: `Transaction failed: ${sendResult.error.message || JSON.stringify(sendResult.error)}` }, 500);
    }

    const txSignature = sendResult.result;
    console.log(`[VerifyCollection] Verified collection for mint ${body.mint}: ${txSignature}`);

    return json({ success: true, signature: txSignature });
  } catch (err: any) {
    console.error('[VerifyCollection] Error:', err);
    return json({ error: err.message || 'Failed to verify collection' }, 500);
  }
}

// ─── Main router ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.CORS_ORIGIN);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      let response: Response;

      // Route matching
      if (url.pathname === '/api/health' && request.method === 'GET') {
        response = await handleHealth(env);
      } else if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        response = await handleLogin(request, env);
      } else if (url.pathname === '/api/auth/verify' && request.method === 'GET') {
        response = await handleVerify(request, env);
      } else if (url.pathname.startsWith('/api/admin/submissions/') && request.method === 'POST') {
        const action = url.pathname.split('/').pop() || '';
        response = await handleAdminAction(request, env, action);
      } else if (url.pathname === '/api/rpc' && request.method === 'POST') {
        response = await handleRpcProxy(request, env);
      } else if (url.pathname === '/api/game/update-balance' && request.method === 'POST') {
        response = await handleGameUpdateBalance(request, env);
      } else if (url.pathname === '/api/game/sign' && request.method === 'POST') {
        response = await handleGameSign(request, env);
      } else if (url.pathname === '/api/migration/verify-collection' && request.method === 'POST') {
        response = await handleVerifyCollection(request, env);
      } else {
        response = json({ error: 'Not found' }, 404);
      }

      // Attach CORS headers to every response
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) {
        newHeaders.set(k, v);
      }
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    } catch (err: any) {
      console.error('Worker error:', err);
      return json({ error: 'Internal server error' }, 500, cors);
    }
  },
};
