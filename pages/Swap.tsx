import React from 'react';
import TrashDAQSwap from '../components/TrashDAQSwap';

/**
 * Swap Page
 * Custom-styled swap interface powered by TrashDAQ APIs
 * Matches the trashmarket.fun aesthetic with proper branding
 */
export default function SwapPage() {
    return (
        <div className="min-h-[calc(100vh-120px)] flex items-center justify-center p-4">
            {/* Background Video */}
            <video
                autoPlay
                loop
                muted
                playsInline
                className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30 pointer-events-none"
                src="/gorbagio-video-pill.mp4"
            />
            <TrashDAQSwap />
        </div>
    );
}
