import React, { useRef, useEffect, useState } from 'react';
import { generateInitialLayout, Shape, getImageElement, initializeShapeCache } from '../utils/shapeMath';

interface PegboardCanvasProps {
  gridSize?: number;
  holeRadius?: number;
}

export const PegboardCanvas: React.FC<PegboardCanvasProps> = ({
  gridSize = 10,
  holeRadius = 1.2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const shapesRef = useRef<Shape[]>([]);
  const isDriftingRef = useRef(false);

  // Initialize shapes & cache
  useEffect(() => {
    const initialize = async () => {
      await initializeShapeCache();
      shapesRef.current = generateInitialLayout(window.innerWidth, window.innerHeight);
      isDriftingRef.current = true;

      // Start drifting immediately
      shapesRef.current.forEach(shape => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.3 + Math.random() * 0.8; // Slower, more gentle floating
        shape.dx = Math.cos(angle) * speed;
        shape.dy = Math.sin(angle) * speed;
        shape.rotationSpeed = (Math.random() - 0.5) * 0.01; // Slower rotation
      });
    };

    initialize();
  }, []);

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

      if (!isDriftingRef.current) {
        shapesRef.current = generateInitialLayout(newWidth, newHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Update Shapes
      shapesRef.current.forEach(shape => {
        if (shape.dx !== 0 || shape.dy !== 0) {
          shape.x += shape.dx;
          shape.y += shape.dy;
          shape.rotation += shape.rotationSpeed;

          // Bounce at edges
          if (shape.x < -shape.size / 2 || shape.x > width + shape.size / 2) shape.dx *= -1;
          if (shape.y < -shape.size / 2 || shape.y > height + shape.size / 2) shape.dy *= -1;

          // Wrap around screen
          if (shape.x < -shape.size) shape.x = width + shape.size;
          if (shape.x > width + shape.size) shape.x = -shape.size;
          if (shape.y < -shape.size) shape.y = height + shape.size;
          if (shape.y > height + shape.size) shape.y = -shape.size;
        }
      });

      // Clear Background — deep black
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      // Draw Pegboard Grid
      const cols = Math.ceil(width / gridSize);
      const rows = Math.ceil(height / gridSize);

      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const px = ix * gridSize + gridSize / 2;
          const py = iy * gridSize + gridSize / 2;

          ctx.beginPath();
          ctx.arc(px, py, holeRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#111111';
          ctx.fill();
        }
      }

      // Draw Floating Images on top
      shapesRef.current.forEach(shape => {
        const img = getImageElement(shape.imagePath);
        if (!img || !img.complete) return;

        ctx.save();

        // Move to shape position
        ctx.translate(shape.x, shape.y);

        // Apply rotation
        ctx.rotate(shape.rotation);

        // Apply glow effect with shape color
        ctx.shadowColor = shape.color;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = 0.85;

        // Draw image centered at current position
        const halfSize = shape.size / 2;
        ctx.drawImage(img, -halfSize, -halfSize, shape.size, shape.size);

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };


    render();

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