# GorID Tradability Analysis

**Date:** February 22, 2026  
**Status:** ⚠️ **PARTIALLY FUNCTIONAL - INFRASTRUCTURE INCOMPLETE**

---

## Executive Summary

GorID (.gor domain names) **are tradeable in principle**, but the marketplace infrastructure is **incomplete and not production-ready**. The frontend UI is fully built, but it depends on a backend Trading API that appears to be under construction or not fully deployed.

### Current State

**What Works:**
- ✅ GorID Name Service integration (domain resolution, reverse lookup)
- ✅ Frontend marketplace UI (browse, search, buy, sell)
- ✅ Transaction building for purchases (Wrapped GOR transfers)
- ✅ Domain ownership detection via DAS API

**What's Broken:**
- ❌ Trading API endpoints are not responding (or not deployed)
- ❌ Marketplace listings cannot be fetched
- ❌ Recent sales data is not available
- ❌ Domain listing creation fails silently
- ❌ No escrow mechanism for seller protection

---

## 1. GorID Name Service (On-Chain) ✅

### Status: **WORKING**

The GorID Name Service is fully operational on Gorbagana:

**Program ID:** `namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX`  
**RPC Endpoint:** `https://rpc.trashscan.io`  
**TLD:** `.gor`

### Supported Operations

| Operation | Status | Implementation |
|-----------|--------|-----------------|
| Resolve domain name to address | ✅ Working | `resolveGoridName()` in `goridService.ts` |
| Reverse lookup (address → domain) | ✅ Working | `getGoridNameFromAddress()` |
| List all domains owned by wallet | ✅ Working | `getDomainsOwnedBy()` |
| Check domain availability | ✅ Working | `isDomainAvailable()` |
| Domain name validation | ✅ Working | `isValidDomainName()` supports alphanumeric, hyphens, emoji |

### Test Results

The on-chain name service can be tested directly:

```bash
# Resolve a domain
curl -X POST https://rpc.trashscan.io -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX"]}'

# List domains owned by an address
# (Uses @gorid/spl-name-service SDK)
```

---

## 2. Marketplace Infrastructure (Off-Chain) ❌

### Status: **NOT DEPLOYED / INCOMPLETE**

The marketplace depends on a backend Trading API that is not fully operational.

### Architecture

```
Frontend (Trashmarket.fun)
    ↓
Trading API (Backend)
    ├─ GET /trading/listings
    ├─ GET /trading/sales
    ├─ POST /trading/listings (create listing)
    ├─ POST /trading/purchases (confirm purchase)
    └─ DELETE /trading/listings/:id (cancel listing)
    ↓
Escrow Smart Contract (?)
    ├─ Hold domain NFTs during listing
    └─ Release on purchase confirmation
```

### API Endpoints

**Base URL:** `${RPC_ENDPOINTS.GORBAGANA_API}/trading`

The frontend expects these endpoints to exist:

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/listings` | GET | Fetch all active listings | ❌ Not responding |
| `/listings` | POST | Create a new listing | ❌ Not responding |
| `/listings/:id` | DELETE | Cancel a listing | ❌ Not responding |
| `/sales` | GET | Fetch recent sales | ❌ Not responding |
| `/purchases` | POST | Confirm a purchase | ❌ Not responding |

### Current Implementation

In `services/marketplace-service.ts`:

```typescript
const TRADING_API_URL = `${RPC_ENDPOINTS.GORBAGANA_API}/trading`;

