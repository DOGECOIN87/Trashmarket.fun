import React, { useRef, useEffect, useState } from 'react';
import { generateInitialLayout, Shape, getImageElement, initializeShapeCache } from '../../lib/shapeMath';

interface PegboardCanvasProps {
  gridSize?: number;
  holeRadius?: number;
}

export const PegboardCanvas: React.FC<PegboardCanvasProps> = ({
  gridSize = 10,
  holeRadius = 1.2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const shapesRef = useRef<Shape[]>([]);

  // Pre-render the static pegboard grid to an offscreen canvas
  const renderGrid = (width: number, height: number) => {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d')!;

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);

    ctx.fillStyle = '#111111';
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const px = ix * gridSize + gridSize / 2;
        const py = iy * gridSize + gridSize / 2;
        ctx.beginPath();
        ctx.arc(px, py, holeRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    gridCanvasRef.current = offscreen;
  };

  // Initialize shapes & cache
  useEffect(() => {
    const initialize = async () => {
      await initializeShapeCache();
      shapesRef.current = generateInitialLayout(window.innerWidth, window.innerHeight);

      // Start drifting
      shapesRef.current.forEach(shape => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.3 + Math.random() * 0.8;
        shape.dx = Math.cos(angle) * speed;
        shape.dy = Math.sin(angle) * speed;
        shape.rotationSpeed = (Math.random() - 0.5) * 0.01;
      });
    };

    initialize();
  }, []);

  // Build grid on mount and resize
  useEffect(() => {
    renderGrid(dimensions.width, dimensions.height);
  }, [dimensions, gridSize, holeRadius]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      setDimensions({ width: newWidth, height: newHeight });

      if (canvasRef.current) {
        canvasRef.current.width = newWidth;
        canvasRef.current.height = newHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Animation Loop — only composites pre-rendered grid + floating images
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = 0;
    const targetInterval = 1000 / 30; // Cap at 30fps — this is just a background

    const render = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(render);

      // Throttle to 30fps
      const elapsed = timestamp - lastTime;
      if (elapsed < targetInterval) return;
      lastTime = timestamp - (elapsed % targetInterval);

      const width = canvas.width;
      const height = canvas.height;

      // Update shapes
      shapesRef.current.forEach(shape => {
        if (shape.dx !== 0 || shape.dy !== 0) {
          shape.x += shape.dx;
          shape.y += shape.dy;
          shape.rotation += shape.rotationSpeed;

          // Wrap around screen
          if (shape.x < -shape.size) shape.x = width + shape.size;
          if (shape.x > width + shape.size) shape.x = -shape.size;
          if (shape.y < -shape.size) shape.y = height + shape.size;
          if (shape.y > height + shape.size) shape.y = -shape.size;
        }
      });

      // Blit pre-rendered grid
      if (gridCanvasRef.current) {
        ctx.drawImage(gridCanvasRef.current, 0, 0);
      } else {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);
      }

      // Draw floating images on top
      shapesRef.current.forEach(shape => {
        const img = getImageElement(shape.imagePath);
        if (!img || !img.complete) return;

        ctx.save();
        ctx.translate(shape.x, shape.y);
        ctx.rotate(shape.rotation);
        ctx.globalAlpha = 0.85;

        const halfSize = shape.size / 2;
        ctx.drawImage(img, -halfSize, -halfSize, shape.size, shape.size);
        ctx.restore();
      });
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gridSize, holeRadius]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      className="block absolute top-0 left-0 w-full h-full"
    />
  );
};
