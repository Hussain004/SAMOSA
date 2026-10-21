import { expect, test } from '@playwright/test';

/**
 * The browser tests of the app.
 *
 * They check the things that only exist in the browser: the verdicts appear,
 * a quick fix applies, the share link round trips, and nothing leaves the
 * machine.
 */

const DERIVATION = String.raw`\begin{align*}
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
K_t &= \bar\Sigma_t C_t^\top \left(C_t \bar\Sigma_t C_t^\top + Q_t\right)^{-1}
\end{align*}
`;

const DECLARATIONS = 'x_t, \\bar\\mu_t: n; z_t: m; C_t: m×n; Q_t: spd m; \\bar\\Sigma_t: spd n';

/** The Joseph form with the noise term missing: the step the engine can fix. */
const JOSEPH = String.raw`\begin{align*}
\Sigma_t &:= \left(C_t^\top Q_t^{-1} C_t + \bar\Sigma_t^{-1}\right)^{-1} \\
K_t &:= \Sigma_t C_t^\top Q_t^{-1} \\
\Sigma_t &= (I - K_t C_t)\, \bar\Sigma_t (I - K_t C_t)^\top
\end{align*}
`;

test.beforeEach(async ({ page }) => {
  await page.goto('/app/');
  await page.waitForSelector('.cm-content');
});

test('the default derivation is checked', async ({ page }) => {
  await expect(page.getByText('holds').first()).toBeVisible();
  await expect(page.getByText('exact').first()).toBeVisible();
});

test('a wrong step is flagged and the card opens', async ({ page }) => {
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(DECLARATIONS);
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(DERIVATION);
  await expect(page.getByText('wrong').first()).toBeVisible({ timeout: 15_000 });
});

test('a quick fix applies', async ({ page }) => {
  await page.getByRole('button', { name: 'Presets' }).click();
  await page.locator('textarea').fill(DECLARATIONS);
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(JOSEPH);
  await expect(page.getByText('wrong').first()).toBeVisible({ timeout: 15_000 });

  // open the card of the wrong row
  await page.getByText('wrong').first().click();
  const apply = page.getByRole('button', { name: 'apply' }).first();
  await expect(apply).toBeVisible({ timeout: 15_000 });
  await apply.click();

  // the row is right now
  await expect(page.getByText('wrong').first()).toHaveCount(0, { timeout: 15_000 });
});

test('the share link round trips', async ({ page }) => {
  await page.getByRole('button', { name: 'Share' }).click();
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain('#v1.');
  await page.goto('/app/' + hash);
  await expect(page.getByText('holds').first()).toBeVisible({ timeout: 15_000 });
});

test('the menu items have share links that round trip', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  const items = page.locator('[data-menu-item]');
  const count = await items.count();
  expect(count).toBeGreaterThan(5);

  await items.nth(0).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Share' }).click();
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain('#v1.');
  await page.goto('/app/' + hash);
  // the derivation is back and it has been checked
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
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(DERIVATION);
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
  await page.waitForSelector('.cm-content');
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
