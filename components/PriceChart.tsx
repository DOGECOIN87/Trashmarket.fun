import React from 'react';
import { ChartPoint } from '../types';

interface PriceChartProps {
  data: ChartPoint[];
  color?: string;
  height?: number;
}

const PriceChart: React.FC<PriceChartProps> = ({ data, color = '#adff02', height = 250 }) => {
  if (data.length === 0) return null;

  const prices = data.map(d => d.price);
  const minPrice = Math.min(...prices) * 0.95;
  const maxPrice = Math.max(...prices) * 1.05;
  const range = maxPrice - minPrice;

  // SVG dimensions
  const width = 1000; // virtual width
  
  // Calculate points
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.price - minPrice) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Create area path
  const areaPath = `${points} ${width},${height} 0,${height}`;

  return (
    <div className="w-full h-full relative group bg-black/50">
      <svg 
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${width} ${height}`} 
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Grid lines (Simulated) */}
        <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#333" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#333" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#333" strokeWidth="1" strokeDasharray="4 4" />

        {/* Area fill */}
        <path d={areaPath} fill="url(#chartGradient)" />
        
        {/* Line */}
        <polyline 
          points={points} 
          fill="none" 
          stroke={color} 
          strokeWidth="2" 
          vectorEffect="non-scaling-stroke"
        />
        
        {/* Last Point Indicator */}
        <circle 
            cx="1000" 
            cy={height - ((prices[prices.length - 1] - minPrice) / range) * height} 
            r="4" 
            fill={color} 
            className="animate-pulse"
        />
      </svg>
      
      {/* Tooltip hint */}
      <div className="absolute top-2 right-2 bg-black border border-magic-green px-2 py-1 text-xs text-magic-green font-mono font-bold opacity-0 group-hover:opacity-100 transition-opacity z-20">
        LAST: ◎{prices[prices.length - 1]}
      </div>
    </div>
  );
};

export default PriceChart;