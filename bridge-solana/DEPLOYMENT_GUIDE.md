# Solana Bridge Deployment Guide

## Current Status
✅ Code complete and ready to build
⚠️ **DO NOT DEPLOY YET** - Program ID must be generated first

## Pre-Deployment Checklist

### 1. Generate Program Keypair
```bash
cd /home/mattrick/Desktop/trshmarket/Trashmarket.fun/bridge-solana
anchor keys list
```

This will output something like:
```
solana_bridge: AbCdEf1234567890...
```

### 2. Update Program ID in Two Places

**File 1:** `programs/solana-bridge/src/lib.rs` (line 5)
```rust
// BEFORE:
declare_id!("11111111111111111111111111111111");

// AFTER (use actual ID from step 1):
declare_id!("AbCdEf1234567890...");
```

**File 2:** `Anchor.toml` (line 10)
```toml
[programs.mainnet]
solana_bridge = "AbCdEf1234567890..."
```

### 3. Build the Program
```bash
anchor build
```

**Expected output:**
- Compiled program in `target/deploy/solana_bridge.so`
- IDL file in `target/idl/solana_bridge.json`
- Size should be similar to Gorbagana program (~288 KB)

### 4. Test on Devnet First (Recommended)

**Update Anchor.toml temporarily:**
```toml
[provider]
cluster = "Devnet"
```

**Get devnet SOL:**
```bash
solana airdrop 2 --url devnet
```

**Deploy to devnet:**
```bash
anchor deploy --provider.cluster devnet
```

**Test the program:**
- Create test orders
- Verify escrow accounts
- Test fill and cancel operations
- Check events are emitted correctly

### 5. Deploy to Mainnet (When Ready)

**Ensure you have ~2 SOL for deployment:**
```bash
solana balance
```

**Update Anchor.toml back to mainnet:**
```toml
[provider]
cluster = "Mainnet"
```

**Deploy:**
```bash
anchor deploy --provider.cluster mainnet
```

**⚠️ IMPORTANT:** Once deployed without upgrade authority, the program is PERMANENT and IMMUTABLE. Triple-check everything before mainnet deployment.

## Post-Deployment Tasks

### 1. Update Frontend Integration

The frontend `bridgeService.ts` needs to be updated to interact with BOTH programs:

- **Gorbagana Program:** `FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq`
- **Solana Program:** (new program ID from deployment)

### 2. Create Coordination Service

You'll need to implement cross-chain coordination. Options:

**Option A: Relayer Service (Recommended)**
- Backend service monitoring both chains
- Automatically matches and settles trades
- Charges small fee for service

**Option B: HTLC (Hash Time Locked Contracts)**
- Add secret hash to both programs
- Atomic settlement via hash reveal
- More complex but fully trustless

**Option C: Manual Coordination**
- Users manually complete both sides
- Simple but requires user diligence
- Risk of failed trades

### 3. Update UI Components

Files that need updating:
- `services/bridgeService.ts` - Add Solana connection logic
- `components/BridgeInterface.tsx` - Show dual-chain flow
- `contexts/NetworkContext.tsx` - Handle both RPCs

### 4. Security Audit

Before going live with real funds:
- [ ] Code review by independent developer
- [ ] Test with small amounts first
- [ ] Monitor for 48 hours
- [ ] Set initial trade limits

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                         USER FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  sGOR → gGOR (Maker wants Gorbagana tokens)                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 1. Maker creates order on SOLANA (locks sGOR)      │     │
│  │ 2. Taker locks gGOR on GORBAGANA                   │     │
│  │ 3. Coordination mechanism verifies both locks      │     │
│  │ 4. Taker claims sGOR on SOLANA                     │     │
│  │ 5. Maker receives gGOR on GORBAGANA                │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  gGOR → sGOR (Maker wants Solana tokens)                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 1. Maker creates order on GORBAGANA (locks gGOR)   │     │
│  │ 2. Taker locks sGOR on SOLANA                      │     │
│  │ 3. Coordination mechanism verifies both locks      │     │
│  │ 4. Taker claims gGOR on GORBAGANA                  │     │
│  │ 5. Maker receives sGOR on SOLANA                   │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    TECHNICAL ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  SOLANA MAINNET                      GORBAGANA L2            │
│  ┌─────────────────────┐            ┌─────────────────────┐ │
│  │ Program ID: TBD     │            │ Program ID:         │ │
│  │                     │            │ FreEcfZtek...       │ │
│  │ Token: sGOR         │◄──BRIDGE──►│ Token: gGOR         │ │
│  │ Mint: 71Jvq4...     │            │ (native)            │ │
│  │ Decimals: 6         │            │ Decimals: 9         │ │
│  │                     │            │                     │ │
│  │ Instructions:       │            │ Instructions:       │ │
│  │ - create_order      │            │ - create_order      │ │
│  │ - fill_order        │            │ - fill_order        │ │
│  │ - cancel_order      │            │ - cancel_order      │ │
│  └─────────────────────┘            └─────────────────────┘ │
│           ▲                                   ▲              │
│           │                                   │              │
│           └───────────┬FRONTEND┬──────────────┘              │
│                       │        │                             │
│                       ▼        ▼                             │
│              ┌──────────────────────┐                        │
│              │  Dual RPC Config     │                        │
│              │                      │                        │
│              │  Solana: Alchemy     │                        │
│              │  Gorbagana: TrashRPC │                        │
│              └──────────────────────┘                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Important Constants

| Constant | Value | Description |
|----------|-------|-------------|
| sGOR Mint | `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg` | Solana SPL token |
| sGOR Decimals | 6 | Solana token precision |
| gGOR Decimals | 9 | Gorbagana native token |
| Min Order | 100,000 | 0.1 sGOR (6 decimals) |
| Max Expiry | 216,000 slots | ~24 hours |
| Gorbagana Program | `FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq` | Existing deployment |
| Solana Program | TBD | After key generation |

## Conversion Formula

When displaying amounts, remember the decimal difference:

```typescript
// sGOR (6 decimals) ↔ gGOR (9 decimals)
// To convert equal value:
const DECIMAL_MULTIPLIER = 1000; // 10^(9-6)

// Example: 1.5 sGOR = 1.5 gGOR (same value, different decimals)
const sgorRaw = 1_500_000;        // 1.5 with 6 decimals
const ggorRaw = 1_500_000_000;    // 1.5 with 9 decimals

// Display conversion:
const sgorDisplay = sgorRaw / 1_000_000;      // 1.5
const ggorDisplay = ggorRaw / 1_000_000_000;  // 1.5
```

## Questions?

Refer to:
- `BRIDGE_SECURITY.md` - Security architecture
- `SOLGOR-DEV-SKILL.md` - Development guidelines
- `README.md` - Program overview

Ready to proceed with deployment when you give the go-ahead! 🚀
