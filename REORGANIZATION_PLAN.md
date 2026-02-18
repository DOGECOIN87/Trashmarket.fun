# 🔄 PROJECT REORGANIZATION PLAN

## Current Issues

The project has a **mixed structure** with files in multiple locations:

### Problem 1: Duplicate Directory Structure
- Root level: `components/`, `pages/`, `contexts/`, `services/`, `utils/`
- Src level: `src/components/`, `src/pages/`, `src/contexts/`, etc.

### Problem 2: Inconsistent Imports
- Main app uses root-level imports
- Coin-Pusha uses src-level imports
- This causes confusion and import path issues

### Problem 3: Mixed Organization
- Some Coin-Pusha files in `src/components/coin-pusha/game/`
- Some in `src/lib/coin-pusha/`
- Original game had flatter structure

---

## Recommended Structure

### Option A: Move Everything to `src/` (RECOMMENDED)

**Pros**:
- Modern React/Vite convention
- Clear separation from config files
- Better IDE support
- Scalable for future growth

**Structure**:
```
trashmarket.fun/
├── public/
│   ├── coin-pusha/          # Game assets
│   └── data/                # Static data
├── src/
│   ├── components/
│   │   ├── coin-pusha/      # Coin-Pusha components
│   │   ├── Footer.tsx
│   │   ├── Navbar.tsx
│   │   └── ...
│   ├── pages/
│   │   ├── coin-pusha/
│   │   ├── Home.tsx
│   │   └── ...
│   ├── contexts/
│   ├── services/
│   ├── lib/
│   │   └── coin-pusha/      # Game logic
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   ├── constants/
│   ├── App.tsx
│   └── index.tsx
├── bridge/                  # Separate bridge project
├── bridge-solana/           # Separate Solana bridge
├── package.json
└── vite.config.ts
```

### Option B: Keep Root Level (Current)

**Pros**:
- Less file moving required
- Existing imports mostly work

**Cons**:
- Non-standard structure
- Confusing for new developers
- Harder to maintain

---

## Reorganization Steps (Option A)

### Step 1: Move Root Components to src/
```bash
mv components/* src/components/
mv pages/* src/pages/
mv contexts/* src/contexts/
mv services/* src/services/
mv utils/* src/utils/
```

### Step 2: Update App.tsx imports
Change all imports from `./pages/` to `./src/pages/`, etc.

### Step 3: Update vite.config.ts
Ensure alias paths point to `src/`

### Step 4: Flatten Coin-Pusha structure
Move `src/components/coin-pusha/game/*` to `src/components/coin-pusha/`

### Step 5: Update all import paths
Fix all relative imports throughout the project

### Step 6: Test build
Run `npm run build` to verify

---

## Alternative: Minimal Reorganization (QUICK FIX)

**Goal**: Make it work with minimal changes

### Step 1: Keep root structure as-is
- Don't move existing files
- Root level is the "main" structure

### Step 2: Reorganize only Coin-Pusha
- Flatten `src/components/coin-pusha/game/` → `src/components/coin-pusha/`
- Move `src/lib/coin-pusha/` → `src/services/coin-pusha/`
- Move `src/types/coin-pusha/` → `types/coin-pusha/`
- Move `src/constants/tokens.ts` → `constants/tokens.ts`
- Delete empty `src/` directories

### Step 3: Update Coin-Pusha imports only
- Update imports to reference root-level paths
- Match existing project structure

### Step 4: Update App.tsx
- Change Coin-Pusha import from `./src/pages/` to `./pages/`

---

## Recommendation: MINIMAL REORGANIZATION

Given the project is already established with root-level structure, I recommend the **minimal reorganization** approach:

1. Keep existing root structure
2. Move Coin-Pusha files to match root structure
3. Remove `src/` directory entirely
4. Update imports to be consistent

This minimizes risk and maintains consistency with existing codebase.

---

## Implementation Plan

I will proceed with **Minimal Reorganization** unless instructed otherwise.
