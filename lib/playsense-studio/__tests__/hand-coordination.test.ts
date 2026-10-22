import { expect, it } from 'vitest'
import { handCoordinationAt, type HandCoordinationCue } from '../hand-coordination'
const cue: HandCoordinationCue = { start: 10, end: 12, bar: 1, position: { x: 20, y: 20 }, slots: [
  { at: 10.2, right: true, left: false }, { at: 11, right: true, left: true },
] }
it('follows authored media time through pause, seek, replay and cue boundaries', () => {
  expect(handCoordinationAt([cue], 9)).toBeNull()
  expect(handCoordinationAt([cue], 10)?.slot).toBe(-1)
  expect(handCoordinationAt([cue], 11.5)?.slot).toBe(1)
  expect(handCoordinationAt([cue], 11.5)?.slot).toBe(1)
  expect(handCoordinationAt([cue], 10.3)?.slot).toBe(0)
  expect(handCoordinationAt([cue], 12)).toBeNull()
})

import { variacionesHandCoordination } from '../variaciones-hand-coordination'
import { lessonPresentationFor } from '../lesson-presentation'
import { VARIACIONES_SOURCE_PATH } from '../variaciones-presentation'
it('keeps complete and simple Sobao distinct, with real simultaneous slots in simple', () => {
  const full = variacionesHandCoordination.find(c => c.variant === 'complete')!
  const simple = variacionesHandCoordination.find(c => c.variant === 'simple')!
  expect(full.slots.filter(s => s.left)).toHaveLength(3)
  expect(simple.slots.filter(s => s.left)).toHaveLength(2)
  expect(simple.slots[2]).toMatchObject({ right: true, left: true })
  expect(simple.slots[6]).toMatchObject({ right: false, left: true })
  for (const [i, c] of variacionesHandCoordination.entries()) {
    expect(c.end).toBeGreaterThan(c.start)
    if (i) expect(c.start).toBeGreaterThanOrEqual(variacionesHandCoordination[i - 1].end)
    expect(c.position.y + 144).toBeLessThan(500) // camera insets begin in the lower picture
  }
})

it('activates only for the exact local Variaciones lesson asset', () => {
  expect(lessonPresentationFor(VARIACIONES_SOURCE_PATH, true)?.handCoordination).toBe(variacionesHandCoordination)
  expect(lessonPresentationFor('/other.mp4', true)).toBeNull()
  expect(lessonPresentationFor(VARIACIONES_SOURCE_PATH, false)).toBeNull()
})

it('omits only the final right-hand stroke of the opening complete-Sobao demonstration', () => {
  const opening = variacionesHandCoordination.filter(c => c.start < 73)
  expect(opening.at(-1)!.slots[7].right).toBe(false)
  expect(opening.at(-1)!.slots[6]).toMatchObject({ left: true, leftStroke: 'open' })
  expect(opening.slice(0, -1).every(c => c.slots[7].right)).toBe(true)
  expect(variacionesHandCoordination.filter(c => c.start > 250 && c.start < 274).every(c => c.slots[7].right)).toBe(true)
})

it('covers the requested practice windows and keeps all later demonstrations simple', () => {
  expect(handCoordinationAt(variacionesHandCoordination,150)?.cue.bar).toBe(1)
  expect(handCoordinationAt(variacionesHandCoordination,168.9)).not.toBeNull()
  expect(handCoordinationAt(variacionesHandCoordination,208)).not.toBeNull()
  expect(handCoordinationAt(variacionesHandCoordination,213.6)?.cue.bar).toBe(2)
  expect(variacionesHandCoordination.filter(c=>c.start>73).every(c=>c.variant==='simple')).toBe(true)
})
it('does not light the second-bar attack early and follows uneven moderate attacks', () => {
  expect(handCoordinationAt(variacionesHandCoordination,191.5)).toBeNull()
  const gesture = handCoordinationAt(variacionesHandCoordination,192.51)!
  expect(gesture.slot).toBe(0)
  expect(handCoordinationAt(variacionesHandCoordination,192.52)?.slot).toBe(1)
  const moderate = handCoordinationAt(variacionesHandCoordination,254.2)!
  expect(moderate.cue.slots[6].at).toBe(254.24)
  expect(moderate.slot).toBe(5)
  expect(handCoordinationAt(variacionesHandCoordination,254.24)?.slot).toBe(6)
})

it('leaves the final right square empty at each demonstrated stop, preserving open left tones', () => {
  // Reviewed source-video endings, including both second-bar examples near 3:30.
  for (const start of [69.8,108.98,166.88,177.47,208,213.55,247.12]) {
    const cue = variacionesHandCoordination.find(c => c.start === start)!
    expect(cue.slots[7].right, `right hand at ${start}`).toBe(false)
    expect(cue.slots[6]).toMatchObject({ left: true, leftStroke: 'open' })
    const atEnd = handCoordinationAt(variacionesHandCoordination, cue.end - .01)!
    expect(atEnd.cue.slots[atEnd.slot].right).toBe(false)
  }
  // A continuing pattern still plays its last offbeat; do not mute all bar endings.
  expect(variacionesHandCoordination.find(c => c.start === 164.48)!.slots[7].right).toBe(true)
  expect(variacionesHandCoordination.find(c => c.start === 272.61)!.slots[7].right).toBe(true)
})

it('finishes the 3:38 demonstration and the final moderate round without inventing closing strokes', () => {
  const repeated = handCoordinationAt(variacionesHandCoordination,220.12)!
  expect(repeated.cue.slots[6]).toMatchObject({left:true,leftStroke:'open'})
  expect(repeated.cue.slots[7].right).toBe(false)
  expect(handCoordinationAt(variacionesHandCoordination,275.9)?.cue.bar).toBe(2)
  expect(handCoordinationAt(variacionesHandCoordination,276.7)).toBeNull()
})
it('includes the quiet third-beat damped variations individually', () => {
  for (const at of [259.64,263.62,267.65]) {
    const current = handCoordinationAt(variacionesHandCoordination,at)!
    expect(current.cue.slots[current.slot]).toMatchObject({at,left:true,leftStroke:'muted',right:false})
  }
  expect(handCoordinationAt(variacionesHandCoordination,255.64)!.cue.slots[4].left).toBe(false)
})
