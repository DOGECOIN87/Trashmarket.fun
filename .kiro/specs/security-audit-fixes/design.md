# Design Document

## Overview

This design addresses 10 critical security vulnerabilities discovered during the comprehensive audit. The fixes are organized by severity and impact, focusing on preventing fund loss, transaction failures, and poor user experience. All fixes follow established patterns already present in the codebase (e.g., parseTransactionError, ref-based guards, localStorageIntegrity).

## Architecture

### Component Organization

```
src/
├── contexts/
│   └── WalletContext.tsx          [FIX: localStorage → localStorageIntegrity]
├── lib/
│   ├── useVanityPayment.ts        [FIX: Add ref guards for deposit/withdraw]
│   └── useJunkPusherOnChain.ts    [FIX: Update confirmTransaction API]
├── services/
│   ├── dexService.ts              [FIX: Add validation, parseTransactionError]
│   └── gorbagioMarketplace.ts     [FIX: Add ATA creation, confirmTransaction API]
├── components/
│   ├── LotteryTickets.tsx         [FIX: parseTransactionError, confirmTransaction API]
│   ├── TrashDAQSwap.tsx           [FIX: Add ref guard, parseTransactionError]
│   └── NFTCard.tsx                [FIX: Image error handling]
├── utils/
│   └── gorbaganaRPC.ts            [FIX: Support modern confirmTransaction API]
└── pages/
    └── Raffle.tsx                 [AUDIT: Verify error handling]
```

### Severity Classification

- **CRITICAL**: Funds at risk, transaction failures causing loss
- **HIGH**: Transaction failures, broken core functionality
- **MEDIUM**: Poor UX, inconsistent error handling
- **LOW**: Cosmetic issues, minor improvements

## Components and Interfaces

### 1. WalletContext.tsx (MEDIUM Severity)

**Issue**: Direct localStorage usage for wallet connection state without integrity checks

**Fix**:
```typescript
// BEFORE
localStorage.setItem('gorbagana_last_wallet', walletType);
localStorage.removeItem('gorbagana_last_wallet');
const lastWallet = localStorage.getItem('gorbagana_last_wallet');

// AFTER
import { setItem, getItem, removeItem } from '../utils/localStorageIntegrity';

setItem('gorbagana_last_wallet', walletType);
removeItem('gorbagana_last_wallet');
const lastWallet = getItem('gorbagana_last_wallet');
```

**Rationale**: Prevents tampering with wallet connection preferences. Uses existing HMAC-based integrity system.

---

### 2. useVanityPayment.ts (CRITICAL Severity)

**Issue**: Missing ref-based guards for deposit/withdraw transactions, allowing double-click vulnerabilities

**Fix**:
```typescript
// Add ref for tracking in-flight transactions
const txInFlightRef = useRef(false);

const deposit = useCallback(async (amountGOR: number): Promise<boolean> => {
  // Guard against double-click
  if (txInFlightRef.current) {
    setError('Transaction already in progress');
    return false;
  }
  
  txInFlightRef.current = true;
  setIsDepositing(true);
  
  try {
    // ... existing deposit logic ...
    return true;
  } finally {
    txInFlightRef.current = false;
    setIsDepositing(false);
  }
}, [/* deps */]);

// Same pattern for withdraw()
```

**Rationale**: Follows the pattern already used in Raffle.tsx and Gorid.tsx. Prevents duplicate transactions from accidental double-clicks.

---

### 3. dexService.ts (HIGH Severity)

**Issue**: 
- Missing input validation for swap parameters
- skipPreflight: true (should be false)
- Raw error.message shown to users
- No validation of mint address format

