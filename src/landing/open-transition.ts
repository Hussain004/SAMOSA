import type { MouseEvent } from 'react';
import { createSamosa } from './ascii-samosa.ts';

/**
 * The way into the app.
 *
 * A ring leaves the button that was pressed and the page behind it dims.
 * The samosa decodes out of noise and spins up, then it opens into a warm
 * glow. The app opens on the same glow and fades out of it, so the two pages
 * read as one movement and not as a page load.
 *
 * It is made to be cheap. Every layer moves with a transform or an opacity
 * and nothing else, so the compositor does the work. No filter, no blur, and
 * no layer larger than the screen: an earlier version scaled the samosa
 * fifteen times with a drop shadow, which asked the GPU for a surface of
 * twenty thousand pixels and froze a laptop. A watchdog also gives up on the
 * show, and goes straight to the app, if the frames are slow.
 */

const OPENING_KEY = 'samosa:opening';

/** the characters a cell shows while it has not decoded yet */
const NOISE = '.:-=+*#%@∂∇~·';

/** the moments of the movement, in ms from the press */
const DECODED = 380;
const DIVE = 460;
const FLASH = 780;
const LEAVE = 1020;

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

  // the ring leaves from the press, or from the middle of the button when
  // the press came from the keyboard
  let x = event.clientX;
  let y = event.clientY;
  if (!x && !y) {
    const box = event.currentTarget.getBoundingClientRect();
    x = box.left + box.width / 2;
    y = box.top + box.height / 2;
  }
  playOpen(href, x, y);
}

/** A cell that is not decoded yet shows noise, and noise changes with time. */
function scramble(frame: string, progress: number, now: number): string {
  if (progress >= 1) return frame;
  const tick = Math.floor(now / 55);
  const rows = frame.split('\n');
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    let out = '';
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ' ') {
        out += ch;
        continue;
      }
      const h = (((i * 73856093) ^ (j * 19349663)) >>> 0) / 4294967296;
      // the decoding sweeps from the middle of the samosa outwards
      const reach = Math.hypot((i - row.length / 2) / row.length, (j - rows.length / 2) / rows.length);
      out += h + reach * 0.5 < progress * 1.35 ? ch : NOISE[(Math.floor(h * 997) + tick) % NOISE.length];
    }
    rows[j] = out;
  }
  return rows.join('\n');
}

function playOpen(href: string, x: number, y: number): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.location.assign(href);
    return;
  }
  if (document.querySelector('.samosa-gate')) return;

  const gate = document.createElement('div');
  gate.className = 'samosa-gate';
  gate.setAttribute('aria-hidden', 'true');
  gate.style.setProperty('--x', `${x}px`);
  gate.style.setProperty('--y', `${y}px`);

  const ring = document.createElement('span');
  ring.className = 'samosa-gate-ring';
  const art = document.createElement('div');
  art.className = 'samosa-gate-art';
  const pre = document.createElement('pre');
  pre.className = 'samosa samosa-gate-pre';
  art.appendChild(pre);
  const glow = document.createElement('span');
  glow.className = 'samosa-gate-glow';
  gate.append(ring, art, glow);
  document.body.appendChild(gate);
  document.body.classList.add('samosa-gate-open');

  const small = innerWidth < 700;
  const samosa = createSamosa({ w: small ? 56 : 80, h: small ? 26 : 38, aspect: 0.55 });
  const started = performance.now();
  let frameId = 0;
  let left = false;

  const leave = () => {
    if (left) return;
    left = true;
    cancelAnimationFrame(frameId);
    try {
      sessionStorage.setItem(OPENING_KEY, '1');
    } catch {
      // A private window can refuse storage. The app still opens.
    }
    window.location.assign(href);
  };

  // The first frame has to be painted before the transition starts, or the
  // browser has nothing to animate from.
  void gate.offsetWidth;
  requestAnimationFrame(() => gate.classList.add('is-live'));

  // The watchdog: a machine that cannot draw this in time does not get the
  // show, it gets the app.
  let last = started;
  let slow = 0;
  const draw = (now: number) => {
    if (left) return;
    const t = now - started;
    slow = now - last > 80 ? slow + 1 : 0;
    last = now;
    if (slow >= 3 && t > 150) {
      leave();
      return;
    }
    // once the samosa opens into the glow it is a still picture
    if (t < DIVE) {
      samosa.state.yaw += 0.03 + Math.pow(t / DIVE, 2) * 0.22;
      const frame = samosa.render(now / 1000, { steam: true });
      pre.textContent = scramble(frame, Math.min(1, t / DECODED), now);
    }
    frameId = requestAnimationFrame(draw);
  };
  frameId = requestAnimationFrame(draw);

  window.setTimeout(() => gate.classList.add('is-diving'), DIVE);
  window.setTimeout(() => gate.classList.add('is-flash'), FLASH);
  window.setTimeout(leave, LEAVE);
  // if the page is still here after this, something went wrong, and the
  // page must not stay under a veil
  window.setTimeout(() => {
    if (!left) leave();
  }, LEAVE + 600);
  window.setTimeout(() => {
    gate.remove();
    document.body.classList.remove('samosa-gate-open');
  }, 4000);
}
