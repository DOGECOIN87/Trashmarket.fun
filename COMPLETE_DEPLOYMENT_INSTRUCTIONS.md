# 🚀 COMPLETE COIN-PUSHA DEPLOYMENT INSTRUCTIONS

**Purpose**: Step-by-step instructions for AI assistant to complete Coin-Pusha integration into Trashmarket.fun  
**Current Status**: ~35% Complete - Import paths need fixing, assets need copying, build testing required  
**Repository**: https://github.com/DOGECOIN87/Trashmarket.fun  
**Branch**: `feature/coin-pusha-integration`  
**Target URL**: https://trashmarket.fun/coin-pusha

---

## 📋 CONTEXT & BACKGROUND

### What Has Been Done:
1. ✅ Coin-Pusha extracted from original repository
2. ✅ Token decimals corrected from 6 to 9 (CRITICAL FIX)
3. ✅ Basic file structure created in Trashmarket.fun
4. ✅ Navigation link added to navbar
5. ✅ Route added to App.tsx (`/coin-pusha`)
6. ✅ Dependencies installed: `three`, `@dimforge/rapier3d-compat`, `framer-motion`, `zustand`
7. ✅ Environment variables configured
8. ✅ 2 commits pushed to GitHub

### What Needs to Be Done:
1. ⚠️ Fix all import paths in component files (CRITICAL - BLOCKING)
2. ⚠️ Fix all import paths in lib/service files (CRITICAL - BLOCKING)
3. ⚠️ Copy game assets to public directory (REQUIRED)
4. ⚠️ Update environment variable usage in code
5. ⚠️ Test build compilation
6. ⚠️ Fix TypeScript errors
7. ⚠️ Test locally
8. ⚠️ Add security features (Cloudflare Turnstile)
9. ⚠️ Deploy to production
10. ⚠️ Create pull request

---

## 🔧 STEP-BY-STEP INSTRUCTIONS

**IMPORTANT**: Execute these steps in order. Do not skip steps. Commit changes periodically.

---

### STEP 1: VERIFY ENVIRONMENT & SETUP

**Purpose**: Ensure you have access to the repository and understand the current state.

```bash
# Navigate to repository
cd /home/ubuntu/Trashmarket.fun

# Verify you're on the correct branch
git branch
# Should show: * feature/coin-pusha-integration

# Check current status
git status

# Pull latest changes (in case of updates)
git pull origin feature/coin-pusha-integration
```

**Expected result**: You should be on `feature/coin-pusha-integration` branch with a clean or modified working directory.

---

### STEP 2: COPY GAME ASSETS TO PUBLIC DIRECTORY

**Purpose**: The game requires images and assets that are currently in the original Coin-Pusha repo.

```bash
# Create public directory for coin-pusha assets
mkdir -p /home/ubuntu/Trashmarket.fun/public/coin-pusha

# Copy all assets from original Coin-Pusha
cp -r /home/ubuntu/Coin-Pusha/coin-pusher-src/public/* /home/ubuntu/Trashmarket.fun/public/coin-pusha/

# Verify assets were copied
ls -la /home/ubuntu/Trashmarket.fun/public/coin-pusha/
```

**Expected result**: You should see images like `junk.png`, `trashcoin.png`, `gorby-transparent.png`, and an `assets/` directory.

**Commit this change**:
```bash
cd /home/ubuntu/Trashmarket.fun
git add public/coin-pusha/
git commit -m "feat: Add Coin-Pusha game assets and images"
git push origin feature/coin-pusha-integration
```

---

### STEP 3: FIX IMPORT PATHS IN COMPONENT FILES

**Purpose**: All component files currently use old relative paths from the original Coin-Pusha structure. These must be updated to work in the new Trashmarket.fun structure.

**Files to update** (in `src/components/coin-pusha/game/`):
1. `App.tsx`
2. `HighScoreBoard.tsx`
3. `Overlay.tsx`
4. `PegboardCanvas.tsx`
5. `SoundControl.tsx`
6. `WalletContext.tsx`

**Note**: `CoinPushaGame.tsx` already has correct paths. `BackgroundDecorations.tsx` has no imports to fix.

---

#### 3.1: Fix `App.tsx`

