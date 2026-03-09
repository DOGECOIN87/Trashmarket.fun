import React, { useState, useEffect } from 'react';
import { getMarketMetrics, MarketMetric, getMockTokenMetrics } from '../services/tokenService';
import { useNetwork } from '../contexts/NetworkContext';

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

/**
 * Top ticker — token prices, sits below the Navbar
 */
const PriceTicker: React.FC = () => {
  const [marketMetrics, setMarketMetrics] = useState<MarketMetric[]>(getMockTokenMetrics());

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const metrics = await getMarketMetrics();
        setMarketMetrics(metrics);
      } catch (error) {
        console.error('Failed to fetch market metrics:', error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-b border-white/20 bg-[#050505] overflow-hidden relative py-1 sticky top-16 z-30">
      <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-[#050505] to-transparent z-20 pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-[#050505] to-transparent z-20 pointer-events-none"></div>

      <div className="bg-black/50 backdrop-blur-sm relative z-10">
        <Marquee reverse={true}>
          {marketMetrics.map((item, idx) => (
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
    </div>
  );
};

/**
 * Bottom ticker — live activity feed, sits above the Footer
 */
export const ActivityTicker: React.FC = () => {
  const { currency, accentColor } = useNetwork();

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
    <div className="border-t border-white/20 bg-[#050505] overflow-hidden relative py-1 z-30">
      <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-[#050505] to-transparent z-20 pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-[#050505] to-transparent z-20 pointer-events-none"></div>

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
  );
};

export default PriceTicker;
