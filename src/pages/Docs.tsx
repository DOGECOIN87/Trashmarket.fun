import React, { useState } from 'react';
import { Copy, Check, Download, Hash, Terminal, Type, LayoutTemplate, Palette, Coins, Gamepad2, PieChart } from 'lucide-react';

const COLORS = [
  { name: 'Magic Green', hex: '#adff02', class: 'bg-magic-green text-black' },
  { name: 'Magic Pink', hex: '#ff00ff', class: 'bg-magic-pink text-white' },
  { name: 'Magic Red', hex: '#ff2222', class: 'bg-magic-red text-white' },
  { name: 'Magic Purple', hex: '#9945ff', class: 'bg-magic-purple text-white' },
  { name: 'Void Black', hex: '#000000', class: 'bg-black text-white border border-white/20' },
  { name: 'Card Surface', hex: '#080808', class: 'bg-[#080808] text-white border border-white/20' },
];

const SECTIONS = [
  { id: 'brand', label: 'Identity_Kit' },
  { id: 'manifesto', label: 'Manifesto' },
  { id: 'ui', label: 'UI_Components' },
  { id: 'token', label: 'Token' },
  { id: 'skill-game', label: 'Skill_Game' },
  { id: 'tokenomics', label: 'Tokenomics' },
];

const Docs: React.FC = () => {
  const [activeSection, setActiveSection] = useState('brand');
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHex(text);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row max-w-[1600px] mx-auto border-l border-r border-white/10">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 sticky top-16 h-auto md:h-[calc(100vh-64px)] bg-black/80 z-20 overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Hash className="w-3 h-3" /> Brand Kit
          </h2>
          <nav className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-3 text-xs font-bold font-mono uppercase tracking-wider border-l-2 transition-all ${activeSection === section.id
                  ? 'border-magic-green text-white bg-white/5'
                  : 'border-transparent text-gray-500 hover:text-white hover:border-gray-700'
                  }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 mt-auto border-t border-white/10">
          <div className="bg-[#111] p-3 border border-white/10">
            <div className="text-[10px] text-gray-500 mb-2 uppercase">Current Version</div>
            <div className="text-magic-green font-mono text-xs">v0.9.2-beta</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen bg-black/60 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 md:p-12 pb-24">

          {/* HEADER */}
          <div className="mb-12 border-b border-white/20 pb-8">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 uppercase tracking-tighter">
              Brand_Kit
            </h1>
            <p className="text-gray-400 font-mono text-sm max-w-2xl">
              The authoritative source for the Trash Market visual language, design system, and brand assets. Use these guidelines to build compatible experiences.
            </p>
          </div>

          {/* BRAND KIT SECTION */}
          {activeSection === 'brand' && (
            <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Colors */}
              <section>
                <div className="flex items-center gap-2 mb-6 text-magic-green">
                  <Palette className="w-5 h-5" />
                  <h2 className="text-xl font-bold uppercase tracking-widest">Color_Palette</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {COLORS.map((color) => (
                    <div
                      key={color.hex}
                      className={`group p-4 h-32 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${color.class}`}
                      onClick={() => copyToClipboard(color.hex)}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm uppercase tracking-wider">{color.name}</span>
                        {copiedHex === color.hex && <Check className="w-4 h-4 animate-in zoom-in" />}
                      </div>
                      <div className="font-mono text-xs uppercase flex items-center gap-2 opacity-60 group-hover:opacity-100">
                        {color.hex} <Copy className="w-3 h-3" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Typography */}
              <section>
                <div className="flex items-center gap-2 mb-6 text-magic-green">
                  <Type className="w-5 h-5" />
                  <h2 className="text-xl font-bold uppercase tracking-widest">Typography</h2>
                </div>
                <div className="border border-white/20 p-8 bg-[#050505]">
                  <div className="mb-8">
                    <span className="text-gray-500 text-xs uppercase tracking-widest mb-2 block">Primary Font</span>
                    <h3 className="text-4xl text-white font-mono">JetBrains Mono</h3>
                  </div>

                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 md:items-baseline border-b border-white/10 pb-4">
                      <span className="w-32 text-gray-500 text-xs uppercase">Regular (400)</span>
                      <p className="text-white font-mono font-normal text-lg">The quick brown fox jumps over the lazy dog.</p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 md:items-baseline border-b border-white/10 pb-4">
                      <span className="w-32 text-gray-500 text-xs uppercase">Bold (700)</span>
                      <p className="text-white font-mono font-bold text-lg">THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Logo */}
              <section>
                <div className="flex items-center gap-2 mb-6 text-magic-green">
                  <LayoutTemplate className="w-5 h-5" />
                  <h2 className="text-xl font-bold uppercase tracking-widest">Logomark</h2>
                </div>

                {/* Primary Logo */}
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1 mb-6">Primary_Logo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="border border-white/20 bg-black p-12 flex flex-col items-center justify-center gap-4 group">
                      <div className="relative w-40 h-40 transition-transform group-hover:scale-105">
                        <img src="/logo.svg" alt="Trashmarket Logo — Dark" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-magic-green/10 blur-xl rounded-sm -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">On_Dark</div>
                    </div>
                    <div className="border border-white/20 bg-white p-12 flex flex-col items-center justify-center gap-4 group">
                      <div className="relative w-40 h-40 transition-transform group-hover:scale-105">
                        <img src="/logo.svg" alt="Trashmarket Logo — Light" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-magic-green/10 blur-xl rounded-sm -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">On_Light</div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Variant */}
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1 mb-6">Enhanced_Variant</h3>
                  <div className="flex justify-center">
                    <div className="border border-white/20 bg-black p-8 flex flex-col items-center justify-center gap-4 group w-full max-w-md">
                      <div className="relative w-32 h-32 transition-transform group-hover:scale-105">
                        <img src="/assets/enhanced_logo_v6.svg" alt="Enhanced Logomark" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-magic-green/10 blur-xl rounded-sm -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Gold_SVG_Variant</div>
                    </div>
                  </div>
                </div>

                {/* Wordmarks */}
                <div className="space-y-6 mb-8">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">Wordmarks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="border border-white/20 bg-black p-12 flex items-center justify-center group">
                      <div className="text-2xl font-bold text-white tracking-tighter transition-transform group-hover:scale-110">
                        TRASHMARKET<span className="text-magic-green">.FUN</span>
                      </div>
                    </div>
                    <div className="border border-white/20 bg-white p-12 flex items-center justify-center group">
                      <div className="text-2xl font-bold text-black tracking-tighter transition-transform group-hover:scale-110">
                        TRASHMARKET<span className="text-magic-green">.FUN</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-4">
                  <a href="/logo.svg" download="trashmarket-logo.svg" className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase text-white border border-white/20 transition-colors">
                    <Download className="w-4 h-4" /> Download SVG
                  </a>
                  <a href="/assets/enhanced_logo_v6.svg" download="trashmarket-enhanced.svg" className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase text-white border border-white/20 transition-colors">
                    <Download className="w-4 h-4" /> Enhanced SVG
                  </a>
                </div>
              </section>

            </div>
          )}

          {/* MANIFESTO SECTION */}
          {activeSection === 'manifesto' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
              <div className="border-l-4 border-magic-green pl-6 py-2">
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">"One man's trash is another man's alpha."</h2>
              </div>
              <div className="font-mono text-gray-300 space-y-4 leading-relaxed">
                <p>
                  TrashMarket was born from the debris of failed mints, rugged projects, and derivative art. We believe that liquidity should flow freely, even in the gutters of the blockchain.
                </p>
                <p>
                  We reject rounded corners. We reject smooth gradients. We embrace the raw data.
                </p>
                <p>
                  <strong className="text-white">Core Values:</strong>
                </p>
                <ul className="list-disc pl-5 space-y-2 text-magic-green">
                  <li><span className="text-gray-300">Speed over safety.</span></li>
                  <li><span className="text-gray-300">Information density over whitespace.</span></li>
                  <li><span className="text-gray-300">Brutal honesty about asset value (usually 0).</span></li>
                </ul>
              </div>
            </div>
          )}

          {/* UI COMPONENTS SECTION */}
          {activeSection === 'ui' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Buttons */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6">Buttons</h3>
                <div className="flex flex-wrap gap-4 p-8 border border-white/20 border-dashed">
                  <button className="bg-magic-green text-black px-6 py-2 font-bold uppercase text-sm border border-magic-green hover:bg-black hover:text-magic-green transition-colors">
                    Primary Action
                  </button>
                  <button className="bg-black text-magic-green px-6 py-2 font-bold uppercase text-sm border border-magic-green hover:bg-magic-green hover:text-black transition-colors">
                    Secondary Action
                  </button>
                  <button className="bg-black text-white px-6 py-2 font-bold uppercase text-sm border border-white/20 hover:border-white transition-colors">
                    Tertiary Action
                  </button>
                </div>
              </section>

              {/* Inputs */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6">Inputs & Forms</h3>
                <div className="grid gap-4 p-8 border border-white/20 border-dashed bg-[#050505]">
                  <input type="text" name="demoText" placeholder="PLACEHOLDER_TEXT" className="w-full bg-black border border-white/20 p-3 text-white font-mono focus:border-magic-green outline-none" />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" name="demoCheckbox" checked readOnly className="appearance-none w-4 h-4 border border-magic-green bg-magic-green" />
                    <span className="text-sm font-mono text-gray-300">Checkbox Active</span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TOKEN SECTION */}
          {activeSection === 'token' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
              <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 bg-gradient-to-br from-magic-green/15 via-white/5 to-magic-pink/10 border border-white/20 backdrop-blur-md relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                <div className="relative group mb-12">
                  <div className="absolute inset-0 bg-magic-green/30 blur-[80px] rounded-full scale-125 opacity-40 group-hover:opacity-100 transition-opacity duration-1000"></div>
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    <img src="/assets/grok_image_1772074136993.jpg" alt="DEBRIS Token" className="w-56 h-56 relative z-10 transition-transform duration-1000 group-hover:scale-105 drop-shadow-[0_0_20px_rgba(173,255,2,0.4)] rounded-full" />
                    <img src="/assets/Debri-Intro2.jpg" alt="DEBRIS Intro" className="w-full max-w-md relative z-10 transition-transform duration-1000 group-hover:scale-105 drop-shadow-[0_0_20px_rgba(173,255,2,0.4)] rounded-lg" />
                  </div>
                </div>
                <div className="text-center relative z-10">
                  <h2 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-tight mb-4">DEBRIS Token</h2>
                  <p className="text-gray-300 font-mono text-sm max-w-lg mx-auto opacity-80 leading-relaxed mb-2">
                    The utility token powering games, rewards, and platform activity on the Gorbagana L2 network.
                  </p>
                </div>
              </div>

              {/* Token Details */}
              <section>
                <div className="flex items-center gap-2 mb-6 text-magic-green">
                  <Coins className="w-5 h-5" />
                  <h2 className="text-xl font-bold uppercase tracking-widest">Token_Details</h2>
                </div>
                <div className="border border-white/20 bg-[#050505] p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { label: 'Token Name', value: 'DEBRIS' },
                      { label: 'Network', value: 'Gorbagana (SVM L2)' },
                      { label: 'Total Supply', value: '1,000,000,000' },
                      { label: 'Decimals', value: '9' },
                    ].map((item) => (
                      <div key={item.label} className="border-b border-white/10 pb-4">
                        <span className="text-gray-500 text-xs uppercase tracking-widest block mb-1">{item.label}</span>
                        <span className="text-white font-mono text-lg">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <span className="text-gray-500 text-xs uppercase tracking-widest block mb-1">Contract Address</span>
                    <button onClick={() => copyToClipboard('DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy')} className="flex items-center gap-2 text-magic-green font-mono text-sm hover:text-white transition-colors">
                      DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy
                      {copiedHex === 'DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </section>

              {/* Allocation Overview */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">Allocation_Overview</h3>
                <div className="border border-white/20 bg-[#050505] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20 text-left">
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase">Category</th>
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase text-right">Allocation</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[
                        { cat: 'Game Liquidity — Junk Pusher', pct: '25.0%' },
                        { cat: 'Community Airdrop', pct: '16.0%' },
                        { cat: 'Platform Operations', pct: '15.0%' },
                        { cat: 'Game Liquidity — Slots', pct: '14.9%' },
                        { cat: 'DEX Liquidity', pct: '14.9%' },
                        { cat: 'NFT Marketplace', pct: '5.7%' },
                        { cat: 'Reserve', pct: '5.5%' },
                        { cat: 'In Circulation', pct: '3.0%' },
                      ].map((row) => (
                        <tr key={row.cat} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-gray-300">{row.cat}</td>
                          <td className="p-4 text-magic-green text-right">{row.pct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* SKILL GAME SECTION */}
          {activeSection === 'skill-game' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <div className="flex items-center gap-2 mb-6 text-magic-green">
                  <Gamepad2 className="w-5 h-5" />
                  <h2 className="text-xl font-bold uppercase tracking-widest">Skill_Game</h2>
                </div>
                <p className="text-gray-400 font-mono text-sm mb-8 max-w-2xl">
                  An arcade-style slots game where your decisions matter. Place your WILD symbol strategically to maximize your winnings.
                </p>
              </section>

              {/* How To Play */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">How_To_Play</h3>
                <div className="border border-white/20 bg-[#050505] p-8 space-y-6 font-mono text-sm text-gray-300">
                  <div className="flex gap-4">
                    <span className="text-magic-green font-bold w-6 shrink-0">01</span>
                    <div><span className="text-white font-bold">Connect your wallet</span> — You'll need a Gorbagana-compatible wallet</div>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-magic-green font-bold w-6 shrink-0">02</span>
                    <div><span className="text-white font-bold">Deposit DEBRIS</span> — Transfer tokens from your wallet into the game</div>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-magic-green font-bold w-6 shrink-0">03</span>
                    <div><span className="text-white font-bold">Choose a Play Level</span> — Select your wager: 10 to 9,999 DEBRIS per spin</div>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-magic-green font-bold w-6 shrink-0">04</span>
                    <div><span className="text-white font-bold">Preview (optional)</span> — Scout the grid before committing</div>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-magic-green font-bold w-6 shrink-0">05</span>
                    <div><span className="text-white font-bold">Play</span> — Spin the reels, then place your WILD to complete the best match</div>
                  </div>
                </div>
              </section>

              {/* Payouts */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">Payout_Table</h3>
                <div className="border border-white/20 bg-[#050505] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20 text-left">
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase">Symbol</th>
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase">Rarity</th>
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase text-right">Multiplier</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[
                        { sym: 'Alon', rarity: 'Legendary', mult: '25x', color: 'text-yellow-400' },
                        { sym: 'Oscar', rarity: 'Epic', mult: '8x', color: 'text-purple-400' },
                        { sym: 'Sky Garbage', rarity: 'Rare', mult: '4x', color: 'text-blue-400' },
                        { sym: 'Shredder', rarity: 'Rare', mult: '2.5x', color: 'text-blue-400' },
                        { sym: 'Gorbios', rarity: 'Uncommon', mult: '1.5x', color: 'text-green-400' },
                        { sym: 'Pump Pill', rarity: 'Common', mult: '1.0x', color: 'text-gray-400' },
                        { sym: 'Digibin', rarity: 'Common', mult: '0.7x', color: 'text-gray-400' },
                        { sym: 'Box', rarity: 'Common', mult: '0.4x', color: 'text-gray-400' },
                        { sym: 'Mattress', rarity: 'Common', mult: '0.2x', color: 'text-gray-400' },
                      ].map((row) => (
                        <tr key={row.sym} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-white">{row.sym}</td>
                          <td className={`p-4 ${row.color}`}>{row.rarity}</td>
                          <td className="p-4 text-magic-green text-right">{row.mult}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Winning Lines */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">Winning_Lines</h3>
                <div className="border border-white/20 bg-[#050505] p-8 font-mono text-sm text-gray-300 space-y-3">
                  <p className="text-white font-bold mb-4">8 possible winning lines on the 3x3 grid:</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2"><span className="text-magic-green">—</span> 3 horizontal rows</li>
                    <li className="flex items-center gap-2"><span className="text-magic-green">|</span> 3 vertical columns</li>
                    <li className="flex items-center gap-2"><span className="text-magic-green">\</span> 2 diagonals</li>
                  </ul>
                  <p className="text-gray-500 mt-4 text-xs">Only the best single line pays out per spin. The center cell appears on 4 lines — making it the most powerful WILD placement.</p>
                </div>
              </section>

              {/* Fairness */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">Fairness</h3>
                <div className="border border-white/20 bg-[#050505] p-8 font-mono text-sm text-gray-300 space-y-3">
                  <div className="flex items-baseline gap-3"><span className="text-magic-green text-lg font-bold">~91%</span> <span>Return-To-Player (RTP) with optimal WILD placement</span></div>
                  <div className="flex items-baseline gap-3"><span className="text-magic-green text-lg font-bold">~1:4</span> <span>Approximately 1 in 4 spins returns a profit</span></div>
                  <div className="flex items-baseline gap-3"><span className="text-magic-green text-lg font-bold">25x</span> <span>Maximum payout multiplier on a single spin</span></div>
                  <p className="text-gray-500 text-xs mt-4">All deposits, withdrawals, and game results are recorded on the Gorbagana blockchain. A 2.5% platform fee applies on deposits.</p>
                </div>
              </section>
            </div>
          )}

          {/* TOKENOMICS SECTION */}
          {activeSection === 'tokenomics' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <div className="flex items-center gap-2 mb-6 text-magic-green">
                  <PieChart className="w-5 h-5" />
                  <h2 className="text-xl font-bold uppercase tracking-widest">Tokenomics</h2>
                </div>
                <p className="text-gray-400 font-mono text-sm mb-8 max-w-2xl">
                  Full breakdown of DEBRIS token allocation, distribution, and ecosystem wallets.
                </p>
              </section>

              {/* Allocation */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">Token_Allocation</h3>
                <div className="border border-white/20 bg-[#050505] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20 text-left">
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase">Category</th>
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase text-right">%</th>
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase text-right hidden md:table-cell">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[
                        { cat: 'Game Liquidity — Junk Pusher', pct: '25.0%', bal: '249,975,990' },
                        { cat: 'Community Airdrop', pct: '16.0%', bal: '159,987,056' },
                        { cat: 'Platform Operations', pct: '15.0%', bal: '149,985,000' },
                        { cat: 'Game Liquidity — Slots', pct: '14.9%', bal: '148,500,000' },
                        { cat: 'DEX Liquidity', pct: '14.9%', bal: '148,500,000' },
                        { cat: 'NFT Marketplace', pct: '5.7%', bal: '57,420,031' },
                        { cat: 'Reserve', pct: '5.5%', bal: '54,614,114' },
                        { cat: 'In Circulation', pct: '3.0%', bal: '~31,017,809' },
                      ].map((row) => (
                        <tr key={row.cat} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-gray-300">{row.cat}</td>
                          <td className="p-4 text-magic-green text-right">{row.pct}</td>
                          <td className="p-4 text-gray-500 text-right hidden md:table-cell">{row.bal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Airdrop */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">Community_Airdrop</h3>
                <div className="border border-white/20 bg-[#050505] p-8 font-mono text-sm text-gray-300 space-y-3">
                  <p>DEBRIS is airdropped to community members who register through the official airdrop page on Trashmarket.fun.</p>
                  <p>Registration requires a Twitter/X account and a Gorbagana wallet address. One registration per account.</p>
                  <p className="text-gray-500 text-xs mt-4">Limited supply — once the airdrop pool is exhausted, registration closes.</p>
                </div>
              </section>

              {/* Key Addresses */}
              <section>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-6 px-1">Key_Addresses</h3>
                <div className="border border-white/20 bg-[#050505] overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/20 text-left">
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase">Role</th>
                        <th className="p-4 text-gray-500 font-mono text-xs uppercase">Address</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      {[
                        { role: 'DEBRIS Contract', addr: 'DebrikgCUTkxMGSxnBoVuwqpW4zivMrUfUP6kUeNUMwy' },
                        { role: 'Junk Pusher Treasury', addr: '8iKCvwz3tyUp4hzxcyLYtPQghiwiEhiLDd38MEQBF6kR' },
                        { role: 'Airdrop Pool', addr: 'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo' },
                        { role: 'Platform Operations', addr: 'Drn1GXZoBpER3gUPFCZJTNGEghXvEyFYmtfB7ycoiMAJ' },
                        { role: 'Slots Treasury', addr: 'Eyu7XqQ6WR7czNsGHWbiyYWpniikMYctsAHrvUCXcqtU' },
                        { role: 'DEX Liquidity', addr: 'CdaobFF9Sgr6eN1pKMWfx3hZxkf6qqLUut15vVBb2wG6' },
                        { role: 'NFT Marketplace', addr: '77hDeRmTFa7WVPqTvDtD9qg9D73DdqU3WeaHTxUnQ8wb' },
                        { role: 'Reserve', addr: '7qrxa4jsxVWrNRmuFNPv5ekCScjdk8gPeFg7xDdEdHzU' },
                      ].map((row) => (
                        <tr key={row.role} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="p-4 text-gray-300 whitespace-nowrap">{row.role}</td>
                          <td className="p-4">
                            <button onClick={() => copyToClipboard(row.addr)} className="flex items-center gap-2 text-gray-500 hover:text-magic-green transition-colors">
                              <span className="truncate max-w-[200px] md:max-w-none">{row.addr}</span>
                              {copiedHex === row.addr ? <Check className="w-3 h-3 shrink-0 text-magic-green" /> : <Copy className="w-3 h-3 shrink-0" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-gray-600 font-mono text-xs mt-4 px-1">
                  All balances verifiable on the <a href="https://explorer.gorbagana.wtf" target="_blank" rel="noopener noreferrer" className="text-magic-green hover:underline">Gorbagana Explorer</a>
                </p>
              </section>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default Docs;
