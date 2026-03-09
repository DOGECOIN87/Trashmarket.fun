# Trashmarket.fun Production Readiness Report

**Date:** February 22, 2026  
**Status:** ⚠️ **CRITICAL BLOCKERS IDENTIFIED**  
**Reviewed By:** Manus AI Agent

---

## Executive Summary

The Trashmarket.fun dApp is a sophisticated multi-feature application built on Gorbagana (Solana-compatible L2). While the frontend architecture is sound and the UI is well-structured, **three critical features are incomplete and require immediate attention before production deployment:**

1. **DEX Swap Execution** — Currently a read-only UI; no actual swap transactions are executed
2. **JunkPusher Game Economy** — Partially integrated; on-chain program ID is not configured
3. **Gorbagana-Solana Bridge** — Contains critical bugs in transaction building logic

This report details each blocker, root causes, and the exact steps required to resolve them.

---

## 1. DEX / Swap Functionality

### Current State

The DEX page (`pages/Dex.tsx`) successfully:
- Fetches real-time token prices and market data from `gorapi.trashscan.io`
- Calculates swap estimates using the constant product formula (CPAMM)
- Displays pool information, slippage settings, and price impact warnings
- Provides a polished, brutalist UI with token selector modal

**The Problem:** When users click "EXECUTE_SWAP", the app only shows an alert:
```javascript
alert('Swap execution requires wallet connection. Connect via Backpack or Gorbag Wallet.');
```

No actual transaction is built or sent to the blockchain.

### Root Cause Analysis

The codebase lacks the **Anchor IDL (Interface Definition Language)** or SDK for the "Trashbin Dex CPAMM v4" program. Without this, the frontend cannot:
- Know the program's instruction discriminators
- Construct properly-formatted swap instructions
- Include the treasury fee routing logic

**Current State of Transaction Building:**
- `lib/transactionBuilder.ts` exists but is incomplete (only has game-related functions)
- `services/dexService.ts` has `calculateSwapEstimate()` but no `buildSwapTransaction()`
- No integration with wallet adapter for signing/sending

### What's Needed

#### Step 1: Obtain the Trashbin Dex IDL
**Action:** Contact the developers who deployed the "Trashbin Dex CPAMM v4" program and request:
- The program's public key on Gorbagana
- The Anchor IDL (JSON file)
- Or: A TypeScript SDK for swap operations

**Alternative:** If the IDL cannot be obtained, a custom "Fee Router" smart contract must be written in Rust and deployed to Gorbagana.

#### Step 2: Implement DEX Swap Transaction Builder
Once the IDL is available, implement the following in `lib/transactionBuilder.ts`:

```typescript
export async function buildSwapTransaction(
  payerAddress: PublicKey,
  payTokenMint: PublicKey,
  receiveTokenMint: PublicKey,
  payAmount: number,
  minReceiveAmount: number,
  treasuryWallet: PublicKey,
  treasuryFeePercent: number = 0.5 // 0.5% fee
): Promise<Transaction> {
  // 1. Build the AMM swap instruction using the Trashbin IDL
  // 2. Add a transfer instruction for the treasury fee
  // 3. Return the signed transaction
}
```

#### Step 3: Wire Swap UI to Transaction Builder
In `pages/Dex.tsx`, replace the alert with:

```typescript
const handleExecuteSwap = async () => {
  if (!wallet.connected || !payAmount || !receiveAmount) return;
  
  try {
    const tx = await buildSwapTransaction(
      wallet.publicKey,
      payToken.mint,
      receiveToken.mint,
      parseFloat(payAmount),
      parseFloat(receiveAmount) * (1 - slippage / 100),
      TREASURY_WALLET,
      0.5
    );
    
    const signed = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(signature);
    
    // Show success toast
    toast.success(`Swap confirmed: ${signature}`);
  } catch (err) {
    toast.error(`Swap failed: ${err.message}`);
  }
};
```

#### Step 4: Add Treasury Fee Logic
The treasury fee should be deducted from the output amount and sent to `77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb`.

---

## 2. JunkPusher Game Economy

### Current State

The JunkPusher game is a 3D physics-based arcade game where players:
- Drop coins using JUNK tokens
- Compete on leaderboards
- Win TRASHCOIN rewards

**What's Working:**
- Game engine is fully implemented (`lib/GameEngine.ts`)
- On-chain transaction builders exist (`lib/JunkPusherClient.ts`)
- Token balance fetching works (`lib/tokenService.ts`)
- React integration is solid (`components/junk-pusher/JunkPusherGame.tsx`)

**What's Broken:**
- The program ID is set to a placeholder: `11111111111111111111111111111111`
- Without a valid program ID, all on-chain transactions fail silently
- Game operates in "LOCAL MODE" instead of "ON-CHAIN MODE"

### Root Cause Analysis

In `lib/JunkPusherClient.ts`:

