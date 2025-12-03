import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
    return (
        <footer className="bg-[#121212] border-t border-white/10 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-magic-green to-white bg-clip-text text-transparent mb-4 tracking-tighter">TRASHMARKET.FUN</h3>
                        <p className="text-gray-500 text-sm font-mono">
                            The rawest NFT marketplace on Solana. No filler, just trash.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Marketplace</h4>
                        <ul className="space-y-2 text-gray-400 text-sm font-mono">
                            <li className="hover:text-magic-green cursor-pointer transition-colors">Trending</li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors">New Trash</li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors">Auctions</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Resources</h4>
                        <ul className="space-y-2 text-gray-400 text-sm font-mono">
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/docs">Docs</Link></li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/docs">Brand Kit</Link></li>
                            <li className="hover:text-magic-green cursor-pointer transition-colors"><Link to="/docs">API</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Community</h4>
                        <div className="flex gap-4">
                            {/* Social Icons Placeholder */}
                            <div className="w-8 h-8 bg-gray-900 border border-white/20 hover:border-magic-green hover:bg-magic-green/10 cursor-pointer transition-all"></div>
                            <div className="w-8 h-8 bg-gray-900 border border-white/20 hover:border-magic-green hover:bg-magic-green/10 cursor-pointer transition-all"></div>
                            <div className="w-8 h-8 bg-gray-900 border border-white/20 hover:border-magic-green hover:bg-magic-green/10 cursor-pointer transition-all"></div>
                        </div>
                    </div>
                </div>
                <div className="mt-12 pt-8 border-t border-white/5 text-center text-gray-600 text-xs font-mono uppercase tracking-widest">
                    &copy; 2024 trashmarket.fun. All rights reserved.
                </div>
            </div>
        </footer>
    );
};

export default Footer;