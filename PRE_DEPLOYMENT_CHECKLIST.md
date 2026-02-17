# 🚀 Coin-Pusha Integration - Pre-Deployment Checklist

**Status**: In Progress  
**Branch**: `feature/coin-pusha-integration`  
**Target**: Production deployment to trashmarket.fun

---

## ✅ COMPLETED TASKS

### Phase 1: Extraction & Reorganization
- [x] Located Coin-Pusha repository (DOGECOIN87/Coin-Pusha)
- [x] Cloned repository to local environment
- [x] Created production-ready directory structure
- [x] Extracted all components, services, and game logic
- [x] **CRITICAL FIX**: Updated token decimals from 6 to 9 (Solana standard)
- [x] Verified no hardcoded 6 decimals remain in codebase

### Phase 2: Integration into Trashmarket.fun
- [x] Cloned Trashmarket.fun repository
- [x] Created feature branch: `feature/coin-pusha-integration`
- [x] Created directory structure: `src/components/coin-pusha`, `src/lib/coin-pusha`, etc.
- [x] Copied all game components to new structure
- [x] Added Coin-Pusha route to App.tsx (`/coin-pusha`)
- [x] Added navigation link to Navbar.tsx (🎮 Coin Pusha)
- [x] Installed dependencies: `three`, `@dimforge/rapier3d-compat`, `framer-motion`, `zustand`
- [x] Created CoinPushaGame.tsx wrapper component
- [x] Created CoinPushaPage.tsx with lazy loading

### Phase 3: Configuration
- [x] Created `.env.example` with all required variables
- [x] Created `.env.local` for development
- [x] Updated `.gitignore` to exclude environment files
- [x] Created token constants file with correct 9 decimals
- [x] First commit and push to GitHub

---

## 🔧 REMAINING CRITICAL TASKS

### 1. **FIX IMPORT PATHS** (CRITICAL - BLOCKING)

**Issue**: All component files still use old relative import paths from original Coin-Pusha structure.

**Files needing import path updates**:
```
src/components/coin-pusha/game/App.tsx
src/components/coin-pusha/game/BackgroundDecorations.tsx
src/components/coin-pusha/game/HighScoreBoard.tsx
src/components/coin-pusha/game/Overlay.tsx
src/components/coin-pusha/game/PegboardCanvas.tsx
src/components/coin-pusha/game/SoundControl.tsx
src/components/coin-pusha/game/WalletContext.tsx
```

**Required changes**:
- `from '../context/WalletContext'` → `from './WalletContext'`
- `from '../services/solanaService'` → `from '../../../lib/coin-pusha/solanaService'`
- `from '../services/highScoreService'` → `from '../../../lib/coin-pusha/highScoreService'`
- `from '../services/soundManager'` → `from '../../../lib/coin-pusha/soundManager'`
- `from '../game/GameEngine'` → `from '../../../lib/coin-pusha/GameEngine'`
- `from '../types'` → `from '../../../types/coin-pusha/types'`
- `from '../utils/shapeMath'` → `from '../../../lib/coin-pusha/shapeMath'`
- `from '../game/constants'` → `from '../../../lib/coin-pusha/constants'`
- `from '../game/tokenConfig'` → `from '../../../lib/coin-pusha/tokenConfig'`

**Action**: Systematically update all import statements in component files.

---

### 2. **FIX SERVICE/LIB IMPORTS** (CRITICAL - BLOCKING)

**Files needing updates**:
```
src/lib/coin-pusha/GameEngine.ts
src/lib/coin-pusha/solanaService.ts
src/lib/coin-pusha/tokenService.ts
src/lib/coin-pusha/transactionBuilder.ts
src/lib/coin-pusha/highScoreService.ts
src/lib/coin-pusha/CoinPusherClient.ts
```

**Required changes**:
- Update internal cross-references between lib files
- Ensure they reference `tokenConfig.ts` and `constants.ts` correctly
- Update any references to types

---

### 3. **ENVIRONMENT VARIABLE INTEGRATION** (HIGH PRIORITY)

**Current state**: Environment variables defined but not used in code.

**Required updates**:
- Update `src/constants/tokens.ts` to use `import.meta.env.VITE_*` variables
- Update `src/lib/coin-pusha/solanaService.ts` to use RPC from env
- Add fallback values for development

**Example**:
```typescript
export const GORBAGANA_RPC = import.meta.env.VITE_GORBAGANA_RPC || 'https://rpc.trashscan.io';
export const TRASHCOIN_MINT = new PublicKey(
  import.meta.env.VITE_TRASHCOIN_MINT || 'GNFqCqaU9R2jas4iaKEFZM5hiX5AHxBL7rPHTCpX5T6z'
);
```

---

### 4. **CLOUDFLARE SECURITY SETUP** (MEDIUM PRIORITY)

**Components needed**:
- [ ] Create `src/components/security/TurnstileWidget.tsx`
- [ ] Install `@marsidev/react-turnstile` package
- [ ] Create `src/middleware.ts` for rate limiting (if using Next.js) or equivalent
- [ ] Create `config/cloudflare/_headers` file
- [ ] Create `config/cloudflare/_routes.json` file

**Note**: Some Cloudflare features (like middleware) are Next.js specific. Since Trashmarket.fun uses Vite, we may need alternative approaches:
- Use Cloudflare Workers for rate limiting
- Configure headers via Cloudflare dashboard
- Add Turnstile widget to game page

---

### 5. **ASSET MANAGEMENT** (MEDIUM PRIORITY)

