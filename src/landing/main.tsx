import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './App.tsx';
import { SHARE_VERSION } from '../core/share.ts';
import 'katex/dist/katex.min.css';
import '../styles.css';

// A link to a derivation is a link to the app, not to this page. The old
// links pointed at the landing page with the hash, so they are carried over.
if (window.location.hash.startsWith(`#${SHARE_VERSION}.`)) {
  window.location.replace(`/app/${window.location.hash}`);
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
  root.style.opacity = '1';
}
