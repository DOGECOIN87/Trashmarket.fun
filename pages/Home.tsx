import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MOCK_COLLECTIONS } from '../constants';
import { Terminal, ArrowRight, ArrowUpRight, ArrowDownRight, Activity, Zap, Radio } from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';

// --- SIMPLE MARQUEE COMPONENT ---
const Marquee = ({ children, reverse = false, className = "" }: { children?: React.ReactNode, reverse?: boolean, className?: string }) => {
  return (
    <div className={`flex overflow-hidden relative w-full select-none ${className}`}>
      <div className={`flex shrink-0 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'} min-w-full items-center gap-0`}>
        {children}
      </div>
      <div className={`flex shrink-0 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'} min-w-full items-center gap-0`}>
        {children}
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { currency, accentColor } = useNetwork();
  
  // Set Gorbagios as the featured collection (System Spotlight)
  const featuredCollection = MOCK_COLLECTIONS.find(c => c.id === 'gorbagios') || MOCK_COLLECTIONS[0];
  
  const [isHovering, setIsHovering] = useState(false);

  const MARKET_METRICS = [
    { label: "SOL", value: "$145.20", change: "+5.2%", color: "text-magic-green" },
    { label: "BTC", value: "$65,100", change: "+1.2%", color: "text-magic-green" },
    { label: "ETH", value: "$3,450", change: "-0.4%", color: "text-magic-red" },
    { label: "JUP", value: "$1.45", change: "+12.4%", color: "text-magic-green" },
    { label: "PYTH", value: "$0.45", change: "+1.2%", color: "text-magic-green" },
    { label: "WIF", value: "$3.20", change: "-4.5%", color: "text-magic-red" },
    { label: "BONK", value: "$0.000024", change: "+8.2%", color: "text-magic-green" },
    { label: "POPCAT", value: "$0.45", change: "+15%", color: "text-magic-green" },
    { label: "RENDER", value: "$7.20", change: "+3.1%", color: "text-magic-green" },
    { label: "HNT", value: "$6.50", change: "-1.2%", color: "text-magic-red" },
    { label: "RAY", value: "$1.80", change: "+5.5%", color: "text-magic-green" },
    { label: "ORCA", value: "$2.10", change: "+0.5%", color: "text-magic-green" },
    { label: "GAS", value: "4 Gwei", change: "LOW", color: "text-blue-400" },
    { label: "TPS", value: "3,892", change: "LIVE", color: "text-yellow-400" },
    { label: "DOM", value: "2.4%", change: "SOL", color: "text-white" },
  ];

  const LIVE_ACTIVITIES = [
    { type: "SALE", text: `Mad Lads #2912 sold for 145.5 ${currency}`, time: "1s" },
    { type: "LIST", text: `Tensorian #400 listed for 18.2 ${currency}`, time: "1s" },
    { type: "SALE", text: `SMB Gen2 #441 sold for 24.5 ${currency}`, time: "2s" },
    { type: "OFFER", text: `Offer of 45.0 ${currency} on DeGods #3321`, time: "2s" },
    { type: "SWEEP", text: `Whale swept 5x Claynos (Floor 9.5 ${currency})`, time: "3s" },
    { type: "SALE", text: `Foxes #551 sold for 4.2 ${currency}`, time: "4s" },
    { type: "MINT", text: "Galactic Geckos #999 minted", time: "4s" },
    { type: "SALE", text: `Okay Bears #881 sold for 12.0 ${currency}`, time: "5s" },
    { type: "LIST", text: `Retardio #12 listed for 5.5 ${currency}`, time: "5s" },
    { type: "SALE", text: `Sharx #302 sold for 7.8 ${currency}`, time: "6s" },
    { type: "VOL", text: "Famous Fox Fed vol spike > 500%", time: "6s" },
    { type: "SALE", text: `Froganas #221 sold for 1.2 ${currency}`, time: "7s" },
  ];

  return (
    <div className="min-h-screen bg-black pb-20" onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}>
      
      {/* Hero / Spotlight */}
      <div className="relative h-[450px] w-full overflow-hidden border-b border-white/20">
        <div className="absolute inset-0">
          <img 
            src={featuredCollection.banner} 
            alt="Hero" 
            className="w-full h-full object-cover opacity-20 grayscale contrast-150"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.5)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
        </div>
        
        <div className="absolute bottom-0 left-0 w-full p-4 md:p-12 z-10">
          <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-end justify-between gap-8">
            <div className="max-w-3xl w-full">
              <div className={`flex items-center justify-between mb-2 w-full border-b ${accentColor === 'text-magic-purple' ? 'border-magic-purple/30' : 'border-magic-green/30'} pb-2`}>
                   <div className={`inline-flex items-center gap-2 ${accentColor} text-xs font-bold uppercase tracking-widest font-mono`}>
                        <Terminal className="w-3 h-3" /> System_Spotlight :: {featuredCollection.id.toUpperCase()}
                   </div>
                   <div className="flex gap-4 items-center">
                        <span className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 text-gray-500`}>
                            <Radio className={`w-3 h-3 ${accentColor} animate-pulse`} />
                            SYSTEM_ONLINE
                        </span>
                        <Link to="/launchpad" className="text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-mono">
                            [ AI_LAUNCHPAD_ACTIVE ]
                        </Link>
                   </div>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter uppercase leading-none">
                {featuredCollection.name}
              </h1>
              
              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                  <div className="flex items-center gap-8 text-sm text-gray-400 font-mono">
                     <div className={`flex flex-col border-l-2 ${accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green'} pl-3`}>
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">Floor_Price</span>
                        <span className="text-white text-xl font-bold">{currency} {featuredCollection.floorPrice}</span>
                     </div>
                     <div className="flex flex-col border-l-2 border-gray-800 pl-3">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">24h_Volume</span>
                        <span className="text-white text-xl font-bold">{currency} {(featuredCollection.totalVolume / 1000).toFixed(1)}k</span>
                     </div>
                  </div>

                  <Link 
                    to={`/collection/${featuredCollection.id}`}
                    className={`group relative px-8 py-3 bg-black border ${accentColor === 'text-magic-purple' ? 'border-magic-purple text-magic-purple hover:bg-magic-purple' : 'border-magic-green text-magic-green hover:bg-magic-green'} font-bold uppercase tracking-widest text-xs hover:text-black transition-all duration-200`}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                        Execute_View <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DUAL SPEED TICKER SYSTEM - CSS ANIMATED */}
      <div className="border-b border-white/20 bg-[#050505] overflow-hidden relative flex flex-col py-2 gap-1 group">
         {/* Gradient Masks */}
         <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-black to-transparent z-20 pointer-events-none"></div>
         <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-black to-transparent z-20 pointer-events-none"></div>
         
         {/* Top Row: Macro Stats (Right) */}
         <div className="border-b border-white/5 bg-black/50 backdrop-blur-sm relative z-10">
             <Marquee reverse={true}>
                {MARKET_METRICS.map((item, idx) => (
                    <div key={`m-${idx}`} className="flex items-center gap-3 mx-8 py-2 text-xs uppercase tracking-wider font-mono whitespace-nowrap">
                        <span className="text-gray-600 font-bold">{item.label}</span>
                        <span className={`font-bold ${item.color}`}>{item.value}</span>
                        <span className={`text-[10px] ${item.change.startsWith('+') ? 'text-magic-green' : item.change.startsWith('-') ? 'text-magic-red' : 'text-gray-400'}`}>
                            {item.change}
                        </span>
                        <span className="text-gray-800 ml-4">/</span>
                    </div>
                ))}
             </Marquee>
         </div>

         {/* Bottom Row: Live Activities (Left) */}
         <div className="bg-black relative z-10">
             <Marquee reverse={false}>
                {LIVE_ACTIVITIES.map((item, idx) => (
                    <div key={`a-${idx}`} className="flex items-center gap-2 mx-8 py-2 text-xs uppercase tracking-wider font-mono border-r border-white/10 pr-8 whitespace-nowrap">
                        <div className={`w-1.5 h-1.5 ${item.type === 'SALE' ? (accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green') : item.type === 'SWEEP' ? 'bg-magic-pink' : 'bg-blue-400'}`}></div>
                        <span className="text-gray-500 font-bold">[{item.type}]</span>
                        <span className="text-gray-200">{item.text}</span>
                        <span className="text-gray-700 text-[10px]">{item.time}</span>
                    </div>
                ))}
             </Marquee>
         </div>
      </div>

      {/* Pro Table Section */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
                <Activity className={`w-5 h-5 ${accentColor}`} />
                <h2 className="text-xl font-bold text-white uppercase tracking-widest font-mono">Market_Feed</h2>
            </div>
            <div className="flex gap-px bg-white/10 border border-white/10">
                <button className="px-4 py-1 bg-black text-gray-500 hover:text-white text-[10px] uppercase font-bold tracking-wider hover:bg-white/5">1h</button>
                <button className={`px-4 py-1 ${accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green'} text-black text-[10px] uppercase font-bold tracking-wider`}>24h</button>
                <button className="px-4 py-1 bg-black text-gray-500 hover:text-white text-[10px] uppercase font-bold tracking-wider hover:bg-white/5">7d</button>
            </div>
        </div>

        <div className="border border-white/20 bg-black relative">
            <div className={`absolute -top-1 -left-1 w-2 h-2 border-t border-l ${accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green'}`}></div>
            <div className={`absolute -bottom-1 -right-1 w-2 h-2 border-b border-r ${accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green'}`}></div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 text-[10px] text-gray-500 uppercase font-mono tracking-widest bg-white/5">
                            <th className="p-4 font-bold">Rank / Collection</th>
                            <th className="p-4 font-bold text-right">Floor</th>
                            <th className="p-4 font-bold text-right">24h %</th>
                            <th className="p-4 font-bold text-right">24h Vol</th>
                            <th className="p-4 font-bold text-right">Sales</th>
                            <th className="p-4 font-bold text-right">Supply</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {MOCK_COLLECTIONS.map((collection, idx) => (
                            <tr key={collection.id} className="group hover:bg-white/5 transition-colors">
                                <td className="p-4">
                                    <Link to={`/collection/${collection.id}`} className="flex items-center gap-4">
                                        <span className="text-gray-700 font-mono text-sm w-4 text-center group-hover:text-white transition-colors">0{idx + 1}</span>
                                        <div className={`w-8 h-8 border border-white/20 overflow-hidden bg-gray-900 group-hover:border-${accentColor === 'text-magic-purple' ? 'magic-purple' : 'magic-green'} transition-colors`}>
                                            <img src={collection.image} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-300 group-hover:text-white flex items-center gap-2 uppercase tracking-tight text-sm transition-colors">
                                                {collection.name}
                                                {collection.isVerified && <Zap className={`w-3 h-3 ${accentColor} fill-current`} />}
                                            </div>
                                        </div>
                                    </Link>
                                </td>
                                <td className={`p-4 text-right font-mono font-bold text-gray-300 group-hover:${accentColor} transition-colors`}>
                                    {currency} {collection.floorPrice}
                                </td>
                                <td className={`p-4 text-right font-mono font-bold text-xs ${collection.change24h >= 0 ? 'text-magic-green' : 'text-magic-red'}`}>
                                    <div className="flex items-center justify-end gap-1">
                                        {collection.change24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                        {Math.abs(collection.change24h)}%
                                    </div>
                                </td>
                                <td className="p-4 text-right font-mono text-gray-500 text-xs">
                                    {currency} {(collection.totalVolume / 1000).toFixed(1)}k
                                </td>
                                <td className="p-4 text-right font-mono text-gray-500 text-xs">
                                    {collection.listedCount * 2}
                                </td>
                                <td className="p-4 text-right font-mono text-gray-600 text-xs">
                                    {collection.supply}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-3 border-t border-white/10 text-center bg-black hover:bg-white/5 cursor-pointer transition-colors">
                <button className="text-[10px] text-gray-400 font-bold flex items-center justify-center gap-2 w-full uppercase tracking-widest hover:text-white">
                    [ LOAD_MORE_DATA ]
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Home;