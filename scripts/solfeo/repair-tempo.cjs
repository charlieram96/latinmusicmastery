/** Recoverable local migration: rerender mis-timed examples from the existing
 * documentary frames, and move every downstream synchronization waypoint. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {prepareFilm}=require('./prepare-film.cjs'),{diagramSound,tempo}=require('./score-audio.cjs'),{writeWave}=require('./write-wave.cjs');
const root='local-artifacts/solfeo-course',prod=root+'/production',ff='/Users/raffymac/bin/ffmpeg',probe='/Users/raffymac/bin/ffprobe';
const duration=p=>+execFileSync(probe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',p],{encoding:'utf8'});
const read=p=>JSON.parse(fs.readFileSync(p));const save=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v,null,2));fs.renameSync(p+'.tmp',p)};
const selected=process.argv.slice(2);const lessons=read(prod+'/storyboards.json').lessons.filter(l=>!(l.module===1&&l.number<=2)&&(!selected.length||selected.includes(l.id)));
const backup=prod+'/backups/tempo-100';fs.mkdirSync(backup,{recursive:true});
for(const f of ['studio.json','structure.json'])if(!fs.existsSync(backup+'/'+f))fs.copyFileSync(root+'/'+f,backup+'/'+f);
let report=[];
for(const original of lessons){
 const film=prepareFilm(original),dir=`${prod}/films/${film.id}`,manifest=read(dir+'/manifest.json');
 if(manifest.tempoRevision===1){console.log('Already synchronized',film.id);continue}
 const old=structuredClone(manifest);fs.mkdirSync(backup+'/'+film.id,{recursive:true});
 if(!fs.existsSync(backup+'/'+film.id+'/manifest.json'))fs.copyFileSync(dir+'/manifest.json',backup+'/'+film.id+'/manifest.json');if(!fs.existsSync(backup+'/'+film.id+'/ready.json'))fs.copyFileSync(`${prod}/ready/${film.id}.json`,backup+'/'+film.id+'/ready.json');
 const ready=read(`${prod}/ready/${film.id}.json`);let cursor=0,changed=0;
 for(const [i,ch]of manifest.chapters.entries()){
  const scene=film.scenes[i],prefix=dir+'/'+String(i).padStart(3,'0');let length=ch.end-ch.start,sound=null;
  if(scene.kind==='notation'){
   sound=diagramSound(scene.diagram,{positions:scene.positions,bpm:scene.bpm,range:scene.range,traversalResolved:scene.traversalResolved});
   const updated=JSON.stringify(sound.events)!==JSON.stringify(ch.soundEvents);
   if(updated){
    length=Math.max(scene.duration,sound.length);
    // Read the white notation rectangle from the existing frame. Keep the
    // supplied score image, positions, typography and all non-score art intact.
    const geom=JSON.parse(execFileSync('/Users/raffymac/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',['-c',`from PIL import Image
import json,sys
im=Image.open(sys.argv[1]).convert('RGB'); src=Image.open(sys.argv[2]); w,h=src.size
rows=[y for y in range(175,635) if sum(im.getpixel((x,y))==(255,255,255) for x in range(64,1216))>200]
assert rows, 'Missing notation picture'
top=min(rows); height=max(rows)-top+1
scale=min(1152/w,height/h)
print(json.dumps(dict(x=64+(1152-w*scale)/2,y=top+(height-h*scale)/2,w=w*scale,h=h*scale,top=top)))`,prefix+'.png','public'+scene.image],{encoding:'utf8'}));
    writeWave(prefix+'-tempo.wav',sound.events,length);
    let filters=`drawbox=x=64:y=${geom.top-29}:w=850:h=27:color=0xf9f7f4:t=fill,drawtext=fontfile=/Library/Fonts/Montserrat-Regular.ttf:text='${sound.bpm} BPM (negra)':fontsize=14:fontcolor=0x25211e:x=64:y=${geom.top-22},fade=t=in:st=0:d=0.35`;
    for(const e of sound.events){const p=scene.positions[e.visualIndex];if(!p)throw Error('Missing note position '+film.id+'/'+i);filters+=`,drawbox=x=${Math.round(geom.x+p.x*geom.w-10)}:y=${Math.round(geom.y+p.y*geom.h-24)}:w=28:h=48:color=0xff8500@0.28:t=fill:enable='between(t,${e.start},${e.start+e.duration})'`}
    execFileSync(ff,['-y','-loop','1','-framerate','18','-i',prefix+'.png','-i',prefix+'-tempo.wav','-t',String(length),'-vf',filters,'-c:v','libx264','-threads','2','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-ac','2',prefix+'-tempo.mp4'],{stdio:'ignore'});
    if(!fs.existsSync(backup+'/'+film.id+'/'+String(i).padStart(3,'0')+'.mp4'))fs.copyFileSync(prefix+'.mp4',backup+'/'+film.id+'/'+String(i).padStart(3,'0')+'.mp4');fs.renameSync(prefix+'-tempo.mp4',prefix+'.mp4');length=duration(prefix+'.mp4');changed++;
   }
   ch.soundEvents=sound.events;ch.performedBpm=sound.bpm;
  }
  ch.start=cursor;ch.end=cursor+length;cursor=ch.end;
  const section=ready.sections.find(s=>s.id===`${film.id}-section-${i}`);
  if(section&&sound){
   const firstRow=scene.diagram.rows?.[0]||scene.diagram.upperRow||{};
   section.score.initialTempo=tempo(firstRow.tempo,scene.bpm??(firstRow.meter||scene.diagram.meter?96:100));
   for(const nav of firstRow.nav||[])if(nav.bar===0)section.score.initialTempo=tempo(nav.text,section.score.initialTempo);
   section.videoStartSeconds=ch.start;section.videoEndSeconds=ch.end;
   section.activeTimeMap.waypoints=sound.timing.map(p=>({musicalPositionQN:p.qn,videoTimeSeconds:ch.start+p.seconds,measureNumber:null,beatInMeasure:null}));
   const [a,b]=section.activeTimeMap.waypoints;
   section.metronomeAnchorSeconds=a&&b?a.videoTimeSeconds-a.musicalPositionQN*(b.videoTimeSeconds-a.videoTimeSeconds)/(b.musicalPositionQN-a.musicalPositionQN):null;
  }
 }
 if(changed){
  fs.writeFileSync(dir+'/concat.txt',manifest.chapters.map((_,i)=>`file '${path.resolve(dir,String(i).padStart(3,'0')+'.mp4')}'`).join('\n'));
  execFileSync(ff,['-y','-f','concat','-safe','0','-i',dir+'/concat.txt','-c:v','copy','-af','aresample=48000:async=1:first_pts=0','-c:a','aac','-b:a','192k','-movflags','+faststart',dir+'/lesson-tempo.mp4'],{stdio:'ignore'});
  if(!fs.existsSync(backup+'/'+film.id+'/lesson.mp4'))fs.copyFileSync(dir+'/lesson.mp4',backup+'/'+film.id+'/lesson.mp4');fs.renameSync(dir+'/lesson-tempo.mp4',dir+'/lesson.mp4');
  require('./mux-continuous-audio.cjs').muxContinuousAudio(dir+'/lesson.mp4',dir+'/lesson-continuous.mp4',dir,manifest.chapters,{preferTempo:true});
  fs.renameSync(dir+'/lesson-continuous.mp4',dir+'/lesson.mp4');
  manifest.duration=duration(dir+'/lesson.mp4');
  fs.copyFileSync(dir+'/lesson.mp4',`public/local-course-assets/solfeo/films/${film.id}-tempo-v1.mp4`);
  ready.videoUrl=`/local-course-assets/solfeo/films/${film.id}-tempo-v1.mp4`;
 }
 manifest.tempoRevision=1;ready.duration=manifest.duration;
 // Reread stores at installation time; retain other classes and user metadata.
 const studio=read(root+'/studio.json'),structure=read(root+'/structure.json');
 for(const section of ready.sections){const saved=studio.sections.find(s=>s.id===section.id);if(!saved)throw Error('Missing installed section');if(saved.draft)throw Error('Unsaved editor draft requires review');saved.score.initialTempo=section.score.initialTempo;saved.timing.waypoints=section.activeTimeMap.waypoints;saved.timing.anchor={seconds:section.metronomeAnchorSeconds,qn:0};}
 const item=structure.sections.flatMap(s=>s.classes).find(c=>c.id===film.id).items.find(i=>i.item_type==='VIDEO');item.video_url=ready.videoUrl;item.video_duration_seconds=Math.round(ready.duration);
 studio.media[film.id+'-video'].bpm=ready.sections[0]?.score.initialTempo??100;
 // Intro/narration are not a musical example. The score map owns its first beat.
 studio.media[film.id+'-video'].anchorSeconds=null;
 save(root+'/studio.json',studio);save(root+'/structure.json',structure);save(`${prod}/ready/${film.id}.json`,ready);save(dir+'/manifest.json',manifest);
 report.push({id:film.id,scenesRetimed:changed,sections:ready.sections.length,duration:manifest.duration});console.log(film.id,changed,'retimed;',ready.sections.length,'scores aligned');
}
save(prod+'/tempo-repair-report.json',report);
