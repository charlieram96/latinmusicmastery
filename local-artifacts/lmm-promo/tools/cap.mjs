// Usage: node cap.mjs config.json  — config: {out, state, shots:[{path,name,wait,kids,lang,w,h,scale,click:[selectors],scrollY,theme}]}
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'] });
for (const s of cfg.shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w || 1920, height: s.h || 1080 }, deviceScaleFactor: s.scale || 1, colorScheme: s.theme === 'light' ? 'light' : 'dark', storageState: cfg.state || undefined });
  await ctx.addInitScript(({ kids, theme }) => {
    try { localStorage.setItem('lmm-learning-mode', kids ? 'kids' : 'classic'); if (theme) localStorage.setItem('theme', theme); } catch {}
    const hide = () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.documentElement.appendChild(st); };
    if (document.documentElement) hide(); else document.addEventListener('DOMContentLoaded', hide);
  }, { kids: !!s.kids, theme: s.theme });
  if (s.lang) await ctx.addCookies([{ name: 'lmm-locale', value: s.lang, url: 'http://localhost:3000' }, { name: 'NEXT_LOCALE', value: s.lang, url: 'http://localhost:3000' }]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR', s.path, String(e).slice(0, 160)));
  try {
    await page.goto('http://localhost:3000' + s.path, { waitUntil: 'load', timeout: 240000 });
    await page.waitForTimeout(s.wait || 6000);
    for (const c of s.click || []) { try { await page.click(c, { timeout: 8000 }); await page.waitForTimeout(s.clickWait || 2500); } catch (e) { console.log('click fail', c); } }
    if (s.scrollY) { await page.evaluate(y => window.scrollTo(0, y), s.scrollY); await page.waitForTimeout(1200); }
    await page.screenshot({ path: `${cfg.out}/${s.name}.png`, fullPage: !!s.full, timeout: 240000 });
    console.log('ok', s.name);
  } catch (e) { console.log('ERR', s.name, String(e).slice(0, 200)); }
  await ctx.close();
}
await browser.close();