**Current imports** (WRONG):
```typescript
import { GameEngine } from './game/GameEngine';
import { Overlay } from './components/Overlay';
import { PegboardCanvas } from './components/PegboardCanvas';
import { GameState } from './types';
import { WalletProvider, useWallet } from './context/WalletContext';
import { setupAutoSave, loadGameState, clearGameState, hasRecoverableState, getRecoveryMessage } from './services/statePersistence';
import { soundManager } from './services/soundManager';
import { BackgroundDecorations } from './components/BackgroundDecorations';
```

**Replace with** (CORRECT):
```typescript
import { GameEngine } from '../../../lib/coin-pusha/GameEngine';
import { Overlay } from './Overlay';
import { PegboardCanvas } from './PegboardCanvas';
import { GameState } from '../../../types/coin-pusha/types';
import { WalletProvider, useWallet } from './WalletContext';
import { setupAutoSave, loadGameState, clearGameState, hasRecoverableState, getRecoveryMessage } from '../../../lib/coin-pusha/statePersistence';
import { soundManager } from '../../../lib/coin-pusha/soundManager';
import { BackgroundDecorations } from './BackgroundDecorations';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/components/coin-pusha/game/App.tsx` and replace the imports.

---

#### 3.2: Fix `HighScoreBoard.tsx`

**Current imports** (WRONG):
```typescript
import { useWallet } from '../context/WalletContext';
import { getConnection, getProgramId } from '../services/solanaService';
import { getHighScores, getPlayerRank, HighScoreEntry } from '../services/highScoreService';
import { soundManager } from '../services/soundManager';
```

**Replace with** (CORRECT):
```typescript
import { useWallet } from './WalletContext';
import { getConnection, getProgramId } from '../../../lib/coin-pusha/solanaService';
import { getHighScores, getPlayerRank, HighScoreEntry } from '../../../lib/coin-pusha/highScoreService';
import { soundManager } from '../../../lib/coin-pusha/soundManager';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/components/coin-pusha/game/HighScoreBoard.tsx`.

---

#### 3.3: Fix `Overlay.tsx`

**Current imports** (WRONG):
```typescript
import { GameState } from '../types';
import { useWallet } from '../context/WalletContext';
import type { GameEngine } from '../game/GameEngine';
import { HighScoreBoard } from './HighScoreBoard';
import { SoundControl } from './SoundControl';
import { soundManager } from '../services/soundManager';
```

**Replace with** (CORRECT):
```typescript
import { GameState } from '../../../types/coin-pusha/types';
import { useWallet } from './WalletContext';
import type { GameEngine } from '../../../lib/coin-pusha/GameEngine';
import { HighScoreBoard } from './HighScoreBoard';
import { SoundControl } from './SoundControl';
import { soundManager } from '../../../lib/coin-pusha/soundManager';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/components/coin-pusha/game/Overlay.tsx`.

---

#### 3.4: Fix `PegboardCanvas.tsx`

**Current imports** (WRONG):
```typescript
import { generateInitialLayout, Shape, getImageElement, initializeShapeCache } from '../utils/shapeMath';
```

**Replace with** (CORRECT):
```typescript
import { generateInitialLayout, Shape, getImageElement, initializeShapeCache } from '../../../lib/coin-pusha/shapeMath';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/components/coin-pusha/game/PegboardCanvas.tsx`.

---

#### 3.5: Fix `SoundControl.tsx`

**Current imports** (WRONG):
```typescript
import { soundManager } from '../services/soundManager';
```

**Replace with** (CORRECT):
```typescript
import { soundManager } from '../../../lib/coin-pusha/soundManager';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/components/coin-pusha/game/SoundControl.tsx`.

---

#### 3.6: Fix `WalletContext.tsx`

**Current imports** (WRONG):
```typescript
import * as SolanaService from '../services/solanaService';
```

**Replace with** (CORRECT):
```typescript
import * as SolanaService from '../../../lib/coin-pusha/solanaService';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/components/coin-pusha/game/WalletContext.tsx`.

---

**After completing all component import fixes, commit**:
```bash
cd /home/ubuntu/Trashmarket.fun
git add src/components/coin-pusha/game/
git commit -m "fix: Update import paths in all Coin-Pusha components"
git push origin feature/coin-pusha-integration
```

