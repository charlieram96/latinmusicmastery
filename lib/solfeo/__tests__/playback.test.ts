import { describe, expect, it } from 'vitest'
import { segmentBounds, tickSegment } from '../playback'
describe('theory lesson manual advance', () => {
 it('holds the introduction at its final frame', () => expect(tickSegment(5.9, -1, 12, false)).toEqual({time:6,running:false}))
 it('stops each explanation at its boundary without selecting the next one', () => {
  for(let segment=0;segment<5;segment++) {
   const {end}=segmentBounds(segment,12)
   expect(tickSegment(end-.1,segment,12,false)).toEqual({time:end,running:false})
   expect(tickSegment(end,segment,12,false)).toEqual({time:end,running:false})
  }
 })
 it('loops only the selected explanation when requested', () => expect(tickSegment(29.9,1,12,true)).toEqual({time:18,running:true}))
 it('keeps the practice static even with repeat enabled', () => expect(tickSegment(66,5,12,true)).toEqual({time:66,running:false}))
})
