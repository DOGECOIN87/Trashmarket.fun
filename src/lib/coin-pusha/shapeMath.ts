export type ShapeType = string;

// List of all available images to use as floating shapes
export const IMAGE_PATHS = [
  '/1000609168.jpg',
  '/chatgpt-image.png',
  '/gorby-transparent.png',
  '/logo-incinerator.jpg',
  '/edutedbymattr8ck.png',
  '/oscarthegrouch.webp',
  '/sticker.webp',
  '/sticker3.webp',
  '/stickerpill.webp',
  '/junk.png',
  '/trashcoin.png',
];

export const SHAPE_TYPES: ShapeType[] = IMAGE_PATHS;

export interface Shape {
  id: number;
  type: ShapeType;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  imagePath: string;
}

const BITMAP_SIZE = 256;
const bitmapCache: Record<string, Uint8Array> = {};
const imageCache: Record<string, HTMLImageElement> = {};
let isCacheInitialized = false;
let loadingPromise: Promise<void> | null = null;

/**
 * Load an image and create a bitmap mask from it
 */
async function loadImageMask(imagePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = BITMAP_SIZE;
      canvas.height = BITMAP_SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        console.error(`Could not create context for ${imagePath}`);
        reject(new Error('Context creation failed'));
        return;
      }

      // Clear
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, BITMAP_SIZE, BITMAP_SIZE);

      // Draw image scaled to fit
      ctx.drawImage(img, 0, 0, BITMAP_SIZE, BITMAP_SIZE);

      // Extract pixel mask (checking alpha channel for transparency)
      const imgData = ctx.getImageData(0, 0, BITMAP_SIZE, BITMAP_SIZE);
      const pixels = imgData.data;
      const mask = new Uint8Array(BITMAP_SIZE * BITMAP_SIZE);

      for (let i = 0; i < pixels.length; i += 4) {
        // Use alpha channel for transparency detection
        const alpha = pixels[i + 3];
        mask[i / 4] = alpha > 100 ? 1 : 0;
      }

      bitmapCache[imagePath] = mask;
      imageCache[imagePath] = img;
      resolve();
    };

    img.onerror = () => {
      console.error(`Failed to load image: ${imagePath}`);
      // Create a simple rectangular mask as fallback
      const mask = new Uint8Array(BITMAP_SIZE * BITMAP_SIZE);
      const margin = BITMAP_SIZE * 0.1;
      for (let y = 0; y < BITMAP_SIZE; y++) {
        for (let x = 0; x < BITMAP_SIZE; x++) {
          if (x > margin && x < BITMAP_SIZE - margin && y > margin && y < BITMAP_SIZE - margin) {
            mask[y * BITMAP_SIZE + x] = 1;
          }
        }
      }
      bitmapCache[imagePath] = mask;
      resolve();
    };

    img.src = imagePath;
  });
}

export async function initializeShapeCache(): Promise<void> {
  if (isCacheInitialized) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await Promise.all(IMAGE_PATHS.map(path => loadImageMask(path)));
      isCacheInitialized = true;
      console.log('All image masks loaded successfully');
    } catch (error) {
      console.error('Error loading image masks:', error);
    }
  })();

  return loadingPromise;
}

export function isPointInShape(px: number, py: number, shape: Shape): boolean {
  const dx = px - shape.x;
  const dy = py - shape.y;

  const cos = Math.cos(-shape.rotation);
  const sin = Math.sin(-shape.rotation);
  const lx = (dx * cos) - (dy * sin);
  const ly = (dx * sin) + (dy * cos);

  const u = (lx / shape.size) + 0.5;
  const v = (ly / shape.size) + 0.5;

  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;

  const mask = bitmapCache[shape.imagePath];
  if (!mask) return false;

  const mapX = Math.floor(u * BITMAP_SIZE);
  const mapY = Math.floor(v * BITMAP_SIZE);

  const safeX = Math.max(0, Math.min(BITMAP_SIZE - 1, mapX));
  const safeY = Math.max(0, Math.min(BITMAP_SIZE - 1, mapY));

  return mask[safeY * BITMAP_SIZE + safeX] === 1;
}

export function generateInitialLayout(width: number, height: number): Shape[] {
  // Gorbagana brand palette — greens and purples
  const colors = [
    '#00ff00', // Neon Green — primary
    '#9945FF', // Oscar Purple
    '#00cc44', // Emerald
    '#FF00FF', // Magenta accent
    '#33ff66', // Light green
    '#7733ff', // Deep purple
    '#00ff88', // Mint
    '#ffcc00', // Gold
    '#ff0099', // Hot pink
  ];

  const minDim = Math.min(width, height);
  const baseSize = minDim * 0.12; // Slightly smaller for more images

  const shapes: Shape[] = [];

  // Create one shape for each image
  IMAGE_PATHS.forEach((imagePath, i) => {
    const sizeVariation = 0.7 + Math.random() * 0.6;
    shapes.push({
      id: i,
      type: imagePath,
      imagePath: imagePath,
      x: Math.random() * width,
      y: Math.random() * height,
      dx: 0,
      dy: 0,
      size: baseSize * sizeVariation,
      rotation: (Math.random() - 0.5) * 0.4,
      rotationSpeed: 0,
      color: colors[i % colors.length],
    });
  });

  return shapes;
}

export function getImageElement(imagePath: string): HTMLImageElement | null {
  return imageCache[imagePath] || null;
}