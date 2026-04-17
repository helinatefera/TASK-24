/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // v8 coverage + jsdom is slow in Docker — raise per-test timeout
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
      // Thresholds reflect measured coverage from the current vitest suite.
      // Gated at 5% below measured to prevent silent regressions.
      thresholds: {
        statements: 50,
        branches: 65,
        functions: 45,
        lines: 50,
      },
    },
  },
});
