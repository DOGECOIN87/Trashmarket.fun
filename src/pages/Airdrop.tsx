import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { CheckCircle2, AlertCircle, Loader2, Twitter, Wallet, ExternalLink } from 'lucide-react';
import { type User } from 'firebase/auth';
import {
  signInWithTwitter,
  signOutTwitter,
  onAuthChange,
  getRegistration,
  registerForAirdrop,
  type AirdropRegistration,
} from '../services/airdropService';

const WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const Airdrop: React.FC = () => {
  // Firebase Auth state
  const [twitterUser, setTwitterUser] = useState<User | null>(null);
  const [twitterHandle, setTwitterHandle] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);

  // Registration state
  const [registration, setRegistration] = useState<AirdropRegistration | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Solana wallet (for auto-filling)
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  // Listen for Firebase auth state
  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setTwitterUser(user);
      setAuthLoading(false);
      if (user) {
        const twitterData = user.providerData.find(p => p.providerId === 'twitter.com');
        setTwitterHandle(twitterData?.displayName || user.displayName || '');
        // Check existing registration
        setRegLoading(true);
        try {
          const existing = await getRegistration(user.uid);
          setRegistration(existing);
        } catch (err) {
          console.error('Failed to check registration:', err);
        } finally {
          setRegLoading(false);
        }
      } else {
        setRegistration(null);
        setTwitterHandle('');
      }
    });
    return unsub;
  }, []);

  // Registration count is not available with current security rules
  // (rules only allow users to read their own document)

  // Auto-fill wallet from connected Solana wallet
  useEffect(() => {
    if (connected && publicKey && !walletInput) {
      setWalletInput(publicKey.toBase58());
    }
  }, [connected, publicKey]);

  const handleTwitterLogin = async () => {
    setError('');
    try {
      const { twitterHandle: handle } = await signInWithTwitter();
      setTwitterHandle(handle);
    } catch (err: any) {
      console.error('[Airdrop] Twitter login error:', err?.code, err?.message, err);
      if (err?.code === 'auth/popup-closed-by-user') return;
      if (err?.code === 'auth/internal-error') {
        setError('Authentication failed. Please disable browser extensions and try again, or use an incognito window.');
      } else {
        setError(err?.message || 'Failed to sign in with X');
      }
    }
  };

  const handleTwitterLogout = async () => {
    await signOutTwitter();
    setRegistration(null);
    setTwitterHandle('');
    setWalletInput('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!walletInput.trim()) {
      setError('Please enter a wallet address');
      return;
    }
    if (!WALLET_REGEX.test(walletInput.trim())) {
      setError('Invalid Gorbagana wallet address. Must be 32-44 Base58 characters.');
      return;
    }
    if (!twitterUser) {
      setError('Please sign in with X first');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerForAirdrop(twitterUser.uid, twitterHandle, walletInput.trim());
      const reg = await getRegistration(twitterUser.uid);
      setRegistration(reg);
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const maskWallet = (wallet: string) => {
    if (wallet.length <= 12) return wallet;
    return wallet.substring(0, 6) + '...' + wallet.substring(wallet.length - 6);
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-magic-green animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-mono uppercase text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  // ── SUCCESS STATE ──
  if (twitterUser && registration && !regLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
        {/* Success Header */}
        <div className="text-center mb-12">
          <CheckCircle2 className="w-20 h-20 text-magic-green mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-black text-magic-green mb-4 tracking-tight">
            REGISTRATION CONFIRMED
          </h1>
          <p className="text-gray-400 text-lg">
            Your wallet has been registered for the DEBRIS airdrop.
          </p>
        </div>

        {/* Registration Details */}
        <div className="border border-white/10 bg-black/50 p-6 md:p-8 space-y-6 mb-8">
          <div>
            <p className="text-xs font-bold text-magic-green uppercase tracking-widest mb-2">
              X.com Account
            </p>
            <p className="text-white text-lg font-mono">@{registration.twitterHandle}</p>
          </div>

          <div className="border-t border-white/10 pt-6">
            <p className="text-xs font-bold text-magic-green uppercase tracking-widest mb-2">
              Gorbagana Wallet
            </p>
            <div className="bg-black border border-white/20 p-4 font-mono text-sm text-magic-green break-all">
              {registration.walletAddress}
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <p className="text-xs font-bold text-magic-green uppercase tracking-widest mb-2">
              Registration Date
            </p>
            <p className="text-white font-mono">{formatDate(registration.registeredAt)}</p>
          </div>
        </div>

        {/* What's Next */}
        <div className="border border-white/10 bg-magic-green/5 p-6 mb-8">
          <h3 className="text-lg font-bold text-magic-green uppercase mb-4">What's Next?</h3>
          <ol className="space-y-3 text-gray-400 text-sm font-mono">
            <li className="flex gap-3">
              <span className="text-magic-green font-bold flex-shrink-0">1.</span>
              <span>Monitor your wallet for DEBRIS token distribution</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-green font-bold flex-shrink-0">2.</span>
              <span>Follow @TrashmarketFun for airdrop announcements</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-green font-bold flex-shrink-0">3.</span>
              <span>Explore the Trashmarket ecosystem</span>
            </li>
            <li className="flex gap-3">
              <span className="text-magic-green font-bold flex-shrink-0">4.</span>
              <span>Trade and use DEBRIS on Gorbagana Chain</span>
            </li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <a
            href="https://trashscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3 border border-white/20 bg-black text-white font-bold text-sm uppercase tracking-wider hover:border-magic-green hover:text-magic-green transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View on Explorer
          </a>
          <button
            onClick={handleTwitterLogout}
            className="px-6 py-3 border border-white/20 bg-black text-gray-400 font-bold text-sm uppercase tracking-wider hover:border-red-500 hover:text-red-400 transition-colors"
          >
            Sign Out
          </button>
        </div>

      </div>
    );
  }

  // ── REGISTRATION FORM STATE ──
  if (twitterUser && !registration && !regLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-magic-green mb-4 tracking-tight">
            WELCOME, {(twitterHandle || 'USER').toUpperCase()}
          </h1>
          <p className="text-gray-400 text-lg">
            Your X.com account has been verified. Submit your Gorbagana wallet to complete registration.
          </p>
        </div>

        {/* Form */}
        <div className="border border-white/10 bg-black/50 p-6 md:p-10 mb-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Wallet Input */}
            <div>
              <label className="block text-sm font-bold text-magic-green uppercase tracking-widest mb-4">
                Gorbagana Wallet Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  placeholder="Enter your Gorbagana wallet address"
                  className="flex-1 bg-black border border-white/20 text-white px-4 py-3 font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-magic-green focus:ring-1 focus:ring-magic-green transition-colors"
                  disabled={isSubmitting}
                />
                {connected && publicKey && (
                  <button
                    type="button"
                    onClick={() => setWalletInput(publicKey.toBase58())}
                    className="px-4 py-3 border border-white/20 bg-black text-gray-400 hover:text-magic-green hover:border-magic-green transition-colors text-xs font-bold uppercase"
                    title="Use connected wallet"
                  >
                    <Wallet className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-3 font-mono uppercase tracking-wider">
                Base58 encoded, 32-44 characters
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 p-4">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="border border-white/10 bg-magic-green/5 p-5 text-sm">
              <p className="font-bold text-magic-green uppercase mb-3">Important</p>
              <ul className="space-y-2 text-gray-400 list-disc list-inside font-mono text-xs">
                <li>Only register with a wallet you control</li>
                <li>One registration per X.com account</li>
                <li>DEBRIS tokens will be distributed to this address</li>
                <li>Ensure the address is on Gorbagana Chain</li>
              </ul>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-magic-green text-black font-bold text-lg uppercase tracking-wider hover:bg-[#cbf30c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  REGISTERING...
                </span>
              ) : (
                'REGISTER WALLET'
              )}
            </button>
          </form>
        </div>

        {/* Signed in info */}
        <div className="flex items-center justify-between text-xs text-gray-600 font-mono uppercase tracking-widest">
          <p>Signed in as: <span className="text-magic-green">@{twitterHandle}</span></p>
          <button
            onClick={handleTwitterLogout}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING REGISTRATION STATE ──
  if (twitterUser && regLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-magic-green animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-mono uppercase text-sm">Checking registration...</p>
        </div>
      </div>
    );
  }

  // ── LANDING / LOGIN STATE ──
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
      <div className="flex flex-col items-center text-center">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-5xl md:text-7xl font-black text-magic-green mb-6 tracking-tight leading-tight">
            DEBRIS<br />AIRDROP
          </h1>
          <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
            Verify your X.com account and register your Gorbagana wallet to participate
            in the DEBRIS token airdrop. One registration per account.
          </p>
        </div>

        {/* Steps */}
        <div className="w-full max-w-md space-y-4 mb-12">
          <div className="flex items-start gap-4 text-left">
            <span className="text-magic-green font-black text-xl flex-shrink-0 w-8">01</span>
            <div>
              <h3 className="font-bold text-white mb-1">Authenticate with X.com</h3>
              <p className="text-sm text-gray-500 font-mono">Verify your identity using your X account</p>
            </div>
          </div>
          <div className="flex items-start gap-4 text-left">
            <span className="text-magic-green font-black text-xl flex-shrink-0 w-8">02</span>
            <div>
              <h3 className="font-bold text-white mb-1">Submit Wallet Address</h3>
              <p className="text-sm text-gray-500 font-mono">Provide your Gorbagana wallet for distribution</p>
            </div>
          </div>
          <div className="flex items-start gap-4 text-left">
            <span className="text-magic-green font-black text-xl flex-shrink-0 w-8">03</span>
            <div>
              <h3 className="font-bold text-white mb-1">Receive DEBRIS</h3>
              <p className="text-sm text-gray-500 font-mono">Get your DEBRIS tokens on Gorbagana Chain</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleTwitterLogin}
          className="flex items-center justify-center gap-3 px-12 py-4 bg-magic-green text-black font-bold text-lg uppercase tracking-wider hover:bg-[#cbf30c] transition-all duration-200 hover:scale-105 active:scale-95 mb-6"
        >
          <Twitter className="w-5 h-5" />
          SIGN IN WITH X.COM
        </button>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm mt-2">
            <AlertCircle className="w-4 h-4" />
            <p>{error}</p>
          </div>
        )}

        <p className="text-gray-600 text-xs uppercase tracking-widest font-mono mt-4">
          Secure &bull; Verified &bull; On-Chain
        </p>

      </div>
    </div>
  );
};

export default Airdrop;
