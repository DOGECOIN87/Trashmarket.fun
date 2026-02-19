# AI Assistant Guide: Trashmarket.fun dApp Development

**Prepared for**: Next AI Assistant (Senior Full-Stack dApp Architect)
**Author**: Manus AI
**Date**: February 19, 2026

## 1.0 Introduction & Mission

Your mission is to complete the development of the **Trashmarket.fun** dApp, a multi-faceted platform on the Gorbagana blockchain. This guide provides a comprehensive overview of the existing architecture, identifies all incomplete components, and outlines a clear roadmap for completion. You will act as the senior architect, responsible for implementing missing features, fixing security vulnerabilities, and preparing the dApp for a production launch.

The codebase has been reorganized and cleaned, but significant work remains to transition from a partially-mocked frontend to a fully functional, on-chain dApp. This document is your primary source of truth.

## 2.0 Core Architecture & Stack

The dApp is built on a modern web stack, but currently lacks a backend, which is a critical gap. All logic is client-side, posing significant security and scalability risks.

| Component | Technology | Status | Key Notes |
|---|---|---|---|
| **Frontend** | React, Vite, TypeScript | ✅ In Place | Solid foundation, but needs state management overhaul. |
| **Styling** | Tailwind CSS | ✅ In Place | Functional, but needs brand alignment. |
| **Blockchain SDK** | `@solana/web3.js` | ✅ In Place | Standard Solana SDK, compatible with Gorbagana. |
| **Wallet Adapter** | `@solana/wallet-adapter-react` | ✅ In Place | Functional, but a custom `WalletContext` adds unnecessary complexity. |
| **On-Chain Programs** | Anchor (Rust) | 🔶 Partial | Bridge programs exist but are not fully integrated or tested. |
| **Backend Server** | **None** | ❌ **Missing** | **CRITICAL GAP**. All sensitive logic is exposed on the client. |
| **Database** | Firebase/Firestore | 🔶 Partial | Used only for the collection submission form. Not for core dApp data. |
| **Indexing/Queries** | **None** | ❌ **Missing** | Relies on direct RPC calls and local mock data. Not scalable. |

## 3.0 Project Roadmap: From Incomplete to Production

This roadmap is prioritized by criticality. Address these items in order.

### 3.1 Priority 1: Critical Security & Infrastructure

**Goal**: Eliminate all major security vulnerabilities and establish a secure backend architecture.

| Task ID | Task | Problem | Recommended Solution |
|---|---|---|---|
| **SEC-01** | **Implement Backend Server** | No backend exists. Admin logic, API keys, and sensitive operations are exposed client-side. | Create a Node.js backend (Express or Fastify) or use serverless functions (Vercel/Cloudflare). This backend will manage all sensitive operations. |
| **SEC-02** | **Secure Admin Authentication** | Admin password and wallet list are in client-side code (`import.meta.env`). | Move admin authentication to the new backend. Create a secure endpoint that requires a signature from an admin wallet to issue a JWT or session token. |
| **SEC-03** | **Replace Magic Eden API** | `magicEdenService.ts` uses a deprecated, non-functional API. | Find a new NFT marketplace API provider (e.g., Tensor, another public API) or remove the service if no suitable replacement is found. |
| **SEC-04** | **Implement Firebase Security Rules** | No security rules are defined for Firestore, likely leaving it open to public read/write. | Write and deploy strict Firestore security rules. Ensure only authenticated users can submit, and only admins can modify submission statuses. |

### 3.2 Priority 2: Complete Core dApp Features

**Goal**: Transition all mocked or partially implemented features to fully functional, on-chain operations.

