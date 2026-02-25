import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Send } from 'lucide-react';
import LotteryTickets from './LotteryTickets';

const Footer: React.FC = () => {
    return (
        <footer className="relative bg-magic-dark border-t border-white/10 pt-16 pb-8 overflow-hidden">
            {/* Animated SVG Background */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-45 z-0"
                style={{
                    backgroundImage: 'url("/assets/enhanced_logo_v6.svg")',
                    backgroundSize: '150px 150px',
                    backgroundPosition: '0 0',
                    backgroundRepeat: 'repeat'
                }}
            />

            <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-12 mb-16">
                    {/* Brand Section */}
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <img src="/assets/logo.svg" alt="Logo" className="w-8 h-8" />
                            <span className="text-xl font-black text-white tracking-tighter">
                                TRASHMARKET<span className="text-magic-green">.FUN</span>
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm font-mono leading-relaxed max-w-xs">
                            The rawest NFT marketplace on Solana. No filler, just trash.
                        </p>
                    </div>

                    {/* Links Sections */}
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Marketplace</h4>
                        <ul className="space-y-2 text-gray-500 text-xs font-mono uppercase tracking-wider">
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/">Trending</Link></li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/">New Trash</Link></li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/">Auctions</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Resources</h4>
                        <ul className="space-y-2 text-gray-500 text-xs font-mono uppercase tracking-wider">
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/docs">Docs</Link></li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/docs">Brand Kit</Link></li>
                        </ul>
                    </div>

                    {/* Lottery Section - New Modal Trigger */}
                    <div className="md:col-span-1 flex flex-col items-start">
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Lottery</h4>
                        <LotteryTickets />
                    </div>

                    {/* Community Section */}
                    <div className="flex flex-col">
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Community</h4>
                        <div className="flex gap-4">
                            <a
                                href="https://github.com/DOGECOIN87/Trashmarket.fun"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-black border border-white/10 flex items-center justify-center hover:border-magic-green/50 hover:text-magic-green transition-all group"
                            >
                                <Github className="w-5 h-5" />
                            </a>
                            <a
                                href="https://twitter.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-black border border-white/10 flex items-center justify-center hover:border-magic-green/50 hover:text-magic-green transition-all group"
                            >
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a
                                href="https://t.me"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-black border border-white/10 flex items-center justify-center hover:border-magic-green/50 hover:text-magic-green transition-all group"
                            >
                                <Send className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-600 text-[10px] font-mono uppercase tracking-[0.2em]">
                        © 2026 TRASHMARKET.FUN. ALL RIGHTS RESERVED.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
