import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import type { AirdropRegistration } from '../../../drizzle/schema';
import { ASSETS, BRAND } from '../../../shared/constants';

interface AdminDashboardProps {
  onBack: () => void;
  onLogout: () => void;
}

export default function AdminDashboard({ onBack, onLogout }: AdminDashboardProps) {
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds

  // Fetch all registrations
  const { data: registrations, isLoading, refetch: refetchRegistrations } = trpc.airdrop.exportRegistrations.useQuery();

  // Fetch real-time stats
  const { data: stats, refetch: refetchStats } = trpc.airdrop.getStats.useQuery();

  // Fetch recent registrations
  const { data: recentRegistrations, refetch: refetchRecent } = trpc.airdrop.getRecentRegistrations.useQuery({
    limit: 15,
  });

  // Fetch trend stats
  const { data: trendStats, refetch: refetchTrend } = trpc.airdrop.getRegistrationStats.useQuery();

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetchStats();
      refetchRecent();
      refetchTrend();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refetchStats, refetchRecent, refetchTrend]);

  const handleExportCSV = () => {
    if (!registrations) return;

    const headers = ['ID', 'Twitter Handle', 'Twitter ID', 'Gorbagana Wallet', 'Registered At'];
    const rows = registrations.map((reg) => [
      reg.id,
      reg.twitterHandle,
      reg.twitterId,
      reg.gorbaganaWallet,
      new Date(reg.registeredAt).toISOString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debris-registrations-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleCopyWallets = () => {
    if (!registrations) return;

    const wallets = registrations.map((reg) => reg.gorbaganaWallet).join('\n');
    navigator.clipboard.writeText(wallets);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyJSON = () => {
    if (!registrations) return;

    const json = JSON.stringify(registrations, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
                <p className="text-xs text-[#666666] uppercase tracking-widest">ADMIN DASHBOARD</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="btn-secondary text-sm"
              >
                BACK
              </button>
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
            {/* Auto-Refresh Controls */}
            <div className="card mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[#adff02] uppercase tracking-widest">AUTO-REFRESH</span>
                </label>
                {autoRefresh && (
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="input-field text-sm py-2 px-3"
                  >
                    <option value={2}>Every 2s</option>
                    <option value={5}>Every 5s</option>
                    <option value={10}>Every 10s</option>
                    <option value={30}>Every 30s</option>
                  </select>
                )}
              </div>
              <button
                onClick={() => {
                  refetchStats();
                  refetchRecent();
                  refetchTrend();
                  refetchRegistrations();
                }}
                className="btn-secondary text-sm"
              >
                REFRESH NOW
              </button>
            </div>

            {/* Real-Time Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              <div className="card">
                <p className="text-xs font-bold text-[#adff02] uppercase tracking-widest mb-2">
                  TOTAL REGISTRATIONS
                </p>
                <p className="text-4xl text-glow-green">
                  {isLoading || !stats ? '...' : stats.totalCount}
                </p>
              </div>
              <div className="card">
                <p className="text-xs font-bold text-[#adff02] uppercase tracking-widest mb-2">
                  LAST 24 HOURS
                </p>
                <p className="text-4xl text-glow-green">
                  {isLoading || !stats ? '...' : stats.last24h}
                </p>
              </div>
              <div className="card">
                <p className="text-xs font-bold text-[#adff02] uppercase tracking-widest mb-2">
                  LAST HOUR
                </p>
                <p className="text-4xl text-glow-green">
                  {isLoading || !stats ? '...' : stats.lastHour}
                </p>
              </div>
              <div className="card">
                <p className="text-xs font-bold text-[#adff02] uppercase tracking-widest mb-2">
                  STATUS
                </p>
                <p className="text-2xl text-[#adff02]">
                  {autoRefresh ? '🔴 LIVE' : '⚪ PAUSED'}
                </p>
              </div>
            </div>

            {/* Recent Registrations Feed */}
            <div className="card mb-12">
              <h2 className="text-2xl font-bold text-glow-green mb-6">LIVE FEED - LATEST SIGN-UPS</h2>
              {isLoading || !recentRegistrations || recentRegistrations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#666666] uppercase tracking-widest">
                    {isLoading ? 'LOADING...' : 'NO RECENT REGISTRATIONS'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentRegistrations.map((reg: AirdropRegistration) => (
                    <div
                      key={reg.id}
                      className="bg-[#000000] border border-[#222222] p-4 hover:border-[#adff02] transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-[#adff02] font-bold">@{reg.twitterHandle}</span>
                            <span className="text-xs text-[#666666]">ID: {reg.id}</span>
                          </div>
                          <p className="text-xs text-[#999999] font-mono break-all mb-2">
                            {reg.gorbaganaWallet.substring(0, 20)}...{reg.gorbaganaWallet.substring(reg.gorbaganaWallet.length - 10)}
                          </p>
                          <p className="text-xs text-[#666666]">
                            {formatDate(new Date(reg.registeredAt))}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="inline-block bg-[#080808] border border-[#333333] px-3 py-1 text-xs text-[#adff02] font-bold">
                            NEW
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hourly Trend Chart */}
            {trendStats && trendStats.hourlyTrend.length > 0 && (
              <div className="card mb-12">
                <h2 className="text-2xl font-bold text-glow-green mb-6">REGISTRATION TREND</h2>
                <div className="space-y-3">
                  {trendStats.hourlyTrend.slice(-24).map((stat) => (
                    <div key={stat.hour} className="flex items-center gap-4">
                      <span className="text-xs text-[#666666] w-16">{stat.hour.slice(11, 16)}</span>
                      <div className="flex-1 bg-[#080808] border border-[#222222] h-8 relative overflow-hidden">
                        <div
                          className="bg-[#adff02] h-full transition-all duration-300"
                          style={{
                            width: `${Math.min((stat.count / Math.max(...trendStats.hourlyTrend.map((s) => s.count), 1)) * 100, 100)}%`,
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black">
                          {stat.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Controls */}
            <div className="card mb-12">
              <h2 className="text-2xl font-bold text-glow-green mb-6">EXPORT DATA</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleExportCSV}
                  disabled={isLoading || !registrations}
                  className="btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  EXPORT CSV
                </button>
                <button
                  onClick={handleCopyWallets}
                  disabled={isLoading || !registrations}
                  className="btn-secondary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copied ? 'COPIED!' : 'COPY WALLETS'}
                </button>
                <button
                  onClick={handleCopyJSON}
                  disabled={isLoading || !registrations}
                  className="btn-secondary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  COPY JSON
                </button>
              </div>
            </div>

            {/* All Registrations Table */}
            <div className="card">
              <h2 className="text-2xl font-bold text-glow-green mb-6">ALL REGISTRATIONS</h2>

              {isLoading ? (
                <div className="text-center py-12">
                  <p className="text-[#666666] uppercase tracking-widest">LOADING...</p>
                </div>
              ) : registrations && registrations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#111111]">
                        <th className="text-left py-3 px-4 text-[#adff02] font-bold uppercase tracking-widest">
                          ID
                        </th>
                        <th className="text-left py-3 px-4 text-[#adff02] font-bold uppercase tracking-widest">
                          Twitter
                        </th>
                        <th className="text-left py-3 px-4 text-[#adff02] font-bold uppercase tracking-widest">
                          Wallet
                        </th>
                        <th className="text-left py-3 px-4 text-[#adff02] font-bold uppercase tracking-widest">
                          Registered
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.map((reg: AirdropRegistration) => (
                        <tr key={reg.id} className="border-b border-[#111111] hover:bg-[#080808] transition-colors">
                          <td className="py-3 px-4 text-[#999999]">{reg.id}</td>
                          <td className="py-3 px-4 text-white font-mono">@{reg.twitterHandle}</td>
                          <td className="py-3 px-4 text-[#adff02] font-mono text-xs">
                            {reg.gorbaganaWallet.substring(0, 10)}...{reg.gorbaganaWallet.substring(reg.gorbaganaWallet.length - 10)}
                          </td>
                          <td className="py-3 px-4 text-[#666666] text-xs">
                            {new Date(reg.registeredAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[#666666] uppercase tracking-widest">NO REGISTRATIONS YET</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
