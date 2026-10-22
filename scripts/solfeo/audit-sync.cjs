const fs=require('node:fs'),{prepareFilm}=require('./prepare-film.cjs'),{diagramSound}=require('./score-audio.cjs');
const root='local-artifacts/solfeo-course',prod=root+'/production',read=p=>JSON.parse(fs.readFileSync(p));
const studio=read(root+'/studio.json'),lessons=read(prod+'/storyboards.json').lessons;
let sections=0,points=0,errors=[],anchors=[];const audio=[];
for(const lesson of lessons){if(lesson.module===1&&lesson.number<=2)continue;
 const film=prepareFilm(lesson),manifest=read(prod+'/films/'+lesson.id+'/manifest.json');
 for(const [i,ch] of manifest.chapters.entries()){
  if(ch.kind!=='notation')continue;const scene=film.scenes[i],sound=diagramSound(scene.diagram,{positions:scene.positions,bpm:scene.bpm,range:scene.range,traversalResolved:scene.traversalResolved});
  if(sound.events.length)audio.push({id:lesson.id,chapter:i,expectedStart:ch.start+Math.min(...sound.events.map(e=>e.start)),events:sound.events.map(e=>({t:ch.start+e.start,pitch:e.soundPitch||e.pitch,duration:e.duration}))});
  const saved=studio.sections.find(s=>s.id===lesson.id+'-section-'+i);if(!saved)continue;sections++;
  const wp=saved.timing.waypoints;
  if(wp.length!==sound.timing.length)errors.push(saved.id+' count');
  for(const [j,p]of sound.timing.entries()){points++;if(!wp[j]||Math.abs(wp[j].musicalPositionQN-p.qn)>1e-6||Math.abs(wp[j].videoTimeSeconds-(ch.start+p.seconds))>.001)errors.push(saved.id+' waypoint '+j)}
  const a=wp[0],b=wp[1];const zero=a.videoTimeSeconds-a.musicalPositionQN*(b.videoTimeSeconds-a.videoTimeSeconds)/(b.musicalPositionQN-a.musicalPositionQN);
  if(saved.timing.anchor&&Math.abs(saved.timing.anchor.seconds-zero)>.001)anchors.push({id:saved.id,old:saved.timing.anchor,correct:{seconds:zero,qn:0}});
 }
}
const report={sections,points,errors,anchors};fs.writeFileSync(prod+'/sync-map-audit.json',JSON.stringify(report,null,2));fs.writeFileSync(prod+'/sync-audio-expectations.json',JSON.stringify(audio));console.log(report);
