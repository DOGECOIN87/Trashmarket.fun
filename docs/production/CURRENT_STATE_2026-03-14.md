# Trashmarket.fun — Current Codebase State

**Date:** 2026-03-14  
**Prepared from:** local repo inspection, local environment validation, and deployment handover follow-up work  
**Repo:** `DOGECOIN87/Trashmarket.fun`

> This document is intended to be a newer snapshot than the older production reports in this repository. Where this file conflicts with older reports such as `CURRENT_STATE.md` or `MASTER_PRODUCTION_SUMMARY.md`, treat this file as the more current repo-aligned reference.

---

## Executive Summary

Trashmarket.fun is currently structured as a multi-surface Gorbagana dApp with three major layers:

1. **Frontend**: React + Vite application with wallet integration and routes for marketplace, GorID, bridge, raffle, vanity generation, swap, and on-chain games.
2. **Backend**: Cloudflare Worker API handling authentication, admin flows, RPC proxying, and admin-signed JunkPusher actions.
3. **On-chain programs**: Anchor-based Solana/Gorbagana programs, with the immediate deployment focus on `junkpusher`.

### High-confidence findings from this session

- The local repo was updated from GitHub during this session.
- The frontend is **not** just a static shell; it contains real integrations for DEX quoting/execution attempts, wallet-driven gameplay, and backend-assisted admin signing.
- The `junkpusher` program is **not** using a placeholder ID in the local environment. The source, local keypair, `.env.local`, and deployed on-chain program all align on:
  - `5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe`
- The on-chain upgrade authority matches the configured local wallet.
- The frontend dev server was successfully started and confirmed reachable locally at:
  - `http://localhost:5173/`
- A fresh Anchor rebuild/redeploy was **not** completed in this session because the current build pipeline is blocked by toolchain / lockfile incompatibilities.

---

## 1. Repository Layout

| Area | Path | Purpose | Current Assessment |
|---|---|---|---|
| Frontend app | `src/` | Main Trashmarket.fun UI | Active and feature-rich |
| Frontend assets | `public/` | Images, video, audio, branding | Large branded media footprint |
| Cloudflare Worker backend | `backend/` | Auth, admin, RPC proxy, game signing | Present and already deployed per handover |
| Main Anchor programs | `programs/` | `junkpusher`, `goraffle` | `junkpusher` is the immediate deployment target |
| Bridge workspace | `bridge/`, `bridge-solana/` | Cross-chain / escrow bridge work | Present as separate project surfaces |
| Vanity miner workspace | `vanity-miner/` | Vanity address generation program/workflow | Present as its own subproject |
| Production docs | `docs/production/` | Historical readiness/current-state docs | Useful, but some files are stale |

### Frontend stack from `package.json`

- **React 19**
- **Vite 6**
- **TypeScript 5.8**
- **Tailwind 4**
- **@coral-xyz/anchor 0.30.1**
- **@solana/web3.js 1.98.x**
- Solana wallet adapter packages
- Firebase client/admin dependencies
- Wrangler for Cloudflare Worker workflows

---

## 2. Frontend Current State

### 2.1 App shell and routes

From `src/App.tsx`, the app uses a **HashRouter** and exposes routes for:

- `/` — home
- `/collection/:id` — collection / market view
- `/gorid`
- `/docs`
- `/official-docs`
- `/bridge`
- `/junk-pusher`
- `/slots`
- `/dex`
- `/vanity`
- `/submit`
- `/raffle`

This confirms the frontend is organized as a multi-feature dApp rather than a single-purpose game client.

### 2.2 DEX / swap state

The older production docs describe the swap flow as alert-only. That is no longer accurate.

Current repo state:

- `src/pages/Swap.tsx` renders `TrashDAQSwap`
- `src/components/TrashDAQSwap.tsx` includes:
  - token selection
  - balance loading
  - slippage settings
  - route and price impact display
  - transaction status UI
  - swap execution flow
