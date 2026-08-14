import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm()],
  resolve: {
    alias: {
      '@eclipse/sdk': path.resolve(__dirname, '../../packages/sdk/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: [
      '@midnight-ntwrk/ledger-v8',
      '@midnight-ntwrk/midnight-js-protocol',
      '@midnight-ntwrk/midnight-js-types',
      '@midnight-ntwrk/midnight-js-contracts',
      '@midnight-ntwrk/midnight-js-http-client-proof-provider',
      '@midnight-ntwrk/midnight-js-indexer-public-data-provider',
    ],
    include: [
      'object-inspect',
      'buffer',
      'cross-fetch',
      'fetch-retry',
      'pino',
      'isomorphic-ws',
      '@subsquid/scale-codec',
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});