**Fix**:
```typescript
import { parseTransactionError } from '../utils/errorMessages';

export const executeSwap = async (
  connection: any,
  wallet: any,
  inputMint: string,
  outputMint: string,
  inputAmount: number,
  slippageBps: number = 100,
  expectedOutputAmount: number = 0
): Promise<{ signature: string; success: boolean; error?: string }> => {
  try {
    // VALIDATION BLOCK (NEW)
    if (!wallet.publicKey) {
      return { signature: '', success: false, error: 'Wallet not connected' };
    }

    if (inputAmount <= 0) {
      return { signature: '', success: false, error: 'Invalid input amount' };
    }

    if (slippageBps < 0 || slippageBps > 10000) {
      return { signature: '', success: false, error: 'Invalid slippage tolerance' };
    }

    if (inputMint === outputMint) {
      return { signature: '', success: false, error: 'Cannot swap identical tokens' };
    }

    if (!isValidMintAddress(inputMint) || !isValidMintAddress(outputMint)) {
      return { signature: '', success: false, error: 'Invalid token mint address' };
    }

    // ... existing swap logic ...

    // FIX: Change skipPreflight to false
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,  // CHANGED from true
      maxRetries: 3,
    });

    // FIX: Use modern confirmTransaction API
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    return { signature, success: true };
  } catch (error: any) {
    console.error('Swap execution failed:', error);
    return {
      signature: '',
      success: false,
      error: parseTransactionError(error),  // CHANGED from error.message
    };
  }
};
```

**Rationale**: Prevents common attack vectors (negative amounts, invalid addresses, excessive slippage). Uses parseTransactionError for consistent error formatting.

---

### 4. gorbagioMarketplace.ts (CRITICAL Severity)

**Issue**: 
- Missing ATA creation for buyer when purchasing NFT
- Using deprecated confirmTransaction API
- No check if buyer has sufficient SOL for ATA rent

**Fix**:
```typescript
import { parseTransactionError } from '../utils/errorMessages';

export async function buildBuyTransaction(
  connection: Connection,
  buyerWallet: PublicKey,
  listing: GorbagioListing,
): Promise<Transaction> {
  const sellerPubkey = new PublicKey(listing.seller);
  const mintPubkey = new PublicKey(listing.mintAddress);
  const priceLamports = Math.round(listing.priceSol * LAMPORTS_PER_SOL);

  const marketplaceFee = Math.round((priceLamports * MARKETPLACE_FEE_BPS) / 10000);
  const sellerProceeds = priceLamports - marketplaceFee;

  // FIX: Check buyer balance including ATA rent
  const buyerBalance = await connection.getBalance(buyerWallet);
  const estimatedTxFee = 10000;
  const ataRent = 2039280; // Rent for ATA (NEW)
  const totalRequired = priceLamports + estimatedTxFee + ataRent; // CHANGED
  
  if (buyerBalance < totalRequired) {
    throw new Error(
      `Insufficient SOL. You need ${totalRequired / LAMPORTS_PER_SOL} SOL but have ${buyerBalance / LAMPORTS_PER_SOL} SOL`
    );
  }

  const tx = new Transaction();

  // 1. Pay seller
  tx.add(
    SystemProgram.transfer({
      fromPubkey: buyerWallet,
      toPubkey: sellerPubkey,
      lamports: sellerProceeds,
    }),
  );

  // 2. Pay marketplace fee
  tx.add(
    SystemProgram.transfer({
      fromPubkey: buyerWallet,
      toPubkey: TREASURY_WALLET,
      lamports: marketplaceFee,
    }),
  );

  // 3. FIX: Ensure buyer ATA exists (CRITICAL FIX)
  const buyerAta = await getAssociatedTokenAddress(mintPubkey, buyerWallet);
  try {
    await getAccount(connection, buyerAta);
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError) {
      // Create ATA if it doesn't exist
      tx.add(
        createAssociatedTokenAccountInstruction(
          buyerWallet, // payer
          buyerAta,
          buyerWallet, // owner
          mintPubkey,
        ),
      );
    } else {
      throw err;
    }
  }

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = buyerWallet;

  return tx;
}

export async function executeBuy(
  connection: Connection,
  buyerWallet: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  listing: GorbagioListing,
  currentNetwork?: NetworkType,
): Promise<TradeResult> {
  if (currentNetwork && currentNetwork !== 'SOLANA_MAINNET') {
    return {
      success: false,
      error: 'Please switch to Solana network to trade Gorbagio NFTs.',
    };
  }
  
  try {
    const listingRef = doc(db, LISTINGS_COLLECTION, listing.mintAddress);
    const snap = await getDoc(listingRef);
    if (!snap.exists() || !snap.data().active) {
      return { success: false, error: 'Listing is no longer active' };
    }

    const tx = await buildBuyTransaction(connection, buyerWallet, listing);
    const signed = await signTransaction(tx);

    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    // FIX: Use modern confirmTransaction API
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    await setDoc(
      listingRef,
      {
        active: false,
        soldTo: buyerWallet.toBase58(),
        soldAt: serverTimestamp(),
        txSignature: signature,
      },
      { merge: true },
    );

    return { success: true, signature };
  } catch (err: any) {
    console.error('[GorbagioMarketplace] Buy failed:', err);
    return { 
      success: false, 
      error: parseTransactionError(err)  // CHANGED from err.message
    };
  }
}
```

