import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const C = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9344;
const p = spawn(C, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/lmm-rec-profile', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tgt; for (let i = 0; i < 40; i++) { try { const l = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json(); tgt = l.find(t => t.type === 'page'); if (tgt) break; } catch {} await sleep(250); }
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await cmd('Page.navigate', { url: 'http://127.0.0.1:3007/playsense-preview' });
await sleep(16000);
const js = `(async()=>{
  const cv=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  if(!cv) return {err:'no canvas'};
  const st=cv.captureStream(30);
  const mt=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  const rec=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:7000000});
  const chunks=[]; rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const done=new Promise(r=>rec.onstop=r); rec.start(500);
  await new Promise(r=>setTimeout(r,${process.env.SECS || 12}000)); rec.stop(); await done;
  const blob=new Blob(chunks,{type:mt}); const buf=new Uint8Array(await blob.arrayBuffer());
  let s=''; for(let i=0;i<buf.length;i+=32768) s+=String.fromCharCode.apply(null,buf.subarray(i,i+32768));
  return {mt,w:cv.width,h:cv.height,b64:btoa(s)};
})()`;
const r = await cmd('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true, timeout: 60000 });
const v = r.result?.result?.value;
if (!v || v.err) { console.log('fail', JSON.stringify(r).slice(0, 500)); }
else { writeFileSync('miami-stage.webm', Buffer.from(v.b64, 'base64')); console.log(v.mt, v.w, v.h, Math.round(v.b64.length * .75 / 1024) + 'KB'); }
const shot = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
writeFileSync('record-stage-after.jpg', Buffer.from(shot.result.data, 'base64'));
ws.close(); p.kill();
