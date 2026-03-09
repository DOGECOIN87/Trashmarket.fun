import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'crypto', 'stream', 'util', 'events'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        protocolImports: true,
      }),
      react(),
    ],
    define: {
      'process.env': JSON.stringify(env),
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        buffer: 'buffer',
      }
    },
    build: {
      target: 'esnext',
      minify: 'terser',
    },
  };
});