---

### STEP 4: FIX IMPORT PATHS IN LIB/SERVICE FILES

**Purpose**: Service files also have internal cross-references that need updating.

---

#### 4.1: Fix `GameEngine.ts`

**Current imports** (WRONG):
```typescript
import { PHYSICS, DIMENSIONS, COLORS, TRASHCOIN } from './constants';
import { GameConfig, GameEventCallback } from '../types';
import { soundManager } from '../services/soundManager';
```

**Replace with** (CORRECT):
```typescript
import { PHYSICS, DIMENSIONS, COLORS, TRASHCOIN } from './constants';
import { GameConfig, GameEventCallback } from '../../types/coin-pusha/types';
import { soundManager } from './soundManager';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/lib/coin-pusha/GameEngine.ts`.

---

#### 4.2: Fix `statePersistence.ts`

**Current imports** (WRONG):
```typescript
import { GameState } from '../types';
```

**Replace with** (CORRECT):
```typescript
import { GameState } from '../../types/coin-pusha/types';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/lib/coin-pusha/statePersistence.ts`.

---

#### 4.3: Fix `tokenService.ts`

**Current imports** (WRONG):
```typescript
import { TOKEN_CONFIG } from '../game/tokenConfig';
```

**Replace with** (CORRECT):
```typescript
import { TOKEN_CONFIG } from './tokenConfig';
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/lib/coin-pusha/tokenService.ts`.

---

**After completing all lib import fixes, commit**:
```bash
cd /home/ubuntu/Trashmarket.fun
git add src/lib/coin-pusha/
git commit -m "fix: Update import paths in Coin-Pusha lib/service files"
git push origin feature/coin-pusha-integration
```

---

### STEP 5: UPDATE ASSET PATHS IN CODE

**Purpose**: Ensure the code references assets from the new `/coin-pusha/` public directory.

**Files that may reference assets**:
- `src/lib/coin-pusha/shapeMath.ts` (likely references images)
- `src/components/coin-pusha/game/BackgroundDecorations.tsx` (likely references background images)
- `src/lib/coin-pusha/constants.ts` (may have asset paths)

**Action**: 
1. Search for any hardcoded paths like `/junk.png` or `/trashcoin.png`
2. Update them to `/coin-pusha/junk.png` and `/coin-pusha/trashcoin.png`

**Example search**:
```bash
cd /home/ubuntu/Trashmarket.fun
grep -r "\.png\|\.jpg\|\.webp" src/lib/coin-pusha/ src/components/coin-pusha/ --include="*.ts" --include="*.tsx"
```

**Update any found paths** to include `/coin-pusha/` prefix.

**Commit if changes made**:
```bash
git add -A
git commit -m "fix: Update asset paths to use /coin-pusha/ directory"
git push origin feature/coin-pusha-integration
```

---

### STEP 6: UPDATE ENVIRONMENT VARIABLE USAGE

**Purpose**: Make the code use environment variables instead of hardcoded values.

---

#### 6.1: Update `src/constants/tokens.ts`

**Find the hardcoded values** and replace with environment variables:

**Current** (WRONG):
```typescript
export const GORBAGANA_RPC = 'https://rpc.trashscan.io';
export const GORBAGANA_API = 'https://gorapi.trashscan.io';
export const GORBAGANA_WS = 'wss://rpc.trashscan.io';
```

**Replace with** (CORRECT):
```typescript
export const GORBAGANA_RPC = import.meta.env.VITE_GORBAGANA_RPC || 'https://rpc.trashscan.io';
export const GORBAGANA_API = import.meta.env.VITE_GORBAGANA_API || 'https://gorapi.trashscan.io';
export const GORBAGANA_WS = import.meta.env.VITE_GORBAGANA_WS || 'wss://rpc.trashscan.io';
```

**Also update token mints**:
```typescript
export const GOR_MINT = new PublicKey(
  import.meta.env.VITE_GOR_MINT || 'So11111111111111111111111111111111111111112'
);
export const TRASHCOIN_MINT = new PublicKey(
  import.meta.env.VITE_TRASHCOIN_MINT || 'GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z'
);
export const JUNK_MINT = new PublicKey(
  import.meta.env.VITE_JUNK_MINT || 'BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF'
);
export const TREASURY_WALLET = new PublicKey(
  import.meta.env.VITE_TREASURY_WALLET || '77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb'
);
```

