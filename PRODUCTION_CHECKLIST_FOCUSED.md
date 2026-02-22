# Trashmarket.fun Production Checklist (DEX & JunkPusher Only)

**Focus:** Finalizing DEX and JunkPusher for production  
**Status:** In Progress  
**Last Updated:** February 22, 2026

---

## 1. DEX / Swap Functionality

### 1.1 Obtain Trashbin Dex IDL/SDK
- [ ] Contact Gorbagana developers for Trashbin Dex CPAMM v4 IDL
- [ ] Verify program ID on Gorbagana mainnet
- [ ] Obtain IDL JSON or TypeScript SDK
- [ ] Store IDL in `idl/trashbin_dex.json`

### 1.2 Implement DEX Swap Transaction Builder
- [ ] Create `buildSwapTransaction()` in `lib/transactionBuilder.ts`
- [ ] Support both GOR (native) and SPL token swaps
- [ ] Include treasury fee routing (0.5% to `77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb`)
- [ ] Handle slippage protection
- [ ] Add proper error handling and validation

### 1.3 Wire DEX UI to Transaction Builder
- [ ] Replace alert in `pages/Dex.tsx` with real transaction flow
- [ ] Integrate `useWallet()` hook from `@solana/wallet-adapter-react`
- [ ] Add loading state during transaction signing/confirmation
- [ ] Implement success/error toast notifications
- [ ] Display transaction signature with link to TrashScan

### 1.4 Test DEX Swap End-to-End
- [ ] Test GOR → Token swap
- [ ] Test Token → GOR swap
- [ ] Verify treasury fee is deducted
- [ ] Verify transaction appears on TrashScan
- [ ] Test slippage protection (reject swap if price impact too high)
- [ ] Test with Backpack wallet
- [ ] Test on mobile (Backpack mobile)

---

## 2. JunkPusher Game Economy

### 2.1 Verify On-Chain Program Deployment
- [ ] Confirm JunkPusher program is deployed to Gorbagana
- [ ] Obtain program ID from deployment
- [ ] Verify program supports all required instructions:
  - [ ] `initialize_game(initialBalance: u64)`
  - [ ] `record_coin_collection(amount: u64)`
  - [ ] `record_score(score: u64)`
  - [ ] `deposit_balance(amount: u64)`
  - [ ] `withdraw_balance(amount: u64)`

### 2.2 Configure Program ID
- [ ] Set `VITE_SOLANA_PROGRAM_ID` in `.env.local`
- [ ] Verify `lib/JunkPusherClient.ts` reads the environment variable
- [ ] Test that program ID is not the placeholder (`11111111111111111111111111111111`)

### 2.3 Verify Token Configuration
- [ ] Confirm JUNK token mint: `BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF`
- [ ] Confirm TRASHCOIN mint: `GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z`
- [ ] Both tokens have 9 decimals
- [ ] Both tokens are deployed on Gorbagana

### 2.4 Test On-Chain Integration
- [ ] Connect wallet with JUNK tokens
- [ ] Start a game and drop coins
- [ ] Verify transaction appears on TrashScan
- [ ] Verify on-chain status shows "ON-CHAIN" (not "LOCAL MODE")
- [ ] Complete a game and verify score is recorded
- [ ] Check that player appears on leaderboard
- [ ] Test deposit/withdrawal of JUNK tokens

### 2.5 Verify Game Balance Management
- [ ] Player can deposit JUNK tokens before playing
- [ ] Game deducts JUNK for each action (if applicable)
- [ ] Player can withdraw remaining balance
- [ ] Balance updates reflect on-chain state

---

## 3. General Production Finalization

### 3.1 Environment Configuration
- [ ] `.env.local` contains all required variables
- [ ] Gorbagana RPC: `https://rpc.trashscan.io`
- [ ] All program IDs are set (not placeholders)
- [ ] All token mints are correct
- [ ] Treasury wallet is correct

### 3.2 Error Handling & UX
- [ ] All transaction failures show user-friendly error messages
- [ ] Toast notifications for success/error/pending states
- [ ] Loading spinners during transaction confirmation
- [ ] Retry logic for failed transactions
- [ ] Proper handling of wallet disconnection

### 3.3 Security & Validation
- [ ] All user inputs are validated before transaction building
- [ ] Minimum order amounts enforced
- [ ] Maximum slippage limits enforced
- [ ] Wallet address validation
- [ ] Token mint validation

### 3.4 Mobile Optimization
- [ ] Test on Backpack mobile wallet
- [ ] Verify UI is readable on small screens
- [ ] Test touch interactions (buttons, modals, etc.)
- [ ] Verify wallet connection works on mobile

### 3.5 Final Testing
- [ ] DEX: Perform 3+ successful swaps
- [ ] JunkPusher: Play 3+ games and verify scores recorded
- [ ] Monitor TrashScan for all transactions
- [ ] Test with different wallet addresses
- [ ] Test with varying transaction amounts

---

## 4. Deployment & Launch

### 4.1 Pre-Launch Checks
- [ ] All code is committed to GitHub
- [ ] No console errors or warnings
- [ ] All environment variables are set
- [ ] Tested on both desktop and mobile

### 4.2 Launch
- [ ] Deploy frontend to production
- [ ] Verify all features work on live site
- [ ] Monitor for errors in first 24 hours
- [ ] Prepare user documentation

---

## Priority Order

1. **Obtain Trashbin Dex IDL** (Blocker for DEX)
2. **Deploy JunkPusher Program** (Blocker for JunkPusher)
3. **Implement DEX Swap Builder** (2-3 hours)
4. **Wire DEX UI** (1 hour)
5. **Configure JunkPusher Program ID** (15 minutes)
6. **Comprehensive Testing** (2-3 hours)
7. **Final Production Push** (30 minutes)

---

**Total Estimated Time:** 8-12 hours (excluding waiting for IDL/program deployment)
