import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5180/');
await page.waitForSelector('svg path', { timeout: 60000 });
const countPaths = () => page.locator('svg path[stroke][fill="none"]:not([stroke="transparent"])').count();
const before = await countPaths();
// uncheck the top 3 rows (skip the master checkbox = first one)
for (let i = 1; i <= 3; i++) await page.locator('input[type=checkbox]').nth(i + 1).click();
await page.waitForTimeout(400);
const after = await countPaths();
console.log('visible line paths before/after hiding 3:', before, after);
await page.screenshot({ path: '/tmp/f1u-toggles.png', fullPage: true });
// master toggle: hide all, then show all
await page.locator('input[type=checkbox]').nth(1).click();
await page.waitForTimeout(300);
console.log('after hide-all:', await countPaths());
await page.locator('input[type=checkbox]').nth(1).click();
await page.waitForTimeout(300);
console.log('after show-all:', await countPaths());
console.log(errors.length ? 'ERRORS: ' + errors.join('; ') : 'no errors');
await browser.close();
