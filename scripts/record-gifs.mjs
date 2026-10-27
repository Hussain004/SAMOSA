import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The three clips of the README (the plan, section 8.1).
 *
 * They are recorded from the real app, so they cannot show anything the
 * product does not do. The page is laid out at 1000 by 700 CSS pixels and
 * captured at twice the density, so the frames are real 2000 by 1400 pixels
 * of sharp type, and not a small page that was zoomed. The README column is
 * about 840 pixels wide, so the text is a little smaller than its CSS size there,
 * and a retina screen still has pixels to spare.
 *
 * The frames come from the screencast of the browser, one picture for every
 * change of the page, with the time it was drawn. ffmpeg then holds each
 * picture for as long as it lasted, so the pauses are exactly as long as
 * they were, and nothing is resampled twice.
 *
 *   pnpm build && pnpm preview --port 4173
 *   node scripts/record-gifs.mjs
 */

const OUT = resolve(process.cwd(), 'public/gifs');
const WORK = resolve(process.cwd(), '.gifs');
const BASE = process.env.SAMOSA_URL ?? 'http://localhost:4173';

const WIDTH = 1000;
const HEIGHT = 700;

// The Joseph form of the Kalman update, with the noise term left out: the
// last row is wrong, and the engine knows exactly what is missing.
const KALMAN_BUG = String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top
\end{align*}`;

const GRADIENT = String.raw`\begin{align*}
J &:= a^\top X b \\
\frac{\partial J}{\partial X} &= b a^\top
\end{align*}`;

const KALMAN_DECLS = 'x: n; z: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t, \\Sigma_t: spd n; K_t: n×m';

async function main() {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(WORK, { recursive: true });

  // 1. the transposed product: the squiggle, the counterexample, the fix
  await record('transpose', 'A, B: n×n', async (page) => {
    await typeText(page, String.raw`(A B)^\top = A^\top B^\top`);
    await page.waitForTimeout(1600);
    await clickBadRow(page);
    await page.waitForTimeout(1500);
    await scrollInspector(page, 'counterexample');
    await page.waitForTimeout(2200);
    await scrollInspector(page, 'fix');
    await page.waitForTimeout(1600);
    await applyFix(page);
    await page.waitForTimeout(1200);
    await scrollInspector(page, 'top');
    await page.waitForTimeout(2400);
  });

  // 2. the Joseph form of the Kalman update, with the missing noise term
  await record('kalman', KALMAN_DECLS, async (page) => {
    await typeText(page, KALMAN_BUG, true);
    await page.waitForTimeout(1800);
    await clickBadRow(page);
    await page.waitForTimeout(1500);
    await scrollInspector(page, 'counterexample');
    await page.waitForTimeout(2200);
    await scrollInspector(page, 'fix');
    await page.waitForTimeout(1800);
    await applyFix(page);
    await page.waitForTimeout(1200);
    await scrollInspector(page, 'top');
    await page.waitForTimeout(2600);
  });

  // 3. the gradient in the wrong layout
  await record('gradient', 'X: m×n; a: m; b: n', async (page) => {
    await typeText(page, GRADIENT, true);
    await page.waitForTimeout(1600);
    await clickBadRow(page);
    await page.waitForTimeout(3200);
  });

  console.log('the clips are in public/gifs');
}

/** Records one clip from the screencast of the page. */
async function record(name, decls, script) {
  const dir = resolve(WORK, name);
  mkdirSync(dir, { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('samosa-font', '1.125');
      window.localStorage.setItem('samosa-theme', 'dark');
    } catch {
      // a private profile can refuse storage; the defaults are fine
    }
  });
  // a cursor, because a screencast does not draw the pointer
  await context.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const dot = document.createElement('div');
      dot.style.cssText =
        'position:fixed;z-index:99999;pointer-events:none;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
        'border:2px solid #e8b04b;background:#e8b04b33;box-shadow:0 0 10px #e8b04b88;left:-50px;top:-50px;transition:transform 120ms ease-out;';
      document.body.appendChild(dot);
      window.addEventListener('mousemove', (e) => {
        dot.style.left = e.clientX + 'px';
        dot.style.top = e.clientY + 'px';
      }, true);
      window.addEventListener('mousedown', () => { dot.style.transform = 'scale(0.7)'; }, true);
      window.addEventListener('mouseup', () => { dot.style.transform = 'scale(1)'; }, true);
    });
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  const frames = [];
  let writing = Promise.resolve();
  cdp.on('Page.screencastFrame', (event) => {
    const index = frames.length;
    frames.push({ at: event.metadata.timestamp, file: resolve(dir, `f${String(index).padStart(5, '0')}.png`) });
    const data = Buffer.from(event.data, 'base64');
    writing = writing.then(() => writeFileSync(frames[index].file, data));
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
  });

  // the page is set up before the camera starts: no load, no settings
  await open(page, decls);
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await script(page);
  await page.waitForTimeout(500);
  await cdp.send('Page.stopScreencast');
  await writing;
  await context.close();
  if (frames.length < 10) throw new Error(`${name}: only ${frames.length} frames were captured`);

  // Every picture is held for as long as the page showed it. The last one
  // is held a little, so the loop does not jump.
  const list = [];
  frames.forEach((frame, i) => {
    const next = frames[i + 1]?.at ?? frame.at + 1.2;
    list.push(`file '${frame.file}'`, `duration ${Math.max(0.001, next - frame.at).toFixed(4)}`);
  });
  list.push(`file '${frames[frames.length - 1].file}'`);
  const concat = resolve(dir, 'frames.txt');
  writeFileSync(concat, list.join('\n'));

  const input = ['-y', '-f', 'concat', '-safe', '0', '-i', concat];

  // The video is the sharp one: the full frames, a high quality, no resizing.
  execFileSync('ffmpeg', [
    ...input,
    '-vf', 'fps=30,scale=1920:-2:flags=lanczos',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '17',
    '-movflags', '+faststart',
    resolve(OUT, `${name}.mp4`),
  ], { stdio: 'ignore' });

  // The WebP is what the README shows. An image plays by itself on GitHub.
  // 1440 pixels is more than the 840 the column has, so it stays sharp on a
  // retina screen, and the colour is not reduced.
  execFileSync('ffmpeg', [
    ...input,
    '-vf', 'fps=20,scale=1440:-2:flags=lanczos',
    '-vcodec', 'libwebp_anim', '-lossless', '0', '-q:v', '88', '-compression_level', '6',
    '-loop', '0', '-an',
    resolve(OUT, `${name}.webp`),
  ], { stdio: 'ignore' });

  // The GIF is the fallback, for the places that cannot show a WebP. One
  // palette for the whole clip, and no dither, so flat areas stay flat.
  execFileSync('ffmpeg', [
    ...input,
    '-vf', 'fps=15,scale=1200:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
    '-loop', '0',
    resolve(OUT, `${name}.gif`),
  ], { stdio: 'ignore' });

  rmSync(dir, { recursive: true, force: true });
  console.log(`  ${name}: ${frames.length} frames`);
}

/** Clicks the row that SAMOSA flagged. */
async function clickBadRow(page) {
  const badges = page.locator('.badge');
  const count = await badges.count();
  for (let i = 0; i < count; i++) {
    const text = await badges.nth(i).innerText();
    if (text.includes('wrong') || text.includes('shape')) {
      await glideClick(page, badges.nth(i));
      return;
    }
  }
  throw new Error('no flagged row');
}

/** Moves the pointer to an element, so the clip shows where it goes, then clicks. */
async function glideClick(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('nothing to click');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await page.waitForTimeout(220);
  await locator.click();
}

/** Scrolls the inspector, smoothly, to the counterexample, to the fix or to the top. */
async function scrollInspector(page, what) {
  await page.evaluate((target) => {
    const box = document.querySelector('[data-testid="inspector"]');
    if (!box) return;
    if (target === 'top') {
      box.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const heading = [...box.querySelectorAll('*')].find(
      (el) => el.children.length === 0 && el.textContent?.trim().toLowerCase().startsWith(target === 'fix' ? 'did you mean' : 'counterexample'),
    );
    if (!heading) return;
    const top = heading.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 12;
    box.scrollTo({ top, behavior: 'smooth' });
  }, what);
  await page.waitForTimeout(900);
}

/** Applies the first fix on offer, with the pointer going to its button. */
async function applyFix(page) {
  const apply = page.getByRole('button', { name: 'apply' }).first();
  if (!(await apply.count())) throw new Error('no fix to apply');
  await glideClick(page, apply);
}

/** Opens the app, empty, with the given declarations. */
async function open(page, decls) {
  await page.goto(`${BASE}/app/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.cm-content');
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(decls);
  await page.waitForTimeout(300);
  // close the settings again, so the panes fill the window
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.waitForTimeout(300);
  // start empty, so the clip opens on the derivation it is about
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(500);
}

/** Types a derivation, a line at a time or a key at a time. */
async function typeText(page, text, byLine = false) {
  await page.locator('.cm-content').click();
  if (!byLine) {
    await page.keyboard.type(text, { delay: 55 });
    return;
  }
  for (const line of text.split('\n')) {
    await page.keyboard.insertText(line);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(260);
  }
}

await main();
