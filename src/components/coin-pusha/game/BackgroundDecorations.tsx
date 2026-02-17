import React, { useEffect, useState } from 'react';

/**
 * Background Decorations Component
 * 
 * Displays Gorbagana-themed assets floating in the background
 * Creates a trashy, chaotic aesthetic matching the brand
 * ALL ASSETS ARE FLOATING - NO FIXED POSITIONS
 */

interface FloatingAsset {
  id: number;
  src: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  duration: number;
  delay: number;
  opacity: number;
}

export const BackgroundDecorations: React.FC = () => {
  const [assets, setAssets] = useState<FloatingAsset[]>([]);

  useEffect(() => {
    // Define all available background assets
    const assetPaths = [
      '/assets/backgrounds/g-logo.png',
      '/assets/backgrounds/gorbagana-text.png',
      '/assets/backgrounds/trash-character-1.png',
      '/assets/backgrounds/trash-character-2.png',
      '/assets/backgrounds/trash-character-3.png',
      '/assets/backgrounds/trash-character-4.png',
      '/assets/backgrounds/trash-character-5.png',
      '/assets/backgrounds/trash-character-6.png',
      '/assets/backgrounds/trash-bin.png',
      '/assets/backgrounds/chains.png',
    ];

    // Generate random floating assets - MORE ASSETS FOR BETTER COVERAGE
    const generatedAssets: FloatingAsset[] = [];
    const assetCount = 25; // Increased from 15 to 25 for more coverage

    for (let i = 0; i < assetCount; i++) {
      const randomAsset = assetPaths[Math.floor(Math.random() * assetPaths.length)];
      
      generatedAssets.push({
        id: i,
        src: randomAsset,
        x: Math.random() * 100, // Random X position (0-100%)
        y: Math.random() * 100, // Random Y position (0-100%)
        size: 60 + Math.random() * 180, // Random size (60-240px) - increased range
        rotation: Math.random() * 360, // Random rotation
        duration: 15 + Math.random() * 35, // Float duration (15-50s) - faster movement
        delay: Math.random() * 10, // Random delay (0-10s)
        opacity: 0.08 + Math.random() * 0.17, // Opacity (0.08-0.25) - slightly more visible
      });
    }

    setAssets(generatedAssets);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* ALL Floating Assets - No fixed positions */}
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="absolute animate-float-slow"
          style={{
            left: `${asset.x}%`,
            top: `${asset.y}%`,
            width: `${asset.size}px`,
            height: `${asset.size}px`,
            opacity: asset.opacity,
            transform: `rotate(${asset.rotation}deg)`,
            animationDuration: `${asset.duration}s`,
            animationDelay: `${asset.delay}s`,
          }}
        >
          <img 
            src={asset.src} 
            alt=""
            className="w-full h-full object-contain"
            style={{
              filter: 'blur(1px)',
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default BackgroundDecorations;
