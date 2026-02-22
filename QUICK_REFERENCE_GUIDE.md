# Trashmarket.fun — Quick Reference Guide

**Last Updated:** February 22, 2026

---

## 🚨 Critical Blockers (MUST FIX FIRST)

| # | Feature | Blocker | Status | Action |
|---|---------|---------|--------|--------|
| 1 | DEX | Missing Trashbin IDL | 🔴 BLOCKING | Request from developers or create custom fee router |
| 2 | JunkPusher | Program ID not set | 🔴 BLOCKING | Deploy program or obtain program ID |
| 3 | GorID | Backend API not deployed | 🔴 BLOCKING | Deploy Trading API + escrow contract |

---

## 📋 Quick Checklist

### DEX Swap Execution
```
[ ] Obtain Trashbin Dex IDL
[ ] Implement buildSwapTransaction() in lib/transactionBuilder.ts
[ ] Wire Dex.tsx UI to transaction builder
[ ] Add treasury fee routing (0.5%)
[ ] Test GOR → Token swap
[ ] Test Token → GOR swap
[ ] Verify fees on TrashScan
```

### JunkPusher Game
```
[ ] Confirm program deployed to Gorbagana
[ ] Get program ID
[ ] Set VITE_SOLANA_PROGRAM_ID in .env.local
[ ] Verify JUNK token: BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF
[ ] Verify TRASHCOIN token: GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z
[ ] Play game and verify on-chain transaction
[ ] Check leaderboard population
```

### GorID Marketplace
```
[ ] Deploy Trading API backend (5 endpoints)
[ ] Deploy escrow smart contract
[ ] Configure Wrapped GOR token
[ ] Test domain listing
[ ] Test domain purchase
[ ] Verify fees collected
[ ] Remove "UNDER CONSTRUCTION" banner
```

---

## 🔧 Key Files to Modify

### DEX
- `lib/transactionBuilder.ts` — Add `buildSwapTransaction()`
- `pages/Dex.tsx` — Replace alert with real transaction flow

### JunkPusher
- `.env.local` — Set `VITE_SOLANA_PROGRAM_ID`
- `lib/tokenConfig.ts` — Verify token mints

### GorID
- `lib/trading-config.ts` — Configure Wrapped GOR
- `.env.local` — Set API endpoints

---

## 🌐 Environment Variables

```bash
# REQUIRED - DEX
VITE_TREASURY_WALLET=77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb

# REQUIRED - JunkPusher
VITE_SOLANA_PROGRAM_ID=<program_id>

# REQUIRED - GorID
VITE_WRAPPED_GOR_MINT=<wrapped_gor_mint>
VITE_FEE_RECIPIENT=<treasury_wallet>

# OPTIONAL - RPC Endpoints
VITE_GORBAGANA_RPC=https://rpc.trashscan.io
```

---

## 📊 Token Configuration

### JUNK Token
- **Mint:** `BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF`
- **Decimals:** 9
- **Chain:** Gorbagana
- **Use:** JunkPusher game deposits

### TRASHCOIN Token
- **Mint:** `GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z`
- **Decimals:** 9
- **Chain:** Gorbagana
- **Use:** JunkPusher game rewards

### Wrapped GOR Token
- **Mint:** `<TO BE CONFIGURED>`
- **Decimals:** 9
- **Chain:** Gorbagana
- **Use:** GorID marketplace payments

---

## 🎯 Program IDs

### GorID Name Service
- **Program ID:** `namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX`
- **Status:** ✅ Deployed on Gorbagana
- **Use:** Domain resolution, reverse lookup

### JunkPusher
- **Program ID:** `<TO BE OBTAINED>`
- **Status:** ❓ Unknown
- **Use:** Game on-chain state

### Trashbin Dex
- **Program ID:** `<TO BE OBTAINED>`
- **Status:** ❓ Unknown
- **Use:** Token swaps

### Gorbagana Bridge
- **Program ID:** `FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq`
- **Status:** ✅ Deployed (SKIPPED)
- **Use:** Cross-chain trading (deferred)

---

## 🧪 Testing Commands

### Test DEX Swap
```bash
# 1. Connect wallet
# 2. Enter swap amount
# 3. Click "EXECUTE_SWAP"
# 4. Sign transaction
# 5. Verify on TrashScan
```

### Test JunkPusher
```bash
# 1. Connect wallet with JUNK tokens
# 2. Click "PLAY GAME"
# 3. Drop coins and complete game
# 4. Verify transaction on TrashScan
# 5. Check leaderboard
```

### Test GorID
```bash
# 1. Connect wallet with Wrapped GOR
# 2. Search for domain
# 3. Click "BUY"
# 4. Sign transaction
# 5. Verify domain transferred
# 6. Check fees collected
```

---

## 📱 Mobile Testing

- Test on Backpack mobile wallet
- Test on Privy wallet
- Verify UI is readable on small screens
- Test touch interactions

---

## 🚀 Deployment Checklist

```
[ ] All code committed to GitHub
[ ] No console errors or warnings
[ ] All environment variables set
[ ] Tested on desktop and mobile
[ ] DEX: 3+ successful swaps
[ ] JunkPusher: 3+ games with on-chain scores
[ ] GorID: 3+ domain purchases
[ ] Monitor TrashScan for all transactions
[ ] Ready for production deployment
```

---

## 📚 Documentation Files

| File | Purpose | Size |
|------|---------|------|
| `MASTER_PRODUCTION_SUMMARY.md` | **START HERE** - Overview of all blockers | 690 lines |
| `PRODUCTION_READINESS_REPORT.md` | Detailed analysis of each feature | 426 lines |
| `PRODUCTION_CHECKLIST_FOCUSED.md` | Step-by-step implementation checklist | 148 lines |
| `GORID_TRADABILITY_ANALYSIS.md` | GorID marketplace deep dive | 388 lines |
| `QUICK_REFERENCE_GUIDE.md` | This file - Quick lookup | — |

---

## 🔗 Important Links

- **Gorbagana RPC:** https://rpc.trashscan.io
- **TrashScan Explorer:** https://trashscan.io
- **GorID Website:** https://gorid.com
- **Solana Docs:** https://docs.solana.com
- **Anchor Docs:** https://www.anchor-lang.com

---

## 💡 Tips

1. **Always test on Devnet first** before mainnet deployment
2. **Use TrashScan** to verify all transactions
3. **Monitor gas fees** - Gorbagana uses GOR for fees
4. **Keep private keys secure** - Never commit `.env` files
5. **Test error cases** - Network failures, insufficient balance, etc.

---

## ❓ FAQ

**Q: Can I deploy DEX without Trashbin IDL?**  
A: Yes, create a custom fee router contract instead.

**Q: Can I deploy JunkPusher without the program?**  
A: No, the program must be deployed first.

**Q: Can I deploy GorID without the backend API?**  
A: No, the Trading API must be deployed first.

**Q: How long to production?**  
A: 8-16 hours once all dependencies are obtained.

**Q: What if something breaks?**  
A: Check TrashScan for transaction details, review error logs, test on testnet first.

---

**Last Updated:** February 22, 2026  
**Status:** Ready for Implementation
