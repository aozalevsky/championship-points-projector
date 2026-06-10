import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto('http://localhost:5180/');
await page.waitForSelector('svg path', { timeout: 60000 });
const href = await page.locator('a:has-text("Source")').getAttribute('href');
console.log('header link:', href);
await page.screenshot({ path: '/tmp/f1u-srclink.png', clip: { x: 900, y: 0, width: 700, height: 70 } });
await browser.close();
