# Current State of Trashmarket.fun dApp

## Overview
The Trashmarket.fun frontend is currently in development. It successfully connects to the Gorbagana network and fetches real-time token/market data from `gorapi.trashscan.io`.

## Outstanding Issues & Blockers

### 1. DEX Swap Execution & Custom Fees
- **Current State:** The DEX UI (`pages/Dex.tsx`) successfully pulls token prices and calculates swap estimates, but the "Execute Swap" button only triggers a browser alert.
- **The Block:** We want to implement a custom "Frontend Fee" that takes a percentage of the swap and sends it to the Treasury Wallet (`77hD...Q8wb`). However, there is no AMM SDK (e.g., Meteora, Raydium) or Smart Contract IDL (JSON interface) available in the codebase to construct the actual Solana/Anchor swap instruction for the "Trashbin Dex CPAMM v4".
- **Required Next Steps:** 
  1. Obtain the `idl.json` or TypeScript SDK from the developers who wrote the Trashbin Dex programs.
  2. Implement the `buildSwapTransaction` function in `lib/transactionBuilder.ts` to include:
     - The transfer instruction for the Treasury Fee.
     - The AMM Swap instruction.
  3. Wire the transaction builder to the "Execute Swap" button to sign and send via the user's wallet.
  - *Alternative:* If the IDL cannot be found, a new custom "Fee Router" smart contract must be written in Rust and deployed to Gorbagana.

### 2. Game Economy (Junkpusher)
- **Current State:** The game UI is being integrated. `lib/transactionBuilder.ts` contains functions for `buildBumpTransaction`, `buildInitializeGameTransaction`, and `buildRecordScoreTransaction`.
- **Required Next Steps:**
  - Verify that the game frontend correctly calls these transaction builders and triggers wallet prompts.
  - Ensure all GOR dependencies are removed from the game's deposit/withdrawal, converting interactions fully to the JUNK SPL token as requested in earlier planning.

### 3. API Integrations
- `gorapi.trashscan.io` has been verified as a **read-only** data provider (prices, candles, DAS RPC). It cannot be used to route or calculate swap transactions on behalf of the frontend. All swap instruction building *must* happen client-side or on a custom backend.
