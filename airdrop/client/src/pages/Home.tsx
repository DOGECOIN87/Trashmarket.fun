import { useEffect, useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { trpc } from '@/lib/trpc';
import { ASSETS, BRAND, COLORS } from '../../../shared/constants';
import RegistrationForm from '@/components/RegistrationForm';
import SuccessPage from '@/components/SuccessPage';
import AdminDashboard from '@/components/AdminDashboard';
import AdminAccessDenied from '@/components/AdminAccessDenied';

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminWalletVerified, setAdminWalletVerified] = useState<boolean | null>(null);

  // Fetch existing registration
  const { data: registration, isLoading: regLoading } = trpc.airdrop.getRegistration.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Verify admin wallet mutation
  const verifyWalletMutation = trpc.airdrop.verifyAdminWallet.useMutation({
    onSuccess: (result: any) => {
      setAdminWalletVerified(result.isAuthorized);
      if (result.isAuthorized) {
        setShowAdmin(true);
      }
    },
    onError: (error: any) => {
      console.error('Wallet verification failed:', error);
      setAdminWalletVerified(false);
    },
  });

  const handleLogout = async () => {
    await logout();
    setShowAdmin(false);
    setAdminWalletVerified(null);
  };

  const handleShowAdmin = async () => {
    if (registration?.gorbaganaWallet) {
      verifyWalletMutation.mutate({ wallet: registration.gorbaganaWallet });
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-glow-blue text-2xl mb-4">INITIALIZING...</div>
          <div className="animate-pulse text-[#666666]">Loading DEBRIS Airdrop Registration</div>
        </div>
      </div>
    );
  }

  // Show access denied if wallet is not authorized
  if (isAuthenticated && user?.role === 'admin' && showAdmin && adminWalletVerified === false) {
    return <AdminAccessDenied onLogout={handleLogout} />;
  }

  // Show admin dashboard if user is admin, requested, and wallet verified
  if (isAuthenticated && user?.role === 'admin' && showAdmin && adminWalletVerified === true) {
    return (
      <AdminDashboard onBack={() => setShowAdmin(false)} onLogout={handleLogout} />
    );
  }

  // Show success page if already registered
  if (isAuthenticated && registration && !regLoading) {
    return (
      <SuccessPage
        registration={registration}
        onLogout={handleLogout}
        onShowAdmin={user?.role === 'admin' ? handleShowAdmin : undefined}
      />
    );
  }

  // Show registration form if authenticated but not registered
  if (isAuthenticated && !registration && !regLoading) {
    return (
      <RegistrationForm
        user={user}
        onLogout={handleLogout}
        onShowAdmin={user?.role === 'admin' ? handleShowAdmin : undefined}
      />
    );
  }

  // Show login page if not authenticated
  return (
    <div className="min-h-screen bg-black relative overflow-hidden flex flex-col">
      {/* Animated SVG background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <img
          src={ASSETS.PATTERN}
          alt="background pattern"
          className="w-full h-full object-cover animated-bg"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Header */}
        <header className="border-b border-[#333333] py-6">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center justify-center gap-3">
              <img
                src={ASSETS.LOGO}
                alt="DEBRIS Logo"
                className="w-12 h-12"
              />
              <div className="text-center">
                <h1 className="text-2xl text-glow-blue font-bold">{BRAND.NAME}</h1>
                <p className="text-xs text-[#666666] uppercase tracking-widest">{BRAND.SUBTITLE}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section - Centered with Image */}
        <section className="flex-1 py-12 md:py-16 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 w-full">
            <div className="flex flex-col items-center text-center">
              {/* Hero Image - Top */}
              <div className="mb-12 w-full max-w-md">
                <div className="relative aspect-square">
                  <img
                    src={ASSETS.HERO}
                    alt="DEBRIS Airdrop"
                    className="w-full h-full object-cover border border-[#333333]"
                  />
                  <div className="absolute inset-0 border border-[#adff02] opacity-50 pointer-events-none"></div>
                </div>
              </div>

              {/* Text Content - Centered Below Image */}
              <div className="max-w-2xl">
                <h2 className="text-5xl md:text-6xl mb-6 text-glow-blue leading-tight font-bold tracking-tight">
                  REGISTER FOR<br />THE DEBRIS<br />AIRDROP
                </h2>
                <p className="text-[#999999] mb-10 leading-relaxed text-base md:text-lg">
                  Verify your X.com account and register your Gorbagana wallet to participate in the DEBRIS token airdrop. One registration per account.
                </p>

                {/* Steps */}
                <div className="space-y-4 mb-12">
                  <div className="flex items-start justify-center gap-4">
                    <span className="text-[#adff02] font-bold text-xl flex-shrink-0">01</span>
                    <div className="text-left">
                      <h3 className="font-bold text-white mb-1">Authenticate with X.com</h3>
                      <p className="text-sm text-[#666666]">Verify your identity using your X.com account</p>
                    </div>
                  </div>
                  <div className="flex items-start justify-center gap-4">
                    <span className="text-[#adff02] font-bold text-xl flex-shrink-0">02</span>
                    <div className="text-left">
                      <h3 className="font-bold text-white mb-1">Submit Wallet Address</h3>
                      <p className="text-sm text-[#666666]">Provide your Gorbagana wallet for token distribution</p>
                    </div>
                  </div>
                  <div className="flex items-start justify-center gap-4">
                    <span className="text-[#adff02] font-bold text-xl flex-shrink-0">03</span>
                    <div className="text-left">
                      <h3 className="font-bold text-white mb-1">Receive DEBRIS</h3>
                      <p className="text-sm text-[#666666]">Get your DEBRIS tokens on Gorbagana Chain</p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <a
                  href={getLoginUrl()}
                  className="btn-primary inline-block px-12 py-4 text-lg font-bold hover:bg-[#cbf30c] transition-all duration-200 transform hover:scale-105 active:scale-95 mb-6"
                >
                  AUTHENTICATE WITH X.COM
                </a>
                <p className="text-[#666666] text-xs uppercase tracking-widest">
                  Secure • Verified • On-Chain
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#333333] py-8 mt-auto">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center text-[#666666] text-xs uppercase tracking-widest space-y-2">
              <p>DEBRIS Airdrop Registration • Powered by Trashmarket.fun</p>
              <p>Gorbagana Chain • {new Date().getFullYear()}</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
