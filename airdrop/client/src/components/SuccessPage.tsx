import type { AirdropRegistration } from '../../../drizzle/schema';
import { ASSETS, BRAND } from '../../../shared/constants';

interface SuccessPageProps {
  registration: AirdropRegistration;
  onLogout: () => void;
  onShowAdmin?: () => void;
}

export default function SuccessPage({ registration, onLogout, onShowAdmin }: SuccessPageProps) {
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
    return wallet.substring(0, 6) + '...' + wallet.substring(wallet.length - 6);
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
              {onShowAdmin && (
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

        {/* Success Section */}
        <section className="py-16">
          <div className="container">
            <div className="max-w-2xl mx-auto">
              {/* Success Message */}
              <div className="text-center mb-12">
                <div className="mb-6">
                  <div className="inline-block">
                    <svg
                      className="w-24 h-24 text-[#adff02]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <h2 className="text-4xl mb-4 text-glow-green">REGISTRATION CONFIRMED</h2>
                <p className="text-[#999999] text-lg">
                  Your wallet has been successfully registered for the DEBRIS airdrop.
                </p>
              </div>

              {/* Registration Details */}
              <div className="card mb-8 space-y-6">
                <div>
                  <p className="text-xs font-bold text-[#adff02] uppercase tracking-widest mb-2">
                    X.com Account
                  </p>
                  <p className="text-white text-lg">@{registration.twitterHandle}</p>
                </div>

                <div className="border-t border-[#111111] pt-6">
                  <p className="text-xs font-bold text-[#adff02] uppercase tracking-widest mb-2">
                    Gorbagana Wallet
                  </p>
                  <div className="bg-[#000000] border border-[#333333] p-4 font-mono text-sm text-[#adff02] break-all">
                    {registration.gorbaganaWallet}
                  </div>
                  <p className="text-xs text-[#666666] mt-2">
                    Masked: {maskWallet(registration.gorbaganaWallet)}
                  </p>
                </div>

                <div className="border-t border-[#111111] pt-6">
                  <p className="text-xs font-bold text-[#adff02] uppercase tracking-widest mb-2">
                    Registration Date
                  </p>
                  <p className="text-white">{formatDate(registration.registeredAt)}</p>
                </div>
              </div>

              {/* What's Next */}
              <div className="bg-[#000800] border border-[#333333] p-6 mb-8">
                <h3 className="text-lg font-bold text-[#adff02] uppercase mb-4">What's Next?</h3>
                <ol className="space-y-3 text-[#999999] text-sm">
                  <li className="flex gap-3">
                    <span className="text-[#adff02] font-bold flex-shrink-0">1.</span>
                    <span>Monitor your wallet for DEBRIS token distribution</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[#adff02] font-bold flex-shrink-0">2.</span>
                    <span>Follow @Trashmarket.fun for airdrop announcements</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[#adff02] font-bold flex-shrink-0">3.</span>
                    <span>Visit Trashmarket.fun to explore the ecosystem</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[#adff02] font-bold flex-shrink-0">4.</span>
                    <span>Trade and use DEBRIS on Gorbagana Chain</span>
                  </li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="https://trashmarket.fun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary py-3 text-center"
                >
                  VISIT TRASHMARKET
                </a>
                <a
                  href="https://trashscan.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary py-3 text-center"
                >
                  VIEW ON EXPLORER
                </a>
              </div>

              {/* Footer Note */}
              <div className="text-center text-[#666666] text-xs uppercase tracking-widest mt-8">
                <p>Your registration is secure and on-chain verified</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
