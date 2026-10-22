const fs=require('fs'),assert=require('node:assert/strict');
const root='local-artifacts/solfeo-course',prod=root+'/production',read=p=>JSON.parse(fs.readFileSync(p)),write=(p,o)=>fs.writeFileSync(p,JSON.stringify(o,null,2));
const store=read(root+'/studio.json'),drafts=read(prod+'/exercises.json');let lessons=0,sections=0,retimed=0,windows=0;
for(const file of fs.readdirSync(prod+'/ready').filter(f=>f.endsWith('.json'))){
 const lesson=read(prod+'/ready/'+file),id=lesson.classId,manifest=read(prod+'/films/'+id+'/manifest.json');assert.equal(manifest.tempoRevision,1,id);
 const segments=manifest.chapters.flatMap((ch,i)=>{
  if(ch.kind!=='notation'||!ch.soundEvents.length||lesson.sections.some(s=>s.id===id+'-section-'+i))return [];
  const bpm=ch.performedBpm??100,from=ch.start+Math.min(...ch.soundEvents.map(e=>e.start)),to=ch.start+Math.max(...ch.soundEvents.map(e=>e.start))+60/bpm;
  return [{from,to,bpm}];
 });
 store.media[id+'-video'].segments=segments;windows+=segments.length;
 lesson.metronome=store.media[id+'-video'];
 for(const section of lesson.sections){const persisted=store.sections.find(s=>s.id===section.id);assert.deepEqual(persisted.timing.waypoints,section.activeTimeMap.waypoints);assert.equal(persisted.score.initialTempo,section.score.initialTempo);assert(section.score.initialTempo>0);sections++}
 if(/^local-solfeo-m12-c0[2-7]$/.test(id)){
  const questions=drafts.lessons.find(l=>l.classId===id).questions;
  for(const q of lesson.questions){const source=questions.find(s=>s.id===q.id);assert(source);q.audio_url=source.audioUrl;q.question=q.question_es=source.prompt}
 }
 write(prod+'/ready/'+file,lesson);lessons++;if(lesson.videoUrl.includes('tempo-v1'))retimed++;
}
write(root+'/studio.json',store);
// Apply the same audio URL and instructions to any locally edited question copies.
if(fs.existsSync(root+'/questions.json')){const qstore=read(root+'/questions.json');for(const [key,questions]of Object.entries(qstore)){if(!/^local-solfeo-m12-c0[2-7]-exercise$/.test(key))continue;const source=read(prod+'/ready/'+key.replace('-exercise','')+'.json').questions;for(const q of questions){const match=source.find(s=>s.id===q.id);if(match){q.audio_url=match.audio_url;q.question=q.question_es=match.question_es}}}write(root+'/questions.json',qstore)}
write(prod+'/tempo-repair-report.json',{lessons,sections,retimed,illustrationWindows:windows,dictations:6});console.log({lessons,sections,retimed,illustrationWindows:windows,dictations:6});
