import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.config';

/**
 * Game Config Service
 *
 * Stores live game configuration in Firestore:
 *   game_config/slots         — pause flag + outcome weights
 *   game_config/junk-pusher   — pause flag
 *
 * Changes take effect in real-time for all connected clients.
 */

// ─── Slots: outcome pool metadata ────────────────────────────���───────────────
// These 11 entries must match OUTCOME_POOL order in SkillGame.tsx
export const SLOTS_OUTCOME_META = [
  { label: 'LOSS',        mult: 0,   tier: -1, color: '#ef4444' },
  { label: '0.2× loss',   mult: 0.2, tier: 8,  color: '#6b7280' },
  { label: '0.4× loss',   mult: 0.4, tier: 7,  color: '#6b7280' },
  { label: '0.7× loss',   mult: 0.7, tier: 6,  color: '#9ca3af' },
  { label: '1.0× break',  mult: 1.0, tier: 5,  color: '#adff02' },
  { label: '1.5× Mini',   mult: 1.5, tier: 4,  color: '#adff02' },
  { label: '2.5× Minor',  mult: 2.5, tier: 3,  color: '#86efac' },
  { label: '4.0× Minor',  mult: 4.0, tier: 2,  color: '#ff6b35' },
  { label: '8.0× Major',  mult: 8.0, tier: 1,  color: '#ff6b35' },
  { label: '25× Grand',   mult: 25,  tier: 0,  color: '#ffd700' },
  { label: 'BONUS',       mult: 0,   tier: 9,  color: '#a78bfa' },
] as const;

// Default weights matching hardcoded OUTCOME_POOL in SkillGame.tsx
export const DEFAULT_SLOTS_WEIGHTS: number[] = [100, 200, 200, 150, 120, 100, 60, 30, 15, 5, 3];

export interface SlotsGameConfig {
  paused: boolean;
  outcomeWeights: number[]; // length must equal SLOTS_OUTCOME_META.length (11)
}

export interface JunkPusherGameConfig {
  paused: boolean;
}

// ─── RTP calculator ─────────────────────────────────────────────────────���─────

/** Calculate theoretical RTP from a weights array. Returns 0–1 (e.g. 0.91 = 91%). */
export function calculateSlotsRTP(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return SLOTS_OUTCOME_META.reduce(
    (rtp, meta, i) => rtp + (weights[i] / total) * meta.mult,
    0
  );
}

/** Return probability of each outcome as percentage strings. */
export function getOutcomeProbabilities(weights: number[]): string[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return weights.map(() => '0.00');
  return weights.map((w) => ((w / total) * 100).toFixed(2));
}

// ─── Firestore subscriptions ─────────────────────────────���───────────────────

export function subscribeToSlotsConfig(callback: (config: SlotsGameConfig) => void): () => void {
  const ref = doc(db, 'game_config', 'slots');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const weights = Array.isArray(data.outcomeWeights) &&
          data.outcomeWeights.length === SLOTS_OUTCOME_META.length
          ? (data.outcomeWeights as number[])
          : DEFAULT_SLOTS_WEIGHTS;
        callback({ paused: data.paused ?? false, outcomeWeights: weights });
      } else {
        callback({ paused: false, outcomeWeights: DEFAULT_SLOTS_WEIGHTS });
      }
    },
    () => callback({ paused: false, outcomeWeights: DEFAULT_SLOTS_WEIGHTS })
  );
}

export function subscribeToJunkPusherConfig(callback: (config: JunkPusherGameConfig) => void): () => void {
  const ref = doc(db, 'game_config', 'junk-pusher');
  return onSnapshot(
    ref,
    (snap) => {
      callback(snap.exists() ? { paused: snap.data().paused ?? false } : { paused: false });
    },
    () => callback({ paused: false })
  );
}

// ─── Firestore writes (admin only) ───────────────────────────────────────────

export async function updateSlotsConfig(config: Partial<SlotsGameConfig>): Promise<void> {
  await setDoc(doc(db, 'game_config', 'slots'), config, { merge: true });
}

export async function updateJunkPusherConfig(config: Partial<JunkPusherGameConfig>): Promise<void> {
  await setDoc(doc(db, 'game_config', 'junk-pusher'), config, { merge: true });
}
