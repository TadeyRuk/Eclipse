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
    exclude: ['@midnight-ntwrk/ledger-v8'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});
