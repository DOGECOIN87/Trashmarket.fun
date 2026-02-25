import React, { useState } from 'react';
import { Copy, Check, ExternalLink, ChevronRight, Code2, Zap, Gamepad2, Coins, Link as LinkIcon, Upload, BookOpen, Settings } from 'lucide-react';

const OfficialDocs: React.FC = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sections = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'features', label: 'Features', icon: Zap },
    { id: 'tokenomics', label: 'Tokenomics', icon: Coins },
    { id: 'faq', label: 'FAQ', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="border-b border-white/20 bg-gradient-to-b from-black via-black to-black/80">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="mb-4 flex items-center gap-2 text-magic-green text-sm font-mono uppercase tracking-widest">
            <BookOpen className="w-4 h-4" />
            Official Documentation
          </div>
          <h1 className="text-6xl md:text-7xl font-heading text-white mb-6 uppercase tracking-tight">
            Trashmarket.fun
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl font-heading mb-8 leading-relaxed">
            The ultimate garbage-powered economy. One man's trash is another man's alpha.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="#features" className="px-6 py-3 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors">
              Get Started
            </a>
            <a href="https://github.com/DOGECOIN87/Trashmarket.fun" target="_blank" rel="noopener noreferrer" className="px-6 py-3 border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white/5 transition-colors flex items-center gap-2">
              View on GitHub <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-8 overflow-x-auto">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(section.id)}
                  className={`py-4 px-2 font-bold uppercase tracking-widest text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                    activeTab === section.id
                      ? 'border-magic-green text-magic-green'
                      : 'border-transparent text-gray-500 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section>
              <h2 className="text-4xl font-heading text-white mb-8 uppercase tracking-tight">Welcome to Trashmarket.fun</h2>
              <div className="prose prose-invert max-w-none space-y-6">
                <p className="text-lg text-gray-300 leading-relaxed">
                  Trashmarket.fun is a decentralized marketplace and ecosystem built exclusively for the Gorbagana network. We reject rounded corners, smooth gradients, and whitespace. We embrace the raw data, brutal honesty, and information density that blockchain technology demands.
                </p>
                <p className="text-lg text-gray-300 leading-relaxed">
                  Our philosophy is simple: <span className="text-magic-green font-bold">Speed over safety. Information density over whitespace. Brutal honesty about asset value (usually 0).</span>
                </p>
              </div>
            </section>

            <section className="border-t border-white/10 pt-12">
              <h3 className="text-2xl font-heading text-white mb-8 uppercase tracking-tight">Core Values</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: 'Speed', desc: 'Fast execution and minimal friction in every interaction.' },
                  { title: 'Transparency', desc: 'All data visible on-chain. No hidden mechanics or opaque algorithms.' },
                  { title: 'Community', desc: 'Built by the community, for the community. Permissionless participation.' },
                ].map((value, idx) => (
                  <div key={idx} className="border border-white/10 p-6 bg-white/5 hover:bg-white/10 transition-colors">
                    <h4 className="text-lg font-heading text-magic-green mb-3 uppercase">{value.title}</h4>
                    <p className="text-gray-400 text-sm leading-relaxed">{value.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-white/10 pt-12">
              <h3 className="text-2xl font-heading text-white mb-8 uppercase tracking-tight">Network Requirements</h3>
              <div className="bg-black border border-magic-green/30 p-8">
                <p className="text-gray-300 mb-4">Trashmarket.fun operates exclusively on the <span className="font-bold text-magic-green">Gorbagana Network</span>.</p>
                <div className="space-y-3 text-sm text-gray-400 font-mono">
                  <div><span className="text-magic-green">Network:</span> Gorbagana</div>
                  <div><span className="text-magic-green">Native Token:</span> GOR</div>
                  <div><span className="text-magic-green">RPC:</span> https://rpc.gorbagana.com</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* FEATURES */}
        {activeTab === 'features' && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section>
              <h2 className="text-4xl font-heading text-white mb-12 uppercase tracking-tight">Platform Features</h2>

              {/* Market Feed */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Market Feed</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Real-time market data and collection tracking. View top-performing collections, floor prices, 24-hour volumes, and live artwork streams. The Market Feed provides continuous market intelligence in a dense, information-rich format.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Key Metrics:</div>
                  <ul className="space-y-1">
                    <li>• Floor Price tracking</li>
                    <li>• 24h Volume statistics</li>
                    <li>• Collection spotlights</li>
                    <li>• Live artwork carousel</li>
                  </ul>
                </div>
              </div>

              {/* GorID */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <LinkIcon className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">GorID (Identity)</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Decentralized identity system for the Gorbagana ecosystem. Register .gor domains, manage your identity, and trade domain names on an integrated marketplace. Includes platform fees (2.5%) and creator royalties (5%).
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Features:</div>
                  <ul className="space-y-1">
                    <li>• Register .gor domains</li>
                    <li>• Peer-to-peer marketplace</li>
                    <li>• List domains for sale</li>
                    <li>• Transparent fee structure</li>
                  </ul>
                </div>
              </div>

              {/* Junk Pusher */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Gamepad2 className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Junk Pusher (Arcade)</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  A Web3 arcade game powered by JUNK tokens. Drop coins using your tokens and win TRASHCOIN rewards. Compete on global leaderboards and earn through skilled gameplay. Requires Gorbagana network connection.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Game Mechanics:</div>
                  <ul className="space-y-1">
                    <li>• Physics-based coin pusher</li>
                    <li>• JUNK token rewards</li>
                    <li>• TRASHCOIN winnings</li>
                    <li>• Global leaderboards</li>
                  </ul>
                </div>
              </div>

              {/* Vanity Generator */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Code2 className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Vanity Generator</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Client-side vanity address mining for Gorbagana. Generate custom addresses with specific prefixes or suffixes. All computation happens in your browser—private keys never leave your device. Mining is paid per cycle using GOR tokens.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Security & Features:</div>
                  <ul className="space-y-1">
                    <li>• Client-side generation</li>
                    <li>• Pattern matching (prefix/suffix)</li>
                    <li>• Paid mining cycles</li>
                    <li>• Instant keypair download</li>
                  </ul>
                </div>
              </div>

              {/* Bridge */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Coins className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Bridge (Cross-Chain)</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Secure escrow-based bridge between Solana and Gorbagana networks. Trade sGOR (Solana) for gGOR (Gorbagana) through peer-to-peer offers. All trades are verified and locked in escrow until completion.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Bridge Mechanics:</div>
                  <ul className="space-y-1">
                    <li>• Peer-to-peer offers</li>
                    <li>• Escrow verification</li>
                    <li>• sGOR ↔ gGOR swaps</li>
                    <li>• Cross-chain security</li>
                  </ul>
                </div>
              </div>

              {/* DEX */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">DEX (Swap)</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Native decentralized exchange for Gorbagana tokens. Swap GOR for ecosystem tokens like JUNK, TRASH, and others. Real-time price charts, token search, and instant swaps.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">DEX Features:</div>
                  <ul className="space-y-1">
                    <li>• Token search & filtering</li>
                    <li>• Real-time pricing</li>
                    <li>• 24h price changes</li>
                    <li>• Instant swaps</li>
                  </ul>
                </div>
              </div>

              {/* Submit */}
              <div className="border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Upload className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Submit (Launchpad)</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Permissionless collection submission for creators. Submit your NFT project with detailed information including team details, roadmap, utility, and royalty structure. Automated preview and submission workflow.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Submission Fields:</div>
                  <ul className="space-y-1">
                    <li>• Collection metadata</li>
                    <li>• Team information</li>
                    <li>• Project roadmap</li>
                    <li>• Utility & benefits</li>
                    <li>• Royalty configuration</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TOKENOMICS */}
        {activeTab === 'tokenomics' && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section>
              <h2 className="text-4xl font-heading text-white mb-12 uppercase tracking-tight">Tokenomics</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                {[
                  {
                    name: 'GOR',
                    title: 'Native Token',
                    desc: 'The native utility token of the Gorbagana network. Used for gas fees, vanity mining, and ecosystem transactions.',
                    uses: ['Gas fees', 'Vanity mining', 'Trading fees', 'Governance'],
                  },
                  {
                    name: 'JUNK',
                    title: 'Arcade Token',
                    desc: 'The primary currency for the Junk Pusher arcade game. Earned through ecosystem participation and gameplay.',
                    uses: ['Arcade gameplay', 'Rewards', 'Leaderboard prizes', 'Community rewards'],
                  },
                  {
                    name: 'TRASH',
                    title: 'Reward Token',
                    desc: 'Reward token for high-performing players, community contributors, and ecosystem participants.',
                    uses: ['Player rewards', 'Community incentives', 'Governance', 'Staking'],
                  },
                ].map((token, idx) => (
                  <div key={idx} className="border border-white/10 p-8 bg-black hover:bg-white/5 transition-colors">
                    <div className="text-magic-green font-mono text-sm font-bold mb-2">{token.name}</div>
                    <h4 className="text-xl font-heading text-white mb-3 uppercase">{token.title}</h4>
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">{token.desc}</p>
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 uppercase font-bold">Use Cases:</div>
                      <ul className="space-y-1">
                        {token.uses.map((use, uIdx) => (
                          <li key={uIdx} className="text-sm text-gray-400 flex items-center gap-2">
                            <ChevronRight className="w-3 h-3 text-magic-green" />
                            {use}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              <section className="border-t border-white/10 pt-12">
                <h3 className="text-2xl font-heading text-white mb-8 uppercase tracking-tight">Fee Structure</h3>
                <div className="space-y-4">
                  {[
                    { service: 'GorID Marketplace', fee: '2.5%', recipient: 'Platform', royalty: '5%', royaltyRecipient: 'Creator' },
                    { service: 'Vanity Mining', fee: 'Per Cycle', recipient: 'Treasury', royalty: 'N/A', royaltyRecipient: 'N/A' },
                    { service: 'DEX Swaps', fee: 'Variable', recipient: 'Liquidity', royalty: 'N/A', royaltyRecipient: 'N/A' },
                  ].map((fee, idx) => (
                    <div key={idx} className="border border-white/10 p-6 bg-white/5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Service</div>
                          <div className="text-white font-mono">{fee.service}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Platform Fee</div>
                          <div className="text-magic-green font-bold">{fee.fee}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Recipient</div>
                          <div className="text-gray-300">{fee.recipient}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Creator Royalty</div>
                          <div className="text-gray-300">{fee.royalty}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </div>
        )}

        {/* FAQ */}
        {activeTab === 'faq' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section>
              <h2 className="text-4xl font-heading text-white mb-12 uppercase tracking-tight">Frequently Asked Questions</h2>

              {[
                {
                  q: 'What network does Trashmarket.fun operate on?',
                  a: 'Trashmarket.fun operates exclusively on the Gorbagana network. All features require a Gorbagana wallet connection.',
                },
                {
                  q: 'How do I get started?',
                  a: 'Connect your Backpack or compatible Solana wallet, switch to the Gorbagana network, and you\'re ready to explore the marketplace, play Junk Pusher, or generate vanity addresses.',
                },
                {
                  q: 'Is the Vanity Generator secure?',
                  a: 'Yes. All address generation happens client-side in your browser. Private keys never leave your device. We recommend using a fresh address for vanity-generated accounts.',
                },
                {
                  q: 'What are the fees on GorID marketplace?',
                  a: 'GorID marketplace charges a 2.5% platform fee and 5% creator royalty on all domain sales. These fees are transparent and deducted from the sale price.',
                },
                {
                  q: 'Can I use the Bridge on Solana mainnet?',
                  a: 'The Bridge supports both Solana mainnet and devnet (for testing). On devnet, you can test with sGOR tokens. Mainnet trading requires real sGOR tokens.',
                },
                {
                  q: 'How do I submit my collection?',
                  a: 'Visit the Submit page and fill out the collection form with your project details, team information, roadmap, and utility. The submission is permissionless and automated.',
                },
                {
                  q: 'What tokens can I swap on the DEX?',
                  a: 'The DEX supports GOR (native) and all ecosystem tokens including JUNK, TRASH, and other Gorbagana-based tokens. Use the search feature to find tokens by symbol or mint address.',
                },
                {
                  q: 'Is there a fee to play Junk Pusher?',
                  a: 'Yes, Junk Pusher requires JUNK tokens to play. Each coin drop costs JUNK tokens. Winnings are paid in TRASHCOIN and GOR tokens.',
                },
              ].map((faq, idx) => (
                <div key={idx} className="border border-white/10 p-6 bg-white/5 hover:bg-white/10 transition-colors">
                  <h3 className="text-lg font-heading text-magic-green mb-3 uppercase">{faq.q}</h3>
                  <p className="text-gray-300 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </section>

            <section className="border-t border-white/10 pt-12">
              <h3 className="text-2xl font-heading text-white mb-6 uppercase tracking-tight">Need More Help?</h3>
              <div className="border border-magic-green/30 bg-magic-green/5 p-8">
                <p className="text-gray-300 mb-4">For additional support, visit our GitHub repository or connect with the community.</p>
                <div className="flex flex-wrap gap-4">
                  <a href="https://github.com/DOGECOIN87/Trashmarket.fun" target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors flex items-center gap-2">
                    GitHub <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 bg-black/50 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center text-gray-500 text-sm">
          <p>Trashmarket.fun © 2026 | Built for the Gorbagana Network</p>
        </div>
      </div>
    </div>
  );
};

export default OfficialDocs;
