import { describe, expect, it } from 'vitest'
import { expectedMediaTime, followRate, type PlayMedia } from '../play-follow'
import { WaypointTimeMap, type Waypoint } from '@/components/playsense-studio/shared/time-map/time-map'

// Bar 1 at 10 s, a 2 s count-in (one 4/4 bar at 120), an 8 s loop.
const media = (patch: Partial<PlayMedia> = {}): PlayMedia => ({
  bar1: 10, trimIn: 0, trimOut: null, countInSeconds: 2, preroll: true, loopSeconds: 8, ...patch,
})

describe('expectedMediaTime during the count-in', () => {
  it('with pre-roll, runs the video from bar 1 minus the count-in', () => {
    expect(expectedMediaTime(media(), -2)).toEqual({ media: 8, playing: true })
    expect(expectedMediaTime(media(), -0.5)).toEqual({ media: 9.5, playing: true })
  })

  it('with pre-roll, holds at bar 1 minus the count-in until the count-in starts', () => {
    // The preview demo clock can start earlier than the real count-in.
    expect(expectedMediaTime(media(), -3.5)).toEqual({ media: 8, playing: false })
  })

  it('without pre-roll, holds paused at bar 1', () => {
    const m = media({ preroll: false })
    expect(expectedMediaTime(m, -2)).toEqual({ media: 10, playing: false })
    expect(expectedMediaTime(m, -0.01)).toEqual({ media: 10, playing: false })
  })

  it('clamps the pre-roll at trim-in and starts late, when the clock reaches it (Review Focus 3)', () => {
    // Bar 1 is 1.2 s into the usable region, but the count-in is 2 s long.
    const m = media({ bar1: 1.7, trimIn: 0.5 })
    expect(expectedMediaTime(m, -2)).toEqual({ media: 0.5, playing: false })
    expect(expectedMediaTime(m, -1.3)).toEqual({ media: 0.5, playing: false })
    const start = expectedMediaTime(m, -1.15)
    expect(start.playing).toBe(true)
    expect(start.media).toBeCloseTo(0.55, 12)
    const later = expectedMediaTime(m, -0.2)
    expect(later.playing).toBe(true)
    expect(later.media).toBeCloseTo(1.5, 12)
  })
})

describe('expectedMediaTime after bar 1', () => {
  it('follows bar 1 plus the engine time, folded per loop', () => {
    expect(expectedMediaTime(media(), 0)).toEqual({ media: 10, playing: true })
    expect(expectedMediaTime(media(), 3)).toEqual({ media: 13, playing: true })
    expect(expectedMediaTime(media(), 9)).toEqual({ media: 11, playing: true })
  })

  it('holds paused at trim-in while bar 1 plus the engine time is still before it', () => {
    // Bar 1 at 1 s, trim-in at 2.5 s: bars before the trim-in have no media.
    const m = media({ bar1: 1, trimIn: 2.5 })
    expect(expectedMediaTime(m, 0)).toEqual({ media: 2.5, playing: false })
    expect(expectedMediaTime(m, 1.4)).toEqual({ media: 2.5, playing: false })
    // Once the clock reaches the trim-in it plays from there.
    expect(expectedMediaTime(m, 1.5)).toEqual({ media: 2.5, playing: true })
    const later = expectedMediaTime(m, 3)
    expect(later.playing).toBe(true)
    expect(later.media).toBeCloseTo(4, 12)
    // Each loop pass holds again until the trim-in.
    expect(expectedMediaTime(m, 8.5)).toEqual({ media: 2.5, playing: false })
  })

  it('holds at trim-in during the count-in when bar 1 is before it', () => {
    expect(expectedMediaTime(media({ bar1: 1, trimIn: 2.5 }), -1)).toEqual({ media: 2.5, playing: false })
    expect(expectedMediaTime(media({ bar1: 1, trimIn: 2.5, preroll: false }), -1)).toEqual({ media: 2.5, playing: false })
  })

  it('clamps to the trim-out point', () => {
    expect(expectedMediaTime(media({ trimOut: 15 }), 7).media).toBe(15)
  })
})

describe('followRate', () => {
  it('trims the rate gently toward the expected time, clamped to ±3 %', () => {
    expect(followRate(10, 10, 1)).toEqual({ rate: 1, seekTo: null })
    expect(followRate(10.02, 10, 1).rate).toBeCloseTo(1.01, 12)
    expect(followRate(10, 10.02, 1).rate).toBeCloseTo(0.99, 12)
    expect(followRate(10.4, 10, 1)).toEqual({ rate: 1.03, seekTo: null })
    expect(followRate(10, 10.4, 1)).toEqual({ rate: 0.97, seekTo: null })
  })

  it('multiplies in the student speed', () => {
    expect(followRate(10.4, 10, 0.5).rate).toBeCloseTo(0.515, 12)
  })

  it('hard-seeks only past 0.5 s of drift, without a rate spike', () => {
    expect(followRate(10.5, 10, 1).seekTo).toBeNull()
    expect(followRate(10.51, 10, 1)).toEqual({ rate: 1, seekTo: 10.51 })
    expect(followRate(9, 10, 0.75)).toEqual({ rate: 0.75, seekTo: 9 })
  })

  it('seeks back to bar 1 exactly once at a loop wrap, with no rate spike (Review Focus 4)', () => {
    const m = media()
    let actual = expectedMediaTime(m, 7.9).media
    const seeks: number[] = []
    const rates: number[] = []
    for (let e = 7.9; e < 8.5; e += 1 / 60) {
      // The element advances at the rate it was given over one frame.
      const { media: expected } = expectedMediaTime(m, e)
      const { rate, seekTo } = followRate(expected, actual, 1)
      rates.push(rate)
      if (seekTo !== null) { seeks.push(seekTo); actual = seekTo }
      actual += rate / 60
    }
    expect(seeks).toHaveLength(1)
    expect(seeks[0]).toBeCloseTo(10, 1)
    for (const r of rates) expect(Math.abs(r - 1)).toBeLessThan(0.01)
  })
})

describe('the old placement (Review Focus 1)', () => {
  it('matches the uniform time map placement when bar 1 is its first waypoint', () => {
    // 4 bars of 4/4 at 90 bpm, mapped uniformly from 3.2 s, looped twice.
    const secPerQN = 60 / 90
    const firstWaypoint = 3.2
    const waypoints: Waypoint[] = [0, 4, 8, 12, 16].map((qn, i) => ({
      musicalPositionQN: qn, videoTimeSeconds: firstWaypoint + qn * secPerQN, measureNumber: i + 1, beatInMeasure: 1,
    }))
    const map = new WaypointTimeMap('tm', 'tempo', waypoints)
    const loopSeconds = 16 * secPerQN
    const loops = 2
    const m = media({ bar1: firstWaypoint, trimIn: 0, loopSeconds, countInSeconds: 4 * secPerQN })
    for (const e of [0, 0.37, 2.5, 5, 10.66, loopSeconds + 0.01, loopSeconds + 4.2, 2 * loopSeconds - 0.01]) {
      // The old effect: progress over all loops, folded back into one pass.
      const progress = e / (loopSeconds * loops)
      const withinPass = (progress * loops) % 1
      const old = map.toVideoTime(withinPass * map.totalQN)
      expect(Math.abs(expectedMediaTime(m, e).media - old)).toBeLessThan(0.001)
    }
  })
})
