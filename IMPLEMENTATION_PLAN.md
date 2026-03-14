# Trashmarket.fun — Implementation Fix Plan

## Scope
Fix all identified issues in JunkPusher and Slots games. Do NOT touch Gorid or Raffle (separate projects).

## Execution Order

Steps are ordered so each can be completed independently where possible. Execute them in this order.

---

## Step 1: Fix Broken TypeScript Imports (4 files)

The types `GameState`, `GameConfig`, and `GameEventCallback` are defined in `src/lib/types.ts`. Four files import from a non-existent `types/types` path.

**1.1** `src/components/junk-pusher/JunkPusherGame.tsx` line 6:
- Change: `import { GameState } from '../../types/types';`
- To: `import { GameState } from '../../lib/types';`

**1.2** `src/components/junk-pusher/Overlay.tsx` line 2:
- Change: `import { GameState } from '../../types/types';`
- To: `import { GameState } from '../../lib/types';`

**1.3** `src/lib/GameEngine.ts` line 4:
- Change: `import { GameConfig, GameEventCallback } from '../types/types';`
- To: `import { GameConfig, GameEventCallback } from './types';`

**1.4** `src/lib/statePersistence.ts` line 8:
- Change: `import { GameState } from '../types/types';`
- To: `import { GameState } from './types';`

**Verify:** Run `npx tsc --noEmit` — all four import errors should be gone.

---

## Step 2: Fix skipPreflight in bridgeService

**2.1** `src/services/bridgeService.ts` line 81:
- Change `skipPreflight: true` to `skipPreflight: false`

**2.2** `src/services/bridgeService.ts` line 419:
- Change `skipPreflight: true` to `skipPreflight: false`

**Verify:** Grep file for `skipPreflight: true` — should find zero matches.

---

## Step 3: Derive Treasury Token Account Instead of Hardcoding

**3.1** `src/lib/JunkPusherClient.ts` line 26:
- Remove: `const TREASURY_TOKEN_ACCOUNT = new PublicKey('2FiLdUB55vgDz24Hq12FqHuQpkmwJadeERUJqf32zi9J');`
- Add a function that derives it:

```typescript
function getTreasuryTokenAccount(programId: PublicKey): PublicKey {
    const [treasuryAuthority] = JunkPusherClient.getTreasuryAuthorityPDA(programId);
    return getAssociatedTokenAddressSync(
        DEBRIS_MINT,
        treasuryAuthority,
        true,  // allowOwnerOffCurve (PDA is off-curve)
        TOKEN_2022_PROGRAM_ID,
    );
}
```

**3.2** In `depositBalance` (line ~283) and `withdrawBalance` (line ~334), replace `TREASURY_TOKEN_ACCOUNT` with `getTreasuryTokenAccount(this.programId)`.

**3.3** Add a startup assertion that verifies the derived address matches the previously hardcoded value `2FiLdUB55vgDz24Hq12FqHuQpkmwJadeERUJqf32zi9J`. If it doesn't match, investigate whether the on-chain program uses the treasury wallet directly as authority or the treasury_authority PDA.

**Verify:** Run `npx tsc --noEmit`. Add a temporary console.log at app startup to confirm the derived address.

---

## Step 4: Create Error Message Parser Utility

Create new file: `src/lib/errorMessages.ts`

```typescript
/**
 * Parse raw Solana/Gorbagana errors into user-friendly messages.
 */

const ERROR_PATTERNS: [RegExp, string][] = [
    [/insufficient funds/i, 'Insufficient balance. Please check your DEBRIS and GGOR balances.'],
    [/insufficient lamports/i, 'Insufficient GGOR for transaction fees.'],
    [/Transaction expired/i, 'Transaction expired. Please try again.'],
    [/blockhash not found/i, 'Network congestion detected. Please try again.'],
    [/User rejected/i, 'Transaction was cancelled.'],
    [/Signature request denied/i, 'Transaction was cancelled.'],
    [/AccountNotFound/i, 'Account not found. You may need to initialize your game first.'],
    [/Custom program error/i, 'The game program rejected this transaction. Please check your balance.'],
    [/0x1/, 'Insufficient funds for this operation.'],
    [/Network request failed/i, 'Network error. Please check your connection and retry.'],
    [/timeout/i, 'Request timed out. Please try again.'],
];

export function friendlyError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);

    for (const [pattern, friendly] of ERROR_PATTERNS) {
        if (pattern.test(msg)) {
            return friendly;
        }
    }

    // Fallback: truncate raw message to avoid leaking internal details
    if (msg.length > 120) {
        return 'Transaction failed. Please try again.';
    }
    return msg;
}
```

