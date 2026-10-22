const fs=require('fs'),{diagramSound}=require('./score-audio.cjs'),{prepareFilm}=require('./prepare-film.cjs');
const prod='local-artifacts/solfeo-course/production',lessons=JSON.parse(fs.readFileSync(`${prod}/storyboards.json`)).lessons;
const failures=[],verified=[];
for(const l of lessons.filter(l=>!(l.module===1&&l.number<=2))){
 const p=`${prod}/films/${l.id}/manifest.json`;if(!fs.existsSync(p)){failures.push({id:l.id,error:'Missing movie'});continue}
 const m=JSON.parse(fs.readFileSync(p)),film=prepareFilm(l);let reasons=[];
 if(m.rendererVersion!==4)reasons.push('Previous renderer');
 if(film.scenes.length!==m.chapters.length)reasons.push('Changed scene structure');
 else for(const [i,s]of film.scenes.entries()){
  const ch=m.chapters[i];if(ch.kind!==s.kind||ch.title!==s.title||JSON.stringify(ch.diagram)!==JSON.stringify(s.diagram)){reasons.push(`Changed chapter ${i}`);continue}
  if(s.kind==='notation'){
   try{const sound=diagramSound(s.diagram,{positions:s.positions,bpm:s.bpm,range:s.range,traversalResolved:s.traversalResolved});
    const summarize=arr=>JSON.stringify(arr.map(e=>[e.pitch,e.soundPitch||e.pitch,e.start,e.duration,e.gain??.17]));
    if(summarize(sound.events)!==summarize(ch.soundEvents))reasons.push(`Updated sound ${i}`);
    for(const e of sound.events){const anchor=s.positions[e.visualIndex];if(!anchor||!Number.isFinite(e.start)||!Number.isFinite(e.duration))throw Error('Invalid sound or visual anchor')}
   }catch(e){reasons.push(`Chapter ${i}: ${e.message}`)}
  }
 }
 if(reasons.length)failures.push({id:l.id,error:[...new Set(reasons)].join('; ')});else verified.push(l.id);
}
fs.writeFileSync(`${prod}/film-audit.json`,JSON.stringify({verified,failures},null,2));console.log({verified:verified.length,failures});
