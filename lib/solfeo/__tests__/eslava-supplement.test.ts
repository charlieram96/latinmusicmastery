import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'))
const book=read('local-artifacts/solfeo-course/book-audit/local-solfeo-m02-c05.json')
const pages=book.pages.filter((p:any)=>p.supplementId==='supplement-20261008-redonda-blanca')
const diagrams=pages.flatMap((p:any)=>p.blocks.filter((b:any)=>b.vector))
const source=read('local-artifacts/solfeo-course/references/eslava/lessons-1-6.json')
it('installs all six original numbered exercises with their notes, rests and ties',()=>{
 expect(book.practice.some((p:any)=>p.supplementId==='supplement-20261008-redonda-blanca')).toBe(false)
 expect(pages).toHaveLength(3)
 expect(diagrams).toHaveLength(6)
 source.lessons.forEach((lesson:any,i:number)=>{
  const block=diagrams[i]
  expect(block.rows.map((r:any)=>r.bars)).toEqual(lesson.systems.map((r:any)=>r.bars))
  expect(block.rows.map((r:any)=>r.ties??[])).toEqual(lesson.systems.map((r:any)=>r.ties??[]))
  for(const row of block.rows){expect(row.meter).toBe('2/2');for(const bar of row.bars)expect(bar.reduce((n:number,e:any)=>n+4/e.dur,0)).toBe(4)}
  const v=book.vectors[block.vector];expect(v.svg).not.toContain('<image');expect(v.audio.events.length).toBeGreaterThan(0)
 })
})
it('preserves the repeated high C, silent opening, and sustained final three whole notes',()=>{
 const audio=(i:number)=>book.vectors[diagrams[i].vector].audio
 expect(audio(0).events.map((e:any)=>e.pitch)).toEqual('C4 D4 E4 F4 G4 A4 B4 C5 C5 B4 A4 G4 F4 E4 D4 C4'.split(' '))
 expect(audio(1).events[0].start).toBeCloseTo(2.4)
 const end=audio(5);expect(end.events.at(-1).pitch).toBe('C4');expect(end.events.at(-1).duration).toBeGreaterThan(7)
 expect(end.pulses[0].beatsPerBar).toBe(2)
})
