import { describe, expect, it } from 'vitest'
import { exerciseScoreTime, scoreCursorAt, scoreScrollOffset, scoreReadingStops, scoreReadingOffset, scoreVerticalOffset } from '../notation-playback'

const anchors = [{ms:0,x:80,system:0},{ms:500,x:200,system:0},{ms:1000,x:50,system:1},{ms:1500,x:150,system:1}]

describe('notation playback geometry',()=>{
  it('sweeps to the previous row barline, then enters the next row on its downbeat',()=>{
    expect(scoreCursorAt(750,anchors,3000,[320,400])).toEqual({x:260,system:0})
    expect(scoreCursorAt(1000,anchors,3000,[320,400])).toEqual({x:50,system:1})
  })
  it('uses the actual final duration rather than extrapolating beyond the final bar',()=>{
    expect(scoreCursorAt(2250,anchors,3000,[320,400])).toEqual({x:275,system:1})
    expect(scoreCursorAt(9000,anchors,3000,[320,400])).toEqual({x:400,system:1})
    expect(scoreCursorAt(1000,[{ms:0,x:90,system:0}],2000,[330])).toEqual({x:210,system:0})
  })
  it('keeps the opening clef and a complete short phrase visible',()=>{
    expect(scoreScrollOffset(80,1000,2200)).toBe(0)
    expect(scoreScrollOffset(950,1000,900)).toBe(0)
    expect(scoreScrollOffset(1800,1000,2200)).toBe(-1200)
    expect(scoreScrollOffset(800,1000,2200)).toBe(-540)
  })
  it('handles an empty staff and time before playback',()=>{
    expect(scoreCursorAt(400,[],0,[])).toEqual({x:0,system:0})
    expect(scoreCursorAt(-500,anchors,3000,[320,400])).toEqual({x:80,system:0})
  })
})

describe('steady score reading', () => {
  const measures = Array.from({ length: 6 }, (_, i) => ({ x: 16 + i * 300, width: 300, startMs: i * 2000, endMs: (i + 1) * 2000 }))

  it('holds two complete measures still and only turns at the next barline', () => {
    const stops = scoreReadingStops(measures, [], [], 640, 1832)
    expect(stops).toEqual([{ ms: 0, offset: 0 }, { ms: 4000, offset: -600 }, { ms: 8000, offset: -1192 }])
    for (const time of [0, 100, 1500, 2000, 3999]) expect(scoreReadingOffset(time, stops)).toBe(0)
    expect(scoreReadingOffset(4000, stops)).toBe(-600)
    expect(scoreReadingOffset(7999, stops)).toBe(-600)
  })

  it('divides a wide bar at visible beats instead of continuously chasing its notes', () => {
    const wide = [{ x: 16, width: 1200, startMs: 0, endMs: 4000 }]
    const beats = [0, 1, 2, 3].map(i => ({ ms: i * 1000, x: 60 + i * 300 }))
    const stops = scoreReadingStops(wide, beats, beats, 500, 1232)
    expect(stops).toEqual([{ ms: 0, offset: 0 }, { ms: 1000, offset: -344 }, { ms: 2000, offset: -644 }, { ms: 3000, offset: -732 }])
    for (const time of [1000, 1100, 1600, 1999]) expect(scoreReadingOffset(time, stops)).toBe(-344)
    for (const beat of beats) {
      const x = beat.x + scoreReadingOffset(beat.ms, stops)
      expect(x).toBeGreaterThanOrEqual(16)
      expect(x).toBeLessThan(500 - 16)
    }
  })

  it('uses note onsets when a dense single beat exceeds the available width', () => {
    const wide = [{ x: 16, width: 1100, startMs: 0, endMs: 4000 }]
    const notes = Array.from({ length: 8 }, (_, i) => ({ ms: i * 500, x: 60 + i * 140 }))
    const stops = scoreReadingStops(wide, [{ ms: 0, x: 60 }], notes, 390, 1132)
    expect(stops.length).toBeGreaterThan(2)
    expect(stops.every(stop => notes.some(note => note.ms === stop.ms))).toBe(true)
    for (const note of notes) {
      const x = note.x + scoreReadingOffset(note.ms, stops)
      expect(x).toBeGreaterThanOrEqual(16)
      expect(x).toBeLessThan(390 - 16)
    }
  })

  it('recomputes for a narrower pane and restores the correct phrase on seek or repeat', () => {
    const stops = scoreReadingStops(measures, [], [], 340, 1832)
    expect(scoreReadingOffset(1999, stops)).toBe(0)
    expect(scoreReadingOffset(2000, stops)).toBe(-300)
    expect(scoreReadingOffset(10000, stops)).toBe(-1492)
    expect(scoreReadingOffset(0, stops)).toBe(0)
    expect(scoreReadingOffset(3500, stops)).toBe(-300)
    expect(scoreReadingOffset(99999, stops)).toBe(-1492)
  })

  it('keeps short phrases, empty notation, and hidden panes still', () => {
    expect(scoreReadingStops(measures.slice(0, 2), [], [], 800, 632)).toEqual([{ ms: 0, offset: 0 }])
    expect(scoreReadingStops([], [], [], 640, 0)).toEqual([{ ms: 0, offset: 0 }])
    expect(scoreReadingStops(measures, [], [], 0, 1832)).toEqual([{ ms: 0, offset: 0 }])
    expect(scoreReadingOffset(-100, [])).toBe(0)
  })
})

describe('continuous vertical score reading', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ y: 10 + i * 166, startMs: i * 2400, endMs: (i + 1) * 2400 }))
  const offset = (ms: number) => scoreVerticalOffset(ms, rows, 600, 2000)

  it('starts moving before the active row reaches the bottom of the panel', () => {
    expect(offset(4800)).toBeGreaterThan(0)
    const activeY = rows[2].y - offset(4800)
    expect(activeY).toBeLessThan(600 / 2)
    expect(rows[3].y + 132 - offset(4800)).toBeLessThan(600)
  })
  it('glides at a steady pace within a row and has no displacement jump at a downbeat', () => {
    expect(offset(5400) - offset(4800)).toBeCloseTo(offset(6000) - offset(5400))
    for (const time of [4800, 7200, 9600, 12000]) {
      expect(Math.abs(offset(time) - offset(time - 1))).toBeLessThan(.1)
      expect(Math.abs(offset(time + 1) - offset(time))).toBeLessThan(.1)
    }
  })
  it('uses the full duration of rows containing different numbers of measures', () => {
    const mixed = [{y:10,startMs:0,endMs:2400},{y:176,startMs:2400,endMs:9600},{y:342,startMs:9600,endMs:14400}]
    const start = scoreVerticalOffset(4000, mixed, 300, 700)
    const middle = scoreVerticalOffset(6400, mixed, 300, 700)
    expect(middle - start).toBeCloseTo(166 / 3)
    expect(scoreVerticalOffset(9600, mixed, 300, 700) - scoreVerticalOffset(9599, mixed, 300, 700)).toBeLessThan(.1)
  })
  it('holds the beginning and end, and keeps a complete short score still', () => {
    expect(offset(-100)).toBe(0)
    expect(offset(99999)).toBe(1400)
    expect(scoreVerticalOffset(4000, rows.slice(0, 2), 600, 340)).toBe(0)
    expect(scoreVerticalOffset(4000, [], 600, 0)).toBe(0)
    expect(scoreVerticalOffset(4000, rows, 0, 2000)).toBe(0)
  })
  it('selects the correct reading position after a seek, repeat, resize, or zoom', () => {
    expect(offset(12000)).toBeGreaterThan(offset(4800))
    expect(offset(0)).toBe(0)
    expect(scoreVerticalOffset(7200, rows, 400, 2000)).toBeGreaterThan(offset(7200))
    const zoomed = rows.map(row => ({...row,y:row.y * 1.4}))
    expect(scoreVerticalOffset(7200, zoomed, 600, 2800)).toBeGreaterThan(offset(7200))
  })
})

describe('exercise to notation clock',()=>{
  it('maps a faster exercise clock onto its authored score and repeats exactly',()=>{
    expect(exerciseScoreTime(1,8,2,8000)).toBe(2000)
    expect(exerciseScoreTime(4,8,2,8000)).toBe(0)
    expect(exerciseScoreTime(5,8,2,8000)).toBe(2000)
  })
  it('holds the final bar at completion and clamps count-in or empty durations',()=>{
    expect(exerciseScoreTime(8,8,2,8000)).toBe(8000)
    expect(exerciseScoreTime(9,8,2,8000)).toBe(8000)
    expect(exerciseScoreTime(-1,8,2,8000)).toBe(0)
    expect(exerciseScoreTime(1,0,2,8000)).toBe(0)
  })
})
