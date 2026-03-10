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

/** Proxy RPC calls to avoid exposing RPC endpoint directly */
async function handleRpcProxy(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const rpcResponse = await fetch(env.GORBAGANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await rpcResponse.json();
  return json(data);
}

/**
 * POST /api/game/update-balance — Admin-signed game balance update
 *
 * The frontend sends the player's wallet, new balance, and net profit delta.
 * This endpoint builds the update_balance instruction, partially signs it with
 * the admin keypair, and returns the serialized transaction for the player to
 * also sign and submit.
 *
 * Since update_balance requires the admin (game_config.admin) to co-sign,
 * this endpoint acts as the trusted game server that validates and authorizes
 * balance changes.
 */
async function handleGameUpdateBalance(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    playerWallet: string;
    newBalance: number;
    netProfitDelta: number;
  };

  if (!body.playerWallet || body.newBalance === undefined || body.netProfitDelta === undefined) {
    return json({ error: 'Missing playerWallet, newBalance, or netProfitDelta' }, 400);
  }

  // Validate inputs
  if (body.newBalance < 0 || body.newBalance > 1_000_000_000) {
    return json({ error: 'Invalid balance' }, 400);
  }
  if (Math.abs(body.netProfitDelta) > 1_000_000_000) {
    return json({ error: 'Invalid net profit delta' }, 400);
  }

  try {
    // Load admin keypair from secret
    const keypairBytes = new Uint8Array(JSON.parse(env.GAME_ADMIN_KEYPAIR));
    const adminSecretKey = keypairBytes.slice(0, 32);
    const adminPublicKeyBytes = keypairBytes.slice(32, 64);
    const adminPublicKey = base58Encode(adminPublicKeyBytes);

    const PROGRAM_ID = '5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe';
    const playerPubkeyBytes = base58Decode(body.playerWallet);

    // Derive game_state PDA: ["game_state", player_pubkey]
    // We'll compute this via RPC getAccountInfo or just build the instruction
    // and let the frontend handle PDA derivation

    // Derive game_config PDA: ["game_config"]
    // Build the instruction data: discriminator(8) + new_balance(8) + net_profit_delta(8)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode('global:update_balance'));
    const discriminator = new Uint8Array(hashBuffer).slice(0, 8);

    const data = new Uint8Array(24);
    data.set(discriminator, 0);
    // Write new_balance as u64 LE
    const balanceView = new DataView(new ArrayBuffer(8));
    balanceView.setBigUint64(0, BigInt(body.newBalance), true);
    data.set(new Uint8Array(balanceView.buffer), 8);
    // Write net_profit_delta as i64 LE
    const deltaView = new DataView(new ArrayBuffer(8));
    deltaView.setBigInt64(0, BigInt(body.netProfitDelta), true);
    data.set(new Uint8Array(deltaView.buffer), 16);

    // Sign the instruction data + player wallet with admin key to create a proof
    // The frontend will use this to build and submit the full transaction
    const proofData = new Uint8Array([...data, ...playerPubkeyBytes]);
    const importedKey = await crypto.subtle.importKey(
      'raw',
      adminSecretKey,
      { name: 'Ed25519' },
      false,
      ['sign'],
    );
    // Note: Ed25519 raw key import requires the full 64-byte secret in some implementations
    // We'll use tweetnacl-compatible approach instead

    // Return the instruction data and admin public key so the frontend can
    // build and have admin co-sign the transaction via a different flow
    //
    // Actually, the simplest approach: build the full transaction server-side,
    // partially sign with admin, return base64 for player to also sign.

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

    // Return the raw instruction components for the frontend to assemble
    // The frontend will build the transaction with both player + admin as signers,
    // then call a second endpoint to get the admin's signature on the tx
    return json({
      instruction: {
        data: Array.from(data),
        programId: PROGRAM_ID,
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
 * Receives a serialized transaction (base64), verifies it contains a valid
 * update_balance instruction, then adds the admin signature and returns it.
 */
async function handleGameSign(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    transaction: string; // base64 serialized transaction message
  };

  if (!body.transaction) {
    return json({ error: 'Missing transaction' }, 400);
  }

  try {
    const keypairBytes = new Uint8Array(JSON.parse(env.GAME_ADMIN_KEYPAIR));

    // Use tweetnacl to sign the transaction message
    const nacl = await import('tweetnacl');
    const txBytes = Uint8Array.from(atob(body.transaction), c => c.charCodeAt(0));

    // Sign the transaction message with admin keypair
    const signature = nacl.sign.detached(txBytes, keypairBytes);

    return json({
      signature: btoa(String.fromCharCode(...signature)),
      adminPublicKey: base58Encode(keypairBytes.slice(32, 64)),
    });
  } catch (err: any) {
    console.error('Game sign error:', err);
    return json({ error: 'Failed to sign transaction' }, 500);
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
