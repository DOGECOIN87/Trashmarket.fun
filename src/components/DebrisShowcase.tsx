import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Users, ExternalLink, Zap, Activity, Shield, Database, Radar, Cpu } from 'lucide-react';
import { TOKEN_CONFIG } from '../lib/tokenConfig';

interface TokenHolder {
  wallet: string;
  tokenAccount: string;
  amount: number;
}

interface DebrisShowcaseProps {
  debrisSupply: number;
  debrisHolders: TokenHolder[];
  accentColor: string;
  bgAccent: string;
  borderAccent: string;
  truncateAddr: (addr: string) => string;
}

const DEBRIS_MINT = TOKEN_CONFIG.DEBRIS.address;
const DEBRIS_LOGO = 'https://raw.githubusercontent.com/DOGECOIN87/Trashmarket.fun/main/public/assets/logo-circle-transparent.png';

const DebrisShowcase: React.FC<DebrisShowcaseProps> = ({
  debrisSupply,
  debrisHolders,
  accentColor,
  bgAccent,
  borderAccent,
  truncateAddr,
}) => {
  const [displaySupply, setDisplaySupply] = useState(0);
  const [displayHolders, setDisplayHolders] = useState(0);

  // Animate supply counter
  useEffect(() => {
    if (debrisSupply <= 0) return;
    let current = 0;
    const increment = debrisSupply / 60;
    const interval = setInterval(() => {
      current += increment;
      if (current >= debrisSupply) {
        setDisplaySupply(debrisSupply);
        clearInterval(interval);
      } else {
        setDisplaySupply(current);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [debrisSupply]);

  // Animate holders counter
  useEffect(() => {
    if (debrisHolders.length <= 0) return;
    let current = 0;
    const increment = debrisHolders.length / 30;
    const interval = setInterval(() => {
      current += increment;
      if (current >= debrisHolders.length) {
        setDisplayHolders(debrisHolders.length);
        clearInterval(interval);
      } else {
        setDisplayHolders(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(interval);
  }, [debrisHolders.length]);

  return (
    <section className="relative py-12 overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(173,255,2,.05)_25%,rgba(173,255,2,.05)_26%,transparent_27%,transparent_74%,rgba(173,255,2,.05)_75%,rgba(173,255,2,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(173,255,2,.05)_25%,rgba(173,255,2,.05)_26%,transparent_27%,transparent_74%,rgba(173,255,2,.05)_75%,rgba(173,255,2,.05)_76%,transparent_77%,transparent)] bg-[length:50px_50px] animate-grid-flow"></div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-magic-green rounded-full opacity-20"
            animate={{
              y: [0, -300, 0],
              x: [0, Math.sin(i) * 100, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              left: `${20 + i * 15}%`,
              top: `${10 + i * 10}%`,
            }}
          />
        ))}
      </div>

      {/* Scan Line Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-magic-green to-transparent animate-scan-bar"></div>
        <div className="grid grid-cols-12 h-full w-full">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="border-r border-magic-green/20 h-full"></div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className={`p-2 ${bgAccent} text-black`}>
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-[0.2em] font-mono">
              DEBRIS<span className={accentColor}>_PROTOCOL</span>
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500 uppercase">
              <Activity className={`w-3 h-3 ${accentColor} animate-pulse`} />
              <span>Network_Status: Optimal</span>
              <span className="mx-2">|</span>
              <span>Asset_Class: Utility_Token</span>
            </div>
          </div>
        </motion.div>

        <div className="hidden md:flex items-center gap-6 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          <div className="flex flex-col items-end">
            <span>System_Time</span>
            <span className="text-white">{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="flex flex-col items-end">
            <span>Encryption</span>
            <span className="text-white">ED25519_ACTIVE</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* --- TOKEN CORE CARD --- */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-4 group"
        >
          <div className={`relative h-full border ${borderAccent}/30 bg-black/80 backdrop-blur-sm p-8 overflow-hidden`}>
            {/* Corner Accents */}
            <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${borderAccent} group-hover:scale-110 transition-transform`}></div>
            <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${borderAccent} group-hover:scale-110 transition-transform`}></div>
            <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${borderAccent} group-hover:scale-110 transition-transform`}></div>
            <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${borderAccent} group-hover:scale-110 transition-transform`}></div>

            {/* Animated Background Logo */}
            <div className="absolute -right-12 -bottom-12 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
              <motion.img 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                src={DEBRIS_LOGO} 
                alt="" 
                className="w-64 h-64 grayscale"
              />
            </div>

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-10">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-20 h-20 border-2 ${borderAccent} p-1 bg-black shadow-[0_0_20px_rgba(173,255,2,0.2)] cursor-pointer relative group`}
                >
                  <motion.img 
                    src={DEBRIS_LOGO} 
                    alt="DEBRIS" 
                    className="w-full h-full object-cover" 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="absolute inset-0 border-2 border-magic-green/0 group-hover:border-magic-green/50 transition-all duration-300"></div>
                </motion.div>
                <div className="text-right">
                  <div className={`text-[10px] font-mono ${accentColor} mb-1 animate-neon-pulse`}>TOKEN_ID</div>
                  <motion.div 
                    className="text-white font-mono text-xs font-bold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    {truncateAddr(DEBRIS_MINT)}
                  </motion.div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="text-[10px] font-mono text-gray-500 uppercase mb-1 tracking-widest">Circulating_Supply</div>
                  <div className="text-3xl font-black text-white font-mono tracking-tighter animate-neon-pulse">
                    {displaySupply > 0 ? (
                      displaySupply.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    ) : '---'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`border-l-2 ${borderAccent} pl-3 py-1`}>
                    <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Holders</div>
                    <div className="text-xl font-bold text-white font-mono animate-neon-pulse">{displayHolders}</div>
                  </div>
                  <div className="border-l-2 border-gray-800 pl-3 py-1">
                    <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Decimals</div>
                    <div className="text-xl font-bold text-white font-mono">{TOKEN_CONFIG.DEBRIS.decimals}</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <Shield className={`w-3 h-3 ${accentColor}`} />
                    </motion.div>
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">Verified_Contract</span>
                  </div>
                  <a
                    href={`https://explorer.gorbagana.wtf/token/${DEBRIS_MINT}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group/btn flex items-center justify-between w-full p-3 border border-white/10 hover:${borderAccent}/50 transition-all duration-300`}
                  >
                    <span className="text-[10px] font-mono text-gray-300 group-hover/btn:text-white uppercase tracking-widest">View_Explorer</span>
                    <ExternalLink className={`w-3 h-3 ${accentColor}`} />
                  </a>
                </div>
              </div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-8"
              >
                <a
                  href="#/junk-pusher"
                  className={`flex items-center justify-center gap-3 w-full py-4 ${bgAccent} text-black font-black uppercase tracking-[0.2em] text-xs shadow-[0_0_30px_rgba(173,255,2,0.3)] hover:shadow-[0_0_40px_rgba(173,255,2,0.5)] transition-all`}
                >
                  <Zap className="w-4 h-4 fill-current" />
                  Initialize_Game
                </a>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* --- HOLDERS HUD LIST --- */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-8"
        >
          <div className="relative h-full border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                >
                  <Users className={`w-4 h-4 ${accentColor}`} />
                </motion.div>
                <span className="text-xs font-bold text-white uppercase tracking-[0.2em] font-mono">Holder_Registry</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="w-2 h-2 rounded-full bg-magic-green"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  ></motion.div>
                  <span className="text-[9px] font-mono text-gray-500 uppercase">Live_Feed</span>
                </div>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                  <Database className="w-3 h-3 text-gray-600" />
                </motion.div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[9px] text-gray-500 uppercase font-mono tracking-widest border-b border-white/5">
                    <th className="px-6 py-4 font-medium">Rank</th>
                    <th className="px-6 py-4 font-medium">Entity_Address</th>
                    <th className="px-6 py-4 font-medium text-right">Allocation</th>
                    <th className="px-6 py-4 font-medium text-right hidden sm:table-cell">Distribution_Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {debrisHolders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className={`w-8 h-8 border-2 border-t-transparent ${borderAccent} rounded-full animate-spin`}></div>
                            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Synchronizing_Data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      debrisHolders.slice(0, 10).map((holder, idx) => {
                        const pctSupply = debrisSupply > 0 ? (holder.amount / debrisSupply) * 100 : 0;
                        const isGameTreasury = holder.wallet === TOKEN_CONFIG.TREASURY.address ||
                                               holder.tokenAccount === TOKEN_CONFIG.TREASURY.tokenAccount;
                        
                        return (
                          <motion.tr 
                            key={holder.tokenAccount}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group hover:bg-magic-green/5 transition-colors cursor-crosshair"
                          >
                            <td className="px-6 py-4">
                              <span className="font-mono text-gray-600 group-hover:text-white transition-colors text-xs">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold border ${idx === 0 ? borderAccent + ' ' + accentColor : 'border-white/10 text-gray-500'} group-hover:border-magic-green group-hover:text-magic-green transition-all`}>
                                  {idx + 1}
                                </div>
                                <div>
                                  <div className="font-mono text-gray-300 group-hover:text-white transition-colors text-xs">
                                    <span className="hidden sm:inline">{holder.wallet}</span>
                                    <span className="sm:hidden">{truncateAddr(holder.wallet)}</span>
                                  </div>
                                  {isGameTreasury && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <div className="w-1 h-1 bg-magic-pink rounded-full"></div>
                                      <span className="text-[8px] text-magic-pink font-bold uppercase tracking-tighter">System_Treasury</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="font-mono font-bold text-white text-xs">
                                {holder.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                              <div className="text-[8px] text-gray-600 font-mono uppercase">DEBRIS</div>
                            </td>
                            <td className="px-6 py-4 text-right hidden sm:table-cell">
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-mono ${pctSupply > 10 ? 'text-magic-pink' : 'text-gray-400'}`}>
                                    {pctSupply.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="w-32 h-1 bg-white/5 overflow-hidden relative">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${Math.min(pctSupply, 100)}%` }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                    className={`h-full ${pctSupply > 10 ? 'bg-magic-pink shadow-[0_0_10px_rgba(255,0,255,0.5)]' : bgAccent + ' shadow-[0_0_10px_rgba(173,255,2,0.3)]'} relative z-10`}
                                  />
                                  {/* Ghost bar for effect */}
                                  <div className="absolute inset-0 bg-white/5 w-full h-full"></div>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            
            {/* Footer HUD info */}
            <div className="p-3 border-t border-white/5 bg-black/20 flex justify-between items-center text-[8px] font-mono text-gray-600 uppercase tracking-[0.2em]">
              <span>Data_Source: Gorbagana_Mainnet_RPC</span>
              <div className="flex gap-4">
                <span>Total_Records: {debrisHolders.length}</span>
                <span>Page: 01/01</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DebrisShowcase;
