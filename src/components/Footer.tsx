import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Send } from 'lucide-react';

interface FooterProps {
    onOpenScratchTicket?: () => void;
}

const Footer: React.FC<FooterProps> = ({ onOpenScratchTicket }) => {
    return (
        <footer className="relative bg-magic-dark border-t border-white/10 pt-8 md:pt-16 pb-4 md:pb-8 overflow-hidden">
            {/* Animated SVG Background */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-30 z-0"
                style={{
                    backgroundImage: 'url("/slow_spinning_cookies.svg")',
                    backgroundSize: '350px 350px',
                    backgroundPosition: '0 0',
                    backgroundRepeat: 'repeat'
                }}
            />

            <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-6 md:gap-12 mb-8 md:mb-16">
                    {/* Brand Section */}
                    <div className="sm:col-span-2 md:col-span-2">
                        <div className="flex items-center gap-3 mb-6">
                            <img src="/assets/logo.svg" alt="Logo" className="w-8 h-8" />
                            <span className="text-xl font-black text-white tracking-tighter">
                                TRASHMARKET<span className="text-magic-blue">.FUN</span>
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm font-mono leading-relaxed max-w-xs">
                            The rawest NFT marketplace on Gorbagana. No filler, just trash.
                        </p>
                    </div>

                    {/* Links Sections */}
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Marketplace</h4>
                        <ul className="space-y-2 text-gray-500 text-xs font-mono uppercase tracking-wider">
                            <li className="hover:text-magic-blue cursor-pointer transition-colors"><Link to="/">Trending</Link></li>
                            <li className="hover:text-magic-blue cursor-pointer transition-colors"><Link to="/">New Trash</Link></li>
                            <li className="hover:text-magic-blue cursor-pointer transition-colors"><Link to="/">Auctions</Link></li>
                            <li className="hover:text-magic-blue cursor-pointer transition-colors"><Link to="/nft">NFT Market</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Resources</h4>
                        <ul className="space-y-2 text-gray-500 text-xs font-mono uppercase tracking-wider">
                            <li className="hover:text-magic-blue cursor-pointer transition-colors"><Link to="/official-docs">Docs</Link></li>
                            <li className="hover:text-magic-blue cursor-pointer transition-colors"><Link to="/docs">Brand Kit</Link></li>
                            <li className="hover:text-magic-blue cursor-pointer transition-colors"><Link to="/airdrop">Airdrop</Link></li>
                            <li className="hover:text-magic-blue cursor-pointer transition-colors"><Link to="/launchpad">Launchpad</Link></li>
                        </ul>
                    </div>

                    {/* Scratch Ticket Section */}
                    <div className="md:col-span-1 flex flex-col items-start sm:hidden md:flex">
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Scratch Ticket</h4>
                        <button
                            onClick={onOpenScratchTicket}
                            className="px-4 py-2 bg-black border border-white/10 hover:border-magic-blue/50 hover:text-magic-blue transition-all group"
                        >
                            <span className="text-xs font-bold text-gray-400 group-hover:text-magic-blue uppercase tracking-widest font-mono">Buy Ticket</span>
                        </button>
                        <p className="mt-2 text-[9px] text-gray-700 font-mono uppercase tracking-wider">500 GOR</p>
                        <p className="text-[9px] text-gray-700 font-mono uppercase tracking-wider">Win DEBRIS</p>
                    </div>

                    {/* Community Section */}
                    <div className="flex flex-col">
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs px-1">Community</h4>
                        <div className="flex gap-4">
                            <a
                                href="https://github.com/DOGECOIN87/Trashmarket.fun"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-black border border-white/10 flex items-center justify-center hover:border-magic-blue/50 hover:text-magic-blue transition-all group"
                            >
                                <Github className="w-5 h-5" />
                            </a>
                            <a
                                href="https://twitter.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-black border border-white/10 flex items-center justify-center hover:border-magic-blue/50 hover:text-magic-blue transition-all group"
                            >
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a
                                href="https://t.me"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-10 h-10 bg-black border border-white/10 flex items-center justify-center hover:border-magic-blue/50 hover:text-magic-blue transition-all group"
                            >
                                <Send className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-4 md:pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
                    <p className="text-gray-600 text-[10px] font-mono uppercase tracking-[0.2em]">
                        © 2026 TRASHMARKET.FUN. ALL RIGHTS RESERVED.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