```typescript
function getProgramId(): PublicKey {
  const envProgramId = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_SOLANA_PROGRAM_ID
    : undefined;

  if (!envProgramId || envProgramId === '11111111111111111111111111111111') {
    console.warn('[JunkPusherClient] Using placeholder Program ID...');
  }

  return new PublicKey(envProgramId || '11111111111111111111111111111111');
}
```

The environment variable `VITE_SOLANA_PROGRAM_ID` is not set, so the client defaults to the placeholder.

### What's Needed

#### Step 1: Deploy the JunkPusher Program
**Action:** Deploy the on-chain JunkPusher program to Gorbagana.

The program should support these instructions:
- `initialize_game(initialBalance: u64)` — Create a new game session
- `record_coin_collection(amount: u64)` — Record coins collected
- `record_score(score: u64)` — Record final score
- `deposit_balance(amount: u64)` — Deposit JUNK tokens
- `withdraw_balance(amount: u64)` — Withdraw JUNK tokens

**Note:** The transaction builders in `JunkPusherClient.ts` are already written to match this interface.

#### Step 2: Set the Program ID
Once deployed, set the program ID in `.env.local`:

```bash
VITE_SOLANA_PROGRAM_ID=<deployed_program_id>
```

#### Step 3: Verify Token Configuration
Ensure the token configuration in `lib/tokenConfig.ts` is correct:

```typescript
export const TOKEN_CONFIG = {
  JUNK: {
    address: 'BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF', // ✅ Correct
    decimals: 9,
  },
  TRASHCOIN: {
    address: 'GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z', // ✅ Correct
    decimals: 9,
  },
};
```

#### Step 4: Test On-Chain Integration
Once the program is deployed and the ID is set:

1. Connect a wallet with JUNK tokens
2. Start a game and drop coins
3. Verify the transaction appears on TrashScan
4. Check that the on-chain status indicator shows "ON-CHAIN" (not "LOCAL MODE")

---

## 3. Gorbagana-Solana Bridge

### Current State

The bridge is designed to enable trustless P2P trading between Gorbagana (gGOR native) and Solana (sGOR SPL token). Two Anchor programs exist:

- **Gorbagana Program:** `FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq` (Mainnet) ✅ Deployed
- **Solana Program:** `66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M` (Devnet) 🧪 Testing

The IDLs are present and the transaction builders are implemented. **However, the frontend integration has critical bugs.**

### Root Cause Analysis

In `services/bridgeService.ts`, the `createOrderSGOR` function has a parameter mismatch:

**Line 122 (Devnet/Solana):**
```typescript
.createOrder(amountBN, new BN(expirationSlot), gorRecipient)  // 3 args
```

**Line 135 (Mainnet/Gorbagana):**
```typescript
.createOrder(amountBN, 0, new BN(expirationSlot))  // 3 args (direction=0)
```

**The Gorbagana IDL expects:**
```json
"args": [
  { "name": "amount", "type": "u64" },
  { "name": "expiration_slot", "type": "u64" },
  { "name": "gorbagana_recipient", "type": "pubkey" }
]
```

**The Solana IDL expects:**
```json
"args": [
  { "name": "amount", "type": "u64" },
  { "name": "expiration_slot", "type": "u64" },
  { "name": "gorbagana_recipient", "type": "pubkey" }
]
```

Both are identical, but the Gorbagana code is passing the wrong argument order.

Additionally, in `fillOrder()` (line 219), placeholder accounts are passed:

```typescript
const accounts: any = {
  taker: wallet.publicKey,
  maker: order.maker,
  order: orderPDA,
  tokenProgram: TOKEN_PROGRAM_ID,
  systemProgram: SystemProgram.programId,
  escrowTokenAccount: orderPDA,        // ❌ Wrong! Should be derived PDA
  takerTokenAccount: wallet.publicKey, // ❌ Wrong! Should be ATA
  takerReceiveTokenAccount: wallet.publicKey, // ❌ Wrong! Should be ATA
  makerReceiveTokenAccount: order.maker, // ❌ Wrong! Should be ATA
};
```

### What's Needed

#### Step 1: Fix `createOrderSGOR` Parameter Order
In `services/bridgeService.ts` line 134-146, correct the Gorbagana branch:

```typescript
: await currentProgram.methods
    .createOrder(amountBN, new BN(expirationSlot), gorRecipient)  // ✅ Correct order
    .accounts({
      maker: wallet.publicKey,
      order: orderPDA,
      escrowTokenAccount: escrowPDA,
      makerTokenAccount: makerATA,
      sgorMint: SGOR_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .transaction();
```

#### Step 2: Fix `fillOrder` Account Derivation
Replace the placeholder accounts with properly derived PDAs and ATAs:

