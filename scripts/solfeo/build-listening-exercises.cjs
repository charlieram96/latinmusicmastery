// Audio-first dictation: no answer score or pitch sequence before submission.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {diagramSound}=require('./score-audio.cjs'),{writeWave}=require('./write-wave.cjs');
const prod='local-artifacts/solfeo-course/production',catalog=JSON.parse(fs.readFileSync(`${prod}/curriculum.json`)).lessons;
const drafts=JSON.parse(fs.readFileSync(`${prod}/exercises.json`));
const folder='public/local-course-assets/solfeo/exercise-audio';fs.mkdirSync(folder,{recursive:true});
const names={C:'Do',D:'Re',E:'Mi',F:'Fa',G:'Sol',A:'La',B:'Si'};
const name=p=>p.replace(/^([A-G])([#b]*)(-?\d+)$/,(_,n,a,o)=>`${names[n]}${({'#':'♯','##':'𝄪',b:'♭',bb:'𝄫'}[a]||'')}${o}`);
const rhythm=e=>`${e.rest?'silencio de ':''}${({1:'redonda',2:'blanca',4:'negra',8:'corchea',16:'semicorchea',32:'fusa'})[e.dur]}${e.dot?' con puntillo':''}${e.tuplet?` (${e.tuplet[0]}:${e.tuplet[1]})`:''}`;
for(const lesson of catalog.filter(l=>l.module===12&&l.number>=2&&l.number<=7)){
 const row=lesson.scores[0].score.notation,clip=diagramSound({kind:'score',rows:[row]});
 const [beats,denominator]=row.meter.split('/').map(Number),beat=60/clip.bpm*4/denominator,offset=beats*beat-1;
 const events=clip.events.map(e=>({...e,start:e.start+offset}));
 const end=clip.timing.at(-1).seconds+offset;
 for(let at=0,index=0;at<end-1e-8;at+=beat,index++)events.push({pitch:index%beats===0?'F7':'C7',start:at,duration:.035,gain:.055});
 const file=`${folder}/${lesson.id}-tempo-v1.wav`;writeWave(file,events,clip.length+offset);
 const target=file.replace('.wav','.m4a');execFileSync('/Users/raffymac/bin/ffmpeg',['-y','-i',file,'-c:a','aac','-b:a','128k',target],{stdio:'ignore'});fs.unlinkSync(file);
 const pitchSequences=row.bars.map(b=>b.map(e=>e.rest?'Silencio':name(e.pitch)).join(' – '));
 const rhythms=row.bars.map(b=>b.map(rhythm).join(' + '));
 const questions=[];
 for(let i=0;i<row.bars.length;i++){
  const mode=i%2===0?'pitch':'rhythm',answer=(mode==='pitch'?pitchSequences:rhythms)[i];
  const distractors=[...(mode==='pitch'?pitchSequences:rhythms).filter(x=>x!==answer)];
  const extras=mode==='pitch'?['Fa4 – La4 – Do5 – Mi5','Sol4 – Fa4 – Mi4 – Re4']:['cuatro semicorcheas','silencio de blanca'];
  const unique=[...new Set([answer,...distractors,...extras])].slice(0,3),shift=i%unique.length,choices=unique.slice(shift).concat(unique.slice(0,shift));
  questions.push({id:`${lesson.id}-exercise-listen-${i+1}`,type:'audio_choice',audioUrl:`/local-course-assets/solfeo/exercise-audio/${lesson.id}-tempo-v1.m4a`,prompt:`Escucha el dictado en ${row.meter}, negra = ${clip.bpm} BPM, con un compás de precuenta. La primera nota es ${name(row.bars.flat().find(e=>!e.rest).pitch)}. ¿${mode==='pitch'?'Qué secuencia de notas y silencios':'Qué secuencia rítmica'} corresponde al compás ${i+1}?`,choices,answer:choices.indexOf(answer),explanation:`Compás ${i+1}: ${pitchSequences[i]}. Ritmo: ${rhythms[i]}.`});
 }
 const draft=drafts.lessons.find(l=>l.classId===lesson.id);draft.questions=questions;draft.audioFirst=true;
}
fs.writeFileSync(`${prod}/exercises.json`,JSON.stringify(drafts,null,2));console.log('6 audio-first dictations prepared; solutions only in graded explanations');
