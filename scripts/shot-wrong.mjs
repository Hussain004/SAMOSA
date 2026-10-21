import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:4173/app/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Menu' }).click();
await page.waitForTimeout(400);
const card = page.locator('div').filter({ hasText: /^Kalman update/ }).last();
await card.getByRole('button', { name: 'spot the bug' }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/opencode/samosa4/wrong.png' });
// open the card of the wrong row
const wrong = page.locator('span', { hasText: '✗' }).first();
if (await wrong.count()) {
  await wrong.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/opencode/samosa4/card.png' });
}
await browser.close();
console.log('ok');
