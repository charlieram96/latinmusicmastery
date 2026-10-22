const fs=require('node:fs'),path=require('node:path');
const {diagramSound,tempo}=require('./score-audio.cjs');
const {traverse}=require('./repertoire-traversal.cjs');
const {get}=require('@tonaljs/note');
const dir=path.resolve('local-artifacts/solfeo-course/book-audit');
function sound(block,vector){
 if(block.kind==='stair')vector.notes=['C4','D4','E4','F4','G4','A4','B4','C5'].map((pitch,i)=>({pitch,x:86+i*60,y:190-[0,2,4,5,7,9,11,12][i]*10,dur:4}));
 if(block.kind==='conduct'){
  const center=297.64,coords={2:[[center,197],[center,72]],3:[[center,197],[center+100,142],[center,72]],4:[[center,197],[center-105,142],[center+105,142],[center,72]]}[block.count];
  vector.notes=coords.map(([x,y],i)=>({pitch:'C4',x,y,dur:4,label:'Pulso '+(i+1)}));
  return {bpm:100,duration:block.count*.6,events:coords.map((_,i)=>({frequency:i===0?1400:1000,start:i*.6,duration:.05,gain:.09,visualIndex:i,pitch:i===0?'click-accent':'click'}))};
 }
 if(block.kind==='unit-grid'){
  const width=(515.28-125)/3;vector.notes=[];
  block.columns.forEach((col,j)=>col.cells.forEach((cell,i)=>{const start=40+125+j*width+12,end=40+125+(j+1)*width-9;for(let k=0;k<cell.count;k++)vector.notes.push({pitch:'C4',x:cell.count>1?start+9+k*(end-start-18)/(cell.count-1):(start+end)/2-4,y:84+i*76,dur:cell.dur,beats:4/cell.dur*(cell.dot?1.5:1)})}));
 }

 let result;
 if(block.kind==='score'&&block.rows.every(r=>r.bars)&&block.rows.some(r=>Object.keys(r.barStyles||{}).some(k=>String(r.barStyles[k]).includes('repeat'))||r.endings?.length||r.nav?.length)){
  const rows=block.rows.map(r=>diagramSound({kind:'score',rows:[r]},{traversalResolved:true,bpm:100}));
  const offsets=[];let offset=0;for(const r of block.rows){offsets.push(offset);offset+=r.bars.flat().reduce((n,e)=>n+(e.rest?0:1+(e.chordPitches?.length||0)),0)}
  let cursor=0;const events=[],pulses=[],stops=[];
  for(const visit of traverse(block.rows)){
   const original=rows[visit.rowIndex];const ticks=original.timing.filter(t=>t.bar===visit.barIndex);const start=ticks[0]?.seconds;
   const next=original.timing.find(t=>t.bar>visit.barIndex)?.seconds??original.timing.at(-1)?.seconds;
   if(start===undefined||next===undefined||next<=start)throw Error('Invalid bar timing');
   for(const e of original.events.filter(e=>e.bar===visit.barIndex))events.push({...e,start:cursor+e.start-start,visualIndex:e.visualIndex+offsets[visit.rowIndex]});
   pulses.push(...(original.pulses||[]).filter(p=>p.bar===visit.barIndex).map(p=>({...p,start:cursor+p.start-start})));
   cursor+=next-start;
   const row=block.rows[visit.rowIndex],style=row.barStyles?.[visit.barIndex];
   if(visit.barIndex===row.bars.length-1&&(!style||['double','final'].includes(style)))stops.push(cursor);
  }
  result={events,pulses,stops,length:cursor,bpm:rows[0]?.bpm??100};
 }else result=diagramSound(block,{positions:vector.notes,bpm:100,traversalResolved:true});
 if(!result.events.length&&vector.notes.length){let at=0;result={bpm:100,events:vector.notes.map((n,visualIndex)=>{const duration=(n.beats??4/n.dur)*.6,e={pitch:n.pitch,start:at,duration:duration*.92,gain:.17,visualIndex};at+=duration;return e}),length:at};}
 if(block.kind==='unit-grid'){
  let start=0;result.pulses=[];
  for(const col of block.columns){const [n,d]=col.meter.split('/').map(Number),seconds=4/d*60/result.bpm;for(const cell of col.cells){for(let beat=0;beat<n;beat++)result.pulses.push({start:start+beat*seconds,beat:beat+1,beatsPerBar:n,beatSeconds:seconds});start+=n*seconds}}
 }
 const first=Math.min(...result.events.map(e=>e.start),0);
 const events=result.events.map(e=>{const pitch=(e.soundPitch||e.pitch).replace(/n(?=-?\d+$)/,'');const frequency=get(pitch).freq;if(!frequency)throw Error('Invalid pitch '+pitch);return {frequency,start:e.start-first,duration:e.duration,gain:e.gain,visualIndex:e.visualIndex,pitch}});
 return {events,stops:result.stops?.map(t=>t-first),pulses:result.pulses?.map(p=>({...p,start:p.start-first})),duration:Math.max(result.length-first,...events.map(e=>e.start+e.duration)),bpm:result.bpm||100};
}
let count=0,notes=0;const failures=[];
for(const l of JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')))){
 const file=path.join(dir,l.id+'.json'),book=JSON.parse(fs.readFileSync(file));
 const blocks=[...new Map([...book.pages,...book.practice].flatMap(p=>p.blocks).filter(b=>b.vector).map(b=>[b.vector,b])).values()];
 const family=b=>b._sourcePage?.replace(/^(repertorio-\d+)-\d+$/,'$1').replace(/^(lectura-conjunta-retornos|danza-conjunto)-\d+$/,'$1');
 const families=new Map();for(const b of blocks){const k=family(b);if(!families.has(k))families.set(k,[]);families.get(k).push(b)}
 const combined=new Map();
 for(const members of families.values()){
  const rows=members.flatMap(b=>b.kind==='score'?b.rows:b.kind==='grand-study'?[b.upperRow]:[]);
  if(!rows.length||!rows.every(r=>r.bars)||!(/^(repertorio-|danza-conjunto|lectura-conjunta-retornos)/.test(family(members[0]))||rows.some(r=>r.nav?.length||r.endings?.length||Object.values(r.barStyles||{}).some(s=>String(s).includes('repeat')))))continue;
  try{
   const refs=members.flatMap(b=>b.kind==='score'?b.rows.map(r=>({b,r})):b.kind==='grand-study'?[{b,r:b.upperRow}]:[]);
   let inheritedBpm=100;const rowAudio=refs.map(({b,r})=>{const opts={bpm:inheritedBpm,traversalResolved:true};const audio=b.kind==='grand-study'?diagramSound(b,opts):diagramSound({kind:'score',rows:[r]},opts);inheritedBpm=tempo(r.tempo,inheritedBpm);for(const n of r.nav||[])inheritedBpm=tempo(n.text,inheritedBpm);return audio});
   const offsetByVector=new Map();const offsets=refs.map(({b,r})=>{const n=offsetByVector.get(b.vector)||0;offsetByVector.set(b.vector,n+(r.events||r.bars.flat()).reduce((s,e)=>s+(e.rest?0:1+(e.chordPitches?.length||0)),0));return n});
   let cursor=0;const events=[],pulses=[],stops=[];
   for(const v of traverse(rows)){
    const a=rowAudio[v.rowIndex],times=a.timing.filter(t=>t.bar===v.barIndex),start=times[0]?.seconds,end=a.timing.find(t=>t.bar>v.barIndex)?.seconds??a.timing.at(-1)?.seconds;
    if(!(end>start))throw Error('Missing navigation timing');
    for(const e of a.events.filter(e=>e.bar===v.barIndex)){const pitch=(e.soundPitch||e.pitch).replace(/n(?=-?\d+$)/,'');events.push({frequency:get(pitch).freq,pitch,start:cursor+e.start-start,duration:e.duration,gain:e.gain,visualIndex:e.visualIndex+offsets[v.rowIndex],vectorId:refs[v.rowIndex].b.vector})}
    pulses.push(...(a.pulses||[]).filter(p=>p.bar===v.barIndex).map(p=>({...p,start:cursor+p.start-start})));
    cursor+=end-start;
    const row=rows[v.rowIndex],style=row.barStyles?.[v.barIndex];
    if(v.barIndex===row.bars.length-1&&(!style||['double','final'].includes(style)))stops.push(cursor);
   }
   const audio={events,pulses,stops,duration:Math.max(cursor,...events.map(e=>e.start+e.duration)),bpm:rowAudio[0].bpm,completeScore:true};
   for(const b of members)combined.set(b.vector,audio);
  }catch(e){failures.push({classId:l.id,family:family(members[0]),error:e.message})}
 }
 for(const b of blocks){delete book.vectors[b.vector].audio}
 for(const b of blocks)if(b.vector&&!book.vectors[b.vector].audio){try{const v=book.vectors[b.vector];v.audio=combined.get(b.vector)||sound(b,v);count++;notes+=v.audio.events.length}catch(e){failures.push({classId:l.id,page:b.pdfPage,kind:b.kind,error:e.message})}}
 fs.writeFileSync(file,JSON.stringify(book)+'\n');
}
fs.writeFileSync(path.join(dir,'audio-compilation.json'),JSON.stringify({count,notes,failures},null,2));console.log({count,notes,failures:failures.length});if(failures.length)console.log(failures.slice(0,15));

// The first module uses bundled vectors, but follows the same audio boundaries.
const bundledFile=path.resolve('lib/solfeo/module-one-book.json'),bundled=JSON.parse(fs.readFileSync(bundledFile));
for(const lesson of bundled.lessons)for(const page of [...lesson.pages,...lesson.practice])for(const block of page.blocks)if(block.kind==='score'&&block.vector)bundled.vectors[block.vector].audio=sound(block,bundled.vectors[block.vector]);
fs.writeFileSync(bundledFile,JSON.stringify(bundled)+'\n');