**4.1** `src/lib/useJunkPusherOnChain.ts`:
- Add import: `import { friendlyError } from './errorMessages';`
- In the `sendTx` catch block (~line 142-147), change `err.message || 'Transaction failed'` to `friendlyError(err)`
- In the `updateBalance` catch block (~line 341-346), same change.

**4.2** `src/components/slots/SkillGame.tsx`:
- Add import: `import { friendlyError } from '../../lib/errorMessages';`
- In `handleDeposit` catch (~line 362), change `err.message || 'Deposit failed'` to `friendlyError(err)`
- In `handleWithdraw` catch (~line 401), change `err.message || 'Withdrawal failed'` to `friendlyError(err)`

**Verify:** Reject a wallet signature request. The UI should show "Transaction was cancelled." not a raw error string.

---

## Step 5: Add localStorage Integrity (HMAC)

Create new file: `src/lib/localStorageIntegrity.ts`

```typescript
/**
 * HMAC-based localStorage integrity for game balances.
 * Prevents trivial DevTools manipulation of cached values.
 *
 * NOT cryptographic security — on-chain PDA is the source of truth.
 * This only raises the bar above "change one number in DevTools."
 */

const HMAC_ALGO = { name: 'HMAC', hash: 'SHA-256' };

async function deriveKey(walletAddress: string): Promise<CryptoKey> {
    const seed = `trashmarket_integrity_v1_${walletAddress}`;
    const encoded = new TextEncoder().encode(seed);
    return crypto.subtle.importKey('raw', encoded, HMAC_ALGO, false, ['sign', 'verify']);
}

async function computeHmac(key: CryptoKey, data: string): Promise<string> {
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function setWithIntegrity(
    storageKey: string,
    value: string,
    walletAddress: string,
): Promise<void> {
    const key = await deriveKey(walletAddress);
    const hmac = await computeHmac(key, value);
    localStorage.setItem(storageKey, JSON.stringify({ value, hmac }));
}

export async function getWithIntegrity(
    storageKey: string,
    walletAddress: string,
): Promise<string | null> {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed.value || !parsed.hmac) return null;

        const key = await deriveKey(walletAddress);
        const expected = await computeHmac(key, parsed.value);
        if (expected !== parsed.hmac) {
            console.warn(`[Integrity] HMAC mismatch for "${storageKey}" — possible tampering`);
            return null;
        }
        return parsed.value;
    } catch {
        return null;
    }
}
```

**5.1** `src/components/slots/SkillGame.tsx`:
- Add import: `import { setWithIntegrity, getWithIntegrity } from '../../lib/localStorageIntegrity';`
- In the balance **save** effect (~line 322-326): replace `localStorage.setItem(key, balance.toString())` with `setWithIntegrity(key, balance.toString(), publicKey.toBase58())`
- In the balance **load** logic (~line 308-316): replace `localStorage.getItem(key)` with `await getWithIntegrity(key, publicKey.toBase58())`
- The load function's parent must be `async` (it likely already is inside a useEffect with async IIFE).

**5.2** `src/lib/statePersistence.ts`:
- Add import: `import { setWithIntegrity, getWithIntegrity } from './localStorageIntegrity';`
- Make `saveGameState` async. Replace `localStorage.setItem(key, data)` with `await setWithIntegrity(key, data, walletAddress || 'anonymous')`
- Make `loadGameState` async. Replace `localStorage.getItem(...)` with `await getWithIntegrity(...)`. Return type becomes `Promise<PersistedGameState | null>`.
- Update callers in `JunkPusherGame.tsx` (lines ~72, 93) to `await` the result.

**Verify:** Open Slots. Play until balance changes. Open DevTools → Application → localStorage. Edit the `slots_balance_*` entry manually. Reload page. The tampered value should be rejected and balance should fall back to on-chain PDA or 0.

---

## Step 6: Fix Circular verifiedWinnings in Withdrawal

**6.1** `src/lib/highScoreService.ts` — add helper after the existing `getPlayerGameBalance` function (~line 110):

