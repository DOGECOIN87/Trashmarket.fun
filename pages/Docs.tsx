import React, { useState } from 'react';
import { Copy, Check, Download, Hash, Terminal, Type, LayoutTemplate, Palette, Coins } from 'lucide-react';

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
      {/* Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10 opacity-30 pointer-events-none"
        src="/gorbagio-video-robotaxi.mp4"
      />

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 sticky top-16 h-auto md:h-[calc(100vh-64px)] bg-black/80 z-20 overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Hash className="w-3 h-3" /> Documentation
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
              Official_Docs
            </h1>
            <p className="text-gray-400 font-mono text-sm max-w-2xl">
              The authoritative source for the Trash Market visual language, philosophy, and developer endpoints. Use these assets to build compatible garbage.
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
                <div className="flex justify-center mb-12">
                  <div className="border border-white/20 bg-black p-8 flex flex-col items-center justify-center gap-4 group w-full max-w-md">
                    <div className="relative w-32 h-32 transition-transform group-hover:scale-105">
                      <img src="/assets/logo.svg" alt="Official Logomark" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-magic-green/10 blur-xl rounded-sm -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Official_SVG_Variant</div>
                  </div>
                </div>

                <div className="space-y-6 mb-8">
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">Original_Wordmarks</h3>
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
                  <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase text-white border border-white/20 transition-colors">
                    <Download className="w-4 h-4" /> Download SVG
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase text-white border border-white/20 transition-colors">
                    <Download className="w-4 h-4" /> Download PNG
                  </button>
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[60vh] flex flex-col items-center justify-center p-8 bg-gradient-to-br from-magic-green/15 via-white/5 to-magic-pink/10 border border-white/20 rounded-2xl backdrop-blur-md shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

              <div className="relative group mb-12">
                <div className="absolute inset-0 bg-magic-green/30 blur-[80px] rounded-full scale-125 opacity-40 group-hover:opacity-100 transition-opacity duration-1000"></div>
                <img
                  src="/assets/logo-circle-transparent.png"
                  alt="Trashmarket Token"
                  className="w-56 h-56 relative z-10 transition-transform duration-1000 group-hover:rotate-[360deg] drop-shadow-[0_0_20px_rgba(173,255,2,0.4)]"
                />
              </div>

              <div className="text-center relative z-10">
                <h2 className="text-4xl md:text-5xl font-heading text-white uppercase tracking-tight mb-8">
                  Trashmarket.fun Token
                </h2>
                <p className="text-gray-300 font-heading text-lg md:text-xl max-w-md mx-auto opacity-80 leading-relaxed uppercase tracking-widest mb-8">
                  To Be Announced
                </p>
                <p className="text-gray-300 font-heading text-sm md:text-base max-w-md mx-auto opacity-70 leading-relaxed uppercase tracking-widest">
                  The ultimate garbage-powered economy. Ready to dump soon.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default Docs;
