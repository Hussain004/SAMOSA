import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
await page.locator('section').nth(2).screenshot({ path: '/tmp/opencode/samosa4/demo.png' });
await browser.close();
console.log('ok');
