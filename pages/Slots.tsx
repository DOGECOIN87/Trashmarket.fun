import { Suspense, lazy } from 'react';

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
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black overflow-hidden">
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
