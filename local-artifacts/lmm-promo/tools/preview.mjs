// Render specific timestamps of the promo to PNGs for review: node preview.mjs out_dir t1 t2 ...
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
const [,, out, ...times] = process.argv;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('console.' + m.type(), m.text().slice(0, 200)); });
page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300)));
await page.goto(process.env.URL || 'http://127.0.0.1:8765/index.html');
await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
const errs = await page.evaluate('window.BUILD_ERRORS || []'); if (errs.length) console.log('BUILD ERRORS', errs);
for (const t of times) {
  await page.evaluate(async (tt) => { await window.seek(tt); }, Number(t));
  await page.screenshot({ path: `${out}/t_${String(Number(t).toFixed(2)).padStart(7, '0')}.png` });
}
await browser.close();
console.log('ok', times.length);
