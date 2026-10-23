const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(process.argv[3] || 'http://127.0.0.1:8765/index.html'); await p.waitForFunction('window.READY === true');
const sfx = await p.evaluate('window.E.SFX');
fs.writeFileSync(process.argv[2], JSON.stringify(sfx, null, 1));
console.log(sfx.length, 'cues;', [...new Set(sfx.map(s => s.name))].join(', '));
await b.close();
