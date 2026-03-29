import React, { useEffect } from 'react';
import TrashDAQSwap from '../components/TrashDAQSwap';
import { audioManager } from '../lib/audioManager';

/**
 * Swap Page
 * Custom-styled swap interface powered by TrashDAQ APIs
 * Matches the trashmarket.fun aesthetic with proper branding
 */
export default function SwapPage() {
    useEffect(() => {
        return audioManager.playOnInteraction('page_dex');
    }, []);

    return (
        <div className="min-h-[calc(100vh-120px)] flex items-center justify-center p-4">
            <TrashDAQSwap />
        </div>
    );
}
