import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Swap Page
 * Wraps the official TrashDAQ swap interface (swap.trashscan.io) in an iframe
 * to ensure price accuracy and consistent trading experience.
 */
export default function SwapPage() {
    return (
        <div className="h-[calc(100vh-120px)] bg-black flex flex-col overflow-hidden">
            {/* Header / Info Bar */}
            <div className="bg-gradient-to-r from-black via-gray-900 to-black border-b border-magic-green/20 px-4 py-2 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-magic-green rounded-full animate-pulse shadow-[0_0_8px_#adff02]"></div>
                    <h2 className="text-magic-green font-mono text-[10px] font-bold tracking-widest uppercase">
                        Official_TrashDAQ_Aggregator
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    <a 
                        href="https://trashscan.io" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 group"
                    >
                        <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 border border-white/10 group-hover:border-magic-green/30 transition-all">
                            <img 
                                src="https://trashscan.io/logo.png" 
                                alt="Trashscan Logo" 
                                className="w-3 h-3 object-contain brightness-110"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <span className="text-[9px] font-bold text-white group-hover:text-magic-green tracking-tight">TRASHSCAN.IO</span>
                        </div>
                    </a>
                </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 relative bg-[#0a0a0a]">
                <iframe 
                    src="https://swap.trashscan.io/" 
                    className="w-full h-full border-none"
                    title="TrashDAQ Swap"
                    allow="clipboard-read; clipboard-write; web-share; accelerometer; autoplay; camera; gyroscope; payment"
                    sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads"
                />
                
                {/* Subtle Overlay for consistent look */}
                <div className="absolute inset-0 pointer-events-none border-t border-white/5 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]"></div>
            </div>

            {/* Footer / Status */}
            <div className="bg-black border-t border-white/5 px-4 py-1.5 flex justify-between items-center text-[9px] font-mono text-gray-600 shrink-0">
                <div className="flex gap-3 items-center">
                    <span className="text-magic-green/60">STATUS: ONLINE</span>
                    <span className="hidden xs:inline">NETWORK: GORBAGANA</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[8px] uppercase opacity-50">Powered_By_Trashscan</span>
                    <a 
                        href="https://swap.trashscan.io/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-magic-green hover:text-white flex items-center gap-0.5"
                    >
                        <span>EXTERNAL</span>
                        <ExternalLink size={8} />
                    </a>
                </div>
            </div>
        </div>
    );
}
