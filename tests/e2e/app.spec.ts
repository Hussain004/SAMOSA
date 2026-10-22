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

const DERIVATION = String.raw`\begin{align*}
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1}
\end{align*}
`;

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
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(DECLARATIONS);
  await type(page, DERIVATION);
  await expect(page.getByText('wrong').first()).toBeVisible({ timeout: 15_000 });

  // the card draws the counterexample, the two sides and the computed values
  await page.getByText('wrong').first().click();
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
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(DECLARATIONS);
  await type(page, JOSEPH);
  await expect(page.getByText('wrong').first()).toBeVisible({ timeout: 15_000 });

  // open the card of the wrong row
  await page.getByText('wrong').first().click();
  const apply = page.getByRole('button', { name: 'apply' }).first();
  await expect(apply).toBeVisible({ timeout: 15_000 });
  await apply.click();

  // the row is right now
  await expect(page.getByText('wrong').first()).toHaveCount(0, { timeout: 15_000 });
});

test('the share link round trips, with the derivation in it', async ({ page }) => {
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(DECLARATIONS);
  await type(page, JOSEPH);
  await expect(page.getByText('wrong').first()).toBeVisible({ timeout: 15_000 });

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
  await expect(page.getByText('wrong').first()).toBeVisible({ timeout: 15_000 });
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
  await type(page, DERIVATION);
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
  await page.keyboard.type(DERIVATION);
  await expect(page.getByText('wrong').first()).toBeVisible({ timeout: 15_000 });
});

test('the light theme is remembered', async ({ page }) => {
  await page.goto('/app/');
  await page.waitForSelector('.cm-content');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await page.waitForSelector('.cm-content');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the typed demo can be paused, skipped and replayed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('SAMOSA-SERVATIONS')).toBeVisible();

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