- `src/services/dexService.ts` includes:
  - token/market loading from `https://gorapi.trashscan.io`
  - local quote calculation helpers
  - wallet balance helpers
  - `executeSwap()` that attempts to fetch quote + swap instructions and sign/send a transaction

### DEX conclusion

The DEX is **more advanced than the old docs claim**. It is no longer just a UI mock. However, this session did **not** fully browser-test end-to-end swapping, so the safest status is:

- **UI and integration code present**
- **Live data path present**
- **Execution path implemented in code**
- **End-to-end runtime behavior still needs hands-on manual validation**

### 2.3 JunkPusher frontend state

The JunkPusher frontend is wired against the deployed program and backend-assisted admin flows.

Key repo evidence:

- `src/lib/JunkPusherClient.ts`
  - reads `VITE_SOLANA_PROGRAM_ID`
  - builds typed instructions for initialize, score, coin collection, deposit, withdraw, reset
  - calls backend endpoints for admin-assisted balance update and signing
- `src/lib/useJunkPusherOnChain.ts`
  - imports the real `PROGRAM_ID`
  - checks whether the program is available
  - uses backend API base URL when needed
- `src/components/junk-pusher/JunkPusherGame.tsx`
  - uses on-chain balance reads via the same program ID

### JunkPusher conclusion

The frontend is **materially wired for on-chain operation**, not purely local simulation. The older docs that describe this area as blocked only by a placeholder program ID are stale relative to the current repo.

### 2.4 Other surfaced features

The repo also includes active or partially active surfaces for:

- GorID marketplace/trading
- bridge flows
- raffle system
- slots / skill game components
- vanity address generation
- submission/admin workflows

Those areas are clearly present in the codebase, but they were **not fully audited or runtime-tested** in this session.

---

## 3. Backend Current State

The backend is a Cloudflare Worker located under `backend/`.

### Confirmed endpoint surface

From `backend/README.md` and `backend/src/index.ts`, the Worker includes handlers for:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/verify`
- `POST /api/admin/submissions/:action`
- `POST /api/rpc`
- `POST /api/game/update-balance`
- `POST /api/game/sign`

### Backend conclusion

The backend is not just a minimal auth proxy. It also participates in the JunkPusher security model by:

- validating/admin-gating game state updates
- producing admin signatures for approved game transactions
- providing the API base used by the frontend game client

Per the original handover context, this Worker has already been updated and deployed to the user's Cloudflare account.

---

## 4. On-Chain Programs Current State

### 4.1 `junkpusher` program

`programs/junkpusher/src/lib.rs` defines a real Anchor program with:

- `initialize_config`
- `initialize_game`
- `record_coin_collection`
- `record_score`
- `deposit_balance`
- `withdraw_balance`
- `reset_game`
- `update_balance` (admin-only)

### Game/account model

- `GameConfig` PDA stores the admin authority
- `GameState` PDA stores per-player game state
- Deposits use **DEBRIS** via Token-2022 transfer checks
- Withdrawals are limited to verified winnings / net profit rules
- A **2.5% platform fee** is applied on deposits

### 4.2 Confirmed deployment facts from this session

The following were directly verified against the local environment and RPC:

| Item | Value |
|---|---|
| Program ID | `5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe` |
| `declare_id!` in source | `5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe` |
| Local deploy keypair address | `5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe` |
| Local wallet / configured authority | `Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ` |
| On-chain upgrade authority | `Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ` |
| ProgramData address | `BsVidHudwhFcPXmVPD9nSjGuYR8X435VqWdJ1WJMkup2` |
| Last deployed slot observed | `34269486` |

### 4.3 Additional program surfaces in repo

Other on-chain or program-integrated areas present in the repo include:

- `programs/goraffle`
- `bridge/`
- `bridge-solana/`
- `vanity-miner/`
- GorID escrow integrations under frontend service files

These were identified but not deeply validated in this session.

---

## 5. Environment / Deployment Work Completed in This Session

### Repo + toolchain actions completed

- Pulled latest `origin/main`
- Confirmed `build-essential` is installed
- Installed / switched to **Anchor CLI 0.30.1**
- Downloaded **Solana CLI 1.18.12** into:
  - `/home/mattrick/Desktop/TM-NEW/solana-release/bin/`
- Configured Solana CLI to use:
  - RPC: `https://rpc.trashscan.io`
  - keypair: `/home/mattrick/.config/solana/id.json`

