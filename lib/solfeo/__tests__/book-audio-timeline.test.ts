import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {bookAudioTimeline} from '../book-audio-timeline'
it('starts the actual B4 example on beat one after exactly one 4/4 count-in at multiple tempos',()=>{
 const book=JSON.parse(readFileSync('local-artifacts/solfeo-course/book-audit/local-solfeo-m02-c03.json','utf8'))
 const source=book.vectors.bdc66a394dc3167a.audio
 for(const bpm of [60,100,160]){
  const {score,precount,origin,clicks}=bookAudioTimeline(source,bpm)
  expect(score.events[0].pitch).toBe('B4')
  expect(clicks.filter(c=>c.count>0)).toHaveLength(4)
  expect(precount).toBeCloseTo(4*60/bpm)
  expect(score.events[0].start+precount-origin).toBeCloseTo(clicks[4].start)
  expect(clicks[4].beat).toBe(1)
  for(const event of score.events){
   const at=event.start+precount-origin
   const preceding=clicks.findLast(c=>c.start<=at+1e-8)!
   const delta=(at-preceding.start)/(60/bpm)
   expect(Math.min(Math.abs(delta),Math.abs(delta-.5))).toBeLessThan(1e-7)
  }
  expect(new Set(clicks.filter(c=>!c.count).map(c=>c.beatsPerBar))).toEqual(new Set([4,2,3]))
 }
})

it('isolates the three staves, preserving their meters and complete final durations',async()=>{
 const {bookAudioSections}=await import('../book-audio-timeline')
 const book=JSON.parse(readFileSync('local-artifacts/solfeo-course/book-audit/local-solfeo-m02-c03.json','utf8'))
 const sections=bookAudioSections(book.vectors.bdc66a394dc3167a.audio,'bdc66a394dc3167a')
 expect(sections).toHaveLength(3)
 expect(sections.map(s=>s.pulses![0].beatsPerBar)).toEqual([4,2,3])
 for(const [i,s] of sections.entries()){
  expect(s.duration).toBeCloseTo([7.2,3.6,5.4][i])
  expect(s.events[0].start).toBeCloseTo(0)
  expect(s.events.every(e=>e.start+e.duration<=s.duration+1e-8)).toBe(true)
  const timeline=bookAudioTimeline(s)
  expect(timeline.clicks.filter(c=>c.count>0)).toHaveLength([4,2,3][i])
 }
})
