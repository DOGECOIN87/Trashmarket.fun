import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Send } from 'lucide-react';
import LotteryTickets from './LotteryTickets';

const Footer: React.FC = () => {
    return (
        <footer className="bg-black border-t border-white/10 py-12 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-3 mb-4">
                            <img src="/assets/logo.svg" alt="Logo" className="w-8 h-8 rounded-sm opacity-80" />
                            <h3 className="text-xl font-bold bg-gradient-to-r from-magic-green to-white bg-clip-text text-transparent tracking-tighter leading-none">TRASHMARKET.FUN</h3>
                        </div>
                        <p className="text-gray-500 text-sm font-mono">
                            The rawest NFT marketplace on Solana. No filler, just trash.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Marketplace</h4>
                        <ul className="space-y-2 text-gray-400 text-sm font-mono">
                            <li className="hover:text-magic-green cursor-pointer transition-colors">Trending</li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors">New Trash</li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors">Auctions</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Resources</h4>
                        <ul className="space-y-2 text-gray-400 text-sm font-mono">
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/docs">Docs</Link></li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/docs">Brand Kit</Link></li>

                        </ul>
                    </div>
                    <div className="md:col-span-2 flex flex-col justify-start">
                        <LotteryTickets />
                    </div>
                    <div className="flex flex-col">
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Community</h4>
                        <div className="flex gap-4">
                            <a
                                href="https://github.com/DOGECOIN87/Trashmarket.fun"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-12 h-12 flex items-center justify-center bg-black border border-white/10 hover:border-magic-green/50 transition-all group overflow-hidden"
                                title="GitHub"
                            >
                                <Github
                                    className="w-6 h-6 text-magic-green transition-all duration-300 group-hover:scale-110"
                                    style={{
                                        filter: 'drop-shadow(0 0 3px #adff02) drop-shadow(0 0 6px #adff02)',
                                        opacity: 0.8
                                    }}
                                />
                            </a>
                            <a
                                href="https://x.com/Gorbagana_chain"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-12 h-12 flex items-center justify-center bg-black border border-white/10 hover:border-magic-green/50 transition-all group overflow-hidden"
                                title="X (Twitter)"
                            >
                                <Twitter
                                    className="w-6 h-6 text-magic-green transition-all duration-300 group-hover:scale-110"
                                    style={{
                                        filter: 'drop-shadow(0 0 3px #adff02) drop-shadow(0 0 6px #adff02)',
                                        opacity: 0.8
                                    }}
                                />
                            </a>
                            <a
                                href="https://t.me/gorbagana_portal"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-12 h-12 flex items-center justify-center bg-black border border-white/10 hover:border-magic-green/50 transition-all group overflow-hidden"
                                title="Telegram"
                            >
                                <Send
                                    className="w-6 h-6 text-magic-green transition-all duration-300 group-hover:scale-110"
                                    style={{
                                        filter: 'drop-shadow(0 0 3px #adff02) drop-shadow(0 0 6px #adff02)',
                                        opacity: 0.8
                                    }}
                                />
                            </a>
                        </div>
                    </div>
                </div>
                <div className="mt-12 pt-8 border-t border-white/5 text-center text-gray-600 text-xs font-mono uppercase tracking-widest">
                    &copy; 2026 trashmarket.fun. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;