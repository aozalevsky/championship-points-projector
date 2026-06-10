import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto('http://localhost:5180/');
await page.waitForSelector('svg path', { timeout: 60000 });
console.log('season selector value:', await page.locator('select >> nth=1').inputValue());
console.log('slider label:', (await page.locator('text=events left').textContent()).trim());
await browser.close();
