/**
 * Admin Authentication Service
 *
 * Replaces the insecure client-side admin password check with
 * wallet-signature-based authentication via the Trashmarket API backend.
 *
 * Flow:
 *  1. Admin connects wallet
 *  2. Admin signs a timestamped message
 *  3. Backend verifies signature + checks wallet is in admin list
 *  4. Backend returns a session token
 *  5. Token is stored in sessionStorage and sent with admin API calls
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'https://trashmarket-api.workers.dev';

export interface AdminSession {
  token: string;
  wallet: string;
  expiresAt: number;
}

const SESSION_KEY = 'trashmarket_admin_session';

/**
 * Get the current admin session from sessionStorage
 */
export function getAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: AdminSession = JSON.parse(raw);
    // Check expiry
    if (session.expiresAt < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Check if the current user has a valid admin session
 */
export function isAdminAuthenticated(): boolean {
  return getAdminSession() !== null;
}

/**
 * Get the auth header for admin API calls
 */
export function getAdminAuthHeader(): Record<string, string> {
  const session = getAdminSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.token}` };
}

/**
 * Login as admin using wallet signature
 *
 * @param walletAddress - The admin wallet public key (base58)
 * @param signMessage - Function from wallet adapter to sign a message
 */
export async function adminLogin(
  walletAddress: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<AdminSession> {
  // Build the message to sign
  const timestamp = Date.now();
  const message = `Trashmarket Admin Login\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);

  // Request wallet signature
  const signatureBytes = await signMessage(messageBytes);
  const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));

  // Send to backend
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: walletAddress,
      message,
      signature: signatureBase64,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Login failed' }));
    throw new Error((err as any).error || `Login failed: ${response.status}`);
  }

  const data = (await response.json()) as { token: string; wallet: string; expiresIn: number };

  const session: AdminSession = {
    token: data.token,
    wallet: data.wallet,
    expiresAt: Date.now() + data.expiresIn * 1000,
  };

  // Store in sessionStorage (cleared when browser tab closes)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return session;
}

/**
 * Logout admin — clear session
 */
export function adminLogout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Verify the current session is still valid on the backend
 */
export async function verifyAdminSession(): Promise<boolean> {
  const session = getAdminSession();
  if (!session) return false;

  try {
    const response = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!response.ok) {
      adminLogout();
      return false;
    }
    const data = (await response.json()) as { valid: boolean };
    if (!data.valid) {
      adminLogout();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Make an authenticated admin API call
 */
export async function adminFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const session = getAdminSession();
  if (!session) {
    throw new Error('Not authenticated as admin');
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(options.headers || {}),
    },
  });
}
