import { useEffect, useRef } from 'react';
import { createSamosa, type Samosa } from './ascii-samosa.ts';

/**
 * The ASCII samosa, in the browser.
 *
 * The renderer is pure, so the same module produces the frame that is inlined
 * at build time and the frame that moves. It pauses when it is off screen and
 * when the tab is hidden, and it draws a single frame under reduced motion.
 */
export function AsciiSamosa({ className }: { className?: string }) {
  const pre = useRef<HTMLPreElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = pre.current;
    const host = stage.current;
    if (!element || !host) return;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const size = () => (innerWidth < 860 ? [52, 26] : [80, 38]);
    const samosa: Samosa = createSamosa({ w: size()[0], h: size()[1], aspect: 0.55 });

    const onResize = () => {
      const [w, h] = size();
      samosa.resize(w, h);
    };
    window.addEventListener('resize', onResize);

    if (reduce) {
      element.textContent = samosa.render(0, { steam: false });
      return () => window.removeEventListener('resize', onResize);
    }

    // drag to spin, with inertia
    let dragging = false;
    let lastX = 0;
    let moved = 0;
    let light: [number, number, number] = [-0.45, 0.55, -0.75];
    let snack = false;

    const onDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      moved = 0;
      host.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      light = [
        ((event.clientX - rect.left) / rect.width - 0.5) * 1.6,
        0.6 - ((event.clientY - rect.top) / rect.height - 0.5) * 1.2,
        -0.75,
      ];
      if (dragging) {
        const dx = event.clientX - lastX;
        lastX = event.clientX;
        moved += Math.abs(dx);
        samosa.state.vyaw += dx * 0.004;
      }
    };
    const onUp = () => {
      dragging = false;
      if (moved < 4) snack = !snack;
    };

    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(host);

    let last = 0;
    let average = 4;
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      if (average > 12 && now - last < 50) return;
      const dt = Math.min(0.1, (now - (last || now)) / 1000);
      last = now;
      samosa.state.vyaw *= 0.94;
      samosa.state.yaw += dt * 0.5 + samosa.state.vyaw;
      const started = performance.now();
      let out = samosa.render(now / 1000, { light });
      if (snack) out = out.replace(/^(.*)$/m, (line) => `${line.slice(0, -10)}  ✓ crispy`);
      element.textContent = out;
      average = average * 0.9 + (performance.now() - started) * 0.1;
      if (++frame % 30 === 0) frame = 0;
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div
      ref={stage}
      className={`relative grid cursor-grab place-items-center select-none active:cursor-grabbing ${className ?? ''}`}
      aria-label="A rotating ASCII art samosa shaped like the nabla symbol"
    >
      <pre ref={pre} className="samosa" aria-hidden="true" />
      <p className="sr-only">
        An ASCII art samosa shaped like the nabla symbol, turning slowly in the dark.
      </p>
      <span className="pointer-events-none absolute -bottom-5 text-[0.6875rem] text-[var(--color-faint)]">
        drag to spin · click for snack mode
      </span>
    </div>
  );
}
