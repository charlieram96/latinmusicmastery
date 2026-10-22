const fs=require('node:fs'),assert=require('node:assert/strict'),{get}=require('@tonaljs/note');
const dir='local-artifacts/solfeo-course/book-audit/',source=require('../../output/pdf/solfeo-aplicado-ampliado-fuentes/content.es.json');
const moduleOne=require('../../lib/solfeo/module-one-book.json');
const books=JSON.parse(fs.readFileSync(dir+'manifest.json')).map(l=>JSON.parse(fs.readFileSync(dir+l.id+'.json')));
const blocks=[...moduleOne.lessons,...books].flatMap(l=>[...l.pages,...l.practice]).flatMap(p=>p.blocks);
const texts=new Set(blocks.map(b=>b.text));let paragraphs=0,events=0;
for(const p of source.pages)if(!p.id.startsWith('toc-'))for(const b of p.blocks||[])if(['p','small'].includes(b.type)){assert(texts.has(b.text),'Missing source paragraph: '+b.text.slice(0,100));paragraphs++}
const expected=source.pages.flatMap((p,i)=>(p.blocks||[]).map((b,j)=>({b,i,j}))).filter(({b,i})=>i>=24&&b.type==='diagram');
const seen=new Set(books.flatMap(l=>[...l.pages,...l.practice]).flatMap(p=>p.blocks).filter(b=>b.vector).map(b=>b.pdfPage+':'+b.sourceBlock));
for(const {b,i,j} of expected)assert(seen.has((i+1)+':'+j),'Missing source diagram page '+(i+1)+' '+b.kind);
for(const book of books){assert(!JSON.stringify(book.pages).includes('Índice de contenidos'));for(const b of book.pages.flatMap(p=>p.blocks)){assert(b.kind!=='blank','Exercise worksheet leaked into lesson '+book.id);assert(!(b.type==='h'&&['Ejercicios','Práctica','Escritura','Ejercicios de integración'].includes(b.text)),'Exercise heading leaked into lesson '+book.id)}for(const [id,v] of Object.entries(book.vectors)){
 assert(!/<(?:image|iframe|object)\b/.test(v.svg),'Raster diagram '+id);
 for(const n of v.notes)assert(get(n.pitch.replace(/n(?=-?\d+$)/,'')).freq>0,'Invalid written pitch '+n.pitch);
 for(const e of v.audio?.events||[]){assert(e.frequency>0&&Number.isFinite(e.frequency));assert(e.start>=0&&e.duration>0);assert(e.start+e.duration<=v.audio.duration+.001);if(!e.pitch.startsWith('click'))assert(Math.abs(get(e.pitch).freq-e.frequency)<.00001);events++}
}}
for(const [a,b] of [['Dbb4','C4'],['Bbb4','A4'],['E#4','F4'],['Cb4','B3'],['B#4','C5']])assert.equal(get(a).midi,get(b).midi);
const result={classes:books.length,paragraphs,sourceDiagrams:expected.length,scheduledEvents:events,sourceCoverage:'pass',pitchChecks:'pass',noRaster:'pass',visualReview:'in progress'};fs.writeFileSync(dir+'verification.json',JSON.stringify(result,null,2));console.log(result);
