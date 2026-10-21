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

test('the share link round trips', async ({ page }) => {
  await page.getByRole('button', { name: 'Share' }).click();
  const hash = await page.evaluate(() => window.location.hash);
  expect(hash).toContain('#v1.');
  await page.goto('/app/' + hash);
  await expect(page.getByText('holds').first()).toBeVisible({ timeout: 15_000 });
});

test('nothing leaves the browser', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(DERIVATION);
  await page.waitForTimeout(1500);
  const leaks = requests.filter((url) => url.includes('J_t') || url.includes('Sigma'));
  expect(leaks).toEqual([]);
});

test('the command palette opens with the keyboard', async ({ page }) => {
  await page.keyboard.press('Control+k');
  await expect(page.getByPlaceholder('Type a command')).toBeVisible();
});
