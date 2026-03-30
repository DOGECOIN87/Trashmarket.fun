import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { doc, getDoc, setDoc, collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase.config';
import { type User } from 'firebase/auth';
import { signInWithTwitter, signOutTwitter, onAuthChange } from '../services/airdropService';
import { RPC_ENDPOINTS } from '../lib/rpcConfig';
import {
  Shield, ShieldOff, Lock, Power, Pause, Play, Eye, Twitter,
  TrendingUp, Users, Coins, LayoutDashboard, RefreshCw,
  ExternalLink, Wallet, CircleDot, Loader2, LogOut, Rocket,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  subscribeToPendingSubmissions,
  approveSubmission,
  rejectSubmission,
} from '../services/submissionService';
import { CollectionSubmission } from '../types';

const ADMIN_WALLET = 'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo';

// Treasury wallets to track
const TREASURY_WALLETS = [
  { label: 'Platform Fees', address: 'Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ' },
  { label: 'NFT Marketplace', address: '77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb' },
];

// All app pages
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

interface PageStatus {
  [pageId: string]: boolean;
}

interface TreasuryBalance {
  address: string;
  label: string;
  balance: number | null;
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

const Admin: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const address = publicKey?.toBase58() || null;

  // Firebase Auth state (Twitter/X)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [pageStatuses, setPageStatuses] = useState<PageStatus>({});
  const [treasuryBalances, setTreasuryBalances] = useState<TreasuryBalance[]>([]);
  const [airdropCount, setAirdropCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Submissions state
  const [pendingSubmissions, setPendingSubmissions] = useState<CollectionSubmission[]>([]);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const isWalletAdmin = connected && address === ADMIN_WALLET;
  const isFullyAuthed = isWalletAdmin && firebaseUser !== null;

  // Listen for Firebase Auth state
  useEffect(() => {
    const unsub = onAuthChange((user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (user) {
        console.log('[Admin] Firebase UID:', user.uid);
      }
    });
    return unsub;
  }, []);

  // Twitter sign-in for admin
  const handleTwitterLogin = async () => {
    setAuthError('');
    try {
      await signInWithTwitter();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') return;
      setAuthError(err?.message || 'Failed to sign in with X');
    }
  };

  const handleTwitterLogout = async () => {
    await signOutTwitter();
    setFirebaseUser(null);
  };

  // Real-time subscription for pending submissions
  useEffect(() => {
    if (!isFullyAuthed) return;
    const unsub = subscribeToPendingSubmissions(setPendingSubmissions);
    return unsub;
  }, [isFullyAuthed]);

  const handleApprove = async (id: string) => {
    if (!address) return;
    setReviewingId(id);
    try {
      await approveSubmission(id, address, reviewNotes[id]);
      setExpandedSubmission(null);
    } catch (err) {
      console.error('[Admin] Approve failed:', err);
    } finally {
      setReviewingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!address) return;
    setReviewingId(id);
    try {
      await rejectSubmission(id, address, reviewNotes[id]);
      setExpandedSubmission(null);
    } catch (err) {
      console.error('[Admin] Reject failed:', err);
    } finally {
      setReviewingId(null);
    }
  };

  // Load page statuses from Firestore
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
    } catch (err) {
      console.error('[Admin] Failed to load page statuses:', err);
      const defaults: PageStatus = {};
      APP_PAGES.forEach(p => { defaults[p.id] = true; });
      setPageStatuses(defaults);
    }
  }, []);

  // Load treasury balances
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

  // Load airdrop registration count
  const loadAirdropCount = useCallback(async () => {
    try {
      const colRef = collection(db, 'airdrop_registrations');
      const snap = await getCountFromServer(colRef);
      setAirdropCount(snap.data().count);
    } catch (err) {
      console.error('[Admin] Failed to load airdrop count:', err);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    if (!isFullyAuthed) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([loadPageStatuses(), loadTreasuryBalances(), loadAirdropCount()]);
      setLoading(false);
      setLastRefresh(new Date());
    };
    load();
  }, [isFullyAuthed, loadPageStatuses, loadTreasuryBalances, loadAirdropCount]);

  // Refresh all data
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPageStatuses(), loadTreasuryBalances(), loadAirdropCount()]);
    setLastRefresh(new Date());
    setRefreshing(false);
  };

  // Toggle page status
  const togglePage = async (pageId: string) => {
    const newStatuses = { ...pageStatuses, [pageId]: !pageStatuses[pageId] };
    setPageStatuses(newStatuses);
    try {
      await setDoc(doc(db, 'site_config', 'page_statuses'), newStatuses);
    } catch (err) {
      console.error('[Admin] Failed to save page status:', err);
      setPageStatuses(pageStatuses);
    }
  };

  // ── GATE 1: Wallet not connected ──
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

  // ── GATE 3: Wallet correct, need Twitter auth ──
  if (!firebaseUser) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 border-2 border-magic-green/30 rounded-full flex items-center justify-center">
            <Shield className="w-10 h-10 text-magic-green" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3 tracking-tight">VERIFY IDENTITY</h1>
          <p className="text-gray-500 text-sm font-mono mb-6">
            Wallet verified. Sign in with X to unlock the admin panel.
          </p>
          {authLoading ? (
            <Loader2 className="w-6 h-6 text-magic-green animate-spin mx-auto" />
          ) : (
            <button
              onClick={handleTwitterLogin}
              className="flex items-center justify-center gap-3 px-8 py-3 bg-magic-green text-black font-bold text-sm uppercase tracking-wider hover:bg-[#cbf30c] transition-all mx-auto"
            >
              <Twitter className="w-4 h-4" />
              SIGN IN WITH X
            </button>
          )}
          {authError && (
            <p className="text-red-400 text-xs mt-4 font-mono">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  // ── GATE 4: Loading dashboard data ──
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-magic-green animate-spin mx-auto mb-4" />
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 border border-magic-green/50 bg-magic-green/10 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-magic-green" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">ADMIN PANEL</h1>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 bg-black text-gray-400 hover:text-magic-green hover:border-magic-green transition-all text-xs font-bold uppercase tracking-wider disabled:opacity-50"
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

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
        <StatCard
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="Total Pages"
          value={APP_PAGES.length.toString()}
          accent="text-white"
        />
        <StatCard
          icon={<Power className="w-5 h-5" />}
          label="Live"
          value={livePages.toString()}
          accent="text-magic-green"
        />
        <StatCard
          icon={<Pause className="w-5 h-5" />}
          label="Paused"
          value={pausedPages.toString()}
          accent={pausedPages > 0 ? 'text-amber-400' : 'text-gray-500'}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Airdrop Signups"
          value={airdropCount.toString()}
          accent="text-cyan-400"
        />
        <StatCard
          icon={<Rocket className="w-5 h-5" />}
          label="Pending Drops"
          value={pendingSubmissions.length.toString()}
          accent={pendingSubmissions.length > 0 ? 'text-amber-400' : 'text-gray-500'}
        />
      </div>

      {/* Treasury Section */}
      <div className="mb-10">
        <SectionHeader icon={<Coins className="w-4 h-4" />} title="Treasury" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="border border-magic-green/30 bg-magic-green/5 p-5">
            <p className="text-xs font-bold text-magic-green uppercase tracking-widest mb-2">Total Balance</p>
            <p className="text-3xl font-black text-magic-green">
              {totalTreasury.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </p>
            <p className="text-xs text-gray-500 font-mono mt-1">GOR</p>
          </div>
          {treasuryBalances.map((t) => (
            <div key={t.address} className="border border-white/10 bg-black/50 p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t.label}</p>
                <a
                  href={`https://explorer.gorbagana.wtf/address/${t.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-magic-green transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-2xl font-black text-white">
                {t.balance !== null
                  ? t.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                  : '—'}
              </p>
              <p className="text-xs text-gray-600 font-mono mt-1 truncate">{t.address}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue / Profit Section */}
      <div className="mb-10">
        <SectionHeader icon={<TrendingUp className="w-4 h-4" />} title="Revenue" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <RevenueCard
            label="Marketplace Fees"
            rate="2.5%"
            description="Platform fee on all NFT & domain trades"
          />
          <RevenueCard
            label="Raffle Fees"
            rate="2.5-10%"
            description="Scales with raffle duration (6h to 48h+)"
          />
          <RevenueCard
            label="Game Revenue"
            rate="House Edge"
            description="Junk Pusher & Slots treasury accumulation"
          />
        </div>
      </div>

      {/* Launchpad Submissions */}
      <div className="mb-10">
        <SectionHeader icon={<Rocket className="w-4 h-4" />} title="Launchpad Submissions" />
        {pendingSubmissions.length === 0 ? (
          <div className="border border-white/10 bg-black/50 p-8 text-center">
            <Clock className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">No pending submissions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingSubmissions.map(sub => {
              const isExpanded = expandedSubmission === sub.id;
              const isReviewing = reviewingId === sub.id;
              return (
                <div key={sub.id} className="border border-amber-500/30 bg-amber-500/5">
                  {/* Row */}
                  <button
                    onClick={() => setExpandedSubmission(isExpanded ? null : sub.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors"
                  >
                    {sub.logoUrl ? (
                      <img src={sub.logoUrl} alt={sub.name} className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Rocket className="w-4 h-4 text-amber-400" />
                      </div>
                    )}
                    <div className="flex-grow min-w-0">
                      <p className="text-white font-bold text-sm truncate">{sub.name} <span className="text-magic-green font-mono text-xs">{sub.symbol}</span></p>
                      <p className="text-gray-500 text-[10px] font-mono truncate">{sub.submittedBy}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider hidden sm:block">
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-white/10 p-4 space-y-4">
                      {/* Banner */}
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
                        {sub.contractAddress && <Field label="Contract" value={`${sub.contractAddress.slice(0, 8)}…`} link={`https://explorer.gorbagana.wtf/address/${sub.contractAddress}`} />}
                      </div>

                      {/* Sample images */}
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

                      {/* Review notes */}
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Review Notes (optional)</p>
                        <textarea
                          rows={2}
                          value={reviewNotes[sub.id] ?? ''}
                          onChange={e => setReviewNotes(n => ({ ...n, [sub.id]: e.target.value }))}
                          placeholder="Add notes for the submitter..."
                          className="w-full bg-black border border-white/20 text-white text-xs font-mono px-3 py-2 resize-none focus:outline-none focus:border-magic-green/50 placeholder-gray-700"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(sub.id)}
                          disabled={isReviewing}
                          className="flex items-center gap-2 px-5 py-2.5 bg-magic-green text-black font-bold text-xs uppercase tracking-wider hover:bg-[#cbf30c] transition-all disabled:opacity-50"
                        >
                          {isReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(sub.id)}
                          disabled={isReviewing}
                          className="flex items-center gap-2 px-5 py-2.5 border border-red-500/50 text-red-400 font-bold text-xs uppercase tracking-wider hover:bg-red-500/10 transition-all disabled:opacity-50"
                        >
                          {isReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pages Control */}
      <div>
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
                        isLive
                          ? 'border-white/10 bg-black/50 hover:border-white/20'
                          : 'border-amber-500/30 bg-amber-500/5'
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
                        <span className={`text-xs font-bold uppercase tracking-wider ${isLive ? 'text-magic-green' : 'text-amber-400'}`}>
                          {isLive ? 'LIVE' : 'PAUSED'}
                        </span>
                        <button
                          onClick={() => togglePage(page.id)}
                          className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
                            isLive ? 'bg-magic-green/30 border border-magic-green/50' : 'bg-gray-800 border border-gray-700'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
                              isLive
                                ? 'left-[calc(100%-22px)] bg-magic-green'
                                : 'left-0.5 bg-gray-600'
                            }`}
                          >
                            {isLive
                              ? <Play className="w-2.5 h-2.5 text-black" />
                              : <Pause className="w-2.5 h-2.5 text-gray-400" />
                            }
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
          <span>{address}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600 font-mono">
          <CircleDot className="w-3 h-3 text-magic-green" />
          <span>UID: {firebaseUser.uid}</span>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ──

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="border border-white/10 bg-black/50 p-4 md:p-5">
      <div className={`mb-3 ${accent}`}>{icon}</div>
      <p className={`text-2xl md:text-3xl font-black ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-magic-green">{icon}</span>
      <h2 className="text-sm font-black text-white uppercase tracking-widest">{title}</h2>
    </div>
  );
}

function Field({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">{label}</p>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-magic-green hover:underline break-all flex items-center gap-1">
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
        <span className="text-xs font-black text-magic-green bg-magic-green/10 px-2 py-0.5 border border-magic-green/30">
          {rate}
        </span>
      </div>
      <p className="text-xs text-gray-500 font-mono leading-relaxed">{description}</p>
    </div>
  );
}

export default Admin;