### Local environment values confirmed

From `.env.local`:

| Variable | Value |
|---|---|
| `VITE_SOLANA_PROGRAM_ID` | `5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe` |
| `VITE_GAME_TREASURY_WALLET` | `8iKCvwz3tyUp4hzxcyLYtPQghiwiEhiLDd38MEQBF6kR` |
| `VITE_GORBAGANA_RPC` | `https://rpc.trashscan.io` |
| `VITE_API_BASE_URL` | `https://trashmarket-api.gor-incinerator.workers.dev` |

### Local dev server status

The frontend was launched locally and confirmed reachable:

- URL: `http://localhost:5173/`
- Vite log file: `/tmp/trashmarket-vite.log`

### 5.1 Exact environment setup / installation process used in this session

The following commands are the **exact shell commands I could recover from this session's history and terminal output**. I am intentionally only listing commands that were actually captured, rather than inventing missing install steps.

#### A. Pull the latest repo state

```bash
cd /home/mattrick/Desktop/TM-NEW/Trashmarket.fun && git pull origin main 2>&1
```

#### B. Check existing prerequisites and installed tools

```bash
rustc --version 2>&1; echo "---SOLANA---"; solana --version 2>&1; echo "---ANCHOR---"; anchor --version 2>&1; echo "---KEYPAIR---"; ls ~/.config/solana/ 2>&1; echo "---KEYPAIR EXISTS---"; test -f ~/.config/solana/id.json && echo "YES" || echo "NO"
dpkg -l build-essential 2>&1 | grep -E "^ii|not installed"
```

#### C. Attempt the Solana installer-script path

These commands were attempted, but the final working CLI path used for this workspace came from the downloaded tarball extraction shown in the next subsection.

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.12/install)" 2>&1
sh -c "$(curl -sSfL https://release.solana.com/v1.18.12/install)" 2>&1
curl -k -sSfL https://release.solana.com/v1.18.12/install -o /tmp/solana-install.sh 2>&1 && head -5 /tmp/solana-install.sh
```

#### D. Download / extract Solana CLI 1.18.12 locally into the workspace

```bash
wget https://github.com/solana-labs/solana/releases/download/v1.18.12/solana-release-x86_64-unknown-linux-gnu.tar.bz2 -O solana-release.tar.bz2 && tar jxf solana-release.tar.bz2 && cd solana-release/bin && export PATH=$PWD:$PATH && solana --version && cd ../.. && rm solana-release.tar.bz2
wget -q "https://github.com/solana-labs/solana/releases/download/v1.18.12/solana-release-x86_64-unknown-linux-gnu.tar.bz2" -O /tmp/solana-1.18.12.tar.bz2 2>&1 && echo "Download OK" || echo "Download FAILED"
```

Effective local Solana binary path used afterward:

- `/home/mattrick/Desktop/TM-NEW/solana-release/bin/solana`

#### E. Inspect AVM / Anchor availability

```bash
cd /home/mattrick/Desktop/TM-NEW
export PATH=$PWD/solana-release/bin:$PATH && avm --version && avm list
```

What is verifiable from this machine now:

- `avm 0.32.1` is installed
- `anchor-cli 0.30.1` is active
- `0.30.1` appears in `avm list`

> Note: the recoverable shell history for this session does **not** include the original `avm install ...` / `avm use ...` command that selected Anchor 0.30.1, so I am not fabricating one here.

#### F. Verify the final active toolchain/config state

```bash
export PATH=/home/mattrick/Desktop/TM-NEW/solana-release/bin:/home/mattrick/.cargo/bin:$PATH && anchor --version
export PATH=/home/mattrick/Desktop/TM-NEW/solana-release/bin:/home/mattrick/.cargo/bin:$PATH && solana --version
export PATH=/home/mattrick/Desktop/TM-NEW/solana-release/bin:/home/mattrick/.cargo/bin:$PATH && solana config get
```

Observed final state:

- Anchor CLI: `0.30.1`
- Solana CLI: `1.18.12`
- RPC URL: `https://rpc.trashscan.io`
- Keypair path: `/home/mattrick/.config/solana/id.json`

