# ☁️ CLOUDFLARE COMPLETE SETUP GUIDE

**Purpose**: Complete guide to set up Cloudflare for Trashmarket.fun with Coin-Pusha integration  
**Includes**: DNS, Security Headers, Bot Protection (Turnstile), Rate Limiting, CDN, and Deployment  
**Target Domain**: trashmarket.fun

---

## 📚 TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Cloudflare Account Setup](#cloudflare-account-setup)
3. [Domain Configuration](#domain-configuration)
4. [DNS Setup](#dns-setup)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Security Headers](#security-headers)
7. [Turnstile Bot Protection](#turnstile-bot-protection)
8. [Rate Limiting](#rate-limiting)
9. [Page Rules & Caching](#page-rules--caching)
10. [Cloudflare Pages Deployment](#cloudflare-pages-deployment)
11. [Workers for Advanced Features](#workers-for-advanced-features)
12. [Verification & Testing](#verification--testing)
13. [Troubleshooting](#troubleshooting)

---

## 1. PREREQUISITES

Before starting, ensure you have:

- [ ] Domain name: `trashmarket.fun` (registered and accessible)
- [ ] Access to domain registrar (to change nameservers)
- [ ] Cloudflare account (free tier is sufficient)
- [ ] GitHub repository with built site
- [ ] Credit card (optional, for paid features)

---

## 2. CLOUDFLARE ACCOUNT SETUP

### Step 2.1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Enter email address and create password
3. Verify email address
4. Log in to Cloudflare dashboard

### Step 2.2: Add Your Site

1. Click **"Add a Site"** button
2. Enter domain: `trashmarket.fun`
3. Click **"Add site"**
4. Select plan: **Free** (sufficient for most needs)
5. Click **"Continue"**

### Step 2.3: Review DNS Records

Cloudflare will scan your existing DNS records.

1. Review the detected records
2. Ensure all important records are listed
3. Click **"Continue"**

---

## 3. DOMAIN CONFIGURATION

### Step 3.1: Update Nameservers

Cloudflare will provide two nameservers (example):
```
ava.ns.cloudflare.com
bob.ns.cloudflare.com
```

**Update nameservers at your domain registrar**:

1. Log in to your domain registrar (e.g., Namecheap, GoDaddy, Google Domains)
2. Find DNS/Nameserver settings for `trashmarket.fun`
3. Replace existing nameservers with Cloudflare's nameservers
4. Save changes

**Note**: DNS propagation can take 24-48 hours, but usually completes in 1-2 hours.

### Step 3.2: Verify Nameserver Change

1. Wait for Cloudflare to detect the change (check email)
2. Or manually check: Click **"Check nameservers"** in Cloudflare dashboard
3. Status should change to **"Active"**

---

## 4. DNS SETUP

### Step 4.1: Configure DNS Records

Navigate to **DNS** → **Records** in Cloudflare dashboard.

**Required records for GitHub Pages deployment**:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | @ | 185.199.108.153 | Proxied (orange cloud) | Auto |
| A | @ | 185.199.109.153 | Proxied (orange cloud) | Auto |
| A | @ | 185.199.110.153 | Proxied (orange cloud) | Auto |
| A | @ | 185.199.111.153 | Proxied (orange cloud) | Auto |
| CNAME | www | trashmarket.fun | Proxied (orange cloud) | Auto |

**Note**: These are GitHub Pages IP addresses. If deploying to Cloudflare Pages, different setup is needed (see Step 10).

### Step 4.2: Add CNAME for GitHub Pages

If using GitHub Pages with custom domain:

1. Create file `CNAME` in your repository root (already exists)
2. Content should be: `trashmarket.fun`
3. Commit and push to GitHub

### Step 4.3: Configure GitHub Pages

In GitHub repository settings:

1. Go to **Settings** → **Pages**
2. Under **Custom domain**, enter: `trashmarket.fun`
3. Check **"Enforce HTTPS"**
4. Save

---

## 5. SSL/TLS CONFIGURATION

### Step 5.1: SSL/TLS Encryption Mode

Navigate to **SSL/TLS** → **Overview**

**Select encryption mode**: **Full (strict)**

- ✅ Recommended for GitHub Pages
- Ensures end-to-end encryption
- Requires valid SSL certificate on origin server (GitHub provides this)

### Step 5.2: Enable Always Use HTTPS

Navigate to **SSL/TLS** → **Edge Certificates**

1. Toggle **"Always Use HTTPS"** to **ON**
2. This redirects all HTTP requests to HTTPS

### Step 5.3: Enable HSTS (HTTP Strict Transport Security)

Still in **Edge Certificates**:

1. Scroll to **"HTTP Strict Transport Security (HSTS)"**
2. Click **"Enable HSTS"**
3. Configure settings:
   - **Max Age**: 6 months (15768000 seconds)
   - **Include subdomains**: ON
   - **Preload**: ON (optional, for maximum security)
4. Click **"Save"**

**Warning**: HSTS is irreversible for the specified duration. Only enable if you're sure HTTPS will always work.

### Step 5.4: Minimum TLS Version

Navigate to **SSL/TLS** → **Edge Certificates**

1. Set **Minimum TLS Version** to **TLS 1.2** (or TLS 1.3 for better security)
2. This ensures older, insecure protocols are not used

---

## 6. SECURITY HEADERS

### Step 6.1: Create Transform Rules for Headers

Navigate to **Rules** → **Transform Rules** → **Modify Response Header**

Click **"Create rule"**

**Rule 1: Global Security Headers**

- **Rule name**: `Global Security Headers`
- **When incoming requests match**: `All incoming requests`
- **Then**: Set dynamic (multiple headers)

Add these headers:

| Header Name | Value |
|-------------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=() |

Click **"Deploy"**

---

**Rule 2: Content Security Policy (CSP)**

Click **"Create rule"** again

- **Rule name**: `Content Security Policy`
- **When incoming requests match**: `All incoming requests`
- **Then**: Set static

| Header Name | Value |
|-------------|-------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.privy.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https://rpc.trashscan.io https://gorapi.trashscan.io wss://rpc.trashscan.io https://*.privy.io https://*.cloudflare.com; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none';` |

**Note**: This CSP allows Web3 wallet connections and Cloudflare services. Adjust as needed.

Click **"Deploy"**

---

**Rule 3: Coin-Pusha Specific Headers**

Click **"Create rule"** again

- **Rule name**: `Coin-Pusha No-Cache Headers`
- **When incoming requests match**: 
  - Field: `URI Path`
  - Operator: `starts with`
  - Value: `/coin-pusha`
- **Then**: Set static

| Header Name | Value |
|-------------|-------|
| Cache-Control | no-cache, no-store, must-revalidate |
| Pragma | no-cache |
| Expires | 0 |

Click **"Deploy"**

---

### Step 6.2: Alternative - Using _headers File (For Cloudflare Pages)

If deploying to Cloudflare Pages, create `public/_headers` file:

```
# Global Security Headers
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.privy.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' https://rpc.trashscan.io https://gorapi.trashscan.io wss://rpc.trashscan.io https://*.privy.io; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:;

# Coin-Pusha Game - No Cache
/coin-pusha/*
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

# API Endpoints - No Cache
/api/*
  Cache-Control: no-store
  X-Content-Type-Options: nosniff
```

**Commit this file**:
```bash
cd /home/ubuntu/Trashmarket.fun
git add public/_headers
git commit -m "feat: Add Cloudflare security headers configuration"
git push origin feature/coin-pusha-integration
```

---

## 7. TURNSTILE BOT PROTECTION

### Step 7.1: Create Turnstile Site

Navigate to **Turnstile** in Cloudflare dashboard (left sidebar)

1. Click **"Add site"**
2. **Site name**: `Trashmarket Coin-Pusha`
3. **Domain**: `trashmarket.fun`
4. **Widget Mode**: `Managed` (recommended)
5. Click **"Create"**

### Step 7.2: Get Site Key and Secret Key

After creation, you'll see:
- **Site Key** (public, goes in frontend code)
- **Secret Key** (private, for server-side verification)

**Copy these keys** - you'll need them.

### Step 7.3: Add Site Key to Environment Variables

**Update `.env.local`**:
```bash
cd /home/ubuntu/Trashmarket.fun
```

Edit `.env.local`:
```env
VITE_CLOUDFLARE_TURNSTILE_SITE_KEY=your_actual_site_key_here
```

**Update `.env.example`** (for documentation):
```env
VITE_CLOUDFLARE_TURNSTILE_SITE_KEY=your_turnstile_site_key_here
```

### Step 7.4: Install Turnstile Package

```bash
cd /home/ubuntu/Trashmarket.fun
npm install @marsidev/react-turnstile --save
```

### Step 7.5: Create Turnstile Component

**Create**: `src/components/security/TurnstileWidget.tsx`

```typescript
import { Turnstile } from '@marsidev/react-turnstile';
import { useState } from 'react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
}

export function TurnstileWidget({ onVerify, onError }: TurnstileWidgetProps) {
  const [error, setError] = useState<string | null>(null);
  const siteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    console.warn('Turnstile site key not configured');
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Turnstile
        siteKey={siteKey}
        onSuccess={(token) => {
          setError(null);
          onVerify(token);
        }}
        onError={() => {
          setError('Verification failed. Please try again.');
          onError?.();
        }}
        onExpire={() => {
          setError('Verification expired. Please verify again.');
          onError?.();
        }}
        options={{
          theme: 'dark',
          size: 'normal',
          action: 'coin-pusha-game',
          retry: 'auto',
        }}
      />
      {error && (
        <p className="text-red-400 text-sm font-mono">{error}</p>
      )}
    </div>
  );
}
```

### Step 7.6: Integrate Turnstile into Game Page

**Option A: Require verification before game loads**

Edit `src/pages/coin-pusha/CoinPushaPage.tsx`:

```typescript
import { Suspense, lazy, useState } from 'react';
import { TurnstileWidget } from '../../components/security/TurnstileWidget';

const CoinPushaGame = lazy(() => import('../../components/coin-pusha/game/CoinPushaGame'));

export default function CoinPushaPage() {
  const [isVerified, setIsVerified] = useState(false);

  const handleVerify = (token: string) => {
    console.log('Turnstile verified:', token);
    setIsVerified(true);
  };

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-green-400 mb-4 font-mono">
            🎮 COIN PUSHA
          </h1>
          <p className="text-gray-400 mb-8 font-mono">
            Verify you're human to play
          </p>
          <TurnstileWidget onVerify={handleVerify} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-green-400 text-lg font-bold">Loading Coin Pusha...</p>
          </div>
        </div>
      }>
        <CoinPushaGame />
      </Suspense>
    </div>
  );
}
```

**Option B: Show Turnstile in overlay (less intrusive)**

Add Turnstile widget to the game overlay, verify before allowing transactions.

### Step 7.7: Server-Side Verification (Optional)

If you have a backend API, verify the Turnstile token server-side:

**Example API endpoint** (Node.js):
```javascript
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

async function verifyTurnstile(token) {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });
  
  const data = await response.json();
  return data.success;
}
```

### Step 7.8: Commit Turnstile Integration

```bash
cd /home/ubuntu/Trashmarket.fun
git add -A
git commit -m "feat: Add Cloudflare Turnstile bot protection to Coin-Pusha"
git push origin feature/coin-pusha-integration
```

---

## 8. RATE LIMITING

### Step 8.1: Create Rate Limiting Rule

Navigate to **Security** → **WAF** → **Rate limiting rules**

Click **"Create rule"**

**Rule 1: Game Endpoint Rate Limit**

- **Rule name**: `Coin-Pusha Game Rate Limit`
- **If incoming requests match**:
  - Field: `URI Path`
  - Operator: `starts with`
  - Value: `/coin-pusha`
- **With the same**:
  - Characteristic: `IP Address`
- **When rate exceeds**:
  - Requests: `30`
  - Period: `1 minute`
- **Then take action**:
  - Action: `Block`
  - Duration: `10 minutes`
  - Response code: `429`

Click **"Deploy"**

---

**Rule 2: API Rate Limit (if you have API endpoints)**

Click **"Create rule"** again

- **Rule name**: `API Rate Limit`
- **If incoming requests match**:
  - Field: `URI Path`
  - Operator: `starts with`
  - Value: `/api`
- **With the same**:
  - Characteristic: `IP Address`
- **When rate exceeds**:
  - Requests: `100`
  - Period: `1 minute`
- **Then take action**:
  - Action: `Managed Challenge`

Click **"Deploy"**

---

### Step 8.2: Rate Limiting via Cloudflare Workers (Advanced)

For more granular control, use Cloudflare Workers:

**Create file**: `workers/rate-limiter.js`

```javascript
// Cloudflare Worker for Advanced Rate Limiting
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Only rate limit game endpoints
    if (!url.pathname.startsWith('/coin-pusha')) {
      return fetch(request);
    }
    
    const clientIP = request.headers.get('CF-Connecting-IP');
    const key = `rate_limit:${clientIP}`;
    
    // Get current count from KV
    const count = await env.RATE_LIMIT_KV.get(key);
    const currentCount = count ? parseInt(count) : 0;
    
    // Rate limit: 30 requests per minute
    if (currentCount >= 30) {
      return new Response('Rate limit exceeded', { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'Content-Type': 'text/plain',
        }
      });
    }
    
    // Increment counter
    await env.RATE_LIMIT_KV.put(key, (currentCount + 1).toString(), {
      expirationTtl: 60, // Expire after 60 seconds
    });
    
    return fetch(request);
  },
};
```

**Deploy Worker**:
```bash
npx wrangler deploy workers/rate-limiter.js
```

---

## 9. PAGE RULES & CACHING

### Step 9.1: Configure Caching

Navigate to **Caching** → **Configuration**

**Browser Cache TTL**: `4 hours` (default is fine)

### Step 9.2: Create Page Rules

Navigate to **Rules** → **Page Rules**

**Rule 1: Cache Static Assets**

- **URL pattern**: `trashmarket.fun/coin-pusha/assets/*`
- **Settings**:
  - Cache Level: `Cache Everything`
  - Edge Cache TTL: `1 month`
  - Browser Cache TTL: `1 month`

Click **"Save and Deploy"**

---

**Rule 2: No Cache for Game Page**

- **URL pattern**: `trashmarket.fun/coin-pusha*`
- **Settings**:
  - Cache Level: `Bypass`

Click **"Save and Deploy"**

---

**Rule 3: No Cache for API**

- **URL pattern**: `trashmarket.fun/api/*`
- **Settings**:
  - Cache Level: `Bypass`

Click **"Save and Deploy"**

---

### Step 9.3: Purge Cache (When Needed)

Navigate to **Caching** → **Configuration**

- **Purge Everything**: Use after major deployments
- **Custom Purge**: Purge specific URLs or files

---

## 10. CLOUDFLARE PAGES DEPLOYMENT

### Step 10.1: Connect GitHub Repository

Navigate to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**

1. Click **"Connect GitHub"**
2. Authorize Cloudflare to access your GitHub account
3. Select repository: `DOGECOIN87/Trashmarket.fun`
4. Click **"Begin setup"**

### Step 10.2: Configure Build Settings

**Project name**: `trashmarket`

**Production branch**: `main`

**Build settings**:
- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`

**Environment variables** (click "Add variable"):
```
VITE_GORBAGANA_RPC=https://rpc.trashscan.io
VITE_GORBAGANA_API=https://gorapi.trashscan.io
VITE_GORBAGANA_WS=wss://rpc.trashscan.io
VITE_GOR_MINT=So11111111111111111111111111111111111111112
VITE_TRASHCOIN_MINT=GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z
VITE_JUNK_MINT=BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF
VITE_TREASURY_WALLET=77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb
VITE_CLOUDFLARE_TURNSTILE_SITE_KEY=your_turnstile_site_key
VITE_SITE_URL=https://trashmarket.fun
```

Click **"Save and Deploy"**

### Step 10.3: Configure Custom Domain

After deployment completes:

1. Go to **Custom domains** tab
2. Click **"Set up a custom domain"**
3. Enter: `trashmarket.fun`
4. Click **"Continue"**
5. Cloudflare will automatically configure DNS
6. Wait for SSL certificate to provision (1-2 minutes)

### Step 10.4: Enable Automatic Deployments

Navigate to **Settings** → **Builds & deployments**

- **Production branch**: `main`
- **Preview branches**: `feature/*` (optional)
- **Automatic deployments**: `Enabled`

Now every push to `main` will trigger automatic deployment.

---

## 11. WORKERS FOR ADVANCED FEATURES

### Step 11.1: Create Worker for Custom Logic

**Use case**: Server-side token verification, API proxying, advanced rate limiting

**Create file**: `workers/coin-pusha-api.js`

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://trashmarket.fun',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Verify Turnstile token
    if (url.pathname === '/api/verify-turnstile') {
      const { token } = await request.json();
      
      const verifyResponse = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: env.TURNSTILE_SECRET_KEY,
            response: token,
          }),
        }
      );
      
      const result = await verifyResponse.json();
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Proxy to Gorbagana RPC (if needed)
    if (url.pathname === '/api/rpc') {
      const rpcRequest = await request.json();
      
      const rpcResponse = await fetch('https://rpc.trashscan.io', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcRequest),
      });
      
      const result = await rpcResponse.json();
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not found', { status: 404 });
  },
};
```

### Step 11.2: Deploy Worker

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy worker
wrangler deploy workers/coin-pusha-api.js --name coin-pusha-api

# Bind to route
wrangler route add "trashmarket.fun/api/*" coin-pusha-api
```

### Step 11.3: Add Worker Environment Variables

```bash
wrangler secret put TURNSTILE_SECRET_KEY
# Enter your Turnstile secret key when prompted
```

---

## 12. VERIFICATION & TESTING

### Step 12.1: Verify DNS Propagation

```bash
# Check DNS records
dig trashmarket.fun
dig www.trashmarket.fun

# Check nameservers
dig NS trashmarket.fun
```

**Expected**: Should show Cloudflare nameservers and IP addresses.

### Step 12.2: Test SSL/TLS

```bash
# Check SSL certificate
curl -I https://trashmarket.fun

# Verify HTTPS redirect
curl -I http://trashmarket.fun
# Should return 301/302 redirect to HTTPS
```

### Step 12.3: Test Security Headers

```bash
# Check security headers
curl -I https://trashmarket.fun/coin-pusha

# Should see:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: ...
# etc.
```

### Step 12.4: Test Rate Limiting

```bash
# Send multiple requests rapidly
for i in {1..35}; do curl -s https://trashmarket.fun/coin-pusha > /dev/null; echo "Request $i"; done

# Should see rate limit (429) after 30 requests
```

### Step 12.5: Test Turnstile

1. Visit `https://trashmarket.fun/coin-pusha`
2. Verify Turnstile widget appears
3. Complete verification
4. Verify game loads after verification

### Step 12.6: Performance Testing

Use Cloudflare's **Speed** → **Optimization** tools:

- Enable **Auto Minify** (HTML, CSS, JS)
- Enable **Brotli** compression
- Enable **Rocket Loader** (optional, may break some JS)

**Test with**:
- Google PageSpeed Insights
- GTmetrix
- WebPageTest

---

## 13. TROUBLESHOOTING

### Issue: DNS not resolving

**Cause**: Nameservers not updated or propagation delay  
**Fix**: 
- Verify nameservers at registrar
- Wait up to 48 hours for propagation
- Use `dig` or `nslookup` to check

### Issue: SSL certificate errors

**Cause**: Wrong encryption mode or certificate not provisioned  
**Fix**:
- Set SSL/TLS mode to "Full (strict)"
- Wait for certificate to provision (can take 15 minutes)
- Check **SSL/TLS** → **Edge Certificates** for status

### Issue: Headers not applying

**Cause**: Transform rules not configured or cache not purged  
**Fix**:
- Verify rules in **Rules** → **Transform Rules**
- Purge cache: **Caching** → **Purge Everything**
- Wait a few minutes for changes to propagate

### Issue: Rate limiting not working

**Cause**: Rule not configured correctly or wrong path  
**Fix**:
- Check rule matches correct URI path
- Verify rule is deployed
- Test with multiple requests from same IP

### Issue: Turnstile not showing

**Cause**: Site key not configured or domain mismatch  
**Fix**:
- Verify `VITE_CLOUDFLARE_TURNSTILE_SITE_KEY` is set
- Check Turnstile domain matches your site
- Rebuild and redeploy

### Issue: 522 or 524 errors

**Cause**: Origin server timeout or unreachable  
**Fix**:
- Verify origin server (GitHub Pages) is accessible
- Check DNS records point to correct IPs
- Temporarily set cloud to "DNS only" (gray) to test origin

### Issue: Mixed content warnings

**Cause**: Loading HTTP resources on HTTPS page  
**Fix**:
- Ensure all assets use HTTPS or relative URLs
- Update CSP to allow necessary sources
- Check browser console for specific URLs

---

## 📋 CLOUDFLARE SETUP CHECKLIST

After completing all steps, verify:

### Account & Domain
- [ ] Cloudflare account created
- [ ] Domain added to Cloudflare
- [ ] Nameservers updated at registrar
- [ ] DNS records configured
- [ ] Domain status: Active

### SSL/TLS
- [ ] SSL/TLS mode: Full (strict)
- [ ] Always Use HTTPS: Enabled
- [ ] HSTS: Enabled
- [ ] Minimum TLS: 1.2 or 1.3
- [ ] SSL certificate: Active

### Security
- [ ] Security headers configured (Transform Rules or _headers)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Content-Security-Policy: Configured
- [ ] Referrer-Policy: Set

### Bot Protection
- [ ] Turnstile site created
- [ ] Site key added to environment variables
- [ ] Turnstile widget integrated in code
- [ ] Verification flow tested

### Rate Limiting
- [ ] Rate limiting rules created
- [ ] Game endpoint rate limit: 30/min
- [ ] API rate limit: 100/min (if applicable)
- [ ] Rate limiting tested

### Caching
- [ ] Page rules configured
- [ ] Static assets cached
- [ ] Game page: No cache
- [ ] API: No cache

### Deployment
- [ ] Cloudflare Pages connected to GitHub (or GitHub Pages configured)
- [ ] Build settings configured
- [ ] Environment variables set
- [ ] Custom domain configured
- [ ] Automatic deployments enabled

### Testing
- [ ] DNS resolves correctly
- [ ] HTTPS works
- [ ] Security headers present
- [ ] Turnstile works
- [ ] Rate limiting works
- [ ] Game loads correctly
- [ ] No console errors

---

## 🎯 RECOMMENDED CLOUDFLARE SETTINGS SUMMARY

| Feature | Setting | Purpose |
|---------|---------|---------|
| SSL/TLS Mode | Full (strict) | End-to-end encryption |
| Always Use HTTPS | ON | Force HTTPS |
| HSTS | ON (6 months) | Prevent downgrade attacks |
| Auto Minify | HTML, CSS, JS | Reduce file sizes |
| Brotli | ON | Better compression |
| Browser Cache TTL | 4 hours | Balance freshness and performance |
| Turnstile | Managed mode | Bot protection |
| Rate Limiting | 30 req/min for game | Prevent abuse |
| WAF | ON (Free tier) | Basic attack protection |

---

## 📚 ADDITIONAL RESOURCES

- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Pages Documentation](https://developers.cloudflare.com/pages/)
- [Security Headers Guide](https://developers.cloudflare.com/rules/transform/)

---

## ✅ COMPLETION

Once all steps are complete, your Trashmarket.fun site will have:

- ✅ Fast global CDN delivery
- ✅ Free SSL/TLS certificates
- ✅ DDoS protection
- ✅ Bot protection (Turnstile)
- ✅ Rate limiting
- ✅ Security headers
- ✅ Automatic deployments
- ✅ 99.99% uptime

**Your Coin-Pusha game is now production-ready with enterprise-grade security! 🚀**
