import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

/** The content security policy the host serves, so the browser, not just the
 * test, refuses the things that would leave the page. The boot scripts are
 * files, so they are allowed by script-src 'self', and the policy has no
 * allowance for the network at all. */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

/** The local preview serves the policy the host serves, so the browser tests
 * run against the real thing. */
const servePolicy: Connect.NextHandleFunction = (req, res, next) => {
  const path = req.url?.split('?')[0] ?? '';
  if (path === '/' || path === '/app' || path.startsWith('/app/')) {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Referrer-Policy', 'no-referrer');
  }
  next();
};

/** The local preview serves the same clean urls as the host. */
const cleanUrls: Plugin = {
  name: 'clean-urls-preview',
  configurePreviewServer(server) {
    const redirectApp: Connect.NextHandleFunction = (req, _res, next) => {
      if (req.url?.split('?')[0] === '/app') req.url = '/app/';
      next();
    };
    server.middlewares.use(redirectApp);
    server.middlewares.use(servePolicy);
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), cleanUrls],

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
