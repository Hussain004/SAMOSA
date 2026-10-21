import { describe, expect, it } from 'vitest';
import { createSamosa } from '../src/landing/ascii-samosa.ts';

/**
 * The ASCII samosa (F20).
 *
 * It is the first thing on the page, so the first frame is written down: if
 * the shape changes, the picture changes, and the picture is a promise.
 */

describe('the ASCII samosa', () => {
  it('draws the first frame the way the prototype does', () => {
    const samosa = createSamosa({ w: 40, h: 20, seed: 7 });
    const frame = samosa.render(0);
    const lines = frame.split('\n');
    expect(lines.length).toBe(20);
    for (const line of lines) expect(line.length).toBe(40);
    // the frame is not empty and not full
    const filled = lines.join('').replace(/ /g, '').length;
    expect(filled).toBeGreaterThan(50);
    expect(filled).toBeLessThan(40 * 20);
  });

  it('is the same every time', () => {
    const first = createSamosa({ w: 40, h: 20, seed: 7 }).render(0);
    const second = createSamosa({ w: 40, h: 20, seed: 7 }).render(0);
    expect(second).toBe(first);
  });

  it('moves over time', () => {
    const samosa = createSamosa({ w: 40, h: 20, seed: 7 });
    expect(samosa.render(2)).not.toBe(samosa.render(0));
  });
});
