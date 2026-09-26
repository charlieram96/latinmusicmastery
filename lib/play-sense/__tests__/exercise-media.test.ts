import { describe, expect, it } from 'vitest'
import { cropWindow, jamRendersGradedGame, resolveLegacyAudioUrl, toExerciseVideo } from '../exercise-media'
import type { ExerciseMedia } from '@/app/actions/playsense-studio'

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

const MEDIA: ExerciseMedia = {
  videoUrl: 'https://example.com/jam.mp3',
  videoStartSeconds: 1.5,
  videoTrimOutSeconds: 30,
  metronomeAnchorSeconds: null,
  metronomeAnchorQn: null,
  timeMap: null,
  backingTracks: [],
  play: { bar1Seconds: 2, countInBars: 1, preroll: true },
}

describe('toExerciseVideo (Studio rework P5, Task 8)', () => {
  it('projects the media into the ScoreExerciseGame video shape', () => {
    expect(toExerciseVideo(MEDIA)).toEqual({
      url: 'https://example.com/jam.mp3',
      startSeconds: 1.5,
      trimOutSeconds: 30,
      timeMap: null,
    })
  })

  it('is null when there is no media, or no videoUrl (a jam with no audio_url yet)', () => {
    expect(toExerciseVideo(null)).toBeNull()
    expect(toExerciseVideo({ ...MEDIA, videoUrl: null })).toBeNull()
  })
})

describe('jamRendersGradedGame (Studio rework P5, Task 8)', () => {
  it('is true only for a JAM_SESSION once its score data has loaded', () => {
    expect(jamRendersGradedGame('JAM_SESSION', true)).toBe(true)
  })

  it('is false for a JAM_SESSION with no score yet', () => {
    expect(jamRendersGradedGame('JAM_SESSION', false)).toBe(false)
  })

  it('is false for any other item type, even with score data', () => {
    expect(jamRendersGradedGame('EXERCISE', true)).toBe(false)
    expect(jamRendersGradedGame('VIDEO', true)).toBe(false)
    expect(jamRendersGradedGame('QUIZ', true)).toBe(false)
  })
})
