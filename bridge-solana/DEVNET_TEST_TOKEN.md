# Devnet Test Token (sGOR)

## 🎯 Test Token Details

A test SPL token has been created on Solana devnet to simulate sGOR for bridge testing.

**Token Information:**
- **Mint Address:** `5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk`
- **Token Account:** `B7HJE8XsmZmvAAts7yvFoeEuTP2T5LJVg7cMWYVZKtCB`
- **Decimals:** 6 (matching mainnet sGOR)
- **Initial Supply:** 1,000,000 tokens
- **Program:** TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
- **Mint Authority:** `Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ`

**Explorer Links:**
- Token: https://explorer.solana.com/address/5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk?cluster=devnet
- Creation Tx: https://explorer.solana.com/tx/4GicbyVGevj6ZcMnvWsQdjTLXxbJFK8513w7XJ5QZXpK6vVShjWFXLjPK61N9iCSy7ZzYJmSkXpnYCY9SEHiiCts?cluster=devnet

---

## 🧪 How to Get Test Tokens

### Option 1: Mint Directly (If You Have Authority)
If you control the mint authority:
```bash
spl-token mint 5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk <AMOUNT> --url devnet
```

### Option 2: Transfer from Test Account
Request a transfer from the test token account:
```bash
spl-token transfer 5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk <AMOUNT> <YOUR_TOKEN_ACCOUNT> --url devnet --fund-recipient
```

---

## 🔧 Testing the Bridge

### 1. Create Your Token Account
```bash
spl-token create-account 5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk --url devnet
```

### 2. Request Test Tokens
Contact the team to get test sGOR tokens.

### 3. Test Bridge Operations

**Create Order (Lock Test sGOR):**
```typescript
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const programId = new PublicKey('66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M');
const testSgorMint = new PublicKey('5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk');

// Create order locking 1 test sGOR
await program.methods
  .createOrder(
    new BN(1_000_000), // 1 sGOR (6 decimals)
    new BN(expirationSlot),
    gorbaganaRecipient
  )
  .accounts({
    // ... accounts
  })
  .rpc();
```

**Fill Order:**
```typescript
await program.methods
  .fillOrder()
  .accounts({
    // ... accounts
  })
  .rpc();
```

**Cancel Order:**
```typescript
await program.methods
  .cancelOrder()
  .accounts({
    // ... accounts
  })
  .rpc();
```

---

## 📊 Token Comparison

| Property | Mainnet sGOR | Devnet Test sGOR |
|----------|--------------|------------------|
| **Mint** | `71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg` | `5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk` |
| **Decimals** | 6 | 6 ✅ |
| **Network** | Solana Mainnet | Solana Devnet |
| **Supply** | ~999.8M | 1M (test) |
| **Value** | Real | Test only |
| **Mint Authority** | None (immutable) | Active (can mint more) |

---

## ⚠️ Important Notes

1. **Test Tokens Have No Value:** These are devnet tokens for testing only
2. **Different Mint Address:** The devnet mint is different from mainnet
3. **Bridge Program Updated:** The devnet bridge program should accept this test token
4. **Mainnet Testing:** Once mainnet deployment happens, use real sGOR (`71Jvq4...`)

---

## 🔄 Testing Workflow

### Full Bridge Test Flow

1. **Setup Wallets:**
   - Alice: Maker on Solana devnet
   - Bob: Taker on Gorbagana mainnet (or testnet if available)

2. **Alice Creates Order (Solana → Gorbagana):**
   ```bash
   # Alice locks 10 test sGOR on Solana devnet
   spl-token transfer 5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk 10 <ESCROW_ACCOUNT> --url devnet
   ```

3. **Bob Sees Order:**
   - Order appears in bridge UI
   - Shows Alice wants gGOR for her sGOR

4. **Bob Fills Order:**
   - Bob sends gGOR on Gorbagana
   - Bob claims sGOR on Solana devnet
   - Alice receives gGOR notification

5. **Verify:**
   - Check Alice's gGOR balance on Gorbagana
   - Check Bob's test sGOR balance on Solana devnet
   - Verify order is marked as filled

---

## 🛠️ Debugging Tools

**Check Token Balance:**
```bash
spl-token balance 5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk --url devnet
```

**View Token Account:**
```bash
spl-token account-info 5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk --url devnet
```

**Check Program Logs:**
```bash
solana logs 66xqiDYSQZh7A3wyS3n2962Fx1aU8N3nbHjaZUCrXq6M --url devnet
```

**View Transaction:**
```bash
solana confirm <SIGNATURE> --url devnet -v
```

---

## 📞 Need Test Tokens?

Contact the team at:
- Discord: #bridge-testing
- Twitter: @trashmarket_fun
- GitHub: Open an issue

---

## 🚀 Next Steps

1. **Update Bridge Program:** Modify the program to accept test token mint on devnet
2. **Create UI Integration:** Add devnet test token to bridge interface
3. **Test End-to-End:** Complete full bridge flow with test tokens
4. **Document Issues:** Report any bugs or unexpected behavior
5. **Prepare Mainnet:** Once testing is complete, deploy to mainnet with real sGOR

Happy testing! 🧪