#### G. Launch the frontend locally for manual testing

```bash
cd /home/mattrick/Desktop/TM-NEW/Trashmarket.fun && nohup npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/trashmarket-vite.log 2>&1 &
curl -I http://127.0.0.1:5173
```

This is the process used to make the dApp available locally at `http://localhost:5173/`.

---

## 6. Current Confirmed Blockers

### 6.1 Fresh `anchor build` is currently blocked

Even though preexisting `target/deploy/junkpusher.so` artifacts are present in the repo, a **fresh build from the current source tree was not successfully reproduced** in this session.

#### Blocker A — SBF toolchain vs lockfile

The Solana 1.18.12 SBF toolchain exposes:

- platform-tools `v1.41`
- bundled `rustc 1.75.0`

Attempting a build hit:

- `Cargo.lock` version 4 incompatibility in `programs/junkpusher/Cargo.lock`

#### Blocker B — alternate host toolchain path

Attempting to route the build through a Rust 1.79 toolchain then hit a separate issue during metadata resolution:

- `wit-bindgen v0.51.0` requiring the unstable/still-incompatible `edition2024` feature for that cargo path

### Build conclusion

The problem is **not** that the program ID is missing or the authority is wrong. The remaining blocker is **build reproducibility / toolchain compatibility**.

### 6.2 Deployment/verify steps were therefore not re-executed

Because a clean build could not be confirmed:

- `anchor deploy --provider.cluster https://rpc.trashscan.io` was **not** re-run in this session
- `anchor verify ...` was **not** re-run in this session

So the deployed on-chain program is real and aligned by ID/authority, but a **new upgrade from this repo state was not completed here**.

---

## 7. Local Testing Guidance

### Local app URL

- `http://localhost:5173/`

### What can be tested immediately

- routing and page loading
- wallet connection UX
- static/media rendering
- token list and DEX market-data loading
- frontend state transitions for swap settings and token selection
- JunkPusher UI shell and wallet-aware behaviors

### What depends on live external services

- DEX execution depends on external APIs and wallet signing
- JunkPusher admin-assisted actions depend on the configured backend Worker
- any chain write depends on Gorbagana RPC + wallet + program state

### Important caution

The local frontend is configured against **live RPC / live backend-style endpoints**, not a mocked sandbox. Manual testing should assume that wallet actions may target real network resources.

---

## 8. Feature Functional Status Matrix

Status legend used below:

- **Verified functional** = I directly confirmed it in this environment/session
- **Implemented / likely functional** = code is substantial and wired, but I did not complete a full end-to-end runtime test here
- **Present / unverified** = feature exists in the repo/app, but I did not validate it enough to call it functional
- **Blocked** = known issue currently prevents reliable use from this environment

