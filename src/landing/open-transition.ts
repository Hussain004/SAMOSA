import type { MouseEvent } from 'react';
import { createSamosa } from './ascii-samosa.ts';

/**
 * The way into the app.
 *
 * The samosa comes towards the screen, then opens down the middle while the
 * app is loading. The app repeats the opening from its own side, so the two
 * pages read as one movement instead of a page load.
 */

const OPENING_KEY = 'samosa:opening';

// A page restored from the back/forward cache keeps the gate that was open
// when it left. Take it down before the page can be used again.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  document.querySelector('.samosa-gate')?.remove();
  document.body.classList.remove('samosa-gate-open');
});

export function openApp(event: MouseEvent<HTMLAnchorElement>): void {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  const href = event.currentTarget.getAttribute('href');
  if (href !== '/app') return;
  event.preventDefault();
  playOpen(href);
}

function playOpen(href: string): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.location.assign(href);
    return;
  }
  if (document.querySelector('.samosa-gate')) return;

  const gate = document.createElement('div');
  gate.className = 'samosa-gate';
  gate.setAttribute('aria-hidden', 'true');

  const art = document.createElement('div');
  art.className = 'samosa-gate-art';
  const small = innerWidth < 700;
  const samosa = createSamosa({ w: small ? 64 : 96, h: small ? 30 : 44, aspect: 0.55 });
  const frame = samosa.render(0, { steam: true });

  for (const side of ['left', 'right']) {
    const pre = document.createElement('pre');
    pre.className = `samosa samosa-gate-half samosa-gate-${side}`;
    pre.textContent = frame;
    pre.setAttribute('aria-hidden', 'true');
    art.appendChild(pre);
  }

  const seam = document.createElement('span');
  seam.className = 'samosa-gate-seam';
  gate.append(art, seam);
  document.body.appendChild(gate);
  document.body.classList.add('samosa-gate-open');

  // The first frame has to be painted before the transition starts, or the
  // browser has nothing to animate from.
  void gate.offsetWidth;
  requestAnimationFrame(() => gate.classList.add('is-live'));
  window.setTimeout(() => gate.classList.add('is-opening'), 430);
  window.setTimeout(() => {
    try {
      sessionStorage.setItem(OPENING_KEY, '1');
    } catch {
      // A private window can refuse storage. The app still opens.
    }
    window.location.assign(href);
  }, 840);
}
