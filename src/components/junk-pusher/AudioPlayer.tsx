import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, autoPlay = true }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const attemptPlay = async () => {
      if (autoPlay && audioRef.current) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.log("Autoplay blocked by browser. Waiting for user interaction.");
          // Browser blocks autoplay without user interaction
          const handleInteraction = () => {
            if (audioRef.current) {
              audioRef.current.play().then(() => {
                setIsPlaying(true);
                window.removeEventListener('click', handleInteraction);
                window.removeEventListener('keydown', handleInteraction);
              });
            }
          };
          window.addEventListener('click', handleInteraction);
          window.addEventListener('keydown', handleInteraction);
        }
      }
    };

    attemptPlay();
  }, [autoPlay]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) setIsMuted(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-full shadow-2xl transition-all hover:bg-black/80">
      <audio ref={audioRef} src={src} loop />
      
      <div className="flex items-center gap-1">
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/40 transition-colors"
          title={isPlaying ? "Pause Music" : "Play Music"}
        >
          {isPlaying ? (
            <div className="flex gap-0.5 items-end h-3">
              <div className="w-0.5 bg-current animate-[music-bar_0.6s_ease-in-out_infinite]" style={{height: '100%'}}></div>
              <div className="w-0.5 bg-current animate-[music-bar_0.8s_ease-in-out_infinite]" style={{height: '60%'}}></div>
              <div className="w-0.5 bg-current animate-[music-bar_0.7s_ease-in-out_infinite]" style={{height: '80%'}}></div>
            </div>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div 
          className="relative flex items-center"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button
            onClick={toggleMute}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white transition-colors"
          >
            {isMuted || volume === 0 ? <VolumeX size={16} /> : volume < 0.5 ? <Volume1 size={16} /> : <Volume2 size={16} />}
          </button>

          {showVolumeSlider && (
            <div className="absolute bottom-full right-0 mb-2 p-3 bg-black/90 border border-white/10 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="h-24 w-1 accent-green-500 cursor-pointer appearance-none bg-gray-700 rounded-full"
                style={{ writingMode: 'bt-lr', appearance: 'slider-vertical' } as any}
              />
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes music-bar {
          0%, 100% { height: 30%; }
          50% { height: 100%; }
        }
      `}} />
    </div>
  );
};

export default AudioPlayer;