| Task ID | Feature | Current State | Completion Steps |
|---|---|---|---|
| **FEAT-01** | **Junk Pusher Game** | Core mechanics are complete, but on-chain integration is entirely mocked. Transactions are built but never sent. | 1. **Connect Wallet**: Ensure the game checks and uses the player's actual on-chain JUNK token balance. Prevent play if balance is zero. <br> 2. **Send Transactions**: Use the wallet adapter's `sendTransaction` method to execute the instructions built by `JunkPusherClient.ts`. <br> 3. **Implement On-Chain State**: Write high scores, player stats, and game state to the blockchain using the existing Anchor program. |
| **FEAT-02** | **Gorbagana-Solana Bridge** | The Anchor programs exist, and the UI is partially built. However, the core `createOrder` calls in `bridgeService.ts` are broken (passing `null` accounts). | 1. **Fix `createOrder` calls**: Correctly create and pass all required token accounts (escrow, maker, etc.). <br> 2. **Test Thoroughly**: The parameter mismatch in `createOrderSGOR` (devnet vs. mainnet) must be investigated and fixed. <br> 3. **Add UI Feedback**: Implement robust loading, success, and error states in the `Bridge.tsx` component. |
| **FEAT-03** | **Gorid Name Service** | The service (`goridService.ts`) returns hardcoded mock data. No on-chain interaction is implemented. | 1. **Integrate `@gorid/spl-name-service`**: Use the actual library to query domain availability and ownership. <br> 2. **Implement Registration**: Create the transaction logic to allow users to register `.gor` domains. |
| **FEAT-04** | **Gorbagio NFT Marketplace** | The service (`gorbagioService.ts`) uses local JSON files because the live API was disabled. | 1. **Verify API Status**: Check if the Gorbagio API is back online. <br> 2. **Implement Live API**: If the API is available, switch from the local JSON files to live API calls. <br> 3. **Implement Fallback**: If the API is still down, keep the local JSON as a fallback but display a clear message to the user that the data is not live. |

### 3.3 Priority 3: Code Quality & UX Refinements

**Goal**: Improve the codebase maintainability, user experience, and brand consistency.

| Task ID | Task | Problem | Recommended Solution |
|---|---|---|---|
| **UX-01** | **Standardize RPC Endpoints** | RPC URLs are hardcoded in multiple places. The user prefers `rpc.trashscan.io`. | Ensure all blockchain connections and API calls consistently use the environment variables defined in `.env.example` (`VITE_GORBAGANA_RPC`). The user has confirmed `https://rpc.trashscan.io` is the preferred endpoint. |
| **CODE-01**| **Refactor Wallet Context** | A custom `WalletContext` duplicates the functionality of `@solana/wallet-adapter-react`, adding complexity. | Remove the custom `WalletContext` and refactor all components to use the standard hooks from the wallet-adapter library directly (e.g., `useWallet`, `useConnection`). |
| **CODE-02**| **State Management** | Multiple context providers are used for state, which can become unwieldy. | Introduce a dedicated state management library like Zustand or Redux Toolkit to centralize and simplify dApp state. |
| **BRAND-01**| **Brand Alignment** | The UI is functional but lacks the distinctive Gorbagana 
trash aesthetic. | Review the `gorbagana-brand` skill and `references/design-system.md`. Apply the brand guidelines: Pusia Bold font, neon green glow effects, grid backgrounds, and the correct color palette. |

## 4.0 Technical Deep Dive & Key Files

This section provides context on critical files and logic.

### 4.1 On-Chain Programs

- **Location**: `bridge/` (Gorbagana) and `bridge-solana/` (Solana)
- **Framework**: Anchor (Rust)
- **Status**: Source code is present, but deployment status is unknown. The IDL for the Solana bridge was missing and has been recreated (`idl/solana_bridge.json`). You will need to verify these programs are deployed or deploy them yourself.

### 4.2 Critical Services

- **`bridgeService.ts`**: Contains the broken logic for creating bridge orders. This is a top priority to fix.
- **`JunkPusherClient.ts`**: Contains all the Anchor instruction builders for the game. This file is currently **unused** and must be integrated into the game component.
- **`goridService.ts`**: Entirely mocked. Needs to be rewritten to use the actual Gorid SPL name service.
- **`magicEdenService.ts`**: Deprecated and non-functional. Must be replaced or removed.

### 4.3 Brand & Chain Configuration

- **`skills/solgor-dev/SKILL.md`**: Your source of truth for all Gorbagana and Solana chain-specific details, including RPC endpoints, token decimals, and bridge mechanics. **Note**: The user has stated the 9-decimal value in the codebase is correct, and the skill's 6-decimal value is outdated. Trust the codebase for decimal values.
- **`skills/gorbagana-brand/SKILL.md`**: Your guide for all visual and branding requirements. Adherence to this is non-negotiable for the final product.

## 5.0 Next Steps & Execution

1.  **Set up your environment**: Run `npm install` to install all dependencies.
2.  **Begin with Priority 1**: Start by creating the backend server to address the critical security flaws.
3.  **Follow the Roadmap**: Proceed through the tasks outlined in section 3.0 in the specified order.
4.  **Commit Changes**: Make clear, atomic commits for each task completed.
5.  **Ask for Clarification**: If any part of this guide is unclear, do not hesitate to ask for more details.

Your objective is to deliver a secure, fully functional, and well-designed dApp. Good luck.
