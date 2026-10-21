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
          // only the JavaScript goes in these chunks: the style sheets have a
          // life of their own, and a landing page that only needs the style
          // should not pull the library in with it
          if (id.includes('katex') && id.endsWith('.js')) return 'katex';
          if ((id.includes('@codemirror') || id.includes('@lezer')) && id.endsWith('.js')) {
            return 'codemirror';
          }
          if (id.includes('decimal.js') && id.endsWith('.js')) return 'decimal';
        },
      },
    },
  },
});
