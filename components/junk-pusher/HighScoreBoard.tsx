import React, { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useGameWallet } from './WalletAdapter';
import { getHighScores, getTopProfits, getPlayerRank, HighScoreEntry } from '../../lib/highScoreService';
import { soundManager } from '../../lib/soundManager';
import { GORBAGANA_CONFIG } from '../../contexts/NetworkContext';

interface HighScoreBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HighScoreBoard: React.FC<HighScoreBoardProps> = ({ isOpen, onClose }) => {
  const wallet = useGameWallet();
  const [scores, setScores] = useState<HighScoreEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<{ rank: number; total: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'score' | 'profit'>('score');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHighScores();
    }
  }, [isOpen, activeTab]);

  const loadHighScores = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const connection = new Connection(GORBAGANA_CONFIG.rpcEndpoint, 'confirmed');
      const programId = new PublicKey(import.meta.env.VITE_SOLANA_PROGRAM_ID || '11111111111111111111111111111111');

      let data: HighScoreEntry[] = [];
      if (activeTab === 'score') {
        data = await getHighScores(connection, programId, 100);
      } else {
        data = await getTopProfits(connection, programId, 100);
      }
      setScores(data);

      if (wallet.isConnected && wallet.publicKey) {
        const { rank, total } = await getPlayerRank(
          connection,
          programId,
          new PublicKey(wallet.publicKey)
        );
        setPlayerRank({ rank, total });
      }
    } catch (err) {
      console.error('Error loading high scores:', err);
      setError('Failed to load leaderboard data. The on-chain program may not be deployed yet.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return '—';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };

  const handleClose = () => {
    soundManager.play('ui_close');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-black border border-magic-green/40 overflow-hidden shadow-[0_0_40px_rgba(173,255,2,0.1)]">

        {/* Header */}
        <div className="relative bg-magic-card border-b border-magic-green/30 px-6 py-5">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-3 mb-1">
            <div className="bg-magic-green text-black p-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">
              Leaderboard
            </h2>
          </div>
          <p className="text-gray-500 text-xs font-mono uppercase tracking-wider">
            Top players on the Gorbagana blockchain
          </p>

          {/* Player Rank */}
          {wallet.isConnected && playerRank && playerRank.rank > 0 && (
            <div className="mt-4 p-3 bg-black border border-magic-green/30">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 text-xs uppercase font-bold">Your Rank</span>
                <span className="text-white font-mono font-bold text-lg">
                  #{playerRank.rank} <span className="text-gray-600 text-xs">/ {playerRank.total}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/20 bg-magic-card">
          <button
            onClick={() => {
              soundManager.play('button_click');
              setActiveTab('score');
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'score'
                ? 'bg-white text-black border-white'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            Top Scores
          </button>
          <button
            onClick={() => {
              soundManager.play('button_click');
              setActiveTab('profit');
            }}
            className={`flex-1 py-3 px-4 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'profit'
                ? 'bg-white text-black border-white'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            Top Profits
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[50vh] p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-magic-green border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-gray-500 font-mono text-xs uppercase tracking-wider">Loading scores...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="text-gray-600 text-4xl mb-4">⚠</div>
              <p className="text-gray-500 font-mono text-sm mb-4">{error}</p>
              <button
                onClick={() => {
                  soundManager.play('button_click');
                  loadHighScores();
                }}
                className="bg-magic-green text-black px-6 py-2 font-bold uppercase tracking-wider text-xs hover:bg-white transition-colors"
              >
                Retry
              </button>
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-600 text-4xl mb-4">—</div>
              <p className="text-gray-500 font-mono text-sm">No scores recorded yet. Be the first!</p>
            </div>
          ) : (
            <div className="border border-white/10 bg-black overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[48px_1fr_100px_100px] sm:grid-cols-[48px_1fr_120px_120px] bg-white/5 text-gray-500 font-mono text-[10px] uppercase border-b border-white/10">
                <div className="p-3 text-center">#</div>
                <div className="p-3">Player</div>
                <div className="p-3 text-right">Score</div>
                <div className="p-3 text-right">Profit</div>
              </div>

              {/* Table Rows */}
              {scores.map((entry) => {
                const isCurrentPlayer = wallet.publicKey === entry.player;
                return (
                  <div
                    key={entry.player}
                    className={`grid grid-cols-[48px_1fr_100px_100px] sm:grid-cols-[48px_1fr_120px_120px] border-b border-white/5 transition-colors ${
                      isCurrentPlayer
                        ? 'bg-magic-green/10 border-l-2 border-l-magic-green'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {/* Rank */}
                    <div className="p-3 text-center">
                      {entry.rank <= 3 ? (
                        <span className={`font-bold text-sm ${
                          entry.rank === 1 ? 'text-yellow-400' :
                          entry.rank === 2 ? 'text-gray-300' :
                          'text-orange-400'
                        }`}>
                          {entry.rank}
                        </span>
                      ) : (
                        <span className="text-gray-600 font-mono text-sm">{entry.rank}</span>
                      )}
                    </div>

                    {/* Player */}
                    <div className="p-3 min-w-0">
                      <div className="font-mono text-sm text-white truncate">
                        {formatAddress(entry.player)}
                      </div>
                      <div className="text-[10px] text-gray-600 font-mono">
                        {formatTimestamp(entry.lastUpdated)}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="p-3 text-right">
                      <span className="text-white font-mono font-bold">
                        {entry.score.toLocaleString()}
                      </span>
                    </div>

                    {/* Profit */}
                    <div className="p-3 text-right">
                      <span className={`font-mono font-bold ${
                        entry.netProfit >= 0 ? 'text-magic-green' : 'text-magic-red'
                      }`}>
                        {entry.netProfit > 0 ? '+' : ''}{entry.netProfit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/20 bg-magic-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
              Data from Gorbagana blockchain
            </span>
            <button
              onClick={() => {
                soundManager.play('button_click');
                loadHighScores();
              }}
              className="bg-white/10 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-colors border border-white/20"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HighScoreBoard;
