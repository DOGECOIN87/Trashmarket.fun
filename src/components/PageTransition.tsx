import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const VIDEOS = [
  '/assets/TM-transition.mp4',
  '/assets/TM-transition-2.mp4',
];

const GAME_ROUTES = new Set(['/junk-pusher', '/slots']);

const PageTransition: React.FC = () => {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [fading, setFading] = useState(false);
  const [src, setSrc] = useState(VIDEOS[0]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    const trigger = isFirst.current || GAME_ROUTES.has(location.pathname);
    isFirst.current = false;
    if (!trigger) return;

    const next = VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
    setSrc(next);
    setFading(false);
    setActive(true);
  }, [location.pathname]);

  // Play the video whenever it becomes active or src changes
  useEffect(() => {
    if (!active || !videoRef.current) return;
    const v = videoRef.current;
    v.currentTime = 0;
    v.playbackRate = src === '/assets/TM-transition-2.mp4' ? 2 : 1;
    v.play().catch(() => handleEnd());
  }, [active, src]);

  const handleEnd = () => {
    setFading(true);
    setTimeout(() => setActive(false), 400);
  };

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 9999,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        onEnded={handleEnd}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default PageTransition;