**Rationale**: This is the same pattern that broke raffles. NFT purchases will fail if the buyer doesn't have an ATA for the NFT mint. This fix prevents transaction failures and fund loss.

---

### 5. LotteryTickets.tsx (MEDIUM Severity)

**Issue**:
- Using deprecated confirmTransaction API
- Raw error.message shown to users
- Feature flag not properly enforced

**Fix**:
```typescript
import { parseTransactionError } from '../utils/errorMessages';

const handleConvert = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // FIX: Enforce feature flag
  if (!IS_FEATURE_ENABLED) {
    setStatus('error');
    setMessage('This feature is temporarily disabled');
    return;
  }
  
  // ... existing validation ...

  try {
    // ... existing transaction building ...

    setMessage('Confirming transaction...');
    const signature = await conn.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    
    // FIX: Use modern confirmTransaction API
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
    await conn.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    setStatus('success');
    setMessage(`Successfully converted ${amount} JUNK!`);
    setAmount('');
    setTimeout(fetchBalances, 3000);
  } catch (err: any) {
    console.error("Transaction failed:", err);
    setStatus('error');
    setMessage(parseTransactionError(err));  // CHANGED from err.message
  }
};
```

**Rationale**: Consistent error handling and proper API usage.

---

### 6. TrashDAQSwap.tsx (HIGH Severity)

**Issue**: Missing ref-based guard for swap transactions, allowing double-click vulnerability

**Fix**:
```typescript
// Add ref at component level
const txInFlightRef = useRef(false);

const handleSwap = async () => {
  if (!state.sellToken || !state.buyToken || !state.sellAmount || !publicKey || !connection) {
    setTxStatus({ status: 'error', message: 'Missing required swap parameters' });
    return;
  }

  // FIX: Add double-click guard
  if (txInFlightRef.current) {
    setTxStatus({ status: 'error', message: 'Transaction already in progress' });
    return;
  }

  const sellAmount = parseFloat(state.sellAmount);
  if (sellAmount <= 0 || sellAmount > state.sellBalance) {
    setTxStatus({ status: 'error', message: 'Insufficient balance for swap' });
    return;
  }

  txInFlightRef.current = true;  // Set guard
  setTxStatus({ status: 'pending', message: 'Processing swap...' });

  try {
    const slippageBps = Math.round(getSlippageValue() * 100);
    const expectedOutput = parseFloat(state.buyAmount);

    const result = await executeSwap(
      connection,
      { publicKey, signTransaction },
      state.sellToken.mint,
      state.buyToken.mint,
      sellAmount,
      slippageBps,
      expectedOutput
    );

    if (result.success) {
      setTxStatus({
        status: 'success',
        message: `Swap successful! Signature: ${result.signature.slice(0, 20)}...`,
        signature: result.signature
      });
      
      setState(prev => ({
        ...prev,
        sellAmount: '',
        buyAmount: '0'
      }));
      
      setTimeout(() => {
        loadTokenBalances();
        setTxStatus({ status: 'idle', message: '' });
      }, 3000);
    } else {
      setTxStatus({
        status: 'error',
        message: result.error || 'Swap failed'
      });
    }
  } catch (error: any) {
    console.error('Swap error:', error);
    setTxStatus({
      status: 'error',
      message: parseTransactionError(error)  // CHANGED from error.message
    });
  } finally {
    txInFlightRef.current = false;  // Release guard
  }
};

// FIX: Update button disabled condition
<button
  onClick={handleSwap}
  disabled={
    !state.sellToken || 
    !state.buyToken || 
    !state.sellAmount || 
    parseFloat(state.sellAmount) <= 0 || 
    !connected || 
    txInFlightRef.current  // ADDED
  }
  className="..."
>
  {!connected ? 'Connect Wallet' : 
   !state.sellToken || !state.buyToken ? 'Select Tokens' : 
   txInFlightRef.current ? 'Processing...' :  // ADDED
   'Swap'}
</button>
```

