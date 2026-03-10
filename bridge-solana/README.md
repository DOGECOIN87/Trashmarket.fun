# Solana Bridge Program

Solana-side sGOR escrow for the cross-chain P2P bridge between Solana and Gorbagana.

## Overview

This program handles sGOR token escrow on Solana, enabling trustless P2P trading between:
- **sGOR** (SPL token on Solana)
- **gGOR** (native token on Gorbagana)

## Trading Flows

| Direction | Description |
|-----------|-------------|
| **sGOR → gGOR** | Maker locks sGOR on Solana, taker sends gGOR on Gorbagana, atomic settlement |
| **gGOR → sGOR** | Maker locks gGOR on Gorbagana, taker fills on Solana, atomic settlement |

## Security

- Atomic escrow settlement
- Expiration-based refunds
- Mint validation enforced

## License

All rights reserved.