**Action**: Use the `file` tool to edit `/home/ubuntu/Trashmarket.fun/src/constants/tokens.ts`.

---

#### 6.2: Check `solanaService.ts` for RPC usage

**Search for hardcoded RPC endpoints**:
```bash
grep -n "rpc.trashscan.io\|https://" /home/ubuntu/Trashmarket.fun/src/lib/coin-pusha/solanaService.ts
```

**If found**, update to use `GORBAGANA_RPC` from constants:
```typescript
import { GORBAGANA_RPC } from '../../constants/tokens';
```

**Commit**:
```bash
cd /home/ubuntu/Trashmarket.fun
git add src/constants/tokens.ts src/lib/coin-pusha/solanaService.ts
git commit -m "feat: Add environment variable support for configuration"
git push origin feature/coin-pusha-integration
```

---

### STEP 7: TEST BUILD COMPILATION

**Purpose**: Verify that TypeScript compiles without errors.

```bash
cd /home/ubuntu/Trashmarket.fun

# Run build
npm run build
```

**Expected outcomes**:

**A) Build succeeds** ✅
- Proceed to Step 8

**B) Build fails with TypeScript errors** ❌
- Read the error messages carefully
- Common issues:
  - Missing type definitions
  - Incorrect import paths (go back and fix)
  - Missing dependencies
  - Type mismatches

**Fix errors one by one**:
1. Note the file and line number from error
2. Open the file and fix the issue
3. Run `npm run build` again
4. Repeat until build succeeds

**Commit fixes**:
```bash
git add -A
git commit -m "fix: Resolve TypeScript compilation errors"
git push origin feature/coin-pusha-integration
```

---

### STEP 8: TEST LOCALLY

**Purpose**: Verify the game loads and functions correctly in development mode.

```bash
cd /home/ubuntu/Trashmarket.fun

# Start development server
npm run dev
```

**Expected result**: Server starts on `http://localhost:5173` (or similar)

**Testing checklist**:
1. Navigate to `http://localhost:5173/#/coin-pusha`
2. Verify page loads without console errors
3. Check that 3D canvas renders
4. Check that wallet connect button appears
5. Verify no 404 errors for assets in browser console
6. Test basic interactions (if possible without wallet)

**If errors occur**:
- Check browser console for errors
- Fix issues and restart dev server
- Common issues:
  - Asset 404 errors → check asset paths
  - Module not found → check import paths
  - Type errors → fix TypeScript issues

**Once working, stop the dev server** (Ctrl+C) and proceed.

---

### STEP 9: ADD CLOUDFLARE TURNSTILE (OPTIONAL BUT RECOMMENDED)

**Purpose**: Add bot protection to the game page.

---

#### 9.1: Install Turnstile package

```bash
cd /home/ubuntu/Trashmarket.fun
npm install @marsidev/react-turnstile --save
```

---

#### 9.2: Create Turnstile component

**Create file**: `src/components/security/TurnstileWidget.tsx`

```typescript
import { Turnstile } from '@marsidev/react-turnstile';
import { useState } from 'react';

interface Props {
  onVerify: (token: string) => void;
}

export function TurnstileWidget({ onVerify }: Props) {
  const [error, setError] = useState<string | null>(null);
  const siteKey = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    return null; // Don't show if no key configured
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Turnstile
        siteKey={siteKey}
        onSuccess={onVerify}
        onError={() => setError('Verification failed. Please try again.')}
        options={{
          theme: 'dark',
          size: 'normal',
        }}
      />
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
```

---

#### 9.3: Integrate into game page (OPTIONAL)

**Edit**: `src/pages/coin-pusha/CoinPushaPage.tsx`

Add Turnstile verification before allowing game to load (optional enhancement).

---

#### 9.4: Commit

```bash
cd /home/ubuntu/Trashmarket.fun
git add -A
git commit -m "feat: Add Cloudflare Turnstile bot protection"
git push origin feature/coin-pusha-integration
```

