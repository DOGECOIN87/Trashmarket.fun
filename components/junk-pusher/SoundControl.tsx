import React, { useState } from 'react';
import { soundManager } from '../../lib/soundManager';

export const SoundControl: React.FC = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const toggleMute = () => {
    soundManager.initialize();
    soundManager.toggleMute();
    setIsMuted(!isMuted);
    soundManager.play('button_click');
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    soundManager.setVolume(volume);
  };

  return (
    <div className="relative">
      <button
        onClick={toggleMute}
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
        className="group p-2 bg-black/60 border border-green-500/30 hover:border-green-400 rounded transition-all"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      {/* Volume Slider (appears on hover) */}
      {showVolumeSlider && !isMuted && (
        <div
          className="absolute bottom-full right-0 mb-2 p-3 bg-black/95 border border-green-500/60 rounded shadow-lg"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-green-400 font-[Inter] uppercase tracking-wider">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              defaultValue="0.3"
              onChange={handleVolumeChange}
              className="w-24 h-1 bg-green-900/50 rounded-lg appearance-none cursor-pointer accent-green-400"
              style={{
                writingMode: 'bt-lr',
                WebkitAppearance: 'slider-vertical',
                height: '80px',
                width: '8px',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SoundControl;
