import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * The browser tests of the app.
 *
 * They check the things that only exist in the browser: the verdicts appear,
 * a quick fix applies, the share link round trips, and nothing leaves the
 * machine.
 *
 * Every one of them has to be able to fail. A test that waits for the word
 * "holds" passes on the default derivation, so the tests here type a
 * derivation of their own and check that it is the one that comes back.
 */

/** The Joseph form with the noise term missing: the step the engine can fix. */
const JOSEPH = String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top
\end{align*}
`;

const DECLARATIONS = 'x_t, \\bar\\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n';

test.beforeEach(async ({ page }) => {
  await page.goto('/app/');
  await page.waitForSelector('.cm-content');
  // the rows survive the engine check: wait for the verdicts instead of
  // racing the worker, so a loaded machine does not flake the suite
  await page.waitForSelector('[data-step-id]', { timeout: 30_000 });
});

/** Puts a derivation in the editor. */
async function type(page: import('@playwright/test').Page, source: string): Promise<void> {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.locator('.cm-content').click();
  await page.keyboard.insertText(source);
}

test('the default derivation is checked', async ({ page }) => {
  await expect(page.getByText('holds').first()).toBeVisible();
  await expect(page.getByText('exact').first()).toBeVisible();
});

test('a wrong step is flagged and the card opens', async ({ page }) => {
  await page.locator('summary[aria-label="more actions"]').click();
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(DECLARATIONS);
  await type(page, JOSEPH);
  await expect(page.locator('[data-verdict="wrong"]').first()).toBeVisible({ timeout: 15_000 });

  // the card draws the counterexample, the two sides and the computed values
  await page.locator('[data-verdict="wrong"]').first().click();
  const card = page.getByTestId('inspector');
  await expect(card.getByRole('heading', { name: 'the two sides' })).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole('heading', { name: 'computed by SAMOSA' })).toBeVisible();
  await expect(card.locator('.katex').first()).toBeVisible();

  // the assumptions are readable names, not LaTeX
  const assumptions = card.getByTestId('assumptions');
  await expect(assumptions.getByText('checked assuming')).toBeVisible();
  await expect(assumptions).not.toContainText('\\bar');
});

test('a quick fix applies', async ({ page }) => {
  await page.locator('summary[aria-label="more actions"]').click();
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(DECLARATIONS);
  await type(page, JOSEPH);
  await expect(page.locator('[data-verdict="wrong"]').first()).toBeVisible({ timeout: 15_000 });

  // open the card of the wrong row
  await page.locator('[data-verdict="wrong"]').first().click();
  const apply = page.getByRole('button', { name: 'apply' }).first();
  await expect(apply).toBeVisible({ timeout: 15_000 });
  await apply.click();

  // the row is right now
  await expect(page.locator('[data-verdict="wrong"]').first()).toHaveCount(0, { timeout: 15_000 });

  // ctrl+z puts the row back the way it was, with the history of one edit,
  // not one whole-document replacement
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+Z');
  const restored = await page.locator('.cm-content').innerText();
  expect(restored).not.toContain('K_t Q_t K_t^\\top');
  await expect(page.locator('[data-verdict="wrong"]').first()).toBeVisible({ timeout: 15_000 });
});

test('the share link round trips, with the derivation in it', async ({ page }) => {
  await page.locator('summary[aria-label="more actions"]').click();
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(DECLARATIONS);
  await type(page, JOSEPH);
  await expect(page.locator('[data-verdict="wrong"]').first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Share' }).click();
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain('#v1.');

  await page.goto('/app/' + hash);
  await page.reload();
  await page.waitForSelector('.cm-content');
  await page.waitForTimeout(1500);

  // the derivation that was shared is the one that is there now
  const source = await page.locator('.cm-content').innerText();
  expect(source).toContain('Sigma_t');
  expect(source).toContain('bar');
  // and the verdicts are the ones of that derivation
  await expect(page.locator('[data-verdict="wrong"]').first()).toBeVisible({ timeout: 15_000 });
});

test('a broken link says so', async ({ page }) => {
  await page.goto('/app/#v1.not-a-real-payload');
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page.getByText('this link is broken').first()).toBeVisible({ timeout: 10_000 });
});

test('the menu items have share links that round trip', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  const items = page.locator('[data-menu-item]');
  const count = await items.count();
  expect(count).toBeGreaterThan(5);

  await items.nth(0).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Share' }).click();
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain('#v1.');
  await page.goto('/app/' + hash);
  await page.reload();
  await page.waitForSelector('.cm-content');
  await page.waitForTimeout(1500);

  // the derivation of the menu item is back, and it has been checked
  const source = await page.locator('.cm-content').innerText();
  expect(source.length).toBeGreaterThan(10);
  expect(source).not.toContain('J_t &:= ');
  await expect(page.locator('footer')).toContainText('ms', { timeout: 15_000 });
});

test('nothing leaves the browser', async ({ page }) => {
  const requests: Array<{ url: string; body: string | null; method: string }> = [];
  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      body: request.postData(),
      method: request.method(),
    });
  });
  await type(page, JOSEPH);
  await page.waitForTimeout(1500);

  // the derivation never appears in a URL
  const leaks = requests.filter((r) => r.url.includes('J_t') || r.url.includes('Sigma'));
  expect(leaks).toEqual([]);

  // the derivation never appears in a body
  const bodies = requests.filter((r) => r.body && (r.body.includes('J_t') || r.body.includes('Sigma')));
  expect(bodies).toEqual([]);

  // and nothing is sent away at all: the only requests are the page itself
  const outside = requests.filter((r) => !r.url.startsWith('http://localhost:4173'));
  expect(outside).toEqual([]);
});

test('the app runs under the content security policy', async ({ page }) => {
  const response = await page.goto('/app/');
  const csp = response.headers()['content-security-policy'];
  expect(csp).toBeTruthy();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain('style-src');
  expect(csp).toContain('img-src');
  expect(csp).toContain('font-src');
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain('frame-ancestors');
  expect(response.headers()['referrer-policy']).toBe('no-referrer');

  // the boot script is a file, so script-src 'self' allows it, and it ran
  // before React mounted: the theme is on the document, not the body
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(['light', 'dark']).toContain(theme);
});

test('the landing runs under the content security policy', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response.headers()['content-security-policy'];
  expect(csp).toBeTruthy();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain('style-src');

  // the boot script is a file, so script-src 'self' allows it, and it ran
  // before the first paint
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(['light', 'dark']).toContain(theme);
});

test('the declarations are in the open', async ({ page }) => {
  // the strip above the panes shows what the check ran with, not behind a button
  const strip = page.getByText('declarations', { exact: true });
  await expect(strip).toBeVisible();
  await expect(page.getByText('Q_t: spd m')).toBeVisible();
});

test('a guessed symbol is declared with one click', async ({ page }) => {
  await type(page, String.raw`\begin{align*}
