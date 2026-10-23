// Parallel deterministic frame renderer.
// node render.mjs <outDir> <fromSec> <toSec> [workers=4] [fps=30] [url]
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
const [,, out, fromS, toS, workersS = '4', fpsS = '30', url = 'http://127.0.0.1:8765/index.html'] = process.argv;
const fps = +fpsS, workers = +workersS;
const first = Math.round(+fromS * fps), last = Math.round(+toS * fps) - 1;
fs.mkdirSync(out, { recursive: true });
const frames = []; for (let i = first; i <= last; i++) if (!(process.env.SKIP_EXISTING && fs.existsSync(`${out}/f_${String(i).padStart(5, '0')}.jpg`))) frames.push(i);
console.log('frames to render', frames.length);
const per = Math.ceil(frames.length / workers);
const t0 = Date.now(); let done = 0;
async function worker(list, w) {
  const browser = await chromium.launch({ args: ['--disable-web-security', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log(`[w${w}] PAGEERR`, String(e).slice(0, 200)));
  await page.goto(url);
  await page.waitForFunction('window.READY === true', null, { timeout: 180000 });
  for (const i of list) {
    await page.evaluate(async (t) => { await window.seek(t); }, i / fps);
    await page.screenshot({ path: `${out}/f_${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 94, timeout: 120000 });
    done++;
    if (done % 150 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${frames.length} frames · ${el.toFixed(0)}s · ${(done / el).toFixed(2)} fps · eta ${((frames.length - done) / (done / el)).toFixed(0)}s`); }
  }
  await browser.close();
}
await Promise.all(Array.from({ length: workers }, (_, w) => worker(frames.slice(w * per, (w + 1) * per), w)));
console.log(`done ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
