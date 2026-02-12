# Gorbagana Bridge

**P2P OTC swap program for sGOR (SPL) ↔ gGOR (native) on the Gorbagana chain.**

Deployed on [trashmarket.fun](https://trashmarket.fun) via the Gorbagana RPC at `https://rpc.trashscan.io`.

---

## Architecture

The bridge is a Solana/Anchor program implementing a **P2P escrow-based order book**:

| Direction | Maker Deposits | Taker Provides | Mechanism |
|-----------|---------------|----------------|-----------|
| **0** (sGOR→gGOR) | sGOR (SPL token) into escrow PDA | gGOR (native lamports) to maker | `token::transfer` + `system_program::transfer` |
| **1** (gGOR→sGOR) | gGOR (native lamports) into order PDA | sGOR (SPL token) to maker | `system_program::transfer` + `token::transfer` |

### Critical Design Decision
**gGOR is native gas — never wrapped.** Direction 1 deposits lamports directly into the order PDA account and releases them via direct lamport manipulation. No SPL wrapping or unwrapping occurs.

### PDAs
- **Order PDA**: `seeds = [b"order", maker_pubkey, amount_le_bytes]`
- **Escrow Token PDA**: `seeds = [b"escrow", maker_pubkey, amount_le_bytes]` (direction 0 only)

---

## Project Structure

```
gorbagana-bridge/
├── Anchor.toml              # Anchor config (RPC: rpc.trashscan.io)
├── Cargo.toml               # Workspace config
├── package.json             # JS dependencies
├── programs/bridge/
│   ├── Cargo.toml           # Program dependencies
│   └── src/lib.rs           # Production program logic
├── tests/
│   └── bridge.ts            # Comprehensive test suite
├── scripts/
│   └── deploy.sh            # Guided deployment script
└── migrations/
    └── deploy.ts            # Anchor migration
```

---

## Setup

```bash
yarn install
solana config set --url https://rpc.trashscan.io
```

## Build & Test

```bash
anchor build
anchor test
```

## Deploy

```bash
# Interactive guided deployment (recommended)
./scripts/deploy.sh
```

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `SGOR_MINT` | `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg` | sGOR SPL token mint |
| `MIN_ORDER_AMOUNT` | 100,000 | Minimum order size |
| `MAX_EXPIRY_SLOTS` | 216,000 | ~24 hours at 400ms/slot |

---

## Security

See [BRIDGE_SECURITY.md](./BRIDGE_SECURITY.md) for the full security architecture.

## License

MIT