| Feature Area | Status | Notes |
|---|---|---|
| Local frontend boot / dev server | **Verified functional** | Vite started successfully and returned HTTP 200 at `http://localhost:5173/`. |
| Core app shell / routing / layout | **Implemented / likely functional** | `src/App.tsx` defines the route tree and shared shell; I confirmed the app boots, but did not click through every route in-browser in this pass. |
| Wallet integration framework | **Implemented / likely functional** | Wallet adapter providers and hooks are wired through the app, but I did not complete a full live wallet test for every feature. |
| DEX token/market data + quote UI | **Implemented / likely functional** | `TrashDAQSwap` and `dexService.ts` load markets/tokens, compute price impact, balances, and routes using live APIs. |
| DEX live swap execution | **Implemented / likely functional** | Real execution code exists, but I did **not** personally verify a successful live swap transaction in this session. |
| JunkPusher program identity / environment wiring | **Verified functional** | `.env.local`, `declare_id!`, local keypair, and on-chain deployment all match the same live program ID. |
| JunkPusher full gameplay + on-chain balance flows | **Implemented / likely functional** | Frontend client, backend game-signing endpoints, and on-chain program are aligned, but I did not complete a full deposit/play/update/withdraw cycle myself. |
| Backend Worker API surface | **Implemented / likely functional** | Health, auth, admin, RPC proxy, and game-signing endpoints are implemented; handover says Worker is already deployed, but I did not fully re-test all live endpoints in this update pass. |
| GorID marketplace / trading | **Present / unverified** | Significant code exists, but I did not validate live listing, purchase, or settlement flows end-to-end. |
| Bridge functionality | **Present / unverified** | Separate bridge workspaces and integration code exist, but this was not runtime-tested here. |
| Raffle functionality | **Present / unverified** | Real service/program wiring exists, but I did not execute a full raffle flow. |
| Slots / skill game | **Present / unverified** | Route and component areas exist, but I did not verify production readiness or live operation. |
| Vanity generator | **Present / unverified** | Feature exists in the app and repo, but I did not run a complete UX/compute/payment flow in this session. |
| Collection submission / admin moderation flows | **Present / unverified** | UI/backend pieces exist, but I did not validate the workflow end-to-end. |
| Fresh local Anchor rebuild / redeploy pipeline | **Blocked** | `anchor build` is currently blocked by SBF/Cargo toolchain incompatibilities, so a clean rebuild/redeploy/verify cycle was not reproducible here. |

### Plain-English interpretation

If "fully functional" means **directly proven by this session**, the strongest/high-confidence items are:

- the app boots locally
- the current `junkpusher` deployment identity is correct and aligned
- the codebase wiring between frontend, backend, and the JunkPusher program is real and substantial

If "fully functional" means **end-to-end user transactions confirmed live**, then most feature areas still need manual QA before they should be labeled fully proven.

---

## 8.1 Raffle Manual-QA Findings (Follow-up)

Additional live testing surfaced an important raffle-flow issue that materially changes how this feature should be understood.

### What was observed

- A user bought all tickets in a raffle.
- The UI then exposed a **`DRAW WINNER`** / **`DRAW WINNER NOW`** style action.
- Clicking it triggered multiple wallet transactions and ultimately produced a frontend error:
  - `Failed to draw winner. Check console for details.`

### What the current code actually does

#### 1. Winner draw is currently **frontend-triggered**, not backend-automated

In `src/pages/Raffle.tsx`, the sold-out / expired-with-sales state shows a draw button directly in the user-facing detail view:

- sold-out active raffle → `DRAW WINNER`
- expired active raffle with sales → same draw action path

The button is shown based on raffle state only. There is **no frontend role check** limiting it to an admin, backend process, or raffle creator.

#### 2. The button executes a **two-phase on-chain sequence** from the browser

The current handler in `src/pages/Raffle.tsx` does this directly from the client:

1. `service.drawWinner(raffle.raffleId)`
2. `service.claimPrize(raffle.raffleId, new PublicKey(raffle.nftMint))`

So the UI is not simply asking the backend to finalize the raffle. It is attempting to:

- draw the winner on-chain, then
- claim/distribute the prize on-chain

from the connected wallet session.

This explains why testing the button can trigger **multiple transaction prompts**.

#### 3. The on-chain program currently allows **any signer** to call draw/claim

From the Anchor program under `programs/goraffle/`:

- `draw_winner` takes `authority: Signer<'info>` with **no constraint** tying it to creator/admin/platform authority
- `claim_prize` also takes `authority: Signer<'info>` and uses it primarily as payer / signer, not as an authorization gate

That means the current on-chain design is effectively **permissionless finalization**, not backend-only finalization.

#### 4. No backend raffle automation was found

