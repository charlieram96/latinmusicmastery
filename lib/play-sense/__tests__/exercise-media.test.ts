import { describe, expect, it } from 'vitest'
import { cropWindow, resolveLegacyAudioUrl } from '../exercise-media'

describe('cropWindow', () => {
  it('clamps start into [0, videoDuration - scoreLength]', () => {
    expect(cropWindow(60, 20, 50)).toEqual({ maxStart: 40, start: 40, end: 60 })
    expect(cropWindow(60, 20, -5)).toEqual({ maxStart: 40, start: 0, end: 20 })
    expect(cropWindow(60, 20, 10)).toEqual({ maxStart: 40, start: 10, end: 30 })
  })

  it('pins start to 0 when the video is shorter than the score', () => {
    expect(cropWindow(15, 20, 10)).toEqual({ maxStart: 0, start: 0, end: 15 })
  })

  it('handles unknown video duration (null) by passing start through', () => {
    expect(cropWindow(null, 20, 10)).toEqual({ maxStart: null, start: 10, end: 30 })
    expect(cropWindow(null, 20, -3)).toEqual({ maxStart: null, start: 0, end: 20 })
  })
})

describe('resolveLegacyAudioUrl', () => {
  it('keeps the demo video audio only when there is no new exercise media', () => {
    expect(
      resolveLegacyAudioUrl({ legacyMediaUrl: 'v.mp4', hasBackingTracks: false, hasExerciseVideo: false })
    ).toBe('v.mp4')
  })

  it('drops the legacy audio once backing tracks or an exercise video exist', () => {
    expect(
      resolveLegacyAudioUrl({ legacyMediaUrl: 'v.mp4', hasBackingTracks: true, hasExerciseVideo: false })
    ).toBeUndefined()
    expect(
      resolveLegacyAudioUrl({ legacyMediaUrl: 'v.mp4', hasBackingTracks: false, hasExerciseVideo: true })
    ).toBeUndefined()
  })

  it('returns undefined when there is no legacy media url', () => {
    expect(
      resolveLegacyAudioUrl({ legacyMediaUrl: null, hasBackingTracks: false, hasExerciseVideo: false })
    ).toBeUndefined()
  })
})
