import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:4173/app/#menu=kalman', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: 'Menu' }).click();
await page.waitForTimeout(500);
const card = page.locator('div').filter({ hasText: /^Kalman update/ }).last();
await card.getByRole('button', { name: 'spot the bug' }).click();
await page.waitForTimeout(2000);
// guess the wrong row: the one with the Q_t^{-1}
await page.locator('text=click the wrong row').nth(6).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/opencode/fix1.png' });
const apply = page.getByRole('button', { name: 'apply' }).first();
if (await apply.count()) {
  await apply.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/opencode/fix2.png' });
}
await browser.close();
console.log('ok');
