import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { User } from '../../../drizzle/schema';
import { ASSETS, BRAND, isValidGorbaganaWallet } from '../../../shared/constants';

interface RegistrationFormProps {
  user: User | null;
  onLogout: () => void;
  onShowAdmin?: () => void;
}

export default function RegistrationForm({ user, onLogout, onShowAdmin }: RegistrationFormProps) {
  const [wallet, setWallet] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registerMutation = trpc.airdrop.register.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate wallet format
    if (!wallet.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    if (!isValidGorbaganaWallet(wallet)) {
      setError('Invalid Gorbagana wallet address format. Must be 32-44 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      await registerMutation.mutateAsync({
        gorbaganaWallet: wallet.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated SVG background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <img
          src={ASSETS.PATTERN}
          alt="background pattern"
          className="w-full h-full object-cover animated-bg"
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[#333333] py-6">
          <div className="container flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={ASSETS.LOGO}
                alt="DEBRIS Logo"
                className="w-12 h-12"
              />
              <div>
                <h1 className="text-2xl text-glow-green">{BRAND.NAME}</h1>
                <p className="text-xs text-[#666666] uppercase tracking-widest">{BRAND.SUBTITLE}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user?.role === 'admin' && onShowAdmin && (
                <button
                  onClick={onShowAdmin}
                  className="btn-secondary text-sm"
                >
                  ADMIN
                </button>
              )}
              <button
                onClick={onLogout}
                className="btn-secondary text-sm"
              >
                LOGOUT
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <section className="py-16">
          <div className="container">
            <div className="max-w-2xl mx-auto">
              {/* Welcome */}
              <div className="mb-12 text-center">
                <h2 className="text-4xl mb-4 text-glow-green">WELCOME, {user?.name?.toUpperCase() || 'USER'}</h2>
                <p className="text-[#999999]">
                  Your X.com account has been verified. Now submit your Gorbagana wallet address to complete registration.
                </p>
              </div>

              {/* Form */}
              <div className="card mb-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Wallet Address Input */}
                  <div>
                    <label className="block text-sm font-bold text-[#adff02] uppercase tracking-widest mb-3">
                      Gorbagana Wallet Address
                    </label>
                    <input
                      type="text"
                      value={wallet}
                      onChange={(e) => setWallet(e.target.value)}
                      placeholder="Enter your Gorbagana wallet address (32-44 characters)"
                      className="input-field w-full"
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-[#666666] mt-2 uppercase tracking-widest">
                      Format: Base58 encoded address (e.g., 1A1z7agoat2Ld7hkQnLzktDG2sKqKN62Iy)
                    </p>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-[#1a0000] border border-[#ff2222] p-4 text-[#ff2222] text-sm">
                      <p className="font-bold uppercase">ERROR</p>
                      <p>{error}</p>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-[#000800] border border-[#333333] p-4 text-[#999999] text-sm">
                    <p className="font-bold text-[#adff02] uppercase mb-2">Important</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Only register with a wallet you control</li>
                      <li>One wallet per X.com account</li>
                      <li>DEBRIS tokens will be distributed to this address</li>
                      <li>Ensure the address is on Gorbagana Chain</li>
                    </ul>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'REGISTERING...' : 'REGISTER WALLET'}
                  </button>
                </form>
              </div>

              {/* User Info */}
              <div className="text-center text-[#666666] text-xs uppercase tracking-widest">
                <p>Logged in as: <span className="text-[#adff02]">{user?.email || user?.openId}</span></p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
