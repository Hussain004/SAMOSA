import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './App.tsx';
import 'katex/dist/katex.min.css';
import '../styles.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
}
