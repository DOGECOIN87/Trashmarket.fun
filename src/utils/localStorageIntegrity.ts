/**
 * HMAC-based integrity protection for localStorage values.
 *
 * Prevents players from editing localStorage balances in DevTools.
 * Uses Web Crypto SubtleCrypto (HMAC-SHA256) with a per-session secret.
 *
 * NOTE: This is a deterrent, not cryptographic security — the secret lives
 * in-memory on the client. The real source-of-truth is the on-chain PDA.
 */

// Generate a random per-session secret (survives page reloads via sessionStorage)
function getSessionSecret(): string {
  const KEY = '__tm_integrity_secret';
  let secret = sessionStorage.getItem(KEY);
  if (!secret) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(KEY, secret);
  }
  return secret;
}

async function hmac(data: string): Promise<string> {
  const secret = getSessionSecret();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store a value in localStorage with an HMAC integrity tag.
 */
export async function setWithIntegrity(key: string, value: string): Promise<void> {
  const tag = await hmac(key + ':' + value);
  const envelope = JSON.stringify({ v: value, h: tag });
  localStorage.setItem(key, envelope);
}

/**
 * Read a value from localStorage and verify its HMAC integrity tag.
 * Returns `null` if the value is missing, tampered with, or from a previous session.
 */
export async function getWithIntegrity(key: string): Promise<string | null> {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const envelope = JSON.parse(raw);
    // Support reading legacy (non-envelope) values: if there's no `.h` field,
    // treat the raw string as the value but return null to force re-save with integrity.
    if (!envelope || typeof envelope.v === 'undefined' || typeof envelope.h === 'undefined') {
      return null;
    }
    const expectedTag = await hmac(key + ':' + envelope.v);
    if (expectedTag !== envelope.h) {
      console.warn(`[Integrity] Tampered value detected for key "${key}". Ignoring.`);
      localStorage.removeItem(key);
      return null;
    }
    return envelope.v;
  } catch {
    // Legacy plain-text value — return null so caller falls back to on-chain
    return null;
  }
}

/**
 * Legacy synchronous wrappers for standard localStorage access.
 * Use these for non-sensitive values like UI preferences or last-used wallet.
 */
export const setItem = (key: string, value: string): void => {
  localStorage.setItem(key, value);
};

export const getItem = (key: string): string | null => {
  return localStorage.getItem(key);
};

export const removeItem = (key: string): void => {
  localStorage.removeItem(key);
};

