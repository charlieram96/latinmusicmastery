// Independent pitch audit: Tonal versus scientific-pitch MIDI arithmetic.
const fs=require('node:fs'),path=require('node:path'),{get}=require('@tonaljs/note');
const dir=path.resolve('local-artifacts/solfeo-course/production');
const curriculum=JSON.parse(fs.readFileSync(path.join(dir,'curriculum.json')));
const errors=[],warnings=[];let notes=0,events=0;
const rational=s=>{const [n,d=1]=String(s).split('/').map(Number);return n/d};
const seen=new Set();
for(const lesson of curriculum.lessons){
 if(!lesson.blocks.length)errors.push(`${lesson.id}: missing content`);
 for(const ref of lesson.scores){
  if(seen.has(ref.id))continue;seen.add(ref.id);
  const score=ref.score;
  for(const e of score.events){
   events++;
   if(!(rational(e.durationBeats)>0)||!(rational(e.onsetBeats)>=0))errors.push(`${ref.id}/${e.id}: invalid timing`);
   if(e.rest)continue;
   for(const name of [e.pitch,...(e.grace?[e.grace.pitch]:[])]){
    notes++;
    const match=/^([A-G])([#b]*)(-?\d+)$/.exec(name||'');
    if(!match){errors.push(`${ref.id}: unrecognized pitch ${name}`);continue}
    const expected=12*(Number(match[3])+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1]])+[...match[2]].reduce((a,x)=>a+(x==='#'?1:-1),0);
    const tonal=get(name);
    if(tonal.midi!==expected||Math.abs(tonal.freq-440*2**((expected-69)/12))>1e-8)errors.push(`${ref.id}: pitch disagreement ${name}`);
   }
  }
  if(score.meter){
   const [beats,unit]=score.meter.split('/').map(Number),capacity=beats*4/unit;
   const measures=new Map();
   for(const e of score.events){if(e.chord)continue;const k=`${e.staff}:${e.measure}`;measures.set(k,(measures.get(k)||0)+rational(e.durationBeats))}
   for(const [k,d] of measures)if(Math.abs(d-capacity)>1e-8){
    const pickup=score.notation.pickup&&k.endsWith(':1')&&d<capacity;
    if(!pickup)warnings.push({score:ref.id,measure:k,expected:capacity,actual:d});
   }
  }
 }
}
const report={classes:curriculum.lessons.length,uniqueScores:seen.size,events,pitchesChecked:notes,errors,meterReview:warnings};
fs.writeFileSync(path.join(dir,'music-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,errors:errors.length,meterReview:warnings.length},null,2));
if(errors.length)process.exitCode=1;