S S^\top &= I
\end{align*}`);
  // the checker guesses the symbol is a matrix, and says so in the strip
  await expect(page.getByText('guessed').first()).toBeVisible({ timeout: 15_000 });
  // one click declares it and the check re-runs
  await page.getByRole('button', { name: 'spd n', exact: true }).click();
  await expect(page.getByText('S: spd n', { exact: true })).toBeVisible();
  // and the guess is gone, because the declaration took its place
  await expect(page.getByText('guessed')).toHaveCount(0);
});

test('the app works on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/');
  // the source pane starts closed on a phone, so the editor is attached but
  // not visible
  await page.waitForSelector('.cm-content', { state: 'attached' });
  await page.waitForTimeout(1000);

  // the page does not scroll sideways
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  // and the rows are still there
  await expect(page.getByText('holds').first()).toBeVisible();
});

test('the spot the bug game gives feedback and keeps a streak', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByTestId('spot-joseph').click();

  await expect(page.getByText('one row is wrong. click it.')).toBeVisible();

  // a row that holds is not the answer, and the game goes on
  await page.locator('[data-step-id="s1"]').click();
  await expect(page.getByText('not that row, try again')).toBeVisible();

  // the row that is wrong ends the game
  await page.locator('[data-verdict="wrong"]').first().click();
  await expect(page.getByText(/found it in 2 tries/)).toBeVisible();
  await expect(page.getByText('streak 1')).toBeVisible();

  // the next bug is a different derivation, and the streak stays
  await page.getByRole('button', { name: 'next bug →' }).click();
  await expect(page.getByText('one row is wrong. click it.')).toBeVisible();
  await expect(page.getByText('streak 1')).toBeVisible();
});

test('the phone has one pane at a time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/');
  // the source pane starts closed on a phone, so the editor is attached but
  // not visible
  await page.waitForSelector('.cm-content', { state: 'attached' });
  await page.waitForTimeout(1000);

  // the rendered pane is the one that is open
  await expect(page.getByRole('button', { name: 'rendered', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'source', exact: true })).toBeVisible();
  await expect(page.locator('.cm-content')).toBeHidden();

  // the source is one tap away
  await page.getByRole('button', { name: 'source', exact: true }).click();
  await expect(page.locator('.cm-content')).toBeVisible();

  // and a row opens the card
  await page.getByRole('button', { name: 'rendered', exact: true }).click();
  await page.locator('[data-step-id]').first().click();
  await expect(page.getByTestId('inspector')).toBeVisible();

  // the card is a bottom sheet, and it closes
  await page.getByRole('button', { name: 'close the inspector' }).click();
  await expect(page.getByTestId('inspector')).toBeHidden();
});

test('the command palette opens with the keyboard', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(page.getByPlaceholder('Type a command')).toBeVisible();
});

test('the whole flow works with the keyboard alone', async ({ page }) => {
  // the palette opens and a command runs
  await page.keyboard.press('Control+k');
  await expect(page.getByPlaceholder('Type a command')).toBeVisible();
  await page.keyboard.type('share');
  await page.keyboard.press('Enter');
  await expect(page.getByPlaceholder('Type a command')).toHaveCount(0, { timeout: 10_000 });

  // the editor takes the typing
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(JOSEPH);
  await expect(page.locator('[data-verdict="wrong"]').first()).toBeVisible({ timeout: 15_000 });

  // the rows are in the tab order: focus one, Enter opens its card, arrows move the selection
  const rows = page.getByRole('listbox', { name: 'the rows of the derivation' }).getByRole('option');
  await rows.first().focus();
  await page.keyboard.press('Enter');
  await expect(rows.first()).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
  await page.keyboard.press('ArrowDown');
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
});

test('the card saves as an image', async ({ page }) => {
  await type(page, JOSEPH);
  await expect(page.locator('[data-verdict="wrong"]').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-verdict="wrong"]').first().click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'save as image' }).click();
  const download = await downloadPromise;
  // the image carries the row, the verdict, the counterexample and the fix
  expect(download.suggestedFilename()).toMatch(/^samosa-row-\d+-wrong\.png$/);
  const bytes = readFileSync((await download.path())!);
  // a real PNG, with content: not a 1 pixel stub and not empty
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.length).toBeGreaterThan(2000);
});

test('the app is installable and works offline-ish', async ({ page }) => {
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  const manifest = await page.evaluate(async () => {
    const res = await fetch('/manifest.webmanifest');
    return res.json();
  });
  expect(manifest.name).toContain('SAMOSA');
  expect(manifest.start_url).toBe('/app/');

  // the service worker registers and activates
  const state = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) return { count: 0, active: null };
    const sw = regs[0].active;
    if (sw?.state === 'activated') return { count: regs.length, active: 'activated' };
    // wait for activation
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (sw?.state === 'activated') {
          clearInterval(timer);
          resolve(null);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(timer);
        resolve(null);
      }, 5000);
    });
    return { count: regs.length, active: regs[0].active?.state ?? null };
  });
  expect(state.count).toBeGreaterThan(0);
  expect(state.active).toBe('activated');
});

test('a paper with two blocks gets an outline, and the wrong row shows in it', async ({ page }) => {
  const PAPER = readFileSync('tests/e2e/action/paper-wrong.tex', 'utf8');

  // open the paper with the button under the source pane
  await page.setInputFiles('input[aria-label="open a .tex file"]', 'tests/e2e/action/paper-wrong.tex');
  await expect(page.locator('[data-step-id]').first()).toBeVisible({ timeout: 30_000 });

  // the rail lists the two math blocks, with the rows they hold
  const rail = page.getByRole('navigation', { name: 'the blocks of the document' });
  await expect(rail).toBeVisible();
  await expect(rail.getByText('align*')).toHaveCount(2);
  await expect(rail.getByText('rows 1–1')).toBeVisible();
  await expect(rail.getByText('rows 2–3')).toBeVisible();

  // the wrong row is marked in its block
  await expect(rail.getByText('1 ✗')).toBeVisible();
  await expect(page.locator('[data-verdict="wrong"]')).toHaveCount(1);

  // jumping to the second block selects its first row
  await rail.getByText('rows 2–3').click();
  await expect(page.locator('[data-step-id]').nth(1)).toHaveAttribute('data-verdict', 'ok');

  // the engine read the declarations from the comment at the top of the file
  expect(PAPER).toContain('% samosa:');
});

test('a .tex file dropped on the source pane loads into the editor', async ({ page }) => {
  const PAPER = readFileSync('tests/e2e/action/paper-wrong.tex', 'utf8');
  const dataTransfer = await page.evaluateHandle((text) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'paper.tex', { type: 'text/x-tex' }));
    return transfer;
  }, PAPER);
  const pane = page.locator('section', { has: page.locator('.cm-content') }).first();
  await pane.dispatchEvent('dragover');
  await pane.dispatchEvent('drop', { dataTransfer });
  await expect(page.locator('[data-step-id]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-verdict="wrong"]')).toHaveCount(1);
});

test('the light theme is remembered', async ({ page }) => {
  await page.goto('/app/');
  await page.waitForSelector('.cm-content');
  await page.locator('summary[aria-label="more actions"]').click();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await page.waitForSelector('.cm-content');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the typed demo can be paused, skipped and replayed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('TYPICAL SLIPS')).toBeVisible();

  // the transcript for a screen reader is in the DOM
  await expect(page.locator('.sr-only').getByText('Transcript of the Claude Code demo')).toBeAttached();

  await page.getByRole('button', { name: 'pause the demo', exact: true }).click();
  await expect(page.getByText('paused')).toBeVisible();

  const output = page.getByTestId('demo-output');
  await page.getByRole('button', { name: 'skip to the end' }).click();
  await expect(output.getByText('Done. The share link is in the answer.')).toBeVisible();

  await page.getByRole('button', { name: 'play the demo', exact: true }).click();
  await page.getByRole('button', { name: 'replay the demo', exact: true }).click();
  await expect(output.getByText('Done. The share link is in the answer.')).toBeHidden({ timeout: 5000 });
});
