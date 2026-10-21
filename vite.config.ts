import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
      },
      output: {
        manualChunks(id: string) {
          if (id.includes('katex')) return 'katex';
          if (id.includes('@codemirror') || id.includes('@lezer')) return 'codemirror';
          if (id.includes('decimal.js')) return 'decimal';
        },
      },
    },
  },
});