---

### STEP 10: CREATE CLOUDFLARE CONFIGURATION FILES

**Purpose**: Prepare security headers and routing for Cloudflare deployment.

---

#### 10.1: Create headers file

**Create**: `public/_headers`

```
# Security Headers for Coin-Pusha

/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/coin-pusha/*
  Cache-Control: no-cache, no-store, must-revalidate
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

**Note**: CSP header omitted for now as it may break Web3 wallet connections. Add later if needed.

---

#### 10.2: Commit

```bash
cd /home/ubuntu/Trashmarket.fun
git add public/_headers
git commit -m "feat: Add Cloudflare security headers configuration"
git push origin feature/coin-pusha-integration
```

---

### STEP 11: FINAL BUILD TEST

**Purpose**: Ensure production build works perfectly.

```bash
cd /home/ubuntu/Trashmarket.fun

# Clean previous builds
rm -rf dist

# Production build
npm run build

# Check build output
ls -lh dist/

# Preview production build locally
npm run preview
```

**Expected result**: 
- Build completes successfully
- `dist/` directory contains built files
- Preview server starts and game works at preview URL

**If build fails**: Go back and fix errors, then retry.

---

### STEP 12: UPDATE DOCUMENTATION

**Purpose**: Document the integration for future reference.

---

#### 12.1: Update main README

**Edit**: `README.md`

Add a section about Coin-Pusha:

```markdown
## 🎮 Coin Pusha Game

Coin Pusha is an integrated Web3 arcade game where players can:
- Drop coins using JUNK tokens
- Win TRASHCOIN rewards
- Compete on leaderboards
- Connect with Backpack wallet on Gorbagana network

