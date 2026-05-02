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
      watch: {
        ignored: ['**/target/**'],
      },
      proxy: {
        '/audius-api': {
          target: 'https://api.audius.co',
          changeOrigin: true,
          followRedirects: true,
          rewrite: (path) => path.replace(/^\/audius-api/, ''),
        },
      },
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
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'chunk-three';
            if (id.includes('@dimforge/rapier3d-compat')) return 'chunk-physics';
            if (id.includes('node_modules/firebase')) return 'chunk-firebase';
            if (
              id.includes('@coral-xyz/anchor') ||
              id.includes('@solana/') ||
              id.includes('node_modules/bn.js') ||
              id.includes('node_modules/bs58')
            ) return 'chunk-solana';
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/')
            ) return 'chunk-react';
            if (id.includes('node_modules/lucide-react')) return 'chunk-icons';
            if (id.includes('node_modules/zustand')) return 'chunk-zustand';
            if (id.includes('node_modules/@privy-io')) return 'chunk-privy';
          },
        },
      },
    },
  };
});
