// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { parseMusicXmlString } from '@/lib/playsense-studio/parsers/musicxml'
import { lessonNote } from '../notes'

const cataloguePath=path.resolve('local-artifacts/solfeo-course/production/curriculum.json')
type SourceEvent={pitch?:string;rest?:boolean;chord?:boolean;staff:number;durationBeats:string}
type Ref={id:string;musicxml:string;score:{events:SourceEvent[]}}
const catalogue=existsSync(cataloguePath)?JSON.parse(readFileSync(cataloguePath,'utf8')) as {lessons:{scores:Ref[]}[]}:null
const refs=[...new Map(catalogue?.lessons.flatMap(l=>l.scores).map(s=>[s.id,s])??[]).values()]
const rational=(s:string)=>{const [n,d=1]=s.split('/').map(Number);return n/d}
it.skipIf(!catalogue)('preserves every authored pitch and staff duration through the real PlaySense importer',()=>{
 expect(refs.length).toBeGreaterThan(800)
 const failures:string[]=[]
 for(const ref of refs){
  try {
   const imported=parseMusicXmlString(readFileSync(path.resolve(ref.musicxml),'utf8'))
   const pitches=imported.tracks.flatMap(t=>t.measures.flatMap(m=>m.voices.flatMap(v=>v.events.flatMap(e=>e.kind==='note'?[e.midi]:e.kind==='chord'?e.notes.map(n=>n.midi):[])))).sort((a,b)=>a-b)
   const expected=ref.score.events.filter(e=>!e.rest&&e.pitch).map(e=>lessonNote(e.pitch!).midi).sort((a,b)=>a-b)
   expect(pitches,ref.id).toEqual(expected)
   for(let staff=1;staff<=imported.tracks.length;staff++){
    const source=ref.score.events.filter(e=>e.staff===staff&&!e.chord).reduce((n,e)=>n+rational(e.durationBeats),0)
    const actual=imported.tracks[staff-1].measures.reduce((n,m)=>n+Math.max(...m.voices.map(v=>v.events.reduce((n,e)=>n+e.durationQN,0))),0)
    expect(actual,`${ref.id} staff ${staff}`).toBeCloseTo(source,7)
   }
  }catch(e){failures.push(`${ref.id}: ${e instanceof Error?e.message:String(e)}`)}
 }
 expect(failures).toEqual([])
},120000)
