/* Assemble local review packages. Does not mutate course structure or studio. */
const fs=require('node:fs'),path=require('node:path');
const {diagramSound}=require('./score-audio.cjs');
const prod='local-artifacts/solfeo-course/production';
const catalog=JSON.parse(fs.readFileSync(`${prod}/curriculum.json`)).lessons;
const exercises=JSON.parse(fs.readFileSync(`${prod}/exercises.json`)).lessons;
const staged=`${prod}/staged`;fs.mkdirSync(staged,{recursive:true});
const signature=r=>JSON.stringify([r.events||r.bars,r.meter||null,r.key||0,r.clef||'G']);
const verified=new Set(JSON.parse(fs.readFileSync(`${prod}/film-audit.json`)).verified);
let count=0,errors=[];
for(const [lessonIndex,l] of catalog.entries()){
 if(l.module===1&&l.number<=2||!verified.has(l.id))continue;
 const dir=`${prod}/films/${l.id}`,mf=`${dir}/manifest.json`;if(!fs.existsSync(mf))continue;
 const manifest=JSON.parse(fs.readFileSync(mf));if(manifest.rendererVersion!==4)continue;
 try{
 const sections=[];
 for(const [i,ch] of manifest.chapters.entries()){
  if(!['score','grand','grand-study'].includes(ch.diagram?.kind))continue;
  const row=ch.diagram.rows?.[0]||ch.diagram.upperRow||{bars:ch.diagram.upper.map(pitch=>[{pitch,dur:ch.diagram.dur||1}]),meter:ch.diagram.meter?'4/4':undefined};
  const ref=l.scores.find(s=>signature(s.score.notation)===signature(row)&& (ch.diagram.kind==='score'||s.score.notation.staffClefs?.length===2));
  if(!ref)throw Error(`Missing source score for chapter ${i}: ${ch.title}`);
  const score=JSON.parse(fs.readFileSync(`${prod}/prepared-scores/${ref.id}.json`));const label=l.module===11&&/^\d+$/.test(ch.title)?`Compases ${ch.title}–${Number(ch.title)+score.tracks[0].measures.length-1}`:ch.title;
  score.title=l.module===11?l.title.es.split(' · ').slice(1).join(' · ')+' · '+label:ch.title;score.composer='LMM';
  const sound=diagramSound(ch.diagram,{bpm:ch.bpm,range:ch.range,traversalResolved:l.module===11||(l.module===10&&l.number===5)});
  score.initialTempo=sound.bpm;
  const id=`${l.id}-section-${i}`;
  const waypoints=sound.timing.map(p=>({musicalPositionQN:p.qn,videoTimeSeconds:ch.start+p.seconds,measureNumber:null,beatInMeasure:null}));
  for(let j=1;j<waypoints.length;j++)if(waypoints[j].musicalPositionQN<=waypoints[j-1].musicalPositionQN||waypoints[j].videoTimeSeconds<=waypoints[j-1].videoTimeSeconds)throw Error('Nonmonotonic score timing');
  sections.push({id,label,videoStartSeconds:ch.start,videoEndSeconds:ch.end,score,tracks:score.tracks.map(t=>({...t,id:id+'-track-'+t.index,trackIndex:t.index})),activeTimeMap:{id:id+'-timing',method:'drag',params:{},waypoints},metronomeAnchorSeconds:null});
 }
 const questions=exercises.find(e=>e.classId===l.id).questions.map((q,i)=>({id:q.id,class_item_id:l.id+'-exercise',order_index:i,question:q.prompt,question_es:q.prompt,question_type:q.type||'multiple_choice',options:{...(q.type==='audio_choice'?{optionMode:'text'}:{}),choices:q.choices.map((text,j)=>({id:'choice-'+j,text}))},options_es:null,correct_answer:'choice-'+q.answer,explanation:q.explanation,explanation_es:q.explanation,audio_url:q.audioUrl||null,image_url:null,created_at:null,updated_at:null}));
 const data={classId:l.id,title:l.title,videoUrl:`/local-course-assets/solfeo/films/${l.id}.mp4`,posterUrl:`/local-course-assets/solfeo/films/${l.id}.png`,duration:manifest.duration,sections,questions,nextHref:catalog[lessonIndex+1]?`/solfeo-preview?class=${catalog[lessonIndex+1].id}`:null};
 fs.writeFileSync(`${staged}/${l.id}.json`,JSON.stringify(data,null,2));count++;
 }catch(e){errors.push({classId:l.id,error:e.message})}
}
fs.writeFileSync(`${prod}/staging-report.json`,JSON.stringify({count,errors},null,2));console.log({count,errors});