**Play now**: [trashmarket.fun/coin-pusha](https://trashmarket.fun/coin-pusha)

### Game Features
- 3D physics-based coin pusher mechanics
- Real-time Solana/Gorbagana blockchain integration
- Persistent game state and high scores
- Trash-themed graphics and animations
```

---

#### 12.2: Create game-specific documentation

**Create**: `COIN_PUSHA_SETUP.md`

```markdown
# Coin Pusha Setup & Configuration

## Environment Variables

Required variables in `.env.local`:

\`\`\`
VITE_GORBAGANA_RPC=https://rpc.trashscan.io
VITE_GORBAGANA_API=https://gorapi.trashscan.io
VITE_GORBAGANA_WS=wss://rpc.trashscan.io
VITE_GOR_MINT=So11111111111111111111111111111111111111112
VITE_TRASHCOIN_MINT=GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z
VITE_JUNK_MINT=BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF
VITE_TREASURY_WALLET=77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb
\`\`\`

## Token Configuration

**CRITICAL**: All tokens use 9 decimals (Solana standard).

- **GOR**: Native Gorbagana token
- **TRASHCOIN**: Reward token
- **JUNK**: Betting currency

## Development

\`\`\`bash
npm install
npm run dev
# Navigate to http://localhost:5173/#/coin-pusha
\`\`\`

## Deployment

\`\`\`bash
npm run build
npm run preview  # Test production build
\`\`\`

## Troubleshooting

### Game doesn't load
- Check browser console for errors
- Verify all assets are in `/public/coin-pusha/`
- Ensure RPC endpoint is accessible

### Wallet won't connect
- Verify Backpack wallet is installed
- Check network is set to Gorbagana
- Ensure RPC endpoint is correct

### Build errors
- Run \`npm install\` to ensure all dependencies are installed
- Check TypeScript errors with \`npm run build\`
- Verify all import paths are correct
\`\`\`

---

#### 12.3: Commit documentation

```bash
cd /home/ubuntu/Trashmarket.fun
git add README.md COIN_PUSHA_SETUP.md
git commit -m "docs: Add Coin-Pusha documentation and setup guide"
git push origin feature/coin-pusha-integration
```

---

### STEP 13: PREPARE FOR DEPLOYMENT

**Purpose**: Final checks before deploying to production.

---

#### 13.1: Security audit

**Check for sensitive data**:
```bash
cd /home/ubuntu/Trashmarket.fun

# Search for potential secrets
grep -r "private.*key\|secret\|password" src/ --include="*.ts" --include="*.tsx"

# Verify .env.local is gitignored
git check-ignore .env.local
# Should output: .env.local
```

**Remove console.log statements** (optional but recommended):
```bash
# Find console.log statements
grep -r "console.log" src/ --include="*.ts" --include="*.tsx"

# Remove or comment them out
```

---

#### 13.2: Verify token decimals one final time

```bash
# This should return NO results
grep -r "decimals.*6\|6.*decimal" src/ --include="*.ts" --include="*.tsx"
```

**Expected**: No output (all decimals should be 9)

---

#### 13.3: Final commit

```bash
cd /home/ubuntu/Trashmarket.fun
git add -A
git commit -m "chore: Final cleanup and security audit before deployment"
git push origin feature/coin-pusha-integration
```

---

### STEP 14: DEPLOY TO PRODUCTION

**Purpose**: Deploy the integrated Coin-Pusha game to production.

**Deployment options**:

---

#### OPTION A: Deploy via GitHub Pages (Current Setup)

```bash
cd /home/ubuntu/Trashmarket.fun

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

**Expected result**: Site deploys to GitHub Pages

**Verify**: Visit `https://trashmarket.fun/coin-pusha` (or your configured domain)

---

#### OPTION B: Deploy via Vercel (Recommended for Vite)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel (if needed)
vercel login

# Deploy to production
cd /home/ubuntu/Trashmarket.fun
vercel --prod
```

**During deployment**:
- Set environment variables in Vercel dashboard
- Configure custom domain: `trashmarket.fun`

---

#### OPTION C: Deploy via Cloudflare Pages

```bash
cd /home/ubuntu/Trashmarket.fun

# Build
npm run build

# Deploy with Wrangler
npx wrangler pages deploy dist --project-name=trashmarket
```

**Configure**:
- Set environment variables in Cloudflare dashboard
- Configure custom domain

---

### STEP 15: POST-DEPLOYMENT VERIFICATION

**Purpose**: Ensure everything works in production.

**Verification checklist**:

```bash
# 1. Check site is live
curl -s https://trashmarket.fun | head -20

# 2. Check game page is accessible
curl -s https://trashmarket.fun/coin-pusha | grep -i "coin" && echo "✓ Game page accessible"

# 3. Verify RPC connectivity
curl -s -X POST https://rpc.trashscan.io \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | jq '.result'

# 4. Check security headers
curl -I https://trashmarket.fun/coin-pusha | grep -E "X-Frame-Options|X-Content-Type-Options"
```

**Manual testing**:
1. Visit `https://trashmarket.fun/coin-pusha`
2. Verify game loads without errors
3. Test wallet connection
4. Verify token balances display correctly
5. Test coin drop functionality
6. Check responsive design on mobile
7. Verify no console errors in browser

---

### STEP 16: CREATE PULL REQUEST

**Purpose**: Merge the feature branch into main.

```bash
# Via GitHub CLI
cd /home/ubuntu/Trashmarket.fun
gh pr create --title "feat: Integrate Coin-Pusha game" \
  --body "## Changes

- Integrated Coin-Pusha 3D arcade game
- Fixed token decimals (6→9) for Solana standard
- Added game route at /coin-pusha
- Added navigation link
- Configured environment variables
- Added security headers
- Deployed to production

## Testing
- [x] Build succeeds
- [x] Game loads in production
- [x] Wallet connection works
- [x] Token balances correct (9 decimals)
- [x] No console errors

## Deployment
- Live at: https://trashmarket.fun/coin-pusha
- All tests passing"
```

**Or create PR manually**:
1. Go to https://github.com/DOGECOIN87/Trashmarket.fun
2. Click "Pull requests" → "New pull request"
3. Select `feature/coin-pusha-integration` → `main`
4. Fill in title and description
5. Create pull request

---

### STEP 17: MERGE AND CLEANUP

**After PR is approved**:

```bash
# Merge PR (via GitHub UI or CLI)
gh pr merge --squash

# Switch to main branch
cd /home/ubuntu/Trashmarket.fun
git checkout main

# Pull merged changes
git pull origin main

# Delete feature branch (optional)
git branch -d feature/coin-pusha-integration
git push origin --delete feature/coin-pusha-integration
```

---

## ✅ FINAL VERIFICATION CHECKLIST

After completing all steps, verify:

### Functionality
- [ ] Coin-Pusha extracted from Manus environment
- [ ] Codebase reorganized with clean structure
- [ ] All components copied to Trashmarket.fun
- [ ] Import paths updated to use correct structure
- [ ] Navigation link added and visible
- [ ] `/coin-pusha` route accessible
- [ ] Game loads without errors
- [ ] Wallet connection works (Backpack)
- [ ] Token balances display correctly (9 decimals)
- [ ] Transactions submit to Gorbagana RPC
- [ ] Assets load correctly from `/coin-pusha/` directory

### Security
- [ ] Security headers configured
- [ ] No sensitive data in client bundle
- [ ] Environment variables secured
- [ ] `.env.local` in `.gitignore`
- [ ] Bot protection integrated (optional)

### Token Configuration
- [ ] GOR mint: `So11111111111111111111111111111111111111112` (9 decimals)
- [ ] TRASHCOIN mint: `GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z` (9 decimals)
- [ ] JUNK mint: `BgvprjyRDq1erzQocRTmLPBzMuEmcARg64LE9eGX9XRF` (9 decimals)
- [ ] Treasury: `77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb`
- [ ] No hardcoded 6 decimals anywhere

### Deployment
- [ ] Production build successful
- [ ] Deployed to hosting platform
- [ ] Custom domain configured (trashmarket.fun)
- [ ] SSL certificate active
- [ ] Game accessible at `/coin-pusha`
- [ ] All functionality tested in production

### Documentation
- [ ] README updated
- [ ] Setup guide created
- [ ] Environment variables documented
- [ ] Troubleshooting guide included

### Repository
- [ ] All changes committed
- [ ] All commits pushed to GitHub
- [ ] Pull request created
- [ ] PR merged into main
- [ ] Clean working tree

---

## 🚨 TROUBLESHOOTING GUIDE

### Build fails with "Cannot find module"
**Cause**: Import path is incorrect  
**Fix**: Double-check import paths match the new structure

### Game page shows blank screen
**Cause**: Asset 404 errors or JavaScript errors  
**Fix**: Check browser console, verify asset paths, check for TypeScript errors

### Wallet won't connect
**Cause**: Wrong network or RPC endpoint  
**Fix**: Verify `VITE_GORBAGANA_RPC` is correct, ensure Backpack is on Gorbagana network

### Token balances show wrong decimals
**Cause**: Decimal value is wrong  
**Fix**: Verify all token configs use 9 decimals, not 6

### Assets return 404
**Cause**: Assets not in correct directory  
**Fix**: Ensure assets are in `/public/coin-pusha/` and paths reference `/coin-pusha/`

### TypeScript errors during build
**Cause**: Type mismatches or missing types  
**Fix**: Read error carefully, add missing types or fix type definitions

---

## 📞 COMPLETION REPORT

**When all steps are complete, provide this report**:

```
✅ COIN-PUSHA INTEGRATION COMPLETE

Deployment URL: https://trashmarket.fun/coin-pusha
Repository: https://github.com/DOGECOIN87/Trashmarket.fun
Branch: main (merged from feature/coin-pusha-integration)

Status:
- All import paths fixed ✅
- All assets copied ✅
- Build successful ✅
- Deployed to production ✅
- All tests passing ✅
- Token decimals verified (9) ✅
- Security headers active ✅
- Documentation complete ✅

Performance:
- Build size: [report from npm run build]
- Load time: [test in production]
- No console errors ✅

Next steps:
- Monitor for errors in production
- Gather user feedback
- Consider additional features (leaderboard, tournaments, etc.)
```

---

## 📝 NOTES FOR AI ASSISTANT

- **Execute steps sequentially** - Don't skip ahead
- **Commit frequently** - After each major step
- **Test thoroughly** - Run builds and local tests
- **Read error messages carefully** - They usually tell you exactly what's wrong
- **Use the file tool** - For editing files with precision
- **Use shell tool** - For git commands and npm scripts
- **Ask for help** - If stuck, ask the user for clarification

**Good luck! 🚀**
