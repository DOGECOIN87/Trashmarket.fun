import React, { useState, useEffect, useRef } from 'react';
import { getMarketMetrics, MarketMetric, getMockTokenMetrics } from '../services/tokenService';
import { useNetwork } from '../contexts/NetworkContext';
import { subscribeToActivityFeed, timeAgo, type ActivityItem } from '../services/activityService';

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
              <span className={`text-[10px] ${item.change.startsWith('+') ? 'text-magic-blue' : item.change.startsWith('-') ? 'text-magic-red' : 'text-gray-400'}`}>
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
 * Bottom ticker — live activity feed, sits above the Footer.
 * Subscribes to real events from Gorid (Trading API) and Gorbagio (Firestore).
 * Falls back to a "No recent activity" placeholder when the feed is empty.
 */
export const ActivityTicker: React.FC = () => {
  const { accentColor } = useNetwork();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current = subscribeToActivityFeed(
      (items) => setActivities(items),
      { pollInterval: 30000, maxItems: 30 },
    );
    return () => unsubRef.current?.();
  }, []);

  const dotColor = (type: string) => {
    if (type === 'SALE') return accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-blue';
    if (type === 'LIST') return 'bg-blue-400';
    if (type === 'DELIST') return 'bg-yellow-400';
    if (type === 'DEPOSIT') return 'bg-emerald-400';
    if (type === 'WIN') return 'bg-yellow-300';
    return 'bg-gray-400';
  };

  // Show a placeholder when no real events yet
  const displayItems = activities.length > 0
    ? activities
    : [{ id: 'empty', type: 'LIST' as const, text: 'Waiting for live activity...', timestamp: Date.now(), source: 'gorid' as const }];

  return (
    <div className="border-t border-white/20 bg-[#050505] overflow-hidden relative py-1 z-30">
      <div className="absolute top-0 left-0 w-24 h-full bg-gradient-to-r from-[#050505] to-transparent z-20 pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-24 h-full bg-gradient-to-l from-[#050505] to-transparent z-20 pointer-events-none"></div>

      <div className="bg-black relative z-10">
        <Marquee reverse={false}>
          {displayItems.map((item, idx) => (
            <div key={item.id || idx} className="flex items-center gap-2 mx-8 py-2 text-xs uppercase tracking-wider font-mono border-r border-white/10 pr-8 whitespace-nowrap">
              <div className={`w-1.5 h-1.5 ${dotColor(item.type)}`}></div>
              <span className="text-gray-500 font-bold">[{item.type}]</span>
              <span className="text-gray-200">{item.text}</span>
              <span className="text-gray-700 text-[10px]">{timeAgo(item.timestamp)}</span>
            </div>
          ))}
        </Marquee>
      </div>
    </div>
  );
};

export default PriceTicker;
