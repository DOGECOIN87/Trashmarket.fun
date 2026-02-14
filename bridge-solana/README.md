# Solana Bridge Program

Solana-side sGOR escrow for cross-chain bridge between Solana and Gorbagana.

## Overview

This program handles sGOR token escrow on Solana mainnet, enabling trustless P2P trading between:
- **sGOR** (SPL token on Solana): `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg`
- **gGOR** (native token on Gorbagana)

## Architecture

**Two Programs Required:**
1. **This program** (Solana): Handles sGOR escrow
2. **Gorbagana program** (`FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq`): Handles gGOR escrow

## Trading Flows

### sGOR → gGOR (Solana maker wants gGOR)
1. Maker creates order HERE (Solana), locking sGOR
2. Taker fills on Gorbagana, sending gGOR to maker's Gorbagana address
3. Taker then claims sGOR HERE

### gGOR → sGOR (Gorbagana maker wants sGOR)
1. Maker creates order on Gorbagana, locking gGOR
2. Taker fills HERE (Solana), receiving gGOR on Gorbagana
3. Taker sends sGOR to maker's Solana address

## Instructions

### `create_order`
Locks sGOR in escrow, expecting gGOR in return.

**Parameters:**
- `amount`: sGOR amount (6 decimals)
- `expiration_slot`: Order expiry (max 24 hours)
- `gorbagana_recipient`: Maker's Gorbagana address to receive gGOR

### `fill_order`
Releases sGOR to taker (who has locked gGOR on Gorbagana).

### `cancel_order`
Refunds sGOR to maker if order unfilled.

## Deployment

⚠️ **DO NOT DEPLOY YET** - Program ID needs to be generated first.

### Steps (when ready):

1. **Generate program keypair:**
   ```bash
   cd bridge-solana
   anchor keys list
   ```

2. **Update program ID:**
   - Replace `declare_id!` in `lib.rs` with actual program ID
   - Update `Anchor.toml` `[programs.mainnet]` section

3. **Build:**
   ```bash
   anchor build
   ```

4. **Deploy (requires ~2 SOL):**
   ```bash
   anchor deploy --provider.cluster mainnet
   ```

## Constants

- **SGOR_MINT**: `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg`
- **MIN_ORDER_AMOUNT**: 100,000 (0.1 sGOR with 6 decimals)
- **MAX_EXPIRY_SLOTS**: 216,000 (~24 hours at 400ms/slot)

## Security

- No upgrade authority (permissionless)
- Atomic escrow settlement
- Expiration-based refunds
- Mint validation enforced

## Coordination

Cross-chain settlement requires coordination mechanism (to be implemented):
- Option 1: Relayer service
- Option 2: HTLC (Hash Time Locked Contracts)
- Option 3: Manual taker coordination
