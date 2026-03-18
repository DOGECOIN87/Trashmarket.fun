import React, { useState } from 'react';
import { Copy, Check, ExternalLink, ChevronRight, Code2, Zap, Gamepad2, Coins, Link as LinkIcon, Upload, BookOpen, Settings, Ticket, ImageIcon, ArrowLeftRight } from 'lucide-react';

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
            The decentralized marketplace and ecosystem for the Gorbagana network. Powered by Debris.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="#features" onClick={(e) => { e.preventDefault(); setActiveTab('features'); }} className="px-6 py-3 bg-magic-green text-black font-bold uppercase tracking-widest hover:bg-white transition-colors">
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
                  Trashmarket.fun is the decentralized marketplace and ecosystem built exclusively for the Gorbagana network — a custom SVM (Solana Virtual Machine) Layer 2 chain. Trade NFTs, swap tokens, play on-chain games, bridge assets, and more.
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
                  { title: 'Speed', desc: 'Fast execution on Gorbagana L2 with minimal friction in every interaction.' },
                  { title: 'Transparency', desc: 'All transactions visible on-chain via explorer.gorbagana.wtf. No hidden mechanics.' },
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
              <h3 className="text-2xl font-heading text-white mb-8 uppercase tracking-tight">Network Details</h3>
              <div className="bg-black border border-magic-green/30 p-8">
                <p className="text-gray-300 mb-4">Trashmarket.fun operates exclusively on the <span className="font-bold text-magic-green">Gorbagana Network</span>, a custom SVM L2 chain.</p>
                <div className="space-y-3 text-sm text-gray-400 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-magic-green">Network:</span> Gorbagana (SVM L2)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-magic-green">Native Token:</span> GOR (9 decimals)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-magic-green">RPC:</span>
                    <span
                      className="cursor-pointer hover:text-white transition-colors"
                      onClick={() => copyToClipboard('https://rpc.gorbagana.wtf', 'rpc')}
                    >
                      https://rpc.gorbagana.wtf {copiedCode === 'rpc' ? <Check className="w-3 h-3 inline text-magic-green" /> : <Copy className="w-3 h-3 inline" />}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-magic-green">Explorer:</span>
                    <a href="https://explorer.gorbagana.wtf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                      explorer.gorbagana.wtf <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-magic-green">Wallet:</span> Backpack or any Solana-compatible wallet
                  </div>
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
                  The home page serves as a real-time market dashboard for the Gorbagana ecosystem. View featured collections, DEBRIS token holder leaderboards, circulating supply data, token prices with 24h changes, and a live NFT artwork carousel.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Dashboard Includes:</div>
                  <ul className="space-y-1">
                    <li>• Featured collection spotlight</li>
                    <li>• DEBRIS token holder leaderboard</li>
                    <li>• DEBRIS circulating supply</li>
                    <li>• Token prices with 24h change</li>
                    <li>• Featured NFT carousel</li>
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
                  Integrated marketplace for .gor domain names on the Gorbagana network. Look up existing domains, buy listed domains, list your own domains for sale, and view recent sales history. Domain registration is handled by the GorID protocol — Trashmarket provides the trading layer.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Marketplace Features:</div>
                  <ul className="space-y-1">
                    <li>• Buy and sell .gor domains</li>
                    <li>• Domain lookup and resolution</li>
                    <li>• List domains with custom pricing</li>
                    <li>• Recent sales history</li>
                  </ul>
                  <div className="text-magic-green mt-4 mb-2">Fee Structure:</div>
                  <ul className="space-y-1">
                    <li>• Platform fee: 2.5%</li>
                    <li>• Creator royalty: 5%</li>
                    <li>• Currency: Wrapped GOR</li>
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
                  A physics-based coin pusher arcade game powered by DEBRIS tokens. Drop coins to push treasures off the edge and earn rewards. Compete on the global leaderboard. All deposits and withdrawals are recorded on the Gorbagana blockchain.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Game Details:</div>
                  <ul className="space-y-1">
                    <li>• Currency: DEBRIS token</li>
                    <li>• Drop cost: 1 DEBRIS per coin</li>
                    <li>• Bump cost: 50 DEBRIS</li>
                    <li>• On-chain leaderboard</li>
                    <li>• 2.5% platform fee on deposits</li>
                  </ul>
                </div>
              </div>

              {/* Skill Game (Slots) */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Gamepad2 className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Skill Game (Slots)</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  A skill-based 3x3 grid slot game using DEBRIS tokens. After the spin, you choose where to place your WILD symbol to complete winning lines. Your skill in picking the optimal WILD placement determines your payout. Approximately 90% RTP with optimal play.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Game Details:</div>
                  <ul className="space-y-1">
                    <li>• Currency: DEBRIS token</li>
                    <li>• Wager levels: 10 to 9,999 DEBRIS</li>
                    <li>• Payout multipliers: 0.4x to 30x</li>
                    <li>• 8 possible win lines (rows, columns, diagonals)</li>
                    <li>• ~90% RTP with optimal play</li>
                    <li>• 2.5% platform fee on deposits</li>
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
                  Client-side vanity address mining for Gorbagana. Generate custom wallet addresses with specific patterns. All computation happens in your browser using Web Workers — private keys never leave your device. Unlocking matched addresses requires a DEBRIS payment scaled to pattern difficulty.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Security & Features:</div>
                  <ul className="space-y-1">
                    <li>• 100% client-side generation</li>
                    <li>• Pattern matching (prefix/suffix)</li>
                    <li>• Difficulty-based DEBRIS pricing</li>
                    <li>• Instant keypair download</li>
                    <li>• Private keys never leave your browser</li>
                  </ul>
                </div>
              </div>

              {/* Bridge */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <ArrowLeftRight className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Bridge (Cross-Chain)</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Peer-to-peer escrow bridge between Solana and Gorbagana. Create or fill offers to swap sGOR (Solana) for gGOR (Gorbagana native) and vice versa. All trades are locked in on-chain escrow programs on both networks until completion. Orders expire after approximately 24 hours.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Bridge Details:</div>
                  <ul className="space-y-1">
                    <li>• P2P OTC escrow — no custodial risk</li>
                    <li>• sGOR (Solana) ↔ gGOR (Gorbagana)</li>
                    <li>• Supports Solana mainnet and devnet</li>
                    <li>• ~24 hour order expiration</li>
                    <li>• On-chain programs on both networks</li>
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
                  Native decentralized exchange for Gorbagana tokens. Swap GOR for any token with liquidity on the network, including DEBRIS and other ecosystem tokens. Uses constant-product AMM pools (CPAMM) with real-time pricing and price impact calculations.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">DEX Features:</div>
                  <ul className="space-y-1">
                    <li>• Token search by symbol or mint address</li>
                    <li>• Real-time pricing with 24h change</li>
                    <li>• Liquidity pool browser (CPAMM, DAMM, SAMM)</li>
                    <li>• Price impact calculation</li>
                    <li>• Default swap fee: 0.3%</li>
                  </ul>
                </div>
              </div>

              {/* Raffles */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Ticket className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Raffles</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Create and participate in NFT raffles. Stake an NFT as the prize, set ticket prices in GOR, and let others buy tickets for a chance to win. Winners are drawn on-chain. Platform fees scale with raffle duration.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Raffle Details:</div>
                  <ul className="space-y-1">
                    <li>• Ticket currency: GOR</li>
                    <li>• Platform fee: 2.5% (≤6h), 5% (≤24h), 7.5% (≤48h), 10% ({'>'}48h)</li>
                    <li>• On-chain winner selection</li>
                    <li>• Automatic NFT transfer to winner</li>
                  </ul>
                </div>
              </div>

              {/* Gorbagio Migration */}
              <div className="mb-16 border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <ImageIcon className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Gorbagio Migration</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Migrate legacy Gorbagio NFTs from the old Token-2022 format to the new Metaplex Token Metadata standard. This enables proper collection grouping, marketplace compatibility, and removes "possible spam" warnings in wallets.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Migration Details:</div>
                  <ul className="space-y-1">
                    <li>• Scan wallet for legacy Gorbagios</li>
                    <li>• One-click migration per NFT</li>
                    <li>• Migration fee: 1,000 GOR per NFT</li>
                    <li>• Upgrades to Metaplex standard</li>
                  </ul>
                </div>
              </div>

              {/* Submit */}
              <div className="border-l-4 border-magic-green pl-8">
                <div className="flex items-center gap-3 mb-4">
                  <Upload className="w-6 h-6 text-magic-green" />
                  <h3 className="text-2xl font-heading text-white uppercase">Submit (Collection Launchpad)</h3>
                </div>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  Permissionless NFT collection submission for creators. Submit your project through a 4-step form covering collection details, visual assets, contract information, and project roadmap. Maximum 3 submissions per wallet.
                </p>
                <div className="bg-black border border-white/10 p-4 text-sm text-gray-400 font-mono">
                  <div className="text-magic-green mb-2">Submission Steps:</div>
                  <ul className="space-y-1">
                    <li>• Step 1: Collection info (name, symbol, supply, mint price)</li>
                    <li>• Step 2: Visual assets (logo, banner, sample NFTs)</li>
                    <li>• Step 3: Contract address, royalty %, website, socials</li>
                    <li>• Step 4: Team info, roadmap, utility</li>
                    <li>• Limit: 3 submissions per wallet</li>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                {[
                  {
                    name: 'GOR',
                    title: 'Native Network Token',
                    desc: 'The native gas token of the Gorbagana network (9 decimals). Required for all on-chain transactions, and used as the trading currency across the ecosystem.',
                    uses: ['Gas fees for all transactions', 'GorID domain trading', 'Raffle ticket purchases', 'Bridge (as gGOR on Gorbagana)', 'NFT migration fees'],
                  },
                  {
                    name: 'DEBRIS',
                    title: 'Ecosystem Utility Token',
                    mint: 'DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy',
                    desc: 'The primary utility token powering Trashmarket.fun (9 decimals). Used across all games and services on the platform.',
                    uses: ['Junk Pusher arcade gameplay', 'Skill Game (Slots) wagers', 'Vanity address generation', 'Swappable on the DEX'],
                  },
                ].map((token, idx) => (
                  <div key={idx} className="border border-white/10 p-8 bg-black hover:bg-white/5 transition-colors">
                    <div className="text-magic-green font-mono text-sm font-bold mb-2">${token.name}</div>
                    <h4 className="text-xl font-heading text-white mb-3 uppercase">{token.title}</h4>
                    <p className="text-gray-400 text-sm mb-4 leading-relaxed">{token.desc}</p>
                    {'mint' in token && (
                      <div
                        className="text-xs font-mono text-gray-500 mb-4 cursor-pointer hover:text-gray-300 transition-colors flex items-center gap-1"
                        onClick={() => copyToClipboard(token.mint!, `mint-${idx}`)}
                      >
                        Mint: {token.mint!.slice(0, 8)}...{token.mint!.slice(-4)} {copiedCode === `mint-${idx}` ? <Check className="w-3 h-3 text-magic-green" /> : <Copy className="w-3 h-3" />}
                      </div>
                    )}
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

              <div className="border border-yellow-500/30 bg-yellow-500/5 p-6 mb-16">
                <p className="text-yellow-400 text-sm font-mono uppercase tracking-wider mb-2">Notice</p>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Full tokenomics (supply distribution, emission schedules, burn mechanics) are not yet finalized. This section will be updated as the tokenomics model is formalized. The tokens listed above are currently live and functional on the Gorbagana network.
                </p>
              </div>

              <section className="border-t border-white/10 pt-12">
                <h3 className="text-2xl font-heading text-white mb-8 uppercase tracking-tight">Fee Structure</h3>
                <div className="space-y-4">
                  {[
                    { service: 'GorID Marketplace', fee: '2.5%', recipient: 'Platform', royalty: '5% (Creator)' },
                    { service: 'Game Deposits (Junk Pusher / Slots)', fee: '2.5%', recipient: 'Treasury', royalty: 'N/A' },
                    { service: 'Raffles (≤6h / ≤24h / ≤48h / >48h)', fee: '2.5% / 5% / 7.5% / 10%', recipient: 'Platform', royalty: 'N/A' },
                    { service: 'DEX Swaps', fee: '0.3%', recipient: 'Liquidity Pools', royalty: 'N/A' },
                    { service: 'Gorbagio Migration', fee: '1,000 GOR', recipient: 'Treasury', royalty: 'N/A' },
                    { service: 'Vanity Generator', fee: 'Variable (DEBRIS)', recipient: 'Treasury', royalty: 'N/A' },
                  ].map((fee, idx) => (
                    <div key={idx} className="border border-white/10 p-6 bg-white/5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Service</div>
                          <div className="text-white font-mono text-sm">{fee.service}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Fee</div>
                          <div className="text-magic-green font-bold">{fee.fee}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Recipient / Royalty</div>
                          <div className="text-gray-300 text-sm">{fee.recipient}{fee.royalty !== 'N/A' ? ` + ${fee.royalty}` : ''}</div>
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
                  a: 'Trashmarket.fun operates exclusively on the Gorbagana network, a custom SVM (Solana Virtual Machine) Layer 2 chain. You need to add the Gorbagana network to your wallet (RPC: https://rpc.gorbagana.wtf) and have GOR for gas fees.',
                },
                {
                  q: 'How do I get started?',
                  a: 'Connect your Backpack or compatible Solana wallet, switch to the Gorbagana network, and you\'re ready to explore. You\'ll need GOR for gas fees. To play games, you\'ll also need DEBRIS tokens which you can get on the DEX.',
                },
                {
                  q: 'What tokens are used on Trashmarket.fun?',
                  a: 'GOR is the native gas token used for transactions, domain trading, raffles, and migration fees. DEBRIS is the ecosystem utility token used for the arcade games (Junk Pusher and Skill Game) and the Vanity Generator. Both tokens have 9 decimals.',
                },
                {
                  q: 'Is the Vanity Generator secure?',
                  a: 'Yes. All address generation happens client-side in your browser using Web Workers. Private keys never leave your device. Unlocking a matched address requires a DEBRIS payment scaled to pattern difficulty.',
                },
                {
                  q: 'What are the fees on the GorID marketplace?',
                  a: 'The GorID marketplace charges a 2.5% platform fee and 5% creator royalty on domain sales. These fees are transparent and deducted from the sale price. Note: Trashmarket handles domain trading only — domain registration is done through the GorID protocol directly.',
                },
                {
                  q: 'How does the Bridge work?',
                  a: 'The Bridge is a peer-to-peer escrow system. You create or fill offers to swap sGOR (on Solana) for gGOR (on Gorbagana). Funds are locked in on-chain escrow programs on both networks. Orders expire after roughly 24 hours if not filled.',
                },
                {
                  q: 'How do the games work?',
                  a: 'Both Junk Pusher and the Skill Game use DEBRIS tokens. Deposit DEBRIS from your wallet into the game (2.5% platform fee applies). Junk Pusher is a physics-based coin pusher. The Skill Game is a 3x3 slot grid where you place a WILD symbol — approximately 90% RTP with optimal play.',
                },
                {
                  q: 'How do I submit my NFT collection?',
                  a: 'Visit the Submit page and complete the 4-step form: collection info, visual assets, contract details, and project roadmap. Submissions are permissionless but limited to 3 per wallet.',
                },
                {
                  q: 'What is Gorbagio Migration?',
                  a: 'Legacy Gorbagio NFTs used the old Token-2022 format. The migration tool upgrades them to the Metaplex Token Metadata standard for proper collection grouping and marketplace compatibility. Migration costs 1,000 GOR per NFT.',
                },
                {
                  q: 'Where can I view my transactions?',
                  a: 'All on-chain activity on Gorbagana can be viewed on the block explorer at explorer.gorbagana.wtf. Search by wallet address, transaction signature, or token mint.',
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
          <p>Trashmarket.fun &copy; 2025 | Built for the Gorbagana Network</p>
        </div>
      </div>
    </div>
  );
};

export default OfficialDocs;
