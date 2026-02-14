# Test sGOR Faucet System

A complete faucet system for distributing test sGOR tokens on Solana devnet for bridge testing.

## 🎯 Overview

This faucet system consists of three components:
1. **Frontend UI** - Web interface for users to claim tokens ([/pages/Faucet.tsx](../pages/Faucet.tsx))
2. **API Server** - Backend service for automated distribution ([/faucet-server/](./faucet-server/))
3. **CLI Script** - Manual token distribution tool ([/scripts/faucet-drip.ts](./scripts/faucet-drip.ts))

## 📋 Configuration

**Test Token Details:**
- **Mint:** `5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk`
- **Decimals:** 6
- **Amount per claim:** 5 sGOR
- **Rate limit:** 1 claim per wallet per 24 hours
- **Network:** Solana Devnet only

## 🚀 Quick Start

### Option 1: Run the API Server (Recommended)

The API server provides automated token distribution with built-in rate limiting.

```bash
cd faucet-server

# Install dependencies
npm install

# Set environment variables (optional)
export KEYPAIR_PATH=/path/to/faucet-authority-keypair.json
export RPC_URL=https://api.devnet.solana.com
export PORT=3001

# Start the server
npm start

# Or run in development mode with auto-reload
npm run dev
```

**API Endpoints:**
- `GET /health` - Check server status
- `GET /info` - Get faucet information (balance, rate limits, etc.)
- `GET /can-claim/:wallet` - Check if a wallet can claim
- `POST /claim` - Claim tokens (body: `{ "wallet": "<address>" }`)

**Example API Usage:**
```bash
# Check if wallet can claim
curl http://localhost:3001/can-claim/YourWalletAddressHere

# Claim tokens
curl -X POST http://localhost:3001/claim \
  -H "Content-Type: application/json" \
  -d '{"wallet":"YourWalletAddressHere"}'
```

### Option 2: Manual Distribution via CLI

For manual token distribution (no server required):

```bash
# Install ts-node globally if not already installed
npm install -g ts-node

# Run the script
ts-node scripts/faucet-drip.ts <recipient_wallet_address>

# Example
ts-node scripts/faucet-drip.ts 7YvPGijav52GGidPG8bVKaKXELLAJqLEHV6pDX4o8Mth
```

## 🔧 Frontend Integration

The frontend ([/pages/Faucet.tsx](../pages/Faucet.tsx)) is already integrated into the main app:

### Update Frontend to Use API

To connect the frontend to your API server, update the `handleClaim` function:

```typescript
// In pages/Faucet.tsx, replace the handleClaim function with:

const handleClaim = async () => {
  if (!publicKey) {
    setMessage({ type: 'error', text: 'Please connect your wallet first' });
    return;
  }

  if (!isDevnet) {
    setMessage({ type: 'error', text: 'Faucet only works on Solana Devnet' });
    return;
  }

  if (!canClaim) {
    setMessage({ type: 'error', text: 'You can only claim once every 24 hours' });
    return;
  }

  setClaiming(true);
  setMessage(null);

  try {
    const response = await fetch('http://localhost:3001/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: publicKey.toString() }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to claim tokens');
    }

    setMessage({
      type: 'success',
      text: `Success! 5 sGOR sent. Transaction: ${data.signature}`,
    });

    recordClaim();

  } catch (error: any) {
    setMessage({ type: 'error', text: error.message });
  } finally {
    setClaiming(false);
  }
};
```

## 🔐 Security Considerations

### Faucet Authority Keypair

The faucet requires a Solana keypair with:
- **Mint authority** for the test sGOR token (to mint more if needed)
- **Token balance** to distribute to users

**Setup:**
1. Use the existing faucet authority: `Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ`
2. Or create a new keypair: `solana-keygen new -o faucet-keypair.json`
3. Fund it with test sGOR tokens

### Rate Limiting

**Current Implementation:**
- In-memory storage (Map)
- Resets on server restart

**Production Recommendations:**
- Use Redis for persistent rate limiting
- Add IP-based rate limiting
- Implement CAPTCHA for bot prevention

### Environment Variables

```bash
# .env file for faucet-server
KEYPAIR_PATH=/path/to/faucet-authority.json
RPC_URL=https://api.devnet.solana.com
PORT=3001
```

## 📊 Monitoring

### Check Faucet Balance

```bash
spl-token balance 5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk --url devnet
```

### View Transaction History

```bash
solana transaction-history <FAUCET_AUTHORITY_ADDRESS> --url devnet
```

### Monitor API Server

```bash
# Health check
curl http://localhost:3001/health

# Get faucet info (balance, stats)
curl http://localhost:3001/info
```

## 🐛 Troubleshooting

### "Faucet empty" Error

The faucet token account has run out. Mint more tokens:

```bash
spl-token mint 5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk 1000000 --url devnet
```

### "Rate limit exceeded" Error

User has claimed within the last 24 hours. They must wait.

### Transaction Fails

1. Check devnet is operational: https://status.solana.com
2. Verify RPC endpoint is responding
3. Check faucet authority has SOL for transaction fees:
   ```bash
   solana balance <FAUCET_AUTHORITY> --url devnet
   ```

## 🌐 Deployment

### Deploy API Server

**Option 1: Railway.app**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

**Option 2: Heroku**
```bash
# Create Heroku app
heroku create sgor-faucet

# Set keypair as environment variable (base64 encoded)
heroku config:set KEYPAIR_BASE64=$(cat faucet-keypair.json | base64)

# Deploy
git push heroku main
```

**Option 3: DigitalOcean / AWS / GCP**
- Deploy as a Docker container
- Use PM2 for process management
- Set up Nginx reverse proxy

### Update Frontend API URL

After deploying the server, update the API URL in the frontend:

```typescript
// In pages/Faucet.tsx
const FAUCET_API_URL = 'https://your-faucet-api.com';

// Then use it in fetch calls
fetch(`${FAUCET_API_URL}/claim`, { /* ... */ })
```

## 📝 Alternative: Manual Process

If you don't want to run a server, you can handle faucet requests manually:

1. Users visit `/faucet` page
2. They see instructions to request tokens via Discord/GitHub
3. You run the CLI script manually:
   ```bash
   ts-node scripts/faucet-drip.ts <user_wallet_address>
   ```
4. User receives tokens

This is simpler but requires manual intervention.

## ✅ Testing

### Test the CLI Script
```bash
ts-node scripts/faucet-drip.ts 7YvPGijav52GGidPG8bVKaKXELLAJqLEHV6pDX4o8Mth
```

### Test the API Server
```bash
# Start server
cd faucet-server && npm start

# In another terminal
curl -X POST http://localhost:3001/claim \
  -H "Content-Type: application/json" \
  -d '{"wallet":"7YvPGijav52GGidPG8bVKaKXELLAJqLEHV6pDX4o8Mth"}'
```

### Test the Frontend
1. Switch to Solana Devnet in the UI
2. Navigate to `/faucet`
3. Connect wallet
4. Click "CLAIM 5 TEST sGOR"

## 📚 Related Documentation

- [DEVNET_TESTING.md](./DEVNET_TESTING.md) - Complete devnet testing guide
- [DEVNET_TEST_TOKEN.md](./DEVNET_TEST_TOKEN.md) - Test token information
- [NetworkContext.tsx](../contexts/NetworkContext.tsx) - Network configuration

## 💬 Support

For faucet issues:
- Discord: #bridge-testing
- GitHub: Open an issue
- Twitter: @trashmarket_fun

---

**Status:** ✅ Ready for testing
**Network:** Solana Devnet only
**Faucet mint:** `5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk`
