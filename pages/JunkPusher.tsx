import { Suspense, lazy } from 'react';
import { useNetwork } from '../contexts/NetworkContext';

// Lazy load the game component for better performance
const JunkPusherGame = lazy(() => import('../components/junk-pusher/JunkPusherGame'));

/**
 * Junk Pusher Game Page
 * 
 * A Web3 arcade game where players can:
 * - Drop coins using JUNK tokens
 * - Win TRASHCOIN rewards
 * - Compete on leaderboards
 * - Connect with Backpack wallet
 * 
 * NOTE: This game is only available on the Gorbagana network.
 */
export default function JunkPusherPage() {
    const { isGorbagana } = useNetwork();

    if (!isGorbagana) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="text-6xl mb-6">🔒</div>
                    <h1 className="text-3xl font-bold text-white mb-4">Network Restricted</h1>
                    <p className="text-gray-400 mb-6">
                        The Junk Pusher game is only available on the <span className="text-green-400 font-bold">Gorbagana Network</span>.
                    </p>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-left">
                        <p className="text-sm text-gray-400 mb-2">To play:</p>
                        <ol className="text-sm text-gray-300 space-y-2">
                            <li>1. Switch your wallet to <strong className="text-green-400">Gorbagana Network</strong></li>
                            <li>2. Make sure you're connected to Gorbagana in the navbar</li>
                            <li>3. Return to this page</li>
                        </ol>
                    </div>
                    <p className="text-xs text-gray-500 mt-6">
                        The Junk Pusher game requires GOR tokens and operates exclusively on Gorbagana.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-var(--navbar-height,0px))] bg-gradient-to-b from-gray-900 via-gray-800 to-black overflow-hidden">
            <Suspense
                fallback={
                    <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
                            <p className="text-green-400 text-lg font-bold">Loading Junk Pusher...</p>
                            <p className="text-gray-400 text-sm mt-2">Initializing game engine...</p>
                        </div>
                    </div>
                }
            >
                <JunkPusherGame />
            </Suspense>
        </div>
    );
}
