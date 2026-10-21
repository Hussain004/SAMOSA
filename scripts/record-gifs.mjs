import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The three GIFs of the README (the plan, section 8.1).
 *
 * They are recorded from the real app, so they cannot show anything the
 * product does not do.
 */

const OUT = resolve(process.cwd(), 'public/gifs');
const BASE = process.env.SAMOSA_URL ?? 'http://localhost:4173';

const KALMAN = String.raw`\begin{align*}
J_t &:= \tfrac12 (z_t - C_t x_t)^\top Q_t^{-1} (z_t - C_t x_t) + \tfrac12 (x_t - \bar\mu_t)^\top \bar\Sigma_t^{-1} (x_t - \bar\mu_t) \\
\frac{\partial J_t}{\partial x_t} &= -C_t^\top Q_t^{-1}(z_t - C_t x_t) + \bar\Sigma_t^{-1}(x_t - \bar\mu_t) \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1}
\end{align*}`;

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
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 980, height: 620 } });

  // 1. the transposed product, the squiggle, the counterexample and the fix
  await record(page, 'transpose', async (shot) => {
    await open(page, 'A, B: n×n');
    await type(page, 'A^\\top B = (A B)^\\top');
    await page.waitForTimeout(1800);
    await shot();
    await clickBadRow(page);
    await page.waitForTimeout(2600);
    await shot();
    const apply = page.getByRole('button', { name: 'apply' }).first();
    if (await apply.count()) {
      await apply.click();
      await page.waitForTimeout(2200);
      await shot();
    }
  });

  // 2. the Kalman update, with the missing noise term
  await record(page, 'kalman', async (shot) => {
    await open(page, DECLS);
    await type(page, KALMAN_BUG);
    await page.waitForTimeout(2200);
    await shot();
    await clickBadRow(page);
    await page.waitForTimeout(3000);
    await shot();
  });

  // 3. the gradient in the wrong layout
  await record(page, 'gradient', async (shot) => {
    await open(page, 'X: m×n; a: m; b: n');
    await type(page, GRADIENT);
    await page.waitForTimeout(2000);
    await shot();
    await clickBadRow(page);
    await page.waitForTimeout(2600);
    await shot();
  });

  await browser.close();
  console.log('the GIFs are in public/gifs');
}

/** Records the frames of one GIF. */
async function record(page, name, script) {
  const dir = resolve(OUT, `.${name}`);
  mkdirSync(dir, { recursive: true });
  let index = 0;
  const shot = async () => {
    index += 1;
    await page.screenshot({ path: resolve(dir, `frame${String(index).padStart(3, '0')}.png`) });
  };
  await script(shot);
  execFileSync('ffmpeg', [
    '-y',
    '-framerate',
    '6',
    '-i',
    resolve(dir, 'frame%03d.png'),
    '-vf',
    'scale=980:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
    '-loop',
    '0',
    resolve(OUT, `${name}.gif`),
  ]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`  ${name}.gif`);
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
  await page.waitForTimeout(300);
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
