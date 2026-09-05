import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vitest/config';

export default defineConfig(() => {
  return {
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.endsWith('/src/data.ts')) return 'atlas-data';
            if (!id.includes('node_modules')) return undefined;
            if (normalizedId.includes('/react/') || normalizedId.includes('/react-dom/')) return 'react-vendor';
            if (normalizedId.includes('/d3') || normalizedId.includes('/internmap/') || normalizedId.includes('/delaunator/') || normalizedId.includes('/robust-predicates/')) return 'd3-vendor';
            if (normalizedId.includes('/motion/') || normalizedId.includes('/framer-motion/')) return 'motion-vendor';
            if (normalizedId.includes('/lucide-react/')) return 'icon-vendor';
            return 'vendor';
          },
        },
      },
    },
  };
});
