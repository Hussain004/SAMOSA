import { chromium } from '@playwright/test';

const shots = process.argv[2] ?? '/tmp/opencode';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${shots}/landing-top.png` });
await page.screenshot({ path: `${shots}/landing-full.png`, fullPage: true });

await page.goto('http://localhost:4173/app/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${shots}/app.png` });

await browser.close();
console.log('ok');