export async function fetchListings(): Promise<MarketplaceListing[]> {
  try {
    const response = await fetch(`${TRADING_API_URL}/listings`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.warn('Trading API: listings endpoint returned', response.status);
      return [];  // ← Returns empty array if API fails
    }
    // ...
  } catch (error) {
    console.error('Trading API: Error fetching listings:', error);
    return [];  // ← Silently fails
  }
}
```

**Result:** The marketplace page loads but shows no listings or sales data.

---

## 3. Frontend UI Status

### Current State: ✅ **FULLY BUILT**

The `pages/Gorid.tsx` component includes:

- ✅ Marketplace view (browse listed domains)
- ✅ Activity view (recent sales)
- ✅ My Domains view (owned domains)
- ✅ Domain search
- ✅ Domain lookup (resolve name to address)
- ✅ Buy domain flow
- ✅ List domain for sale flow
- ✅ Fee preview
- ✅ Success/error notifications

### Visual State

The page displays an **"UNDER CONSTRUCTION"** banner:

```
⚠️ UNDER CONSTRUCTION — GorID marketplace integration in progress
```

This is accurate—the marketplace is not production-ready.

---

## 4. Transaction Building ✅

### Status: **READY TO USE (once API is deployed)**

The purchase transaction builder is correctly implemented:

```typescript
export async function buildPurchaseTransaction(
  buyerPubkey: PublicKey,
  listing: MarketplaceListing,
): Promise<Transaction> {
  // 1. Calculate fees
  const priceRaw = humanToTradingAmount(listing.price);
  const fees = calculateFees(priceRaw);

  // 2. Create Wrapped GOR transfer to seller
  transaction.add(
    createTransferInstruction(
      buyerATA,
      sellerATA,
      buyerPubkey,
      fees.sellerReceives,
    )
  );

  // 3. Create fee transfer
  transaction.add(
    createTransferInstruction(
      buyerATA,
      feeATA,
      buyerPubkey,
      fees.platformFee,
    )
  );

  return transaction;
}
```

**Assumptions:**
- Wrapped GOR mint: `TRADING_CONFIG.WRAPPED_GOR_MINT`
- Fee recipient: `TRADING_CONFIG.FEE_RECIPIENT`
- Both are configured in `lib/trading-config.ts`

---

## 5. What's Needed for Production

### Step 1: Deploy the Trading API Backend

The backend must implement these endpoints:

#### `GET /trading/listings`
Returns all active domain listings:
```json
{
  "listings": [
    {
      "id": "listing_123",
      "domainName": "example.gor",
      "domainMint": "NFT_MINT_ADDRESS",
      "seller": "SELLER_ADDRESS",
      "price": 100,
      "priceRaw": "100000000000",
      "listedAt": 1708600000,
      "escrowAccount": "ESCROW_ACCOUNT_ADDRESS"
    }
  ]
}
```

#### `POST /trading/listings`
Create a new listing:
```json
{
  "seller": "SELLER_ADDRESS",
  "domainMint": "NFT_MINT_ADDRESS",
  "domainName": "example.gor",
  "price": 100,
  "priceRaw": "100000000000"
}
```

Response:
```json
{
  "listingId": "listing_123",
  "transaction": "BASE64_ENCODED_TRANSACTION"
}
```

#### `GET /trading/sales`
Returns recent sales:
```json
{
  "sales": [
    {
      "id": "sale_123",
      "domainName": "example.gor",
      "domainMint": "NFT_MINT_ADDRESS",
      "seller": "SELLER_ADDRESS",
      "buyer": "BUYER_ADDRESS",
      "price": 100,
      "timestamp": 1708600000,
      "txSignature": "TRANSACTION_SIGNATURE"
    }
  ]
}
```

#### `POST /trading/purchases`
Confirm a purchase and release domain from escrow:
```json
{
  "listingId": "listing_123",
  "buyer": "BUYER_ADDRESS",
  "txSignature": "TRANSACTION_SIGNATURE"
}
```

### Step 2: Deploy an Escrow Smart Contract

The escrow contract must:
- Accept domain NFTs from sellers
- Hold them during listing
- Release to buyers on purchase confirmation
- Return to sellers on cancellation

**Note:** The current transaction builder assumes the backend handles escrow. If not, a smart contract is required.

### Step 3: Configure Wrapped GOR

Ensure `lib/trading-config.ts` has correct values:

```typescript
export const TRADING_CONFIG = {
  WRAPPED_GOR_MINT: 'WRAPPED_GOR_TOKEN_MINT',  // SPL token mint
  FEE_RECIPIENT: 'TREASURY_WALLET_ADDRESS',     // Fee destination
  MIN_PRICE: 0.1,
  MAX_PRICE: 1000000,
};
```

### Step 4: Test End-to-End

1. Connect wallet with Wrapped GOR tokens
2. List a domain for sale
3. Verify listing appears in marketplace
4. Purchase the domain
5. Verify domain is transferred to buyer
6. Verify fees are collected

---

## 6. DAS API Integration ✅

### Status: **WORKING**

The Digital Asset Standard (DAS) API is used to fetch domain NFT metadata:

```typescript
export async function getDomainAssetsByOwner(ownerAddress: string): Promise<DomainAsset[]> {
  const response = await fetch(DAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAssetsByOwner',
      params: {
        ownerAddress,
        page: 1,
        limit: 1000,
      },
    }),
  });
  // ...
}
```

This correctly fetches:
- Domain name
- NFT mint address
- Owner address
- Domain image/metadata

---

## 7. Summary Table

| Component | Status | Blocker | Fix Time |
|-----------|--------|---------|----------|
| Name Service (on-chain) | ✅ Working | None | — |
| Domain Resolution | ✅ Working | None | — |
| Frontend UI | ✅ Built | None | — |
| Transaction Builder | ✅ Ready | None | — |
| DAS API Integration | ✅ Working | None | — |
| Trading API Backend | ❌ Missing | **YES** | 4-8 hours |
| Escrow Contract | ❓ Unknown | **MAYBE** | 2-4 hours |
| Wrapped GOR Config | ⚠️ Verify | **YES** | 30 minutes |

---

## 8. Recommendation

**GorID is NOT ready for production trading.** The frontend is complete, but the backend infrastructure is missing or not deployed.

### To Enable GorID Trading:

1. **Deploy the Trading API** (priority 1)
2. **Deploy/Verify Escrow Contract** (priority 2)
3. **Configure Wrapped GOR** (priority 3)
4. **Test end-to-end** (priority 4)
5. **Remove "UNDER CONSTRUCTION" banner** (priority 5)

### Estimated Time to Production: **6-12 hours**

---

## Appendix: Key Files

- `pages/Gorid.tsx` — Marketplace UI (853 lines, fully implemented)
- `services/goridService.ts` — Name service integration (269 lines)
- `services/marketplace-service.ts` — Transaction building & API calls (375 lines)
- `lib/trading-config.ts` — Configuration (token mints, fees, etc.)

---

**Report Generated:** February 22, 2026  
**Status:** Awaiting Backend Deployment
