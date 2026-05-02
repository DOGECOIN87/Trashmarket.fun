import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { doc, getDoc, setDoc, collection, getCountFromServer, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase.config';
import { type User } from 'firebase/auth';
import { signInWithTwitter, signOutTwitter, onAuthChange } from '../services/airdropService';
import { RPC_ENDPOINTS } from '../lib/rpcConfig';
import {
  Shield, ShieldOff, Lock, Power, Pause, Play, Eye, Twitter,
  TrendingUp, Users, Coins, LayoutDashboard, RefreshCw,
  ExternalLink, Wallet, CircleDot, Loader2, LogOut, Rocket,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Copy, Check, AlertTriangle, Timer, Hash, BarChart2,
  List, ArrowRight, Gamepad2, Sliders, RotateCcw, Save,
} from 'lucide-react';
import {
  SlotsGameConfig, JunkPusherGameConfig,
  DEFAULT_SLOTS_WEIGHTS, SLOTS_OUTCOME_META,
  calculateSlotsRTP, getOutcomeProbabilities,
  subscribeToSlotsConfig, subscribeToJunkPusherConfig,
  updateSlotsConfig, updateJunkPusherConfig,
} from '../services/gameConfigService';
import {
  subscribeToPendingSubmissions,
  approveSubmission,
  rejectSubmission,
} from '../services/submissionService';
import { CollectionSubmission, SubmissionStatus } from '../types';

const ADMIN_WALLET = 'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo';
const ADMIN_TWITTER = 'gor_incinerator';

const TREASURY_WALLETS = [
  { label: 'Platform Fees', address: 'Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ' },
  { label: 'NFT Marketplace', address: '77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb' },
];

const APP_PAGES = [
  { id: 'home', name: 'Home', path: '/', icon: '🏠', category: 'core' },
  { id: 'nft', name: 'NFT Marketplace', path: '/nft', icon: '🖼️', category: 'marketplace' },
  { id: 'gorid', name: 'Gorid Domains', path: '/gorid', icon: '🌐', category: 'marketplace' },
  { id: 'dex', name: 'DEX / Swap', path: '/dex', icon: '🔄', category: 'defi' },
  { id: 'bridge', name: 'Bridge', path: '/bridge', icon: '🌉', category: 'defi' },
  { id: 'junk-pusher', name: 'Junk Pusher', path: '/junk-pusher', icon: '🎮', category: 'games' },
  { id: 'slots', name: 'Slots', path: '/slots', icon: '🎰', category: 'games' },
  { id: 'raffle', name: 'Raffle', path: '/raffle', icon: '🎟️', category: 'games' },
  { id: 'vanity', name: 'Vanity Generator', path: '/vanity', icon: '✨', category: 'tools' },
  { id: 'submit', name: 'Submit', path: '/submit', icon: '📤', category: 'tools' },
  { id: 'migrate', name: 'Migration', path: '/migrate', icon: '🔀', category: 'tools' },
  { id: 'airdrop', name: 'Airdrop', path: '/airdrop', icon: '🪂', category: 'tools' },
  { id: 'docs', name: 'Docs', path: '/docs', icon: '📄', category: 'info' },
  { id: 'official-docs', name: 'Official Docs', path: '/official-docs', icon: '📋', category: 'info' },
];

const CATEGORIES: Record<string, string> = {
  core: 'Core',
  marketplace: 'Marketplaces',
  defi: 'DeFi',
  games: 'Games',
  tools: 'Tools',
  info: 'Information',
};

const AUTO_REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
];

interface PageStatus {
  [pageId: string]: boolean;
}

interface TreasuryBalance {
  address: string;
  label: string;
  balance: number | null;
}

interface SubmissionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface ConfirmAction {
  type: 'approve' | 'reject';
  submissionId: string;
  submissionName: string;
}

async function fetchBalance(address: string): Promise<number> {
  const res = await fetch(RPC_ENDPOINTS.GORBAGANA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  });
  const data = await res.json();
  return (data.result?.value || 0) / 1e9;
}

async function loadSubmissionsByStatus(status: SubmissionStatus): Promise<CollectionSubmission[]> {
  const q = query(
    collection(db, 'submissions'),
    where('status', '==', status),
    orderBy('submittedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CollectionSubmission[];
}

// ── Copy to clipboard hook ──
function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  }, []);
  return { copy, copiedKey };
}

