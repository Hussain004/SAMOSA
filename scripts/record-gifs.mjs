import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The three GIFs of the README (the plan, section 8.1).
 *
 * They are recorded from the real app, so they cannot show anything the
 * product does not do. The recording is a real screen capture, so the motion
 * is smooth, and the still moments are held long enough to read.
 */

const OUT = resolve(process.cwd(), 'public/gifs');
const WORK = resolve(process.cwd(), '.gifs');
const BASE = process.env.SAMOSA_URL ?? 'http://localhost:4173';

const KALMAN_BUG = String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t
\end{align*}`;

const GRADIENT = String.raw`\begin{align*}
J &:= a^\top X b \\
\frac{\partial J}{\partial X} &= b a^\top
\end{align*}`;

const DECLS = 'x_t, \\bar\\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n; \\Sigma_t: spd n';

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(WORK, { recursive: true });

  // 1. the transposed product: the squiggle, the counterexample, the fix
  await record('transpose', async (page) => {
    await open(page, 'A, B: n×n');
    await type(page, 'A^\\top B = (A B)^\\top');
    await page.waitForTimeout(1600);
    await clickBadRow(page);
    await page.waitForTimeout(2200);
    await scrollInspector(page);
    await page.waitForTimeout(1200);
    const apply = page.getByRole('button', { name: 'apply' }).first();
    if (await apply.count()) {
      await apply.click();
      await page.waitForTimeout(2400);
    }
  });

  // 2. the Kalman update, with the missing noise term
  await record('kalman', async (page) => {
    await open(page, DECLS);
    await type(page, KALMAN_BUG);
    await page.waitForTimeout(1800);
    await clickBadRow(page);
    await page.waitForTimeout(2600);
    await scrollInspector(page);
    await page.waitForTimeout(1200);
  });

  // 3. the gradient in the wrong layout
  await record('gradient', async (page) => {
    await open(page, 'X: m×n; a: m; b: n');
    await type(page, GRADIENT);
    await page.waitForTimeout(1600);
    await clickBadRow(page);
    await page.waitForTimeout(2200);
  });

  console.log('the GIFs are in public/gifs');
}

/** Records one GIF, with a real screen capture. */
async function record(name, script) {
  const dir = resolve(WORK, name);
  mkdirSync(dir, { recursive: true });
  // The page is 1080 by 660 CSS pixels, but it is recorded at twice that in
  // each direction. The text in the app is 13 CSS pixels; at this size the
  // screenshot still has 26 device pixels per glyph, so the downscaled WebP
  // keeps the edges of the type instead of smearing them.
  const context = await chromium.launchPersistentContext('', {
    recordVideo: { dir, size: { width: 2160, height: 1320 } },
    viewport: { width: 1080, height: 660 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await script(page);
  await page.waitForTimeout(600);
  const video = page.video();
  await context.close();
  const raw = await video.path();

  // The video: the full 2x capture at its native size, with a high bitrate.
  // It is the one to watch when the animated WebP is not enough.
  execFileSync('ffmpeg', [
    '-y',
    '-i',
    raw,
    '-vf',
    'trim=start=1.2,setpts=PTS-STARTPTS,fps=25,scale=2160:-2:flags=lanczos',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'slow',
    '-crf',
    '16',
    '-movflags',
    '+faststart',
    resolve(OUT, `${name}.mp4`),
  ]);

  // The GIF is the fallback. It is smaller than the old one in colour depth,
  // but it keeps the 2x capture down to a readable frame, and the palette is
  // built from the whole clip rather than from the differences.
  execFileSync('ffmpeg', [
    '-y',
    '-i',
    raw,
    '-vf',
    'trim=start=1.2,setpts=PTS-STARTPTS,fps=15,scale=1440:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=full[p];[s1][p]paletteuse=dither=none:diff_mode=rectangle',
    '-loop',
    '0',
    resolve(OUT, `${name}.gif`),
  ]);

  // The WebP is what the readme shows: it is an image, so it plays by itself,
  // and it has all the colours. Quality 95 is the point: the old 72 was the
  // reason the type looked soft even before GitHub resized it.
  execFileSync('ffmpeg', [
    '-y',
    '-i',
    raw,
    '-vf',
    'trim=start=1.2,setpts=PTS-STARTPTS,fps=25,scale=1600:-2:flags=lanczos',
    '-vcodec',
    'libwebp_anim',
    '-lossless',
    '0',
    '-q:v',
    '95',
    '-compression_level',
    '6',
    '-loop',
    '0',
    '-an',
    resolve(OUT, `${name}.webp`),
  ]);

  rmSync(dir, { recursive: true, force: true });
  console.log(`  ${name}.gif, ${name}.webp and ${name}.mp4`);
}

/** Scrolls the inspector down to the counterexample. */
async function scrollInspector(page) {
  await page.evaluate(() => {
    const sections = document.querySelectorAll('section');
    const last = sections[sections.length - 1];
    if (!last) return;
    for (const el of last.querySelectorAll('div')) {
      if (el.scrollHeight > el.clientHeight + 8) {
        el.scrollTop = el.scrollHeight;
        return;
      }
    }
  });
}

/** Clicks the row that SAMOSA flagged. */
async function clickBadRow(page) {
  const badges = page.locator('.badge');
  const count = await badges.count();
  for (let i = 0; i < count; i++) {
    const text = await badges.nth(i).innerText();
    if (text.includes('wrong') || text.includes('shape')) {
      await badges.nth(i).click();
      return;
    }
  }
  throw new Error('no flagged row');
}

/** Opens the app with the given declarations. */
async function open(page, decls) {
  await page.goto(`${BASE}/app/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.cm-content');
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(decls);
  await page.waitForTimeout(400);
  // close the settings again, so the panes fill the window
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.waitForTimeout(400);
}

/** Types a derivation into the editor. */
async function type(page, text) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.locator('.cm-content').click();
  await page.keyboard.insertText(text);
}

await main();

