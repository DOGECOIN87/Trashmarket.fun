# Devnet Testing Guide

## 🎉 Program Deployed Successfully!

**Solana Bridge Program (Devnet)**
- **Program ID:** `66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M`
- **Network:** Solana Devnet
- **Explorer:** https://explorer.solana.com/address/66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M?cluster=devnet
- **Deployment Tx:** https://explorer.solana.com/tx/tLJJ94ZFK35ovEYvu8KvFVQWwgdhufAHXDGhz8CG9CX1D43Us2szNZn9XfFpZhXAeFz43SxvVYvyLpDNoj4qasd?cluster=devnet

---

## 📋 Testing Checklist

### Phase 1: Program Verification ✅

- [x] Program deployed to devnet
- [x] Program ID confirmed: `66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M`
- [x] Program size: 267 KB
- [x] IDL generated successfully

### Phase 2: Test Token Created ✅

A test sGOR token has been created on Solana devnet for bridge testing.

**Test Token Details:**
- **Mint:** `5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk`
- **Decimals:** 6 (matching mainnet sGOR)
- **Supply:** 1,000,000 tokens
- **Explorer:** https://explorer.solana.com/address/5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk?cluster=devnet

See [DEVNET_TEST_TOKEN.md](./DEVNET_TEST_TOKEN.md) for complete details on getting and using test tokens.

**Important:** The deployed program currently expects the mainnet sGOR mint. To test with the devnet token:
1. Update the `SGOR_MINT` constant in `lib.rs` to the test token mint
2. Rebuild and redeploy the program
3. Or test with the mainnet mint address (which won't have tokens on devnet)

### Phase 3: Test Instructions

Once test tokens are created, test each instruction:

#### 1. Test `create_order`
```bash
# Create an order using Anchor CLI
anchor run create-order
```

**Expected behavior:**
- Order PDA created successfully
- Escrow token account initialized
- sGOR tokens transferred to escrow
- `OrderCreated` event emitted

#### 2. Test `fill_order`
```bash
# Fill an existing order
anchor run fill-order
```

**Expected behavior:**
- Order marked as filled
- sGOR released from escrow to taker
- Order account closed
- `OrderFilled` event emitted

#### 3. Test `cancel_order`
```bash
# Cancel an unfilled order
anchor run cancel-order
```

**Expected behavior:**
- sGOR refunded to maker
- Order account closed
- `OrderCancelled` event emitted

### Phase 4: Integration Testing

#### Test Scenario 1: Happy Path
1. Alice creates order selling 10 sGOR for 10 gGOR
2. Bob fills the order
3. Alice receives gGOR on Gorbagana
4. Bob receives sGOR on Solana
5. Order closed successfully

#### Test Scenario 2: Cancellation
1. Alice creates order
2. No taker appears
3. Alice cancels order
4. Receives full refund

#### Test Scenario 3: Expiration
1. Create order with short expiration (e.g., 100 slots)
2. Wait for expiration
3. Attempt to fill (should fail)
4. Cancel and verify refund

### Phase 5: Error Handling

Test all error conditions:
- [x] `InvalidAmount` - Amount below minimum (< 100,000)
- [x] `InvalidMint` - Wrong SPL token mint
- [x] `OrderExpired` - Past expiration slot
- [x] `OrderAlreadyFilled` - Double fill attempt
- [x] `Unauthorized` - Non-maker tries to cancel
- [x] `ExpirationInPast` - Expiration before current slot
- [x] `ExpirationTooFar` - Expiration > 24 hours

---

## 🔧 Testing Tools

### Solana CLI
```bash
# Check program
solana program show 66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M --url devnet

# Watch program logs
solana logs 66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M --url devnet
```

### Anchor CLI
```bash
# Run tests
anchor test --skip-build --skip-deploy

# IDL operations
anchor idl init -f target/idl/solana_bridge.json 66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M
```

### TypeScript SDK (for frontend integration)
```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import IDL from './target/idl/solana_bridge.json';

const connection = new Connection('https://api.devnet.solana.com');
const programId = new PublicKey('66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M');
const program = new Program(IDL, programId, provider);

// Create order example
await program.methods
  .createOrder(
    new BN(1_000_000), // 1 sGOR (6 decimals)
    new BN(expirationSlot),
    gorbaganaRecipient
  )
  .accounts({
    maker: wallet.publicKey,
    // ... other accounts
  })
  .rpc();
```

---

## 🐛 Known Limitations (Devnet)

1. **sGOR Token:** Mainnet sGOR token doesn't exist on devnet
   - **Solution:** Create devnet test token with same decimals (6)

2. **Cross-Chain Testing:** Cannot test actual Gorbagana coordination on devnet
   - **Solution:** Test Solana side in isolation, verify escrow logic

3. **No Gorbagana Devnet:** Gorbagana only has mainnet
   - **Solution:** Test coordination logic separately after mainnet deployment

---

## 📊 Success Metrics

Before proceeding to mainnet, verify:

- ✅ All 3 instructions work correctly
- ✅ All error conditions handled properly
- ✅ PDAs derived correctly
- ✅ Token transfers execute as expected
- ✅ Events emitted with correct data
- ✅ No rent issues or account size problems
- ✅ Gas costs are reasonable

---

## 🚀 Next Steps After Devnet Testing

1. **Update Frontend**
   - Add devnet toggle in UI
   - Connect to devnet program ID
   - Test UI flows end-to-end

2. **Security Review**
   - Review all constraints
   - Check for reentrancy issues
   - Verify PDA derivation security
   - Audit token transfer logic

3. **Prepare Mainnet Deployment**
   - Generate new program keypair
   - Update Anchor.toml to mainnet
   - Fund wallet with ~2 SOL
   - Deploy to mainnet-beta
   - Update frontend with mainnet program ID

4. **Launch Coordination**
   - Deploy coordination service (relayer or HTLC)
   - Update documentation
   - Announce launch
   - Monitor for 48 hours

---

## 📞 Support

**Issues?** Check:
- Devnet RPC: https://api.devnet.solana.com
- Explorer: https://explorer.solana.com?cluster=devnet
- Anchor Docs: https://www.anchor-lang.com
- Solana Docs: https://docs.solana.com

**Found a bug?** Document:
- Error message
- Transaction signature
- Input parameters
- Expected vs actual behavior
