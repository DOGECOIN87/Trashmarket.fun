import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount
} from '@solana/spl-token';
import { useNetwork } from '../contexts/NetworkContext';

const FAUCET_AMOUNT = 5_000_000; // 5 tokens (6 decimals)
const RATE_LIMIT_HOURS = 24;
const STORAGE_KEY = 'sgor_faucet_claims';

// Faucet API configuration
// Set to null to show manual request message
// Set to API URL when server is deployed (e.g., 'https://faucet-api.trashmarket.fun' or 'http://localhost:3001')
const FAUCET_API_URL = null;

interface ClaimRecord {
  wallet: string;
  timestamp: number;
}

const Faucet: React.FC = () => {
  const { publicKey, signTransaction } = useWallet();
  const { isDevnet, rpcEndpoint, currentNetwork } = useNetwork();
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState<Date | null>(null);

  // Test token details (devnet only)
  const TEST_SGOR_MINT = new PublicKey('5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk');
  const FAUCET_AUTHORITY = new PublicKey('Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ');

  useEffect(() => {
    if (publicKey) {
      checkClaimEligibility();
    }
  }, [publicKey]);

  const checkClaimEligibility = () => {
    if (!publicKey) return;

    const claims: ClaimRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const userClaim = claims.find(c => c.wallet === publicKey.toString());

    if (!userClaim) {
      setCanClaim(true);
      setNextClaimTime(null);
      return;
    }

    const hoursSinceClaim = (Date.now() - userClaim.timestamp) / (1000 * 60 * 60);

    if (hoursSinceClaim >= RATE_LIMIT_HOURS) {
      setCanClaim(true);
      setNextClaimTime(null);
    } else {
      setCanClaim(false);
      const nextClaim = new Date(userClaim.timestamp + (RATE_LIMIT_HOURS * 60 * 60 * 1000));
      setNextClaimTime(nextClaim);
    }
  };

  const recordClaim = () => {
    if (!publicKey) return;

    const claims: ClaimRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const updatedClaims = claims.filter(c => c.wallet !== publicKey.toString());
    updatedClaims.push({
      wallet: publicKey.toString(),
      timestamp: Date.now()
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedClaims));
    checkClaimEligibility();
  };

  const handleClaim = async () => {
    if (!publicKey) {
      setMessage({ type: 'error', text: 'Please connect your wallet first' });
      return;
    }

    if (!isDevnet) {
      setMessage({ type: 'error', text: 'Faucet only works on Solana Devnet. Please switch networks.' });
      return;
    }

    if (!canClaim) {
      setMessage({ type: 'error', text: 'You can only claim once every 24 hours' });
      return;
    }

    // Check if API is configured
    if (!FAUCET_API_URL) {
      setMessage({
        type: 'info',
        text: 'Faucet backend service not yet deployed. Please request tokens manually via Discord (#bridge-testing) or GitHub.'
      });
      return;
    }

    setClaiming(true);
    setMessage(null);

    try {
      // Call faucet API
      const response = await fetch(`${FAUCET_API_URL}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toString() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to claim tokens');
      }

      // Success!
      setMessage({
        type: 'success',
        text: `Success! 5 sGOR tokens have been sent to your wallet. Transaction: ${data.signature.slice(0, 8)}...`
      });

      // Record claim for UI
      recordClaim();

      // Show explorer link
      setTimeout(() => {
        setMessage({
          type: 'success',
          text: `Tokens sent! View transaction: ${data.explorerUrl}`
        });
      }, 3000);

    } catch (error: any) {
      console.error('Faucet claim failed:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to claim tokens. Please try again or request manually via Discord.'
      });
    } finally {
      setClaiming(false);
    }
  };

  const formatTimeRemaining = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-magic-dark pt-24 pb-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="border-4 border-magic-green bg-black/50 p-8 mb-6">
          <h1 className="text-4xl font-bold text-magic-green mb-2 tracking-tight">
            TEST TOKEN FAUCET
          </h1>
          <p className="text-gray-400 text-sm">
            Get test sGOR tokens for devnet bridge testing
          </p>
        </div>

        {/* Network Warning */}
        {!isDevnet && (
          <div className="border-2 border-red-500 bg-red-500/10 p-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-2xl">⚠️</span>
              <div>
                <p className="text-red-400 font-bold text-sm">WRONG NETWORK</p>
                <p className="text-red-300 text-xs mt-1">
                  This faucet only works on Solana Devnet. Please switch networks using the dropdown in the navigation bar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Faucet Info */}
        <div className="border-2 border-gray-700 bg-black/30 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">💧</span>
            FAUCET DETAILS
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Token:</span>
              <span className="text-white font-bold">Test sGOR (Devnet)</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Amount per claim:</span>
              <span className="text-magic-green font-bold">5 sGOR</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Rate limit:</span>
              <span className="text-white">1 claim per 24 hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Network:</span>
              <span className="text-blue-400">Solana Devnet Only</span>
            </div>
          </div>
        </div>

        {/* Claim Button */}
        <div className="border-2 border-magic-green bg-black/50 p-6">
          {!publicKey ? (
            <div className="text-center">
              <p className="text-gray-400 mb-4">Connect your wallet to claim test tokens</p>
              <div className="inline-block px-6 py-3 border-2 border-gray-600 bg-gray-800/50 text-gray-500 cursor-not-allowed">
                WALLET NOT CONNECTED
              </div>
            </div>
          ) : !isDevnet ? (
            <div className="text-center">
              <p className="text-red-400 mb-4">Switch to Solana Devnet to claim tokens</p>
              <div className="inline-block px-6 py-3 border-2 border-red-500 bg-red-500/20 text-red-400 cursor-not-allowed">
                WRONG NETWORK
              </div>
            </div>
          ) : !canClaim && nextClaimTime ? (
            <div className="text-center">
              <p className="text-yellow-400 mb-2">You've already claimed recently</p>
              <p className="text-gray-400 text-sm mb-4">
                Next claim available in: <span className="text-white font-bold">{formatTimeRemaining(nextClaimTime)}</span>
              </p>
              <div className="inline-block px-6 py-3 border-2 border-yellow-600 bg-yellow-600/20 text-yellow-400 cursor-not-allowed">
                RATE LIMITED
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400 mb-4">
                Wallet: <span className="text-white font-mono text-xs">{publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}</span>
              </p>
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="px-8 py-4 border-4 border-magic-green bg-magic-green/20 hover:bg-magic-green hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-magic-green font-bold tracking-wide"
              >
                {claiming ? 'CLAIMING...' : 'CLAIM 5 TEST sGOR'}
              </button>
            </div>
          )}

          {/* Status Message */}
          {message && (
            <div className={`mt-6 p-4 border-2 ${
              message.type === 'success' ? 'border-green-500 bg-green-500/10 text-green-400' :
              message.type === 'error' ? 'border-red-500 bg-red-500/10 text-red-400' :
              'border-blue-500 bg-blue-500/10 text-blue-400'
            }`}>
              <p className="text-sm">{message.text}</p>
            </div>
          )}
        </div>

        {/* Alternative Methods */}
        <div className="mt-6 border border-gray-700 bg-black/20 p-6">
          <h3 className="text-lg font-bold text-white mb-3">Alternative Ways to Get Test Tokens</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-magic-green">→</span>
              <span>Request via Discord: <span className="text-white">#bridge-testing</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-magic-green">→</span>
              <span>Open an issue on GitHub: <span className="text-white">github.com/trashmarket</span></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-magic-green">→</span>
              <span>DM on Twitter: <span className="text-white">@trashmarket_fun</span></span>
            </li>
          </ul>
        </div>

        {/* Token Info */}
        <div className="mt-6 border border-gray-700 bg-black/20 p-6">
          <h3 className="text-lg font-bold text-white mb-3">Test Token Information</h3>
          <div className="space-y-2 text-xs font-mono">
            <div>
              <span className="text-gray-400">Mint:</span>
              <br />
              <span className="text-magic-green">5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk</span>
            </div>
            <div className="mt-3">
              <span className="text-gray-400">Decimals:</span> <span className="text-white">6</span>
            </div>
            <div>
              <span className="text-gray-400">Network:</span> <span className="text-blue-400">Solana Devnet</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800">
              <a
                href="https://explorer.solana.com/address/5b2P7TQTDQG4nUzrUUSAuv92NT85Ka4oBFXWcTs9A5zk?cluster=devnet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-magic-green hover:underline"
              >
                View on Solana Explorer →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Faucet;
