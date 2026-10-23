const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const [,, outDir, ...routes] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark', storageState: process.env.STATE || undefined });
for (const r of routes) {
  const [path, wait='6000', name] = r.split('|');
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR', path, String(e).slice(0,200)));
  try {
    await page.goto('http://localhost:3000' + path, { waitUntil: 'load', timeout: 180000 });
    await page.waitForTimeout(Number(wait));
    const fn = (name || path.replace(/[^a-z0-9]+/gi,'_')) + '.png';
    await page.screenshot({ path: outDir + '/' + fn });
    console.log('ok', path, fn);
  } catch (e) { console.log('ERR', path, String(e).slice(0,300)); }
  await page.close();
}
await browser.close();
