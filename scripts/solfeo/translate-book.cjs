// Regenerates editable authored English strings; never translates notation IDs or pitches.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
const Anthropic=require('@anthropic-ai/sdk');
const output='lib/solfeo/book-en.json', set=new Set();
function add(s){if(typeof s==='string'&&/[A-Za-zÁÉÍÓÚáéíóúñ]/.test(s))set.add(s.trim())}
function svg(s){for(const m of s.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g))add(m[1]);}
function visit(value,key=''){
 if(typeof value==='string'){if(['text','title','label','question','explanation','left','right'].includes(key))add(value);if(key==='svg')svg(value);return}
 if(Array.isArray(value))value.forEach(v=>visit(v,key));else if(value)Object.entries(value).forEach(([k,v])=>visit(v,k));
}
visit(JSON.parse(fs.readFileSync('lib/solfeo/module-one-book.json','utf8')));
for(const f of fs.readdirSync('local-artifacts/solfeo-course/book-audit').filter(f=>/^local-solfeo-m\d+-c\d+\.json$/.test(f)))visit(JSON.parse(fs.readFileSync(path.join('local-artifacts/solfeo-course/book-audit',f),'utf8')));
const components=['manual-book-page.tsx','manual-values-table.tsx','manual-writing-staff.tsx','treble-clef-writing.tsx','staff-lines-practice.tsx','first-document-lesson.tsx'];
for(const name of [...components.map(f=>'components/solfeo/'+f),'lib/solfeo/module-one-assessment.ts']){
 const source=ts.createSourceFile(name,fs.readFileSync(name,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function walk(n){if(ts.isJsxText(n))add(n.text);else if(ts.isStringLiteral(n)&&(/[áéíóúñ¿¡]/i.test(n.text)||(/^[A-ZÁÉÍÓÚ]/.test(n.text)&&!/[\/{}<>]|className/.test(n.text))))add(n.text);ts.forEachChild(n,walk)}walk(source)
}
let dict=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{};
fs.writeFileSync('/tmp/lmm-book-source-strings.json',JSON.stringify([...set],null,2));
if(process.argv.includes('--extract')){console.log({strings:set.size,characters:[...set].join('').length});process.exit()}
const pending=[...set].filter(s=>!(s in dict));
const batches=[];let batch=[],size=0;
for(const s of pending){if(size+s.length>5500&&batch.length){batches.push(batch);batch=[];size=0}batch.push(s);size+=s.length}if(batch.length)batches.push(batch);
const client=new Anthropic({maxRetries:2,...(process.env.ANTHROPIC_WORKSPACE_ID?{defaultHeaders:{'anthropic-workspace-id':process.env.ANTHROPIC_WORKSPACE_ID}}:{})});
async function run(strings,index){
 const response=await client.messages.create({model:'claude-sonnet-4-6',max_tokens:12000,system:'Translate a Spanish music-reading textbook into accurate, clear American English. Return ONLY a JSON array of translated strings in EXACT input order, same length. Preserve all HTML tags and attributes exactly; never add tags. Do not summarize or omit sentences. Preserve Latin hymn quotations (Ut queant laxis etc), personal names, URLs, numeric values, note octave numbers. For pedagogical solfege keep Do Re Mi Fa Sol La Si syllables when discussing names/hymn; do not turn lowercase Spanish do/re into English verbs. Translate musical terms correctly: redonda=whole note, blanca=half note, negra=quarter note, corchea=eighth note, semicorchea=sixteenth note, fusa=thirty-second note, semifusa=sixty-fourth note, garrapatea=128th note, semigarrapatea=256th note; silencio=rest; plica=stem; corchete=flag; pentagrama=staff; compás=measure or time signature according to context; sostenido=sharp; bemol=flat; becuadro=natural; puntillo=augmentation dot; clave de Sol=treble clef; primera/segunda casilla=first/second ending. Keep input that is already English or code/identifier unchanged.',messages:[{role:'user',content:JSON.stringify(strings)}]});
 const raw=response.content.filter(c=>c.type==='text').map(c=>c.text).join('').replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');const translated=JSON.parse(raw);
 if(!Array.isArray(translated)||translated.length!==strings.length||translated.some(s=>typeof s!=='string'))throw Error('Translation count mismatch: batch '+index);
 strings.forEach((s,i)=>dict[s]=translated[i]);fs.writeFileSync(output,JSON.stringify(dict,null,2)+'\n');console.log(`Batch ${index+1}/${batches.length}; ${Object.keys(dict).length} strings saved`);
}
(async()=>{for(let i=0;i<batches.length;i+=3)await Promise.all(batches.slice(i,i+3).map((b,j)=>run(b,i+j)));console.log('Translation complete')})().catch(e=>{console.error('Translation failed:',e.status??'',e.message?.slice(0,200));process.exitCode=1});
