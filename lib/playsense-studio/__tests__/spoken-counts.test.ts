import { expect, it } from 'vitest'
import { ritmoSpokenCounts, spokenCountAt } from '../ritmo-spoken-counts'
it('follows spoken cues when seeking in either direction and clears during silence', () => {
  expect(spokenCountAt(ritmoSpokenCounts, 175.9)?.beat.number).toBe(3)
  expect(spokenCountAt(ritmoSpokenCounts, 174.6)?.beat.number).toBe(1)
  expect(spokenCountAt(ritmoSpokenCounts, 177.5)).toBeNull()
  expect(spokenCountAt(ritmoSpokenCounts, 68.8)?.beat.number).toBe(3)
  expect(spokenCountAt(ritmoSpokenCounts, 69.5)).toBeNull()
  // “tres o cuatro dedos” describes technique, it is not a spoken count.
  expect(spokenCountAt(ritmoSpokenCounts, 304)).toBeNull()
})
it('keeps every authored number ordered and bounded by its spoken phrase', () => {
  for (const cue of ritmoSpokenCounts) {
    expect(cue.start).toBe(cue.beats[0].at)
    cue.beats.forEach((beat, i) => {
      expect(beat.at).toBeLessThan(cue.end)
      if (i) expect(beat.at).toBeGreaterThan(cue.beats[i - 1].at)
    })
  }
})
