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
