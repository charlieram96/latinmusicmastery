// Deterministic recorder: node record.mjs config.json
// config: {url, out, w, h, scale, fps, seconds, warmup, state, kids, css, clip (selector), clicks:[{sel, at}], evals:[{at, js}], quality}
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.mkdirSync(cfg.out, { recursive: true });
const vt = fs.readFileSync(new URL('./vtime.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const ctx = await browser.newContext({ viewport: { width: cfg.w || 1920, height: cfg.h || 1080 }, deviceScaleFactor: cfg.scale || 1, colorScheme: 'dark', storageState: cfg.state || undefined });
await ctx.addInitScript({ content: vt });
await ctx.addInitScript(({ kids, css }) => {
  try { localStorage.setItem('lmm-learning-mode', kids ? 'kids' : 'classic'); } catch {}
  const add = () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}' + (css || ''); document.documentElement.appendChild(st); };
  if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
}, { kids: !!cfg.kids, css: cfg.css || '' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
await page.goto(cfg.url, { waitUntil: 'load', timeout: 240000 });
await page.waitForTimeout(cfg.warmup ?? 8000);
for (const c of cfg.preClicks || []) { try { await page.click(c, { timeout: 8000 }); await page.waitForTimeout(800); } catch { console.log('preclick fail', c); } }
for (const [sel, val] of cfg.selects || []) { try { await page.selectOption(sel, val); await page.waitForTimeout(cfg.selectWait || 6000); } catch (e) { console.log('select fail', sel, String(e).slice(0,120)); } }
if (cfg.preEval) await page.evaluate(cfg.preEval);
await page.evaluate(() => window.__vt.enable());
let clip;
if (cfg.clip) { const b = await page.locator(cfg.clip).first().boundingBox(); clip = { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) }; console.log('clip', clip); }
const fps = cfg.fps || 30, n = Math.round((cfg.seconds || 5) * fps), dt = 1000 / fps;
for (let k = 0; k < Math.round((cfg.skip || 0) * fps); k++) { await page.evaluate(ms => window.__vt.advance(ms), dt); if (k % 5 === 4) await page.screenshot({ clip: { x: 0, y: 0, width: 4, height: 4 }, timeout: 300000 }); }
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const t = i / fps;
  for (const c of cfg.clicks || []) if (Math.abs(c.at - t) < 0.5 / fps) { try { await page.click(c.sel, { timeout: 3000 }); } catch { console.log('click fail', c.sel); } }
  for (const e of cfg.evals || []) if (Math.abs(e.at - t) < 0.5 / fps) await page.evaluate(e.js);
  await page.evaluate(ms => window.__vt.advance(ms), dt);
  await page.screenshot({ path: `${cfg.out}/f_${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: cfg.quality || 90, clip, animations: 'allow', caret: 'hide', timeout: 300000 });
  if (i % 60 === 0) console.log('frame', i, '/', n, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await browser.close();
console.log('done', n, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
