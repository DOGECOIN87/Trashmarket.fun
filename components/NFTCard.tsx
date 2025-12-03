import React from 'react';
import { NFT } from '../types';
import { Check } from 'lucide-react';
import { useNetwork } from '../contexts/NetworkContext';

interface NFTCardProps {
  nft: NFT;
  collectionName: string;
  isSelected?: boolean;
  onToggle?: () => void;
}

const NFTCard: React.FC<NFTCardProps> = ({ nft, collectionName, isSelected, onToggle }) => {
  const { currency, accentColor } = useNetwork();
  
  // Dynamic classes based on accent color
  const accentClass = accentColor === 'text-magic-purple' ? 'magic-purple' : 'magic-green';
  const borderSelected = accentColor === 'text-magic-purple' ? 'border-magic-purple' : 'border-magic-green';
  const ringSelected = accentColor === 'text-magic-purple' ? 'ring-magic-purple' : 'ring-magic-green';
  const bgSelected = accentColor === 'text-magic-purple' ? 'bg-magic-purple' : 'bg-magic-green';
  const hoverShadow = accentColor === 'text-magic-purple' ? 'hover:shadow-[0_0_20px_rgba(153,69,255,0.15)]' : 'hover:shadow-[0_0_20px_rgba(173,255,2,0.15)]';

  return (
    <div 
        onClick={onToggle}
        className={`group relative bg-magic-card cursor-pointer border transition-all duration-200 ease-out hover:scale-[1.02] ${hoverShadow} hover:z-20 ${
            isSelected 
            ? `${borderSelected} ring-2 ${ringSelected} ring-offset-2 ring-offset-black z-10` 
            : `border-white/10 hover:${borderSelected}/50`
        }`}
    >
      {/* Selection Overlay */}
      {isSelected && (
          <div className={`absolute top-0 right-0 z-10 ${bgSelected} text-black p-1 shadow-none border-b border-l border-black`}>
              <Check className="w-4 h-4" />
          </div>
      )}

      <div className="aspect-square overflow-hidden bg-gray-900 relative">
        <img
          src={nft.image}
          alt={nft.name}
          className={`w-full h-full object-cover transition-all duration-300 ${isSelected ? 'opacity-80 grayscale-0' : 'grayscale group-hover:grayscale-0'}`}
          loading="lazy"
        />
        
        {/* Hover Quick Buy */}
        {!isSelected && (
            <div className="absolute bottom-0 left-0 w-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className={`${bgSelected} text-black text-center text-xs font-bold py-2 uppercase tracking-widest`}>
                    Quick Buy
                </div>
            </div>
        )}
      </div>
      
      <div className="p-3 bg-black">
        <div className="flex justify-between items-baseline mb-1">
             <span className={`text-sm font-bold font-mono ${isSelected ? accentColor : 'text-white'}`}>
                {currency}{nft.price}
             </span>
             {nft.rank && (
                 <span className="text-[10px] text-gray-600 font-mono">
                     #{nft.rank}
                 </span>
             )}
        </div>
        <p className="text-[10px] text-gray-500 truncate font-medium uppercase tracking-wide group-hover:text-gray-300 transition-colors">
            {nft.name}
        </p>
      </div>
    </div>
  );
};

export default NFTCard;