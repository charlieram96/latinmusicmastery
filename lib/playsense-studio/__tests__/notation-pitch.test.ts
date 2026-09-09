import { describe, expect, it } from 'vitest'
import { extractAccidental, extractTrackEvents } from '../score-to-vexflow'
import { GUITAR_LICK_FIXTURE } from '../score-fixtures'

describe('notation accidentals',()=>{
  it('keeps natural B distinct from B-flat',()=>{
    expect(extractAccidental('b/4')).toBeNull()
    expect(extractAccidental('bb/4')).toBe('b')
    expect(extractAccidental('f#/4')).toBe('#')
    expect(extractAccidental('eb/5')).toBe('b')
  })
  it('renders the natural B in a C-major scale without a flat sign',()=>{
    const events = extractTrackEvents(GUITAR_LICK_FIXTURE.tracks[0],[4,4],0).flatMap(block=>block.events)
    const b = events.find(event=>event.midi === 71)
    expect(b?.keys).toEqual(['b/4'])
    expect(b?.accidentals).toEqual([null])
  })
})