```typescript
/**
 * Read a player's on-chain net_profit from their GameState PDA.
 * Returns the net_profit (as signed integer) or null if not found.
 */
export async function getPlayerNetProfit(
    connection: Connection,
    programId: PublicKey,
    playerPubkey: PublicKey
): Promise<number | null> {
    try {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('game_state'), playerPubkey.toBuffer()],
            programId
        );
        const info = await connection.getAccountInfo(pda);
        if (!info || !info.data) return null;
        const state = parseGameState(info.data as Buffer);
        return state ? state.netProfit : null;
    } catch (err) {
        console.error('[getPlayerNetProfit] Error:', err);
        return null;
    }
}
```

**6.2** `src/lib/useJunkPusherOnChain.ts`:
- Add `getPlayerNetProfit` to imports from `./highScoreService`
- In the `withdrawBalance` function (~line 230-242), REPLACE the existing implementation to:
  1. Fetch actual on-chain `net_profit` via `getPlayerNetProfit(connection, PROGRAM_ID, publicKey)`
  2. Fetch actual on-chain `balance` via `getPlayerGameBalance(connection, PROGRAM_ID, publicKey)`
  3. Use those values instead of the client-supplied `verifiedWinnings` and `currentBalance`
  4. If `amount > onChainNetProfit`, reject with error message before building the transaction
  5. Ignore the `verifiedWinnings` and `currentBalance` parameters (mark them as `_verifiedWinnings`, `_currentBalance`)

**6.3** `src/components/junk-pusher/JunkPusherGame.tsx` (~line 268):
- Change: `const sig = await oc.withdrawBalance(intAmount, intAmount, Math.floor(currentBalance));`
- To: `const sig = await oc.withdrawBalance(intAmount);`
- The hook now handles verification internally.

**6.4** `src/components/slots/SkillGame.tsx` (~line 390):
- Change: `const sig = await onChain.withdrawBalance(intAmount, intAmount, Math.floor(balance));`
- To: `const sig = await onChain.withdrawBalance(intAmount);`

**Verify:** Attempt to withdraw more than your actual on-chain `net_profit`. Should see an error like "Cannot withdraw X. Verified winnings: Y" without a wallet popup.

---

## Step 7: Record Bets On-Chain for Slots

**7.1** `src/components/slots/SkillGame.tsx`:
- Add a ref to track the current wager (~line 261):
  ```typescript
  const currentWagerRef = useRef(0);
  const balanceRef = useRef(balance);
  ```
- Keep `balanceRef` synced: `balanceRef.current = balance;` (add this wherever balance changes or at top of render)

**7.2** In `handlePlay` (~line 591), after the wager deduction `setBalance((prev) => prev - playLevel)`:
  ```typescript
  currentWagerRef.current = playLevel;
  ```

**7.3** In `resetToIdle` (~line 430-437), after win/loss is determined and balance is updated:
  ```typescript
  // Sync balance on-chain after each spin resolves
  if (onChain.isProgramReady && publicKey) {
      const wager = currentWagerRef.current;
      const netDelta = won ? (winAmount - wager) : -wager;
      const currentBal = balanceRef.current + (won ? winAmount : 0);
      onChain.updateBalance(Math.max(0, Math.floor(currentBal)), Math.floor(netDelta)).catch((err: any) => {
          console.warn('[Slots] On-chain sync failed:', err);
      });
  }
  ```

**Verify:** Play a Slots game. Check the Cloudflare Worker logs (`wrangler tail`) to confirm `/api/game/update-balance` is called after each spin. Check the on-chain GameState PDA to confirm balance and net_profit update.

---

## Step 8: Add Fairness Disclosure Modal for Slots

**8.1** `src/components/slots/SkillGame.tsx`:
- Add state (~line 244): `const [showFairnessModal, setShowFairnessModal] = useState(false);`
- Replace the existing Help button `onClick` handler (which uses `alert()`) with: `onClick={() => setShowFairnessModal(true)}`
- Add modal JSX before the closing `</div>` of the main container:

