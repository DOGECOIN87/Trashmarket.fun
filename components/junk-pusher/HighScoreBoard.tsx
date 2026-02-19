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

  useEffect(() => {
    if (isOpen) {
      loadHighScores();
    }
  }, [isOpen, activeTab]);

  const loadHighScores = async () => {
    setIsLoading(true);
    try {
      const connection = new Connection(GORBAGANA_CONFIG.rpcEndpoint, 'confirmed');
      const programId = new PublicKey(import.meta.env.VITE_SOLANA_PROGRAM_ID || '11111111111111111111111111111111');

      // Fetch data based on active tab
      let data: HighScoreEntry[] = [];
      if (activeTab === 'score') {
        data = await getHighScores(connection, programId, 100);
      } else {
        data = await getTopProfits(connection, programId, 100);
      }
      setScores(data);

      // Fetch player rank if wallet is connected
      if (wallet.isConnected && wallet.publicKey) {
        const { rank, total } = await getPlayerRank(
          connection,
          programId,
          new PublicKey(wallet.publicKey)
        );
        setPlayerRank({ rank, total });
      }
    } catch (error) {
      console.error('Error loading high scores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0d3d24] border-2 border-green-500/60 rounded-lg overflow-hidden shadow-[0_0_50px_rgba(0,255,0,0.3)]">

        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#1a5f3f] to-[#0d3d24] border-b-2 border-green-500/40 p-6">
          {/* Close Button */}
          <button
            onClick={() => {
              soundManager.play('ui_close');
              onClose();
            }}
            className="absolute top-4 right-4 p-2 text-green-500/50 hover:text-green-400 transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title */}
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white uppercase tracking-tight mb-2 drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">
            HIGH SCORES
          </h2>
          <p className="text-green-300/70 text-sm font-[Inter]">
            Top players on the Gorbagana blockchain
          </p>

          {/* Player Rank (if connected) */}
          {wallet.isConnected && playerRank && playerRank.rank > 0 && (
            <div className="mt-4 p-3 bg-black/40 border border-green-500/30 rounded">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-400 font-[Inter]">Your Rank:</span>
                <span className="font-heading text-lg text-white">
                  #{playerRank.rank} <span className="text-green-400/60 text-xs">/ {playerRank.total}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-green-500/30 bg-black/20">
          <button
            onClick={() => {
              soundManager.play('button_click');
              setActiveTab('score');
            }}
            className={`flex-1 py-3 px-4 font-heading text-sm uppercase tracking-wider transition-all ${activeTab === 'score'
              ? 'bg-green-900/50 text-green-300 border-b-2 border-green-400'
              : 'text-green-500/50 hover:text-green-400 hover:bg-green-900/20'
              }`}
          >
            Top Scores
          </button>
          <button
            onClick={() => {
              soundManager.play('button_click');
              setActiveTab('profit');
            }}
            className={`flex-1 py-3 px-4 font-heading text-sm uppercase tracking-wider transition-all ${activeTab === 'profit'
              ? 'bg-green-900/50 text-green-300 border-b-2 border-green-400'
              : 'text-green-500/50 hover:text-green-400 hover:bg-green-900/20'
              }`}
          >
            Top Profits
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-green-300">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-mono text-sm uppercase tracking-widest">Loading...</span>
              </div>
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-green-400/60 font-[Inter]">No scores recorded yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scores.map((entry, index) => (
                <div
                  key={entry.player}
                  className={`flex items-center gap-4 p-3 rounded border transition-all ${wallet.publicKey === entry.player
                    ? 'bg-green-900/40 border-green-400 shadow-[0_0_15px_rgba(0,255,0,0.2)]'
                    : 'bg-black/20 border-green-500/20 hover:border-green-500/40 hover:bg-black/30'
                    }`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 text-center">
                    {entry.rank <= 3 ? (
                      <div className={`font-heading text-2xl ${entry.rank === 1 ? 'text-yellow-400' :
                        entry.rank === 2 ? 'text-gray-300' :
                          'text-orange-400'
                        }`}>
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                      </div>
                    ) : (
                      <div className="font-heading text-lg text-green-400/60">
                        #{entry.rank}
                      </div>
                    )}
                  </div>

                  {/* Player Address */}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-green-300 truncate">
                      {formatAddress(entry.player)}
                    </div>
                    <div className="text-xs text-green-500/50 font-[Inter]">
                      {formatTimestamp(entry.lastUpdated)}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 text-right">
                    <div>
                      <div className="text-xs text-green-400/60 uppercase font-[Inter]">Score</div>
                      <div className="font-heading text-lg text-white">{entry.score.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-green-400/60 uppercase font-[Inter]">Profit</div>
                      <div className={`font-heading text-lg ${entry.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {entry.netProfit > 0 ? '+' : ''}{entry.netProfit}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-green-500/30 bg-black/20 p-4">
          <div className="flex items-center justify-between text-xs text-green-400/60 font-[Inter]">
            <div>
              Data queried from Gorbagana blockchain
            </div>
            <button
              onClick={() => {
                soundManager.play('button_click');
                loadHighScores();
              }}
              className="px-3 py-1 bg-green-900/30 border border-green-500/30 rounded hover:bg-green-900/50 hover:border-green-400/50 transition-all text-green-300 uppercase tracking-wider"
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
