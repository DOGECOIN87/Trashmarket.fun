import { Suspense, lazy } from 'react';
import { useNetwork } from '../contexts/NetworkContext';

// Lazy load the game component for better performance
const SkillGame = lazy(() => import('../components/slots/SkillGame'));

/**
 * Slots Game Page
 * 
 * A Web3 arcade slots game where players can:
 * - Spin the reels with various trash-themed symbols
 * - Win credits with matching symbols
 * - Compete for high scores
 * - Enjoy arcade-style gameplay
 */
export default function SlotsPage() {
    const { isGorbagana } = useNetwork();

    if (!isGorbagana) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center pt-20">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="text-6xl mb-6">🔒</div>
                    <h1 className="text-3xl font-bold text-white mb-4">Network Restricted</h1>
                    <p className="text-gray-400 mb-6">
                        The Skill Slots game is only available on the <span className="text-adff02 font-bold">Gorbagana Network</span>.
                    </p>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-left">
                        <p className="text-sm text-gray-400 mb-2">To play:</p>
                        <ol className="text-sm text-gray-300 space-y-2">
                            <li>1. Switch your wallet to <strong className="text-adff02">Gorbagana Network</strong></li>
                            <li>2. Make sure you're connected to Gorbagana in the navbar</li>
                            <li>3. Return to this page</li>
                        </ol>
                    </div>
                    <p className="text-xs text-gray-500 mt-6">
                        This game operates exclusively on Gorbagana using DEBRIS tokens.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-b from-gray-900 via-gray-800 to-black">
            {/* Background Video */}
            <video
                autoPlay
                loop
                muted
                playsInline
                className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30 pointer-events-none"
                src="/gorbagio-video-mattress.mp4"
            />
            <Suspense
                fallback={
                    <div className="flex h-screen items-center justify-center">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-magic-green mx-auto mb-4"></div>
                            <p className="text-magic-green text-lg font-bold">Loading Slots...</p>
                            <p className="text-gray-400 text-sm mt-2">Initializing game engine...</p>
                        </div>
                    </div>
                }
            >
                <SkillGame />
            </Suspense>
        </div>
    );
}
