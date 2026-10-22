// Deterministic pedagogical realizations. Ornament convention: principal-start
// trill, lower mordent, upper/principal/lower/principal turn. See music21
// expressions documentation; these examples are modern, not Baroque editions.
const {get,fromMidi}=require('@tonaljs/note');
function neighbor(pitch,step,key=0){
 const p=get(pitch);if(p.empty)throw Error('Invalid ornament pitch');
 const letters='CDEFGAB',i=letters.indexOf(p.letter),j=i+step;
 const letter=letters[(j+7)%7],oct=p.oct+Math.floor(j/7);
 const accidental=key>0&&'FCGDAEB'.slice(0,key).includes(letter)?'#':key<0&&'BEADGCF'.slice(0,-key).includes(letter)?'b':'';
 return letter+accidental+oct;
}
function tempo(text,fallback=96){const m=String(text||'').match(/(negra(?: con puntillo)?|corchea|blanca)\s*=\s*(\d+)/i);return m?Number(m[2])*(m[1].includes('puntillo')?1.5:m[1]==='corchea'?.5:m[1]==='blanca'?2:1):fallback}
function diagramSound(b,options={}){
 if(b.kind==='grand'||b.kind==='grand-study'){
  const row=(notes)=>({events:notes.map(pitch=>({pitch,dur:b.dur||1})),...(b.meter?{meter:'4/4'}:{})});
  const upper=b.upperRow||row(b.upper),lower=b.lowerRow||row(b.lower);
  const shared={...options,bpm:tempo(upper.tempo,options.bpm??96)};const a=diagramSound({kind:'score',rows:[upper]},shared),z=diagramSound({kind:'score',rows:[lower]},shared);
  const upperCount=(upper.events||upper.bars.flat()).filter(e=>!e.rest).reduce((n,e)=>n+1+(e.chordPitches?.length||0),0);
  a.events.forEach(e=>e.visualIndex=b.kind==='grand'?e.visualIndex*2:e.visualIndex);
  z.events.forEach(e=>e.visualIndex=b.kind==='grand'?e.visualIndex*2+1:e.visualIndex+upperCount);
  return {...a,events:[...a.events,...z.events].sort((a,b)=>a.start-b.start),length:Math.max(a.length,z.length)};
 }
 if(['interval-walks','interval-atlas-paths','harmonic-thirds','thirds-map','navigation','enharmonic-keyboard'].includes(b.kind)&&options.positions?.length){
  const points=options.positions;let order=points.map((_,i)=>i),events=[];
  if(b.kind==='navigation')order=b.mode==='endings'?[0,1,2,0,1,3]:/Fine/.test(b.mode)?[0,1,2,3,0,1]:/Coda/.test(b.mode)?[0,1,2,0,1,3]:order;
  const referenceBpm=options.bpm||100,beat=60/referenceBpm;let at=1,lastX=null;
  for(const [j,index] of order.entries()){
   const p=points[index];if(b.kind==='harmonic-thirds'){if(lastX!==null&&Math.abs(lastX-p.x)>1e-5)at+=beat;lastX=p.x}else at=1+j*beat;
   events.push({pitch:p.pitch.replace('n',''),start:at,duration:beat*.92,gain:.17,visualIndex:index});
  }
  return {events,length:at+beat+1,timing:[],bpm:referenceBpm};
 }
 const events=[],timing=[],pulses=[],stops=[];let musicalQN=0;let position=0,visualOffset=0,barBounds=[],bpm=options.bpm||(b.rows?.[0]?.meter?96:100);
 if(b.kind!=='score')return {events,length:8,bpm};
 for(const row of b.rows){
  if(!options.traversalResolved&&(row.nav||[]).some(n=>n.symbol||/D\.[CS]\.|Coda|Fine/i.test(n.text||'')))throw Error('Navigation needs complete-score traversal');
  bpm=tempo(row.tempo,bpm);let activeTempo=bpm;
  const raw=row.events||row.bars.flat(),barIndices=[];
  (row.bars||[raw]).forEach((bar,i)=>bar.forEach(()=>barIndices.push(i)));
  const starts=[],lengths=[],visuals=[];let cursor=position;
  for(let i=0;i<raw.length;i++){
   const e=raw[i];
   if(i===0||barIndices[i]!==barIndices[i-1])for(const nav of row.nav||[])if(nav.bar===barIndices[i])activeTempo=tempo(nav.text,activeTempo);
   const factor=2-2**-(e.dots||(e.dot?1:0));
   const ratio=e.tuplet||(row.tuplet?row.tuplet.split(':').map(Number):[1,1]);
   let performedTempo=activeTempo;
   for(const span of row.spans||[]){if(i>=(span.from??0)&&i<=(span.to??raw.length-1)&&/rit|rall|accel/.test(span.text||'')){const from=span.from??0,to=span.to??raw.length-1,progress=(i-from)/Math.max(1,to-from);performedTempo*=1+(/rit|rall/.test(span.text)?-.2:.2)*progress}}
   let seconds=(e.measureRest?Number(e.value):4/(e.dur||1))*factor*ratio[1]/ratio[0]*60/performedTempo;
   if(e.mark==='fermata')seconds+=60/performedTempo;
   if(!(seconds>0))throw Error('Invalid note duration');
   timing.push({qn:musicalQN,seconds:cursor,bar:barIndices[i]});musicalQN+=(e.measureRest?Number(e.value):4/(e.dur||1))*factor*ratio[1]/ratio[0];starts.push(cursor);lengths.push(seconds);const bi=barIndices[i];if(!barBounds[bi])barBounds[bi]=[cursor,cursor];cursor+=seconds;barBounds[bi][1]=cursor;
   visuals.push(visualOffset);
   if(!e.rest)visualOffset+=1+(e.chordPitches?.length||0);
  }
  const [mn,md]=String(row.meter||'4/4').split('/').map(Number),compound=mn>3&&mn%3===0&&md===8;
  const beatsPerBar=compound?mn/3:mn||4,unit=4/(md||4)*(compound?3:1);
  let qn=0,beatIndex=0;
  for(let i=0;i<raw.length;i++){
   const e=raw[i],factor=2-2**-(e.dots||(e.dot?1:0)),ratio=e.tuplet||(row.tuplet?row.tuplet.split(':').map(Number):[1,1]);
   const length=(e.measureRest?Number(e.value):4/(e.dur||1))*factor*ratio[1]/ratio[0];
   if(i===0||barIndices[i]!==barIndices[i-1]){qn=0;beatIndex=0}
   while(beatIndex*unit<qn+length-1e-8){const offset=Math.max(0,beatIndex*unit-qn);pulses.push({start:starts[i]+offset/length*lengths[i],beat:beatIndex%beatsPerBar+1,beatsPerBar,beatSeconds:unit/length*lengths[i],bar:barIndices[i]});beatIndex++}
   qn+=length;
  }
  let dynamic=.17;
  for(let i=0;i<raw.length;i++){
   const e=raw[i];if(e.dynamic)dynamic=({ppp:.035,pp:.05,p:.075,mp:.12,mf:.17,f:.23,ff:.30,fff:.36,sfz:.3,fp:.22})[e.dynamic]??dynamic;
   if(e.rest||(row.ties||[]).some(pair=>pair[1]===i))continue;
   let end=i;const visited=new Set();
   while((row.ties||[]).some(pair=>pair[0]===end)){
    if(visited.has(end))throw Error('Cyclic tie');visited.add(end);
    const target=row.ties.find(pair=>pair[0]===end)[1];
    if(get(raw[target].pitch).midi!==get(e.pitch).midi)throw Error('Tie changes pitch');end=target;
   }
   let gain=dynamic;
   for(const w of [...(row.wedges||[]),...(row.hairpin?[{from:row.hairpinFrom??0,to:row.hairpinTo??raw.length-1,type:row.hairpin==='cresc'?'crescendo':'diminuendo'}]:[])])if(i>=w.from&&i<=w.to){const t=(i-w.from)/Math.max(1,w.to-w.from);gain=w.type==='crescendo'?.07+.2*t:.27-.2*t}
   if(['accent','marcato'].includes(e.mark))gain*=1.2;
   const octave=(row.spans||[]).filter(s=>i>=(s.from??0)&&i<=(s.to??raw.length-1)).reduce((n,s)=>n+(s.text==='8va'?1:['8vb','8va bassa'].includes(s.text)?-1:0),0);
   const total=starts[end]+lengths[end]-starts[i];
   const push=(pitch,start,duration,visualIndex=visuals[i])=>events.push({pitch,soundPitch:octave?pitch.replace(/(-?\d+)$/,n=>String(Number(n)+octave)):pitch,start,duration,gain,visualIndex,bar:barIndices[i]});
   let pitches;
   if(e.mark==='tr')pitches=Array.from({length:Math.max(4,Math.round(total/.12))},(_,j)=>j%2?neighbor(e.pitch,1,row.key):e.pitch);
   if(e.mark==='turn')pitches=[neighbor(e.pitch,1,row.key),e.pitch,neighbor(e.pitch,-1,row.key),e.pitch];
   if(e.mark==='mordent')pitches=[e.pitch,neighbor(e.pitch,-1,row.key),e.pitch];
   if(pitches){let at=starts[i];pitches.forEach((p,j)=>{const d=e.mark==='mordent'?(j<2?Math.min(.1,total/4):total-2*Math.min(.1,total/4)):total/pitches.length;push(p,at,d*.96);at+=d});continue}
   if(e.grace){const d=e.grace.slash?Math.min(.09,total/6):total/2;push(e.grace.pitch,starts[i],d*.96,visuals[i]);push(e.pitch,starts[i]+d,(total-d)*.96);continue}
   const gliss=(row.gliss||[]).find(pair=>pair[0]===i);
   if(gliss){const a=get(e.pitch).midi,z=get(raw[gliss[1]].pitch).midi,step=Math.sign(z-a),count=Math.abs(z-a);if(!count)throw Error('Empty glissando');for(let j=0;j<count;j++)push(fromMidi(a+step*j),starts[i]+j*total/count,total/count*.96);continue}
   [e.pitch,...(e.chordPitches||[])].forEach((pitch,j)=>push(pitch,starts[i],total*(e.mark==='staccato'?.45:end!==i||e.mark==='tenuto'||(row.slurs||[]).some(([a,z])=>i>=a&&i<z)?.99:.92),visuals[i]+j));
  }
  timing.push({qn:musicalQN,seconds:cursor,bar:barIndices.at(-1)});position=cursor;
  const endStyle=row.barStyles?.[(row.bars?.length??1)-1];
  if(!endStyle||['double','final'].includes(endStyle))stops.push(cursor);
 }
 if(options.range){
  const [from,to]=options.range;
  const bounds=barBounds;
  const offset=bounds[from][0]-1,length=bounds[to][1]-offset+1;
  return {events:events.filter(e=>e.bar>=from&&e.bar<=to).map(e=>({...e,start:e.start-offset})),length,bpm,timing:timing.filter(p=>p.seconds>=bounds[from][0]&&p.seconds<=bounds[to][1]).map(p=>({...p,seconds:p.seconds-offset}))};
 }
 return {events,length:position,bpm,timing,pulses,stops};
}
module.exports={diagramSound,neighbor,tempo};
