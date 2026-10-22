import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
const book=JSON.parse(readFileSync('local-artifacts/solfeo-course/book-audit/local-solfeo-m04-c07.json','utf8'))
const pages=book.pages.filter((p:any)=>p.supplementId==='source-sextuplets-20261008')
it('preserves all five source reductions at six notes in the time of four',()=>{
 const d=pages[0].blocks.find((b:any)=>b.vector)
 expect(d.rows).toHaveLength(5)
 d.rows.forEach((r:any,i:number)=>{const notes=r.events.slice(2);expect(notes).toHaveLength(6);expect(notes.every((n:any)=>n.dur===4*2**i)).toBe(true);expect(notes.reduce((v:number,n:any)=>v+4/n.dur*n.tuplet[1]/n.tuplet[0],0)).toBeCloseTo(4/2**i)})
 expect(book.vectors[d.vector].svg).not.toContain('<image')
})
it('retains both beaming alternatives and audible I/III/V versus I/IV accents',()=>{
 const d=pages[1].blocks.find((b:any)=>b.vector),v=book.vectors[d.vector]
 expect(d.rows[4].beams).toEqual([[0,1],[2,3],[4,5]])
 expect(d.rows[5].beams).toEqual([[0,1,2],[3,4,5]])
 expect(d.rows[6].beams).toEqual([[0,1,2,3,4,5]])
 expect(d.rows[7].tupletGroups.map((g:any)=>g.indices)).toEqual([[0,1,2],[3,4,5]])
 let start=0
 d.rows.forEach((r:any,i:number)=>{const sounds=v.audio.events.slice(start,start+r.events.length);start+=r.events.length;if(i>=4){expect(sounds.map((e:any,j:number)=>e.gain>.17?j+1:0).filter(Boolean)).toEqual(i%2===0?[1,3,5]:[1,4,0].filter(Boolean));expect(v.audio.stops[i]-(v.audio.stops[i-1]??0)).toBeCloseTo(.6)}})
 expect(v.audio.stops).toHaveLength(8)
})