Searches in `backend/` found **no raffle-specific worker logic**, no cron/scheduler, and no endpoint responsible for automatically drawing winners or automatically claiming prizes.

So the current repo does **not** support the product expectation of:

- "backend automatically finalizes the raffle when sold out / ended"

Instead, the present implementation is:

- user-facing frontend button
- direct on-chain draw
- direct on-chain claim

### Most likely reason for the error

Without the exact console/program logs from the failed attempt, the most likely failure mode is:

1. **`drawWinner` succeeds** and the raffle moves from `Active` → `Drawing`
2. **`claimPrize` fails** during payout/distribution setup

Why this is likely:

- `claim_prize` requires existing token accounts for:
  - `creator_token_account`
  - `platform_token_account`
- unlike `winner_nft_account`, those GGOR token accounts are **not** created with `init_if_needed`
- the frontend/service code also does **not** pre-create them before claiming

So if the creator GGOR ATA or platform GGOR ATA does not already exist, claim is likely to fail after winner selection.

That would leave the raffle in an intermediate **`Drawing`** state and also explains why the frontend may appear inconsistent after the failed flow.

### Product / UX mismatch identified

There is now a confirmed mismatch between the current implementation and the intended behavior:

| Intended behavior | Current implementation |
|---|---|
| Backend automatically finalizes sold-out / ended raffles | No backend automation found |
| Normal users should not manually trigger winner draw | Any connected user can reach the draw flow in the frontend |
| Winner selection should feel automatic | Frontend exposes a manual button and executes transactions from the browser |
| Expired/no-sale NFT should be automatically returned | Current UI requires creator interaction; no automatic backend process was found |

### Revised raffle assessment

Because of this finding, raffle status should be understood as:

- **Feature exists and is materially implemented**
- **Not production-safe / not behaviorally aligned with intended UX yet**
- **Needs role/automation/finalization redesign before being called fully functional**

### Recommended fixes

1. **Choose one finalization model explicitly**
   - **Backend-managed** finalization, or
   - **Permissionless user-triggered** finalization

2. **If backend-managed is the intended design**
   - remove/hide the draw button from normal users
   - add a backend/worker/scheduled job or explicit admin endpoint to finalize raffles
   - update frontend copy to reflect backend processing state

3. **If permissionless finalization is acceptable**
   - rename the button from "Draw Winner" to something clearer like `Finalize Raffle`
   - make the flow resilient when creator/platform token accounts do not yet exist
   - clearly explain that any user can finalize a sold-out raffle and pay the transaction fees

4. **Fix payout account preparation**
   - ensure creator/platform GGOR token accounts exist before `claim_prize`, or
   - modify the on-chain program / client flow to create them when missing

5. **Correct inaccurate UX/legal copy**
   - the current Terms tab says winner selection and no-sale return happen automatically, but the codebase currently does not fully implement that behavior automatically

---

## 9. Recommended Next Actions

1. **Stabilize the build environment** for `junkpusher`
   - align SBF tooling, lockfile format, and cargo metadata behavior
   - reproduce a clean `anchor build`

2. **After build is reproducible**, rerun the original deployment handover sequence:
   - `anchor build`
   - `anchor deploy --provider.cluster https://rpc.trashscan.io`
   - `anchor verify 5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe --provider.cluster https://rpc.trashscan.io`

3. **Post-deploy verification**
   - backend health
   - auth rejection on protected game endpoints
   - manual wallet testing in the local/frontend environment

4. **Treat older production docs as historical snapshots**
   - especially where they still mention placeholder program IDs or alert-only swap behavior

---

## 10. Bottom-Line Status

### What is clearly true right now

- The codebase is more complete than several older production reports suggest.
- The frontend, backend, and `junkpusher` program are meaningfully wired together.
- The `junkpusher` deployment target is real, deployed, and authority-aligned.
- The local app can be run for manual testing.

### What is still unresolved

- A fresh verified Anchor build/deploy from the current source tree was not completed in this session.
- The highest-confidence remaining blocker is build/toolchain compatibility, not missing program identity or missing deployment authority.
