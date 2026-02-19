# Trashmarket API — Cloudflare Worker Backend

Secure backend for the Trashmarket.fun dApp. Handles admin authentication, session management, and RPC proxying.

## Setup

```bash
cd backend
npm install
```

## Configuration

Set secrets via Wrangler CLI:

```bash
wrangler secret put ADMIN_WALLETS    # comma-separated admin wallet public keys
wrangler secret put JWT_SECRET       # random string for signing session tokens
```

## Development

```bash
npm run dev
```

## Deployment

```bash
npm run deploy
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Health check |
| POST | `/api/auth/login` | None | Admin login via wallet signature |
| GET | `/api/auth/verify` | Bearer | Verify session token |
| POST | `/api/admin/submissions/:action` | Bearer (admin) | Admin submission actions |
| POST | `/api/rpc` | None | Proxy RPC calls to Gorbagana |

## Auth Flow

1. Frontend requests admin to sign a message: `"Trashmarket Admin Login\nTimestamp: {Date.now()}"`
2. Frontend sends `{ wallet, message, signature }` to `/api/auth/login`
3. Backend verifies the Ed25519 signature and checks wallet is in ADMIN_WALLETS
4. Backend returns a session token (HMAC-SHA256, 24h expiry)
5. Frontend includes `Authorization: Bearer <token>` on subsequent admin requests