```tsx
{showFairnessModal && (
    <div className="skill-fairness-overlay" onClick={() => setShowFairnessModal(false)}>
        <div className="skill-fairness-modal" onClick={(e) => e.stopPropagation()}>
            <h2>How It Works</h2>
            <button className="skill-fairness-close" onClick={() => setShowFairnessModal(false)}>X</button>
            <div className="skill-fairness-content">
                <h3>Gameplay</h3>
                <p>After the spin, tap a cell to place your WILD symbol. If it completes a 3-in-a-row line, you win! Find the best spot for the highest payout. Only the best single line pays out.</p>
                <h3>Fairness Disclosure</h3>
                <ul>
                    <li>Game outcomes use a <strong>weighted probability pool</strong> — the outcome tier is determined before the grid is displayed.</li>
                    <li>The grid is then constructed to match the pre-determined outcome.</li>
                    <li>Your <strong>skill</strong> is in choosing the optimal WILD placement to maximize your payout.</li>
                    <li>Approximate <strong>Return-to-Player (RTP): ~90%</strong> assuming optimal play.</li>
                    <li>House edge: ~10%.</li>
                </ul>
                <h3>Currency</h3>
                <p>All bets and payouts use DEBRIS tokens on the Gorbagana network.</p>
            </div>
        </div>
    </div>
)}
```

**8.2** `src/components/slots/SkillGame.css` — append fairness modal styles:

```css
.skill-fairness-overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
}
.skill-fairness-modal {
    position: relative; background: #1a1a1a;
    border: 1px solid #cbf30c44; border-radius: 8px;
    padding: 24px; max-width: 480px; width: 90%;
    max-height: 80vh; overflow-y: auto;
    color: #e0e0e0; font-size: 14px; line-height: 1.6;
}
.skill-fairness-modal h2 { color: #cbf30c; margin-top: 0; font-size: 20px; }
.skill-fairness-modal h3 { color: #cbf30c99; margin-top: 16px; font-size: 15px; }
.skill-fairness-modal ul { padding-left: 20px; margin: 8px 0; }
.skill-fairness-modal li { margin-bottom: 6px; }
.skill-fairness-close {
    position: absolute; top: 12px; right: 12px;
    background: none; border: 1px solid #666; color: #aaa;
    cursor: pointer; padding: 4px 8px; border-radius: 4px;
}
.skill-fairness-close:hover { color: #fff; border-color: #cbf30c; }
```

**Verify:** Click the Help button on the Slots page. A modal should appear with fairness info. Click outside or X to dismiss.

---

## Step 9: Add CSP Security Headers

**9.1** `index.html` — add inside `<head>` after the viewport meta tag:

```html
<meta http-equiv="X-Content-Type-Options" content="nosniff" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'none';" />
```

**Verify:** Open page in Chrome. Check DevTools Console for CSP violations. Ensure the page loads correctly including wallet connections, RPC calls, and font loading.

---

## Step 10: Optimistic Balance Update Safety (JunkPusher)

**10.1** `src/components/junk-pusher/JunkPusherGame.tsx`:
- Add ref (~line 32): `const txPendingRef = useRef(false);`
- In `handleDeposit` (~line 241): add `if (txPendingRef.current) return null;` at the start. Set `txPendingRef.current = true` before the try block. Set `txPendingRef.current = false` in a `finally` block.
- In `handleWithdraw` (~line 260): same pattern.

**Verify:** Click Deposit rapidly multiple times. Only one transaction should be created.

---

## Files Summary

| File | Steps |
|------|-------|
| `src/components/junk-pusher/JunkPusherGame.tsx` | 1.1, 6.3, 10.1 |
| `src/components/junk-pusher/Overlay.tsx` | 1.2 |
| `src/lib/GameEngine.ts` | 1.3 |
| `src/lib/statePersistence.ts` | 1.4, 5.2 |
| `src/services/bridgeService.ts` | 2.1, 2.2 |
| `src/lib/JunkPusherClient.ts` | 3.1, 3.2 |
| `src/lib/errorMessages.ts` | 4 (NEW) |
| `src/lib/useJunkPusherOnChain.ts` | 4.1, 6.2 |
| `src/lib/localStorageIntegrity.ts` | 5 (NEW) |
| `src/components/slots/SkillGame.tsx` | 4.2, 5.1, 6.4, 7.1-7.3, 8.1 |
| `src/components/slots/SkillGame.css` | 8.2 |
| `src/lib/highScoreService.ts` | 6.1 |
| `index.html` | 9.1 |

## Constraints
- Do NOT modify any Gorid or Raffle code
- Do NOT change the Program ID (5gJkp3DsVTtBP6k7WtbiNBjQhAESgGrgu6AJfypMCAwe)
- Do NOT modify the on-chain Anchor program (lib.rs)
- Do NOT delete or close any existing on-chain accounts
- Run `npx tsc --noEmit` after each step to verify no new TypeScript errors introduced
