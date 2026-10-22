/* Offline film renderer. Uses the platform's opening-card styles and verified
   semantic pitches. Writes production candidates, never edits the live course. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {chromium}=require('/Users/raffymac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {get}=require('@tonaljs/note');
const ROOT=process.cwd(),prod=path.join(ROOT,'local-artifacts/solfeo-course/production');
const lessons=JSON.parse(fs.readFileSync(path.join(prod,'storyboards.json'))).lessons;
const selected=process.argv[2]||'local-solfeo-m01-c03';
let film=lessons.find(l=>l.id===selected);if(!film)throw new Error('Unknown lesson');
film=require('./prepare-film.cjs').prepareFilm(film);
const out=path.join(prod,'films',film.id);fs.mkdirSync(out,{recursive:true});
const ff='/Users/raffymac/bin/ffmpeg',probe='/Users/raffymac/bin/ffprobe';
const duration=p=>Number(execFileSync(probe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',p],{encoding:'utf8'}));
const data=(p,m)=>`data:${m};base64,${fs.readFileSync(p).toString('base64')}`;
const esc=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const css=fs.readFileSync('components/playsense-studio/studio/video-effects-preview.module.css','utf8');
const logo=data('public/lmm-video-watermark.png','image/png');
const {writeWave}=require('./write-wave.cjs');
const {diagramSound,tempo}=require('./score-audio.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--allow-file-access-from-files']});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});let cursor=0;const chapters=[];
 for(let i=0;i<film.scenes.length;i++){
  const scene=film.scenes[i],prefix=path.join(out,String(i).padStart(3,'0'));let audio=prefix+'.wav',seconds=scene.duration,soundEvents=[];
  if((scene.kind==='explanation'||scene.kind==='photo')){
   const text=scene.text.replace(/([a-záéíóú])([3456])/gi,'$1 $2');
   execFileSync('say',['-v','Paulina','-r','155','-o',prefix+'.aiff',text]);
   const spoken=duration(prefix+'.aiff');if(!Number.isFinite(spoken)||spoken<1)throw new Error('Narration empty');seconds=Math.max(seconds,spoken+1.5);
   execFileSync(ff,['-y','-i',prefix+'.aiff','-af','apad=pad_dur=2','-t',String(seconds),audio],{stdio:'ignore'});
  }else{const sound=scene.kind==='notation'?diagramSound(scene.diagram,{positions:scene.positions,bpm:scene.bpm,range:scene.range,traversalResolved:scene.traversalResolved}):{events:scene.kind==='completion'?[{pitch:'C5',start:.2,duration:.4},{pitch:'E5',start:.5,duration:.4},{pitch:'G5',start:.8,duration:1}]:[],length:scene.duration};seconds=Math.max(seconds,sound.length);soundEvents=sound.events;writeWave(audio,sound.events,seconds)}
  const cover=['intro','completion'].includes(scene.kind);
  let body=cover?`<div class="scrim"><div class="intro"><p class="eyebrow">LATIN MUSIC MASTERY</p><h2>${esc(scene.title)}</h2><p class="readyLabel">${esc(scene.label||'LECCIÓN COMPLETADA')}</p>${scene.instructor?`<p>Instructor · ${esc(scene.instructor)}</p>`:''}<p>${esc(scene.text||'Observa. Escucha. Comprende.')}</p><div class="pills"><span>Escucha</span><span>Lectura</span><span>Precisión</span></div></div></div>`:`<header><span>SOLFEO APLICADO · ${film.module}.${film.number}</span><h1>${esc(scene.title)}</h1><div class="rule"></div></header><main>${scene.kind==='notation'?`<div class="metadata"><span>Solfeo · ${scene.diagram.kind==='score'?'Lectura musical':'Notación'}</span><span>LMM</span></div><p class="bpm">♩ = ${tempo(scene.diagram.rows?.[0]?.tempo||scene.diagram.upperRow?.tempo,scene.bpm||(scene.diagram.rows?.[0]?.meter||scene.diagram.upperRow?.meter||scene.diagram.meter?96:100))}</p><img class="notation" src="${data(path.join(ROOT,'public',scene.image),'image/png')}">`:scene.kind==='photo'?`<div class="photo-row"><img src="${data(path.join(ROOT,'public',scene.image),'image/jpeg')}"><div><p>${esc(scene.text)}</p><small>${esc(scene.credit)}</small></div></div>`:scene.kind==='table'?`<table>${scene.rows.map(row=>`<tr>${row.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`:`<p class="explanation">${esc(scene.text)}</p>`}</main>`;
  const html=`<style>@font-face{font-family:M;src:url(${data('/Library/Fonts/Montserrat-Regular.ttf','font/ttf')})}@font-face{font-family:M;src:url(${data('/Library/Fonts/Montserrat-ExtraBold.ttf','font/ttf')});font-weight:850}:root{--background:30 15% 97%;--foreground:25 10% 13%;--muted-foreground:25 5% 43%;--primary:28 96% 49%}*{box-sizing:border-box}body{margin:0;background:#f9f7f4;color:#25211e;font-family:M}.film{width:1280px;height:720px;position:relative;padding:48px 64px 85px;overflow:hidden}${css}.intro{animation:none;max-width:1120px}.intro h2{font-family:M;font-size:58px;line-height:1.1}.intro p{font-size:21px}.intro .eyebrow{font-size:13px}.pills span{font-size:16px}header>span{font-size:13px;color:#ef7909;letter-spacing:2px;font-weight:850}h1{font-size:34px;line-height:1.2;margin:16px 0;text-align:center}.rule{width:72px;height:4px;background:#ef7909;border-radius:4px;margin:20px auto}main{height:438px;display:flex;flex-direction:column;justify-content:center}.explanation{font-size:28px;line-height:1.7;max-width:1020px;margin:auto}.metadata{display:flex;justify-content:space-between;font-size:15px}.bpm{font-size:14px;margin:12px 0 5px}.notation{max-height:360px;width:100%;object-fit:contain;min-height:0}.watermark{position:absolute;bottom:22px;right:30px;width:195px;opacity:.78;filter:drop-shadow(0 1px 4px #ef790933)}.photo-row{display:grid;grid-template-columns:1fr 1fr;gap:35px;align-items:center}.photo-row img{width:100%;height:380px;object-fit:contain;border-radius:14px}.photo-row p{font-size:26px;line-height:1.6}.photo-row small{font-size:13px;color:#776e66}table{border-collapse:collapse;font-size:20px}td{padding:12px;border-bottom:1px solid #ddd}tr:first-child{background:#265b4d;color:white}.counter{position:absolute;bottom:30px;left:64px;color:#857c73;font-size:14px}</style><div class="film">${body}<div class="counter">${i+1} / ${film.scenes.length}</div></div>`;
  await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('main,.intro')].some(e=>e.scrollHeight>e.clientHeight+2));if(overflow)throw new Error(`Clipped frame ${film.id}/${i}`);
  await page.screenshot({path:prefix+'.png'});
  // Dense reference tables need their own full-width frame, not the score image cap.
  if(scene.diagram?.kind==='values')execFileSync(process.env.LMM_PYTHON||'/Users/raffymac/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',['scripts/solfeo/render-values-frame.py',prefix+'.png',`SOLFEO APLICADO · ${film.module}.${film.number}`,`${i+1} / ${film.scenes.length}`]);
  let filters='fade=t=in:st=0:d=0.35';
  if(scene.positions?.length&&soundEvents.length){
   const picture=await page.locator('.notation').evaluate(img=>{const r=img.getBoundingClientRect(),scale=Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight);return {x:r.x+(r.width-img.naturalWidth*scale)/2,y:r.y+(r.height-img.naturalHeight*scale)/2,w:img.naturalWidth*scale,h:img.naturalHeight*scale}});
   let positionIndex=0;
   for(const e of soundEvents){
    const index=e.visualIndex??scene.positions.findIndex((p,j)=>j>=positionIndex&&p.pitch.replace('n','')===e.pitch);if(index<0||!scene.positions[index])throw new Error('No visual anchor for '+e.pitch);
    const p=scene.positions[index];positionIndex=index+1;
    filters+=`,drawbox=x=${Math.round(picture.x+p.x*picture.w-10)}:y=${Math.round(picture.y+p.y*picture.h-24)}:w=28:h=48:color=0xff8500@0.28:t=fill:enable='between(t,${e.start},${e.start+e.duration})'`;
   }
  }
  execFileSync(ff,['-y','-loop','1','-framerate','18','-i',prefix+'.png','-i',audio,'-t',String(seconds),'-vf',filters,'-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2',prefix+'.mp4'],{stdio:'ignore'});
  const encodedSeconds=duration(prefix+'.mp4');chapters.push({start:cursor,end:cursor+encodedSeconds,kind:scene.kind,title:scene.title,sourceTopic:scene.sourceTopic,range:scene.range,bpm:scene.bpm,diagram:scene.diagram,soundEvents});cursor+=encodedSeconds;console.log(`${film.id}: ${i+1}/${film.scenes.length}`,true);
 }
 fs.writeFileSync(path.join(out,'concat.txt'),chapters.map((_,i)=>`file '${path.join(out,String(i).padStart(3,'0')+'.mp4')}'`).join('\n'));
 execFileSync(ff,['-y','-f','concat','-safe','0','-i',path.join(out,'concat.txt'),'-c:v','copy','-af','aresample=48000:async=1:first_pts=0','-c:a','aac','-b:a','192k','-movflags','+faststart',path.join(out,'lesson.mp4')],{stdio:'ignore'});
 require('./mux-continuous-audio.cjs').muxContinuousAudio(path.join(out,'lesson.mp4'),path.join(out,'lesson-continuous.mp4'),out,chapters);
 fs.renameSync(path.join(out,'lesson-continuous.mp4'),path.join(out,'lesson.mp4'));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({classId:film.id,duration:duration(path.join(out,'lesson.mp4')),chapters,status:'candidate-needs-review',rendererVersion:4,voice:'macOS Paulina (synthetic)'},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
