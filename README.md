<div align="center">

# TRASHMARKET.FUN

### The Future Marketplace & DeFi Hub being Built for the Gorbagana Chain

[![Live](https://img.shields.io/badge/LIVE-trashmarket.fun-adff02?style=for-the-badge&labelColor=000000)](https://trashmarket.fun)

<br/>

**Coming Soon - Browse NFTs. Trade GorIDs. P2P OTC Bridge**
**All on Gorbagana.**

<br/>

</div>

---

## What is Trashmarket?

Trashmarket is building an all-in-one platform for the Gorbagana ecosystem — a Solana-compatible L2 chain. It combines an NFT marketplace, a trustless P2P token bridge, a GorID trading platform, into a single brutalist, terminal-inspired interface.

---

## Features

### NFT Marketplace
Browse, buy, and sweep NFT collections on Gorbagana. Live activity feeds, floor price charts, and collection-level stats — all in real time.

### P2P OTC Bridge
Swap between **sGOR** (SPL token) and **gGOR** (native gas) through a fully on-chain escrow order book. No custodians, no wrapping — just atomic peer-to-peer settlement.

### GorID Domains
Register and trade **.gor** domain names. Look up any address, browse listed domains, or list your own for sale.


### Collection Submissions
Submit your own NFT collection to be listed on the marketplace. Track your submission status from pending to approved.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS (JetBrains Mono, brutalist theme) |
| Blockchain | Solana Web3.js + Anchor Framework |
| Smart Contract | Rust / Anchor (deployed on Gorbagana) |
| Wallets | Backpack, Gorbag Wallet |

---

## Bridge Architecture

The bridge uses **dual-program escrow architecture** for trustless P2P cross-chain trading between Solana and Gorbagana.

### Current Status: 🧪 Testing Phase

✅ **Gorbagana Program:** Deployed on mainnet
🧪 **Solana Program:** Deployed on devnet for testing

### How It Works

The bridge requires **two separate programs** (one per chain):

| Chain | Program | Token | Network | Status |
|-------|---------|-------|---------|--------|
| **Gorbagana** | `FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq` | gGOR (native, 9 decimals) | Mainnet | ✅ Live |
| **Solana** | `66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M` | sGOR (SPL, 6 decimals) | Devnet | 🧪 Testing |

**sGOR Mint (Solana mainnet):** `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg`

### Trading Flow

| Direction | Step 1 | Step 2 | Step 3 |
|-----------|--------|--------|--------|
| **sGOR → gGOR** | Maker locks sGOR on Solana | Taker locks gGOR on Gorbagana | Atomic settlement |
| **gGOR → sGOR** | Maker locks gGOR on Gorbagana | Taker locks sGOR on Solana | Atomic settlement |

> **Architecture note:** Each blockchain has its own escrow program. The Gorbagana program handles gGOR (native gas), while the Solana program handles sGOR (SPL token). Cross-chain coordination ensures both sides settle atomically.

### Deployment Status

**Devnet (Testing):**
- ✅ Program deployed: `66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M`
- 🧪 Testing in progress
- 📊 [View on Explorer](https://explorer.solana.com/address/66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M?cluster=devnet)

**Mainnet (Pending):**
- **Cost:** ~2 SOL for deployment
- **Location:** `/bridge-solana/` (complete Anchor workspace)
- **Next steps:** See [bridge-solana/DEPLOYMENT_GUIDE.md](./bridge-solana/DEPLOYMENT_GUIDE.md)

Once mainnet deployment is complete and coordination mechanism is implemented, the bridge will be fully operational.

For the complete security model and implementation details, see [BRIDGE_SECURITY.md](./BRIDGE_SECURITY.md).

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Anchor CLI](https://www.anchor-lang.com/) (for smart contract development)
- A Solana-compatible wallet (Backpack or Gorbag Wallet)

### Run the Frontend

```bash
npm install
npm run dev
```

The app starts at `http://localhost:3000`.

### Build for Production

```bash
npm run build
npm run preview    # preview the build locally
npm run deploy     # deploy to GitHub Pages
```

### Smart Contract Development

```bash
# Point Solana CLI to the Gorbagana RPC
solana config set --url https://rpc.trashscan.io

# Build and test the bridge program
cd bridge
anchor build
anchor test

# Deploy (interactive guided script)
./scripts/deploy.sh
```

---

## Project Structure

```
Trashmarket.fun/
├── src/
│   ├── pages/             # Home, Bridge, Collection, Gorid, Docs
│   ├── components/        # Navbar, Footer, NFTCard, PriceChart
│   ├── contexts/          # Wallet, Network, Anchor providers
│   ├── services/          # Bridge, GorID, Magic Eden integrations
│   └── utils/             # RPC helpers
├── bridge/
│   └── programs/bridge/
│       └── src/lib.rs     # On-chain bridge program (Rust/Anchor)
├── public/                # Static assets
├── index.html             # Entry point + Tailwind config
└── vite.config.ts         # Vite build config with Solana polyfills
```

---

## Network Info

| | |
|-|-|
| **Chain** | Gorbagana (Solana-compatible L2) |
| **RPC** | `https://rpc.trashscan.io` |
| **Explorer** | [trashscan.io](https://trashscan.io) |
| **Native Token** | gGOR |
| **SPL Token (on Solana)** | sGOR |

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a PR

## Want to help bootstrap progress?  

The Goal is 2 SOL to deploy our Solana Program - Anything helps thank you for any donations made!

## Solana Wallet Address:  

Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo  

or  

mattrick.sol

---

## License

MIT
