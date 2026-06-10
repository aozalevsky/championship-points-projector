import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5180/';
const out = process.argv[3] ?? '/tmp/f1u.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
await page.goto(url);
// wait for data to load and the chart svg to appear
await page.waitForSelector('svg path', { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
console.log(`saved ${out}`);
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
else console.log('no console/page errors');
await browser.close();
