# Gorbagana Bridge

**P2P OTC swap program for sGOR (SPL) <> gGOR (native) on the Gorbagana chain.**

Deployed on [trashmarket.fun](https://trashmarket.fun).

## Architecture

The bridge is a Solana/Anchor program implementing a **P2P escrow-based order book**:

| Direction | Maker Deposits | Taker Provides |
|-----------|---------------|----------------|
| **sGOR → gGOR** | sGOR (SPL token) into escrow | gGOR (native) to maker |
| **gGOR → sGOR** | gGOR (native) into order PDA | sGOR (SPL token) to maker |

**gGOR is native gas — never wrapped.** Deposits use direct lamport manipulation. No SPL wrapping or unwrapping occurs.

## Security

- Atomic escrow settlement
- Expiration-based refunds
- Mint validation enforced

## License

All rights reserved.
