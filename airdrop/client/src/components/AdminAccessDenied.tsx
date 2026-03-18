import { ASSETS, BRAND } from '../../../shared/constants';

interface AdminAccessDeniedProps {
  onLogout: () => void;
}

export default function AdminAccessDenied({ onLogout }: AdminAccessDeniedProps) {
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
                <p className="text-xs text-[#666666] uppercase tracking-widest">AIRDROP REGISTRATION</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="btn-secondary text-sm"
            >
              LOGOUT
            </button>
          </div>
        </header>

        {/* Access Denied Content */}
        <section className="py-16">
          <div className="container">
            <div className="max-w-2xl mx-auto text-center">
              {/* Error Icon */}
              <div className="mb-8">
                <div className="inline-block">
                  <svg
                    className="w-24 h-24 text-[#ff2222]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4v2m0 0v2m0-6h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>

              {/* Error Message */}
              <h2 className="text-4xl mb-4 text-[#ff2222]">ACCESS DENIED</h2>
              <p className="text-[#999999] text-lg mb-8">
                Your wallet is not authorized to access the admin dashboard.
              </p>

              {/* Info Box */}
              <div className="card mb-8">
                <div className="bg-[#1a0000] border border-[#ff2222] p-6 text-left">
                  <p className="text-sm text-[#ff2222] font-bold uppercase mb-3">AUTHORIZATION REQUIRED</p>
                  <ul className="space-y-2 text-[#999999] text-sm">
                    <li className="flex gap-2">
                      <span className="text-[#ff2222]">•</span>
                      <span>Admin dashboard access is restricted to authorized wallets only</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#ff2222]">•</span>
                      <span>Contact the project owner to request access</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#ff2222]">•</span>
                      <span>Ensure you are using the correct wallet address</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="/"
                  className="btn-secondary py-3 text-center"
                >
                  BACK TO HOME
                </a>
                <button
                  onClick={onLogout}
                  className="btn-primary py-3"
                >
                  LOGOUT & TRY ANOTHER WALLET
                </button>
              </div>

              {/* Footer Note */}
              <div className="text-center text-[#666666] text-xs uppercase tracking-widest mt-8">
                <p>If you believe this is an error, please contact support</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