```typescript
if (order.direction === 0) {
  // Direction 0: Maker sold sGOR. Taker sends gGOR (native), receives sGOR (SPL)
  const escrowPDA = PublicKey.findProgramAddressSync(
    [
      Buffer.from('escrow'),
      order.maker.toBuffer(),
      order.amount.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID
  )[0];

  const takerReceiveATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
  
  accounts.escrowTokenAccount = escrowPDA;
  accounts.takerReceiveTokenAccount = takerReceiveATA;
} else {
  // Direction 1: Maker sold gGOR. Taker sends sGOR (SPL), receives gGOR (native)
  const takerATA = await getAssociatedTokenAddress(SGOR_MINT, wallet.publicKey);
  const makerReceiveATA = await getAssociatedTokenAddress(SGOR_MINT, order.maker);
  
  accounts.takerTokenAccount = takerATA;
  accounts.makerReceiveTokenAccount = makerReceiveATA;
}
```

#### Step 3: Deploy Solana Program to Mainnet
The Solana-side program is currently on Devnet. To go production:

1. Follow the deployment guide in `bridge-solana/DEPLOYMENT_GUIDE.md`
2. Deploy to Solana Mainnet (costs ~2 SOL)
3. Update the program ID in `AnchorContext.tsx` and `bridgeService.ts`

#### Step 4: Implement Bridge UI Feedback
Add loading states and error handling to `pages/Bridge.tsx`:

```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleCreateOrder = async () => {
  try {
    setIsLoading(true);
    setError(null);
    const result = await createOrderGGOR(amount, expirationSlot);
    toast.success(`Order created: ${result.orderPDA.toBase58()}`);
  } catch (err: any) {
    setError(err.message);
    toast.error(err.message);
  } finally {
    setIsLoading(false);
  }
};
```

---

## 4. General Production Finalization

### Environment Configuration

Ensure the `.env.local` file contains:

```bash
# Gorbagana RPC
VITE_GORBAGANA_RPC=https://rpc.trashscan.io

# Solana RPC
VITE_SOLANA_RPC=https://api.mainnet-beta.solana.com

# Program IDs
VITE_SOLANA_PROGRAM_ID=<junk_pusher_program_id>
VITE_GORBAGANA_BRIDGE_PROGRAM_ID=FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq
VITE_SOLANA_BRIDGE_PROGRAM_ID=<solana_program_id_mainnet>

# Token Mints
VITE_JUNK_MINT=BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF
VITE_TRASHCOIN_MINT=GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z
VITE_SGOR_MINT=71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg

# Treasury
VITE_TREASURY_WALLET=77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb
```

### Security Checklist

- [ ] Review `BRIDGE_SECURITY.md` for escrow logic soundness
- [ ] Verify all token mints are correct on both chains
- [ ] Test with small amounts before going live
- [ ] Ensure wallet connections use Backpack (primary) and Privy (fallback)
- [ ] Implement rate limiting on bridge orders to prevent spam

### Testing Checklist

- [ ] DEX: Swap 0.1 GOR for a token and verify fee routing
- [ ] JunkPusher: Play a game and verify score is recorded on-chain
- [ ] Bridge: Create a gGOR→sGOR order and fill it
- [ ] Mobile: Test all features on Backpack mobile wallet

---

## Summary of Critical Blockers

| Feature | Blocker | Severity | Fix Time |
|---------|---------|----------|----------|
| DEX Swap | Missing Trashbin IDL | 🔴 Critical | 2-4 hours |
| JunkPusher | Program ID not deployed | 🔴 Critical | 1-2 hours |
| Bridge | Account derivation bugs | 🔴 Critical | 1 hour |
| Bridge | Solana program on Devnet | 🟠 High | 2-3 hours |

---

## Next Steps (Priority Order)

1. **Obtain Trashbin Dex IDL** — Contact developers or write custom fee router
2. **Deploy JunkPusher Program** — Use Anchor CLI to deploy to Gorbagana
3. **Fix Bridge Account Logic** — Apply fixes to `bridgeService.ts`
4. **Deploy Solana Bridge to Mainnet** — Follow deployment guide
5. **Comprehensive Testing** — Test all three features end-to-end
6. **Security Audit** — Review escrow logic and transaction building

---

## Appendix: File References

**Key Files to Modify:**
- `lib/transactionBuilder.ts` — Add DEX swap builder
- `pages/Dex.tsx` — Wire swap UI to transaction builder
- `services/bridgeService.ts` — Fix account derivation
- `lib/JunkPusherClient.ts` — Verify program ID configuration
- `.env.local` — Set all environment variables

**Key Files to Review:**
- `BRIDGE_SECURITY.md` — Security model
- `bridge/programs/bridge/src/lib.rs` — Gorbagana bridge program
- `bridge-solana/programs/bridge/src/lib.rs` — Solana bridge program (if exists)

---

**Report Generated:** February 22, 2026  
**Status:** Ready for Developer Action