**Missing assets**:
- [ ] Copy game images from Coin-Pusha to `public/coin-pusha/`
- [ ] Verify sound files are included (if any)
- [ ] Copy any required textures or 3D assets
- [ ] Ensure all assets are referenced with correct paths

**Assets from original repo**:
```
/home/ubuntu/Coin-Pusha/coin-pusher-src/public/
```

---

### 6. **WALLET INTEGRATION** (HIGH PRIORITY)

**Current state**: WalletContext.tsx exists but may need updates.

**Required checks**:
- [ ] Verify WalletContext integrates with existing Trashmarket wallet provider
- [ ] Ensure Backpack wallet adapter is properly configured
- [ ] Test wallet connection flow
- [ ] Verify it uses Gorbagana RPC endpoint

**Potential issue**: Trashmarket.fun already has wallet providers. May need to:
- Use existing wallet context instead of creating new one
- Or merge WalletContext functionality

---

### 7. **BUILD & COMPILATION TESTING** (CRITICAL)

**Required before deployment**:
- [ ] Run `npm run build` to verify no TypeScript errors
- [ ] Fix any type errors or missing dependencies
- [ ] Verify bundle size is reasonable
- [ ] Test production build locally with `npm run preview`

---

### 8. **FUNCTIONALITY TESTING** (CRITICAL)

**Test scenarios**:
- [ ] Game loads without errors
- [ ] 3D physics engine initializes correctly
- [ ] Wallet connects successfully
- [ ] Token balances display correctly (with 9 decimals)
- [ ] Coin drop functionality works
- [ ] Bump functionality works
- [ ] Sound effects play (if enabled)
- [ ] High score board displays
- [ ] Game state persists on page reload
- [ ] Responsive design works on mobile

---

### 9. **SECURITY VERIFICATION** (HIGH PRIORITY)

**Checklist**:
- [ ] No private keys or sensitive data in code
- [ ] Environment variables properly secured
- [ ] `.env.local` is in `.gitignore`
- [ ] No console.log statements in production code
- [ ] Rate limiting configured (if applicable)
- [ ] Bot protection (Turnstile) integrated

---

### 10. **DOCUMENTATION** (MEDIUM PRIORITY)

**Required docs**:
- [ ] Update main README.md with Coin-Pusha information
- [ ] Create COIN_PUSHA_SETUP.md with game-specific docs
- [ ] Document environment variables
- [ ] Add troubleshooting guide
- [ ] Document deployment process

---

### 11. **DEPLOYMENT PREPARATION** (FINAL STEPS)

**Pre-deployment**:
- [ ] All import paths fixed and verified
- [ ] Build succeeds without errors
- [ ] All tests pass
- [ ] Code review completed
- [ ] Environment variables set for production
- [ ] Cloudflare configuration ready

**Deployment options**:
1. **Vercel** (Recommended for Vite)
   - [ ] Install Vercel CLI
   - [ ] Configure `vercel.json`
   - [ ] Set environment variables in Vercel dashboard
   - [ ] Deploy with `vercel --prod`

2. **Cloudflare Pages**
   - [ ] Build with `npm run build`
   - [ ] Deploy with Wrangler: `npx wrangler pages deploy dist`
   - [ ] Configure custom domain

3. **GitHub Pages** (Current setup)
   - [ ] Build with `npm run build`
   - [ ] Deploy with `npm run deploy`
   - [ ] May need additional configuration for routing

**Post-deployment**:
- [ ] Verify site is live at trashmarket.fun/coin-pusha
- [ ] Test all functionality on production
- [ ] Verify RPC connectivity
- [ ] Check security headers
- [ ] Monitor for errors
- [ ] Create pull request to merge into main

---

## 📊 PROGRESS SUMMARY

| Category | Status | Progress |
|----------|--------|----------|
| Extraction & Reorganization | ✅ Complete | 100% |
| Basic Integration | ✅ Complete | 100% |
| Import Path Fixes | ⚠️ **CRITICAL** | 0% |
| Environment Variables | ⚠️ Pending | 30% |
| Security Setup | ⚠️ Pending | 10% |
| Asset Management | ⚠️ Pending | 0% |
| Wallet Integration | ⚠️ Needs Review | 50% |
| Build Testing | ⚠️ **CRITICAL** | 0% |
| Functionality Testing | ⚠️ **CRITICAL** | 0% |
| Documentation | ⚠️ Pending | 20% |
| Deployment | ⏸️ Not Started | 0% |

**Overall Progress**: ~35%

---

## 🚨 BLOCKING ISSUES (Must fix before deployment)

1. **Import paths** - All component files need path updates
2. **Build verification** - Must confirm TypeScript compilation succeeds
3. **Wallet integration** - Need to verify compatibility with existing wallet setup
4. **Asset copying** - Game assets must be in public directory

---

## ⚡ QUICK START - NEXT STEPS

**Immediate actions** (in order):
1. Fix all import paths in component files
2. Fix all import paths in lib/service files
3. Copy assets from Coin-Pusha to public directory
4. Update constants to use environment variables
5. Run `npm run build` to test compilation
6. Fix any TypeScript errors
7. Test locally with `npm run dev`
8. Commit and push changes
9. Deploy to staging/preview
10. Final testing before production

---

## 📝 NOTES

- **Token decimals**: All corrected to 9 (Solana standard) ✅
- **Dependencies**: All installed ✅
- **Repository**: Changes pushed to feature branch ✅
- **Next commit**: Should include import path fixes

---

**Last Updated**: 2026-02-17  
**Maintainer**: AI Assistant  
**Repository**: https://github.com/DOGECOIN87/Trashmarket.fun
