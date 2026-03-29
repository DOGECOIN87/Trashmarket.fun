import { useRef, useEffect } from 'react';

interface RainOverlayProps {
  active: boolean;
}

interface Raindrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

const DROP_COUNT = 400;
const FADE_SPEED = 0.8; // opacity per second

export default function RainOverlay({ active }: RainOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<Raindrop[]>([]);
  const opacityRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize drops once
    if (dropsRef.current.length === 0) {
      for (let i = 0; i < DROP_COUNT; i++) {
        dropsRef.current.push({
          x: Math.random(),
          y: Math.random(),
          speed: 0.4 + Math.random() * 0.6,
          length: 15 + Math.random() * 25,
          opacity: 0.15 + Math.random() * 0.35,
        });
      }
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = (now: number) => {
      const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = now;

      // Fade in/out
      const target = active ? 1 : 0;
      opacityRef.current += (target - opacityRef.current) * Math.min(dt * FADE_SPEED, 1);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (opacityRef.current > 0.01) {
        const globalAlpha = opacityRef.current;

        for (const drop of dropsRef.current) {
          drop.y += drop.speed * dt;
          if (drop.y > 1.1) {
            drop.y = -0.05;
            drop.x = Math.random();
            drop.speed = 0.4 + Math.random() * 0.6;
          }

          const x = drop.x * w;
          const y = drop.y * h;
          const len = drop.length;

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.5, y + len);
          ctx.strokeStyle = `rgba(174, 194, 224, ${drop.opacity * globalAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
    />
  );
}