**Rationale**: Prevents duplicate swap transactions from accidental double-clicks. Follows established pattern.

---

### 7. useJunkPusherOnChain.ts (HIGH Severity)

**Issue**: Using deprecated confirmTransaction API

**Fix**:
```typescript
const sendTx = useCallback(
  async (tx: Transaction, label: TxLabel = ''): Promise<string | null> => {
    if (!publicKey || !signTransaction || !connection) {
      setState((s) => ({ ...s, error: 'Wallet not connected', txStatus: 'error', txLabel: label }));
      return null;
    }

    try {
      setState((s) => ({ ...s, txStatus: 'building', txLabel: label, error: null }));

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setState((s) => ({ ...s, txStatus: 'signing' }));
      const signed = await signTransaction(tx);

      setState((s) => ({ ...s, txStatus: 'confirming' }));
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // FIX: Use modern confirmTransaction API
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      setState((s) => ({
        ...s,
        txStatus: 'confirmed',
        lastTxSignature: signature,
      }));

      setTimeout(() => refreshBalances(), 2000);
      setTimeout(() => {
        setState((s) => ({ ...s, txStatus: 'idle', txLabel: '' }));
      }, 3000);

      return signature;
    } catch (err: any) {
      console.error('[OnChain] Transaction error:', err);
      setState((s) => ({
        ...s,
        txStatus: 'error',
        error: parseTransactionError(err),
      }));
      setTimeout(() => {
        setState((s) => ({ ...s, txStatus: 'idle', txLabel: '' }));
      }, 3000);
      return null;
    }
  },
  [publicKey, signTransaction, connection, refreshBalances],
);
```

**Rationale**: Uses the correct modern API format to prevent confirmation failures.

---

### 8. gorbaganaRPC.ts (MEDIUM Severity)

**Issue**: confirmTransaction only accepts signature string, not modern API format

**Fix**:
```typescript
/**
 * Confirm transaction - supports both legacy and modern API formats
 */
async confirmTransaction(
  signatureOrConfig: string | { signature: string; blockhash: string; lastValidBlockHeight: number },
  timeout: number = 30000
): Promise<boolean> {
  // Extract signature from either format
  const signature = typeof signatureOrConfig === 'string' 
    ? signatureOrConfig 
    : signatureOrConfig.signature;
  
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const result = await this.request<{
        value: { confirmationStatus: string; err: any } | null;
      }>('getSignatureStatuses', [[signature]]);

      if (result.value?.[0]) {
        const status = result.value[0];
        if (status.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
        }
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          return true;
        }
      }
    } catch (error) {
      // Continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Transaction confirmation timeout');
}
```

**Rationale**: Maintains backward compatibility while supporting the modern API format.

---

### 9. NFTCard.tsx (LOW Severity)

