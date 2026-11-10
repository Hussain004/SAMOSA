import { useEffect, useState } from 'react';
import { FontSizeControl } from '../../font-size.tsx';
import { openApp } from '../open-transition.ts';

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-bar)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1560px] items-center gap-4 px-6 lg:px-10 py-4 sm:gap-6">
        <a href="/" className="flex items-center gap-2 text-[var(--color-gold)]">
          <span className="text-lg leading-none">∇</span>
          <span className="text-sm tracking-[0.2em]">SAMOSA</span>
        </a>
        <span className="hidden whitespace-nowrap text-xs text-[var(--color-faint)] 2xl:inline">
          step auditor for matrix math
        </span>
        <nav className="ml-auto flex items-center gap-4 whitespace-nowrap text-[0.8125rem] text-[var(--color-muted)] lg:gap-5">
          <a href="#how" className="hidden hover:text-[var(--color-text)] md:inline">
            How it works
          </a>
          <a href="#menu" className="hidden hover:text-[var(--color-text)] md:inline">
            Menu
          </a>
          <a href="#install" className="hidden hover:text-[var(--color-text)] md:inline">
            Install
          </a>
          <a href="/docs/HOW_IT_WORKS" className="hidden hover:text-[var(--color-text)] xl:inline">
            Docs
          </a>
          <a href="/docs/CHANGELOG" className="hidden hover:text-[var(--color-text)] xl:inline">
            Changelog
          </a>
          <a
            href="https://github.com/Hussain004/SAMOSA"
            target="_blank"
            rel="noreferrer"
            className="hidden whitespace-nowrap hover:text-[var(--color-text)] sm:inline"
          >
            ★ GitHub
          </a>
          <FontSizeControl className="hidden sm:flex" />
          <ThemeToggle />
          <a
            href="/app"
            onClick={openApp}
            className="rounded bg-[var(--color-gold)] px-3 py-1.5 font-medium text-[var(--color-ink)] transition-colors hover:bg-[#f3c368]"
          >
            Open app →
          </a>
        </nav>
      </div>
    </header>
  );
}

/** The paper and the ink: the choice is kept, and the app reads it too. */
export function ThemeToggle() {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light');
  // the page is dressed by the stylesheet now, so the colours of the first
  // paint can go
  useEffect(() => {
    document.getElementById('samosa-boot')?.remove();
  }, []);
  const flip = () => {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? 'light' : 'dark';
    document.documentElement.style.colorScheme = next ? 'light' : 'dark';
    try {
      localStorage.setItem('samosa-theme', next ? 'light' : 'dark');
    } catch {
      // a private window can refuse storage; the page still changes
    }
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={light ? 'Switch to the dark theme' : 'Switch to the light theme'}
      title={light ? 'Dark theme' : 'Light theme'}
      className="rounded border border-[var(--color-line)] px-2 py-1 leading-none text-[var(--color-muted)] transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-text)]"
    >
      <span aria-hidden="true">{light ? '☾' : '☀'}</span>
    </button>
  );
}

