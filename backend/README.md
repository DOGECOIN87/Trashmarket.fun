# Trashmarket API — Cloudflare Worker Backend

Secure backend for the Trashmarket.fun dApp. Handles admin authentication, session management, and RPC proxying.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Admin login via wallet signature |
| GET | `/api/auth/verify` | Verify session token |
| POST | `/api/admin/submissions/:action` | Admin submission actions |
| POST | `/api/rpc` | Proxy RPC calls to Gorbagana |

## License

All rights reserved.
