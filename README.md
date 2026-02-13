<div align="center">

# TRASHMARKET.FUN

### The NFT Marketplace & DeFi Hub for the Gorbagana Chain

[![Live](https://img.shields.io/badge/LIVE-trashmarket.fun-adff02?style=for-the-badge&labelColor=000000)](https://trashmarket.fun)
[![Explorer](https://img.shields.io/badge/EXPLORER-trashscan.io-adff02?style=for-the-badge&labelColor=000000)](https://trashscan.io)
[![License: MIT](https://img.shields.io/badge/LICENSE-MIT-adff02?style=for-the-badge&labelColor=000000)](#license)

<br/>

**Browse NFTs. Swap tokens. Register domains. Generate art with AI.**
**All on Gorbagana.**

<br/>

</div>

---

## What is Trashmarket?

Trashmarket is the all-in-one platform for the Gorbagana ecosystem — a Solana-compatible L2 chain. It combines an NFT marketplace, a trustless P2P token bridge, a domain name service, and an AI-powered art generator into a single brutalist, terminal-inspired interface.

---

## Features

### NFT Marketplace
Browse, buy, and sweep NFT collections on Gorbagana. Live activity feeds, floor price charts, and collection-level stats — all in real time.

### P2P Bridge
Swap between **sGOR** (SPL token) and **gGOR** (native gas) through a fully on-chain escrow order book. No custodians, no wrapping — just atomic peer-to-peer settlement.

### GorID Domains
Register and trade **.gor** domain names. Look up any address, browse listed domains, or list your own for sale.

### AI Launchpad
Generate NFT artwork from text prompts using Google Gemini. Type a description, get an image, download it.

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
| AI | Google Gemini API |
| Backend | Firebase |
| Hosting | GitHub Pages |

---

## Bridge Architecture

The bridge is an Anchor program that implements a **P2P escrow-based order book** — no intermediary, no token wrapping.

**How it works:**

| Swap | Maker locks | Taker sends | Settlement |
|------|------------|-------------|------------|
| sGOR → gGOR | sGOR into escrow PDA | gGOR (native) to maker | Atomic |
| gGOR → sGOR | gGOR (native) into order PDA | sGOR to maker | Atomic |

> **Design note:** gGOR is native gas and is never wrapped. Direction 1 deposits lamports directly into the order PDA and releases them via direct lamport manipulation.

**Program:** [`FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq`](https://trashscan.io)
**sGOR Mint:** `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg`

For the full security model, see [BRIDGE_SECURITY.md](./BRIDGE_SECURITY.md).

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
│   ├── pages/             # Home, Bridge, Collection, Gorid, Launchpad, Docs
│   ├── components/        # Navbar, Footer, NFTCard, PriceChart
│   ├── contexts/          # Wallet, Network, Anchor providers
│   ├── services/          # Bridge, GorID, Gemini, Magic Eden integrations
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
| **SPL Token** | sGOR |

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a PR

---

## License

MIT