**Issue**: No error handling for broken image URLs

**Fix**:
```typescript
<img
  src={nft.image}
  alt={nft.name}
  className={`w-full h-full object-cover transition-all duration-300 ${isSelected ? 'opacity-80 grayscale-0' : 'grayscale group-hover:grayscale-0'}`}
  loading="lazy"
  onError={(e) => {
    // FIX: Add fallback for broken images
    const target = e.target as HTMLImageElement;
    if (target.src !== '/assets/nft-placeholder.png') {
      target.src = '/assets/nft-placeholder.png';
    }
  }}
/>
```

**Rationale**: Prevents broken image icons from displaying. Provides better UX.

---

### 10. Raffle.tsx (AUDIT ONLY)

**Status**: Already fixed in previous audit. Verify error handling is using parseTransactionError.

**Verification**:
- Check that all catch blocks use parseTransactionError
- Verify confirmTransaction uses modern API
- Confirm ATA creation is present in createRaffle

## Data Models

No new data models required. All fixes use existing types and interfaces.

## Error Handling

### Centralized Error Parsing

All transaction errors MUST use `parseTransactionError` from `src/utils/errorMessages.ts`:

```typescript
import { parseTransactionError } from '../utils/errorMessages';

try {
  // ... transaction logic ...
} catch (err: any) {
  const userFriendlyError = parseTransactionError(err);
  // Display userFriendlyError to user
}
```

### Error Display Patterns

1. **Inline banners** for form-related errors (Raffle, Bridge)
2. **Toast notifications** for background operations (Gorid cancel)
3. **Modal alerts** for critical failures (Swap, Marketplace)

## Testing Strategy

### Unit Tests (Optional)

- Test input validation functions in dexService
- Test ref guard behavior in useVanityPayment
- Test confirmTransaction API compatibility in gorbaganaRPC

### Integration Tests (Required)

1. **Double-click prevention**: Rapidly click deposit/withdraw/swap buttons
2. **ATA creation**: Purchase NFT without existing ATA
3. **Error formatting**: Trigger various transaction errors and verify parseTransactionError output
4. **Confirmation API**: Verify transactions confirm successfully with new API format

### Manual Testing Checklist

- [ ] Vanity payment deposit with double-click
- [ ] Vanity payment withdrawal with double-click
- [ ] Swap with invalid inputs (negative amount, invalid address)
- [ ] Swap with double-click
- [ ] Buy Gorbagio NFT without ATA
- [ ] Buy Gorbagio NFT with insufficient SOL
- [ ] Convert JUNK with feature disabled
- [ ] Load NFTs with broken image URLs
- [ ] Create raffle and verify error messages

## Security Considerations

### Input Validation

All user inputs MUST be validated before transaction submission:
- Numeric values: positive, within acceptable ranges
- Addresses: valid base58 format, correct length
- Percentages: 0-100 range
- Token amounts: not exceeding balance

### Transaction Safety

1. **Always use skipPreflight: false** unless there's a documented reason
2. **Always check ATA existence** before token transfers
3. **Always use ref-based guards** for async wallet operations
4. **Always use parseTransactionError** for user-facing errors
5. **Always use modern confirmTransaction API** with blockhash and lastValidBlockHeight

### localStorage Security

All localStorage operations for sensitive data MUST use localStorageIntegrity wrapper to prevent tampering.

## Performance Considerations

- Image loading uses lazy loading (already implemented)
- Balance refreshes are debounced (already implemented)
- Transaction polling uses 1-second intervals (already implemented)

## Deployment Notes

1. Deploy all fixes in a single release to maintain consistency
2. Test on devnet before mainnet deployment
3. Monitor error logs for any new issues after deployment
4. Have rollback plan ready in case of critical issues

## Future Improvements

1. Implement retry logic for failed transactions
2. Add transaction history tracking
3. Implement optimistic UI updates
4. Add comprehensive error logging service
5. Create automated integration test suite