const Admin: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const address = publicKey?.toBase58() || null;
  const { copy, copiedKey } = useCopy();

  // Firebase Auth state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [twitterScreenName, setTwitterScreenName] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [pageStatuses, setPageStatuses] = useState<PageStatus>({});
  const [treasuryBalances, setTreasuryBalances] = useState<TreasuryBalance[]>([]);
  const [airdropCount, setAirdropCount] = useState<number>(0);
  const [submissionStats, setSubmissionStats] = useState<SubmissionStats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Live clock
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-refresh
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Submissions state
  const [pendingSubmissions, setPendingSubmissions] = useState<CollectionSubmission[]>([]);
  const [submissionsTab, setSubmissionsTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reviewedSubmissions, setReviewedSubmissions] = useState<CollectionSubmission[]>([]);
  const [reviewedLoading, setReviewedLoading] = useState(false);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Confirm modal
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // Game config state
  const [slotsConfig, setSlotsConfig] = useState<SlotsGameConfig>({ paused: false, outcomeWeights: DEFAULT_SLOTS_WEIGHTS });
  const [junkConfig, setJunkConfig] = useState<JunkPusherGameConfig>({ paused: false });
  const [editWeights, setEditWeights] = useState<number[]>([...DEFAULT_SLOTS_WEIGHTS]);
  const [weightsEdited, setWeightsEdited] = useState(false);
  const [showOddsEditor, setShowOddsEditor] = useState(false);
  const [gameConfigSaving, setGameConfigSaving] = useState(false);

  const isWalletAdmin = connected && address === ADMIN_WALLET;
  const isCorrectTwitter = twitterScreenName === ADMIN_TWITTER;
  const isFullyAuthed = isWalletAdmin && firebaseUser !== null && isCorrectTwitter;

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setFirebaseUser(user);
      if (user) {
        // Restore screen name captured during sign-in (persisted to sessionStorage)
        const stored = sessionStorage.getItem('admin_twitter_screen_name') || '';
        setTwitterScreenName(stored.toLowerCase());
      } else {
        setTwitterScreenName('');
        sessionStorage.removeItem('admin_twitter_screen_name');
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleTwitterLogin = async () => {
    setAuthError('');
    try {
      const result = await signInWithTwitter();
      if (result) {
        const sn = result.twitterScreenName.toLowerCase();
        setTwitterScreenName(sn);
        if (sn && sn !== ADMIN_TWITTER) {
          setAuthError(`Wrong X account. Sign in as @${ADMIN_TWITTER}.`);
          await signOutTwitter();
          setFirebaseUser(null);
          setTwitterScreenName('');
          sessionStorage.removeItem('admin_twitter_screen_name');
        }
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') return;
      setAuthError(err?.message || 'Failed to sign in with X');
    }
  };

  const handleTwitterLogout = async () => {
    await signOutTwitter();
    setFirebaseUser(null);
  };

  // Real-time pending submissions
  useEffect(() => {
    if (!isFullyAuthed) return;
    const unsub = subscribeToPendingSubmissions(setPendingSubmissions);
    return unsub;
  }, [isFullyAuthed]);

  // Real-time game config subscriptions
  useEffect(() => {
    if (!isFullyAuthed) return;
    const unsubSlots = subscribeToSlotsConfig((cfg) => {
      setSlotsConfig(cfg);
      // Only sync editor if user hasn't made local edits
      setEditWeights((prev) => {
        const unchanged = prev.every((v, i) => v === DEFAULT_SLOTS_WEIGHTS[i]);
        return unchanged ? [...cfg.outcomeWeights] : prev;
      });
    });
    const unsubJunk = subscribeToJunkPusherConfig(setJunkConfig);
    return () => { unsubSlots(); unsubJunk(); };
  }, [isFullyAuthed]);

  // Load reviewed submissions when tab changes
  useEffect(() => {
    if (!isFullyAuthed || submissionsTab === 'pending') return;
    setReviewedLoading(true);
    setReviewedSubmissions([]);
    const status = submissionsTab === 'approved' ? SubmissionStatus.APPROVED : SubmissionStatus.REJECTED;
    loadSubmissionsByStatus(status)
      .then(setReviewedSubmissions)
      .finally(() => setReviewedLoading(false));
  }, [isFullyAuthed, submissionsTab]);

  // Approve/reject (called after confirmation)
  const executeAction = async (action: ConfirmAction) => {
    if (!address) return;
    setReviewingId(action.submissionId);
    setConfirmAction(null);
    try {
      if (action.type === 'approve') {
        await approveSubmission(action.submissionId, address, reviewNotes[action.submissionId]);
      } else {
        await rejectSubmission(action.submissionId, address, reviewNotes[action.submissionId]);
      }
      setExpandedSubmission(null);
      // Refresh stats
      loadSubmissionStats();
    } catch (err) {
      console.error('[Admin] Action failed:', err);
    } finally {
      setReviewingId(null);
    }
  };

  const loadPageStatuses = useCallback(async () => {
    try {
      const docRef = doc(db, 'site_config', 'page_statuses');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setPageStatuses(snap.data() as PageStatus);
      } else {
        const defaults: PageStatus = {};
        APP_PAGES.forEach(p => { defaults[p.id] = true; });
        setPageStatuses(defaults);
      }
    } catch {
      const defaults: PageStatus = {};
      APP_PAGES.forEach(p => { defaults[p.id] = true; });
      setPageStatuses(defaults);
    }
  }, []);

  const loadTreasuryBalances = useCallback(async () => {
    const results = await Promise.all(
      TREASURY_WALLETS.map(async (w) => {
        try {
          const balance = await fetchBalance(w.address);
          return { ...w, balance };
        } catch {
          return { ...w, balance: null };
        }
      })
    );
    setTreasuryBalances(results);
  }, []);

  const loadAirdropCount = useCallback(async () => {
    try {
      const colRef = collection(db, 'airdrop_registrations');
      const snap = await getCountFromServer(colRef);
      setAirdropCount(snap.data().count);
    } catch {
      // silent
    }
  }, []);

  const loadSubmissionStats = useCallback(async () => {
    try {
      const allQ = query(collection(db, 'submissions'));
      const snap = await getDocs(allQ);
      const docs = snap.docs.map(d => d.data() as CollectionSubmission);
      setSubmissionStats({
        total: docs.length,
        pending: docs.filter(d => d.status === SubmissionStatus.PENDING).length,
        approved: docs.filter(d => d.status === SubmissionStatus.APPROVED).length,
        rejected: docs.filter(d => d.status === SubmissionStatus.REJECTED).length,
      });
    } catch {
      // silent
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!isFullyAuthed) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([loadPageStatuses(), loadTreasuryBalances(), loadAirdropCount(), loadSubmissionStats()]);
      setLoading(false);
      setLastRefresh(new Date());
    };
    load();
  }, [isFullyAuthed, loadPageStatuses, loadTreasuryBalances, loadAirdropCount, loadSubmissionStats]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    if (autoRefreshInterval > 0 && isFullyAuthed) {
      autoRefreshRef.current = setInterval(async () => {
        await Promise.all([loadTreasuryBalances(), loadAirdropCount(), loadSubmissionStats()]);
        setLastRefresh(new Date());
      }, autoRefreshInterval * 1000);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefreshInterval, isFullyAuthed, loadTreasuryBalances, loadAirdropCount, loadSubmissionStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPageStatuses(), loadTreasuryBalances(), loadAirdropCount(), loadSubmissionStats()]);
    setLastRefresh(new Date());
    setRefreshing(false);
  };

  const togglePage = async (pageId: string) => {
    const newStatuses = { ...pageStatuses, [pageId]: !pageStatuses[pageId] };
    setPageStatuses(newStatuses);
    try {
      await setDoc(doc(db, 'site_config', 'page_statuses'), newStatuses);
    } catch {
      setPageStatuses(pageStatuses);
    }
  };

  const toggleSlotsPause = async () => {
    await updateSlotsConfig({ paused: !slotsConfig.paused });
  };

  const toggleJunkPusherPause = async () => {
    await updateJunkPusherConfig({ paused: !junkConfig.paused });
  };

  const handleWeightChange = (index: number, value: string) => {
    const num = Math.max(0, Math.min(9999, parseInt(value, 10) || 0));
    setEditWeights((prev) => {
      const next = [...prev];
      next[index] = num;
      return next;
    });
    setWeightsEdited(true);
  };

  const applyOddsChanges = async () => {
    setGameConfigSaving(true);
    try {
      await updateSlotsConfig({ outcomeWeights: editWeights });
      setWeightsEdited(false);
    } finally {
      setGameConfigSaving(false);
    }
  };

  const resetOddsToDefault = async () => {
    setEditWeights([...DEFAULT_SLOTS_WEIGHTS]);
    setWeightsEdited(false);
    setGameConfigSaving(true);
    try {
      await updateSlotsConfig({ outcomeWeights: DEFAULT_SLOTS_WEIGHTS });
    } finally {
      setGameConfigSaving(false);
    }
  };

  // ── GATE 1: Not connected ──
  if (!connected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 border-2 border-white/10 rounded-full flex items-center justify-center">
            <Lock className="w-10 h-10 text-gray-600" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3 tracking-tight">ACCESS RESTRICTED</h1>
          <p className="text-gray-500 text-sm font-mono">Connect your wallet to continue.</p>
        </div>
      </div>
    );
  }

  // ── GATE 2: Wrong wallet ──
  if (!isWalletAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 border-2 border-red-500/30 rounded-full flex items-center justify-center">
            <ShieldOff className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-red-400 mb-3 tracking-tight">UNAUTHORIZED</h1>
          <p className="text-gray-500 text-sm font-mono">This wallet does not have admin access.</p>
        </div>
      </div>
    );
  }

  // ── GATE 3: Need Twitter auth OR wrong account ──
  if (!firebaseUser || !isCorrectTwitter) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 border-2 border-magic-blue/30 rounded-full flex items-center justify-center">
            <Shield className="w-10 h-10 text-magic-blue" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3 tracking-tight">VERIFY IDENTITY</h1>
          <p className="text-gray-500 text-sm font-mono mb-2">
            Wallet verified. Sign in as <span className="text-magic-blue">@{ADMIN_TWITTER}</span> to continue.
          </p>
          {firebaseUser && !isCorrectTwitter && (
            <p className="text-red-400 text-xs font-mono mb-4">
              Signed in as <span className="font-bold">@{twitterScreenName || '?'}</span> — wrong account. Sign out and try again.
            </p>
          )}
          {authLoading ? (
            <Loader2 className="w-6 h-6 text-magic-blue animate-spin mx-auto mt-6" />
          ) : firebaseUser && !isCorrectTwitter ? (
            <button
              onClick={handleTwitterLogout}
              className="flex items-center justify-center gap-3 px-8 py-3 border border-red-500/50 text-red-400 font-bold text-sm uppercase tracking-wider hover:bg-red-500/10 transition-all mx-auto mt-4"
            >
              <LogOut className="w-4 h-4" />
              Sign Out &amp; Try Again
            </button>
          ) : (
            <button
              onClick={handleTwitterLogin}
              className="flex items-center justify-center gap-3 px-8 py-3 bg-magic-blue text-black font-bold text-sm uppercase tracking-wider hover:bg-[#cbf30c] transition-all mx-auto mt-6"
            >
              <Twitter className="w-4 h-4" />
              SIGN IN WITH X
            </button>
          )}
          {authError && <p className="text-red-400 text-xs mt-4 font-mono">{authError}</p>}
        </div>
      </div>
    );
  }

  // ── GATE 4: Loading ──
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-magic-blue animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-mono uppercase text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const livePages = Object.values(pageStatuses).filter(Boolean).length;
  const pausedPages = APP_PAGES.length - livePages;
  const totalTreasury = treasuryBalances.reduce((sum, t) => sum + (t.balance || 0), 0);
  const grouped = Object.entries(CATEGORIES).map(([key, label]) => ({
    category: label,
    pages: APP_PAGES.filter(p => p.category === key),
  }));

  const currentSubmissions = submissionsTab === 'pending' ? pendingSubmissions : reviewedSubmissions;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="border border-white/20 bg-[#0a0a0a] p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${confirmAction.type === 'approve' ? 'text-magic-blue' : 'text-red-400'}`} />
              <h3 className="text-white font-black uppercase tracking-wide text-sm">
                {confirmAction.type === 'approve' ? 'Approve Collection?' : 'Reject Collection?'}
              </h3>
            </div>
            <p className="text-gray-400 text-xs font-mono mb-1">
              <span className="text-white font-bold">{confirmAction.submissionName}</span>
            </p>
            <p className="text-gray-500 text-xs font-mono mb-6">
              {confirmAction.type === 'approve'
                ? 'This will mark the submission as approved and make it visible on the launchpad.'
                : 'This will reject the submission. The submitter will see the rejection and any notes you left.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => executeAction(confirmAction)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-xs uppercase tracking-wider transition-all ${
                  confirmAction.type === 'approve'
                    ? 'bg-magic-blue text-black hover:bg-[#cbf30c]'
                    : 'bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {confirmAction.type === 'approve' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                Confirm {confirmAction.type}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2.5 border border-white/20 text-gray-400 hover:text-white hover:border-white/40 transition-all text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 border border-magic-blue/50 bg-magic-blue/10 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-magic-blue" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">ADMIN PANEL</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500 font-mono">
                {now.toLocaleTimeString()}
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-600 font-mono">
                refreshed {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh selector */}
          <div className="flex items-center border border-white/10 bg-black">
            <span className="px-2.5 text-gray-600">
              <Timer className="w-3 h-3" />
            </span>
            {AUTO_REFRESH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setAutoRefreshInterval(opt.value)}
                className={`px-2.5 py-1.5 text-xs font-bold transition-all ${
                  autoRefreshInterval === opt.value
                    ? 'bg-magic-blue/20 text-magic-blue'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 bg-black text-gray-400 hover:text-magic-blue hover:border-magic-blue transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleTwitterLogout}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 bg-black text-gray-400 hover:text-red-400 hover:border-red-400 transition-all text-xs font-bold uppercase tracking-wider"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
        {[
          { label: 'Stats', href: '#stats', icon: <BarChart2 className="w-3 h-3" /> },
          { label: 'Treasury', href: '#treasury', icon: <Coins className="w-3 h-3" /> },
          { label: 'Revenue', href: '#revenue', icon: <TrendingUp className="w-3 h-3" /> },
          { label: 'Launchpad', href: '#launchpad', icon: <Rocket className="w-3 h-3" /> },
          { label: 'Games', href: '#games', icon: <Gamepad2 className="w-3 h-3" /> },
          { label: 'Pages', href: '#pages', icon: <List className="w-3 h-3" /> },
        ].map(nav => (
          <a
            key={nav.href}
            href={nav.href}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 bg-black text-gray-500 hover:text-magic-blue hover:border-magic-blue/50 transition-all text-xs font-bold uppercase tracking-wider whitespace-nowrap"
          >
            {nav.icon}
            {nav.label}
            <ArrowRight className="w-2.5 h-2.5 opacity-50" />
          </a>
        ))}
      </div>

      {/* Stats Overview */}
      <div id="stats" className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10 scroll-mt-4">
        <StatCard icon={<LayoutDashboard className="w-5 h-5" />} label="Total Pages" value={APP_PAGES.length.toString()} accent="text-white" />
        <StatCard icon={<Power className="w-5 h-5" />} label="Live" value={livePages.toString()} accent="text-magic-blue" />
        <StatCard icon={<Pause className="w-5 h-5" />} label="Paused" value={pausedPages.toString()} accent={pausedPages > 0 ? 'text-amber-400' : 'text-gray-500'} />
        <StatCard icon={<Users className="w-5 h-5" />} label="Airdrop Signups" value={airdropCount.toString()} accent="text-cyan-400" />
        <StatCard icon={<Hash className="w-5 h-5" />} label="Total Submissions" value={submissionStats.total.toString()} accent="text-white" />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Pending Review"
          value={submissionStats.pending.toString()}
          accent={submissionStats.pending > 0 ? 'text-amber-400' : 'text-gray-500'}
          pulse={submissionStats.pending > 0}
        />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Approved" value={submissionStats.approved.toString()} accent="text-magic-blue" />
        <StatCard icon={<XCircle className="w-5 h-5" />} label="Rejected" value={submissionStats.rejected.toString()} accent="text-red-400" />
      </div>

      {/* Treasury Section */}
      <div id="treasury" className="mb-10 scroll-mt-4">
        <SectionHeader icon={<Coins className="w-4 h-4" />} title="Treasury" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="border border-magic-blue/30 bg-magic-blue/5 p-5">
            <p className="text-xs font-bold text-magic-blue uppercase tracking-widest mb-2">Total Balance</p>
            <p className="text-3xl font-black text-magic-blue">
              {totalTreasury.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </p>
            <p className="text-xs text-gray-500 font-mono mt-1">GOR</p>
          </div>
          {treasuryBalances.map((t) => (
            <div key={t.address} className="border border-white/10 bg-black/50 p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t.label}</p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copy(t.address, `treasury-${t.address}`)}
                    className="text-gray-600 hover:text-magic-blue transition-colors"
                    title="Copy address"
                  >
                    {copiedKey === `treasury-${t.address}` ? <Check className="w-3 h-3 text-magic-blue" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <a
                    href={`https://explorer.gorbagana.wtf/address/${t.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-magic-blue transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <p className="text-2xl font-black text-white">
                {t.balance !== null
                  ? t.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                  : '—'}
              </p>
              <p className="text-xs text-gray-600 font-mono mt-1 truncate">{t.address.slice(0, 12)}…{t.address.slice(-6)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Section */}
      <div id="revenue" className="mb-10 scroll-mt-4">
        <SectionHeader icon={<TrendingUp className="w-4 h-4" />} title="Revenue" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <RevenueCard label="Marketplace Fees" rate="2.5%" description="Platform fee on all NFT & domain trades" />
          <RevenueCard label="Raffle Fees" rate="2.5-10%" description="Scales with raffle duration (6h to 48h+)" />
          <RevenueCard label="Game Revenue" rate="House Edge" description="Junk Pusher & Slots treasury accumulation" />
        </div>
      </div>

      {/* Launchpad Submissions */}
      <div id="launchpad" className="mb-10 scroll-mt-4">
        <SectionHeader icon={<Rocket className="w-4 h-4" />} title="Launchpad Submissions" />

        {/* Tabs */}
        <div className="flex items-center border-b border-white/10 mb-4">
          {((['pending', 'approved', 'rejected'] as const)).map(tab => {
            const count = tab === 'pending' ? submissionStats.pending : tab === 'approved' ? submissionStats.approved : submissionStats.rejected;
            const isActive = submissionsTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setSubmissionsTab(tab)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  isActive ? 'text-white border-b-2 border-magic-blue -mb-px' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab}
                <span className={`px-1.5 py-0.5 text-[10px] font-black rounded ${
                  tab === 'pending' && count > 0
                    ? 'bg-amber-500/20 text-amber-400'
                    : tab === 'approved'
                    ? 'bg-magic-blue/10 text-magic-blue'
                    : tab === 'rejected'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-white/5 text-gray-500'
                }`}>
                  {count}
                </span>
                {tab === 'pending' && count > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {reviewedLoading ? (
          <div className="border border-white/10 bg-black/50 p-8 text-center">
            <Loader2 className="w-5 h-5 text-magic-blue animate-spin mx-auto mb-2" />
            <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">Loading submissions...</p>
          </div>
        ) : currentSubmissions.length === 0 ? (
          <div className="border border-white/10 bg-black/50 p-8 text-center">
            <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">
              No {submissionsTab} submissions
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentSubmissions.map(sub => {
              const isExpanded = expandedSubmission === sub.id;
              const isReviewing = reviewingId === sub.id;
              const isPending = sub.status === SubmissionStatus.PENDING;
              return (
                <div
                  key={sub.id}
                  className={`border ${
                    isPending
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : sub.status === SubmissionStatus.APPROVED
                      ? 'border-magic-blue/20 bg-magic-blue/5'
                      : 'border-red-500/20 bg-red-500/5'
                  }`}
                >
                  <button
                    onClick={() => setExpandedSubmission(isExpanded ? null : sub.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    {sub.logoUrl ? (
                      <img src={sub.logoUrl} alt={sub.name} className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <Rocket className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-grow min-w-0">
                      <p className="text-white font-bold text-sm truncate">
                        {sub.name} <span className="text-magic-blue font-mono text-xs">{sub.symbol}</span>
                      </p>
                      <p className="text-gray-500 text-[10px] font-mono truncate">{sub.submittedBy}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {!isPending && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${
                          sub.status === SubmissionStatus.APPROVED ? 'text-magic-blue' : 'text-red-400'
                        }`}>
                          {sub.status}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500 font-mono hidden sm:block">
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/10 p-4 space-y-4">
                      {sub.bannerUrl && (
                        <img src={sub.bannerUrl} alt="banner" className="w-full h-32 object-cover" />
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                        <Field label="Supply" value={sub.supply?.toLocaleString() ?? '—'} />
                        <Field label="Mint Price" value={sub.mintPrice ? `${sub.mintPrice} GOR` : 'TBA'} />
                        <Field label="Royalty" value={sub.royaltyPercentage ? `${sub.royaltyPercentage}%` : '—'} />
                        <Field label="Mint Date" value={sub.mintDate || 'TBA'} />
                      </div>

                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Description</p>
                        <p className="text-gray-300 text-xs font-mono leading-relaxed">{sub.description}</p>
                      </div>

                      {sub.utility && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Utility</p>
                          <p className="text-gray-300 text-xs font-mono leading-relaxed">{sub.utility}</p>
                        </div>
                      )}

                      {sub.roadmap && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Roadmap</p>
                          <p className="text-gray-300 text-xs font-mono leading-relaxed">{sub.roadmap}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
                        {sub.website && <Field label="Website" value={sub.website} link={sub.website} />}
                        {sub.twitter && <Field label="Twitter" value={sub.twitter} />}
                        {sub.discord && <Field label="Discord" value={sub.discord} />}
                        {sub.telegram && <Field label="Telegram" value={sub.telegram} />}
                        {sub.contactEmail && <Field label="Contact" value={sub.contactEmail} />}
                        {sub.contractAddress && (
                          <Field
                            label="Contract"
                            value={`${sub.contractAddress.slice(0, 8)}…`}
                            link={`https://explorer.gorbagana.wtf/address/${sub.contractAddress}`}
                          />
                        )}
                      </div>

                      {sub.sampleImages?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Sample NFTs</p>
                          <div className="flex gap-2 flex-wrap">
                            {sub.sampleImages.map((url, i) => (
                              <img key={i} src={url} alt={`sample-${i}`} className="w-16 h-16 object-cover border border-white/10" />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Review history for non-pending */}
                      {!isPending && sub.reviewedAt && (
                        <div className={`border p-3 ${
                          sub.status === SubmissionStatus.APPROVED
                            ? 'border-magic-blue/20 bg-magic-blue/5'
                            : 'border-red-500/20 bg-red-500/5'
                        }`}>
                          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                            sub.status === SubmissionStatus.APPROVED ? 'text-magic-blue' : 'text-red-400'
                          }`}>
                            {sub.status === SubmissionStatus.APPROVED ? 'Approved' : 'Rejected'}
                          </p>
                          <p className="text-gray-500 text-[10px] font-mono">
                            Reviewed {new Date(sub.reviewedAt).toLocaleString()}
                          </p>
                          {sub.reviewNotes && (
                            <p className="text-gray-300 text-xs font-mono mt-1 leading-relaxed">"{sub.reviewNotes}"</p>
                          )}
                        </div>
                      )}

                      {/* Actions — only for pending */}
                      {isPending && (
                        <>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Review Notes (optional)</p>
                            <textarea
                              rows={2}
                              value={reviewNotes[sub.id] ?? ''}
                              onChange={e => setReviewNotes(n => ({ ...n, [sub.id]: e.target.value }))}
                              placeholder="Add notes for the submitter..."
                              className="w-full bg-black border border-white/20 text-white text-xs font-mono px-3 py-2 resize-none focus:outline-none focus:border-magic-blue/50 placeholder-gray-700"
                            />
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setConfirmAction({ type: 'approve', submissionId: sub.id, submissionName: sub.name })}
                              disabled={isReviewing}
                              className="flex items-center gap-2 px-5 py-2.5 bg-magic-blue text-black font-bold text-xs uppercase tracking-wider hover:bg-[#cbf30c] transition-all disabled:opacity-50"
                            >
                              {isReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              Approve
                            </button>
                            <button
                              onClick={() => setConfirmAction({ type: 'reject', submissionId: sub.id, submissionName: sub.name })}
                              disabled={isReviewing}
                              className="flex items-center gap-2 px-5 py-2.5 border border-red-500/50 text-red-400 font-bold text-xs uppercase tracking-wider hover:bg-red-500/10 transition-all disabled:opacity-50"
                            >
                              {isReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                              Reject
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Game Controls */}
      <div id="games" className="mb-10 scroll-mt-4">
        <SectionHeader icon={<Gamepad2 className="w-4 h-4" />} title="Game Controls" />

        {/* Pause toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {/* Slots */}
          <div className={`border p-5 transition-all ${slotsConfig.paused ? 'border-red-500/40 bg-red-500/5' : 'border-white/10 bg-black/50'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎰</span>
                <div>
                  <p className="text-sm font-bold text-white">Skill Game (Slots)</p>
                  <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
                    Live RTP: <span className={slotsConfig.paused ? 'text-red-400' : 'text-magic-blue'}>
                      {(calculateSlotsRTP(slotsConfig.outcomeWeights) * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold uppercase tracking-wider ${slotsConfig.paused ? 'text-red-400' : 'text-magic-blue'}`}>
                  {slotsConfig.paused ? 'PAUSED' : 'LIVE'}
                </span>
                <button
                  onClick={toggleSlotsPause}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
                    !slotsConfig.paused ? 'bg-magic-blue/30 border border-magic-blue/50' : 'bg-red-900/50 border border-red-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
                    !slotsConfig.paused ? 'left-[calc(100%-22px)] bg-magic-blue' : 'left-0.5 bg-red-600'
                  }`}>
                    {!slotsConfig.paused ? <Play className="w-2.5 h-2.5 text-black" /> : <Pause className="w-2.5 h-2.5 text-white" />}
                  </span>
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowOddsEditor(!showOddsEditor)}
              className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-magic-blue transition-colors uppercase tracking-wider"
            >
              <Sliders className="w-3 h-3" />
              {showOddsEditor ? 'Hide Odds Editor' : 'Edit Outcome Odds'}
            </button>
          </div>

          {/* Junk Pusher */}
          <div className={`border p-5 transition-all ${junkConfig.paused ? 'border-red-500/40 bg-red-500/5' : 'border-white/10 bg-black/50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎮</span>
                <div>
                  <p className="text-sm font-bold text-white">Junk Pusher</p>
                  <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Physics game</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold uppercase tracking-wider ${junkConfig.paused ? 'text-red-400' : 'text-magic-blue'}`}>
                  {junkConfig.paused ? 'PAUSED' : 'LIVE'}
                </span>
                <button
                  onClick={toggleJunkPusherPause}
                  className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
                    !junkConfig.paused ? 'bg-magic-blue/30 border border-magic-blue/50' : 'bg-red-900/50 border border-red-700'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
                    !junkConfig.paused ? 'left-[calc(100%-22px)] bg-magic-blue' : 'left-0.5 bg-red-600'
                  }`}>
                    {!junkConfig.paused ? <Play className="w-2.5 h-2.5 text-black" /> : <Pause className="w-2.5 h-2.5 text-white" />}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Slots Odds Editor */}
        {showOddsEditor && (() => {
          const probs = getOutcomeProbabilities(editWeights);
          const liveRTP = calculateSlotsRTP(editWeights);
          const liveProbs = getOutcomeProbabilities(slotsConfig.outcomeWeights);
          const liveRTPVal = calculateSlotsRTP(slotsConfig.outcomeWeights);
          return (
            <div className="border border-magic-blue/20 bg-black/80">
              {/* Editor header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Sliders className="w-4 h-4 text-magic-blue" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Outcome Weight Editor</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Live RTP</p>
                    <p className={`text-sm font-black ${liveRTPVal >= 0.85 && liveRTPVal <= 0.97 ? 'text-magic-blue' : 'text-amber-400'}`}>
                      {(liveRTPVal * 100).toFixed(2)}%
                    </p>
                  </div>
                  {weightsEdited && (
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pending RTP</p>
                      <p className={`text-sm font-black ${liveRTP >= 0.85 && liveRTP <= 0.97 ? 'text-magic-blue' : 'text-amber-400'}`}>
                        {(liveRTP * 100).toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_80px_70px_70px_70px] gap-2 px-4 py-2 border-b border-white/5 text-[10px] text-gray-600 font-mono uppercase tracking-wider">
                <div>Outcome</div>
                <div className="text-center">Mult</div>
                <div className="text-center">Weight</div>
                <div className="text-center">Live %</div>
                <div className="text-center">Edit %</div>
              </div>

              {/* Outcome rows */}
              {SLOTS_OUTCOME_META.map((meta, i) => {
                const isEdited = editWeights[i] !== slotsConfig.outcomeWeights[i];
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_80px_70px_70px_70px] gap-2 items-center px-4 py-2 border-b border-white/5 ${
                      isEdited ? 'bg-amber-500/5' : 'hover:bg-white/2'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                      <span className="text-xs font-mono text-gray-300 truncate">{meta.label}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-mono" style={{ color: meta.color }}>
                        {meta.mult === 0 ? (meta.tier === 9 ? 'BONUS' : '—') : `${meta.mult}×`}
                      </span>
                    </div>
                    <div className="text-center">
                      <input
                        type="number"
                        value={editWeights[i]}
                        onChange={(e) => handleWeightChange(i, e.target.value)}
                        min={0}
                        max={9999}
                        className="w-16 bg-white/5 border border-white/10 text-white text-xs font-mono text-center px-1 py-0.5 focus:outline-none focus:border-magic-blue/50"
                      />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-mono text-gray-500">{liveProbs[i]}%</span>
                    </div>
                    <div className="text-center">
                      <span className={`text-xs font-mono ${isEdited ? 'text-amber-400 font-bold' : 'text-gray-500'}`}>
                        {probs[i]}%
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Footer actions */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/2">
                <p className="text-[10px] text-gray-600 font-mono">
                  Total weight: {editWeights.reduce((a, b) => a + b, 0).toLocaleString()}
                  {weightsEdited && <span className="text-amber-400 ml-2">· unsaved changes</span>}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetOddsToDefault}
                    disabled={gameConfigSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 text-gray-400 hover:text-white hover:border-white/40 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                  <button
                    onClick={applyOddsChanges}
                    disabled={gameConfigSaving || !weightsEdited}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-magic-blue text-black text-xs font-bold uppercase tracking-wider hover:bg-[#cbf30c] transition-all disabled:opacity-50"
                  >
                    {gameConfigSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Apply Changes
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Pages Control */}
      <div id="pages" className="scroll-mt-4">
        <SectionHeader icon={<Eye className="w-4 h-4" />} title="Page Controls" />
        <div className="space-y-6">
          {grouped.map(({ category, pages }) => (
            <div key={category}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {pages.map((page) => {
                  const isLive = pageStatuses[page.id] !== false;
                  return (
                    <div
                      key={page.id}
                      className={`flex items-center justify-between p-4 border transition-all ${
                        isLive ? 'border-white/10 bg-black/50 hover:border-white/20' : 'border-amber-500/30 bg-amber-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{page.icon}</span>
                        <div>
                          <p className="text-sm font-bold text-white">{page.name}</p>
                          <p className="text-xs text-gray-600 font-mono">{page.path}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isLive ? 'text-magic-blue' : 'text-amber-400'}`}>
                          {isLive ? 'LIVE' : 'PAUSED'}
                        </span>
                        <button
                          onClick={() => togglePage(page.id)}
                          className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
                            isLive ? 'bg-magic-blue/30 border border-magic-blue/50' : 'bg-gray-800 border border-gray-700'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
                              isLive ? 'left-[calc(100%-22px)] bg-magic-blue' : 'left-0.5 bg-gray-600'
                            }`}
                          >
                            {isLive ? <Play className="w-2.5 h-2.5 text-black" /> : <Pause className="w-2.5 h-2.5 text-gray-400" />}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
          <Wallet className="w-3 h-3" />
          <span>{address?.slice(0, 8)}…{address?.slice(-6)}</span>
          <button
            onClick={() => address && copy(address, 'footer-wallet')}
            className="text-gray-700 hover:text-magic-blue transition-colors ml-1"
          >
            {copiedKey === 'footer-wallet' ? <Check className="w-3 h-3 text-magic-blue" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
          <CircleDot className="w-3 h-3 text-magic-blue" />
          <span>UID: {firebaseUser.uid}</span>
          <button
            onClick={() => copy(firebaseUser.uid, 'footer-uid')}
            className="text-gray-700 hover:text-magic-blue transition-colors ml-1"
          >
            {copiedKey === 'footer-uid' ? <Check className="w-3 h-3 text-magic-blue" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──

function StatCard({
  icon, label, value, accent, pulse
}: {
  icon: React.ReactNode; label: string; value: string; accent: string; pulse?: boolean;
}) {
  return (
    <div className="relative border border-white/10 bg-black/50 p-4 md:p-5 overflow-hidden">
      {pulse && (
        <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
      )}
      <div className={`mb-3 ${accent}`}>{icon}</div>
      <p className={`text-2xl md:text-3xl font-black ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-magic-blue">{icon}</span>
      <h2 className="text-sm font-black text-white uppercase tracking-widest">{title}</h2>
    </div>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">{label}</p>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-magic-blue hover:underline break-all flex items-center gap-1">
          {value} <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
        </a>
      ) : (
        <p className="text-gray-300 break-all">{value}</p>
      )}
    </div>
  );
}

function RevenueCard({ label, rate, description }: { label: string; rate: string; description: string }) {
  return (
    <div className="border border-white/10 bg-black/50 p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <span className="text-xs font-black text-magic-blue bg-magic-blue/10 px-2 py-0.5 border border-magic-blue/30">
          {rate}
        </span>
      </div>
      <p className="text-xs text-gray-500 font-mono leading-relaxed">{description}</p>
    </div>
  );
}

export default Admin;
