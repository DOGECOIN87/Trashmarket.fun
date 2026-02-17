import { Suspense, lazy } from 'react';

// Lazy load the game component for better performance
const CoinPushaGame = lazy(() => import('../../components/coin-pusha/game/CoinPushaGame'));

/**
 * Coin Pusha Game Page
 * 
 * A Web3 arcade game where players can:
 * - Drop coins using JUNK tokens
 * - Win TRASHCOIN rewards
 * - Compete on leaderboards
 * - Connect with Backpack wallet
 */
export default function CoinPushaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-green-400 text-lg font-bold">Loading Coin Pusha...</p>
              <p className="text-gray-400 text-sm mt-2">Initializing game engine...</p>
            </div>
          </div>
        }
      >
        <CoinPushaGame />
      </Suspense>
    </div>
  );
}
