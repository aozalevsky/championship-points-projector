import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto('http://localhost:5180/');
await page.waitForSelector('svg path', { timeout: 60000 });
await page.waitForTimeout(1000);

// hover the championship leader's row to test highlight + info box
await page.locator('text=Oscar').first().hover();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/f1u-hover.png', clip: { x: 0, y: 0, width: 1600, height: 800 } });

// switch to the live 2026 season
await page.selectOption('select', '2026');
await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 60000 });
await page.waitForSelector('svg path', { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/f1u-2026.png', fullPage: true });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
