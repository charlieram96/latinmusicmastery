// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseDefinition } from '@/lib/play-sense/types'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => params ? `${key}(${Object.values(params).join(',')})` : key }),
}))
vi.mock('next/image', () => ({ default: () => null }))

// The engine is stubbed: each test sets the session it wants to see.
let session: Record<string, unknown>
let sessionOptions: Record<string, unknown> = {}
vi.mock('@/hooks/use-exercise-session', () => ({ useExerciseSession: (options: Record<string, unknown>) => { sessionOptions = options; return session } }))
vi.mock('@/hooks/use-stage-demo-session', () => ({ useStageDemoSession: () => ({ overrides: {}, attempt: 0, review: () => {} }) }))
vi.mock('@/components/play-sense/stage-highway/StageHighway', () => ({ StageHighway: () => <div data-highway /> }))
let nowPlaying: { onStop: () => void } | null = null
vi.mock('@/components/play-sense/now-playing-bar', () => ({ NowPlayingBar: (p: { onStop: () => void }) => { nowPlaying = p; return null } }))
vi.mock('@/components/play-sense/calibration-wizard', () => ({ CalibrationWizard: () => null }))
vi.mock('@/components/play-sense/audio-mode-prompt', () => ({ AudioModePrompt: () => null }))
vi.mock('@/components/play-sense/playsense-test-panel', () => ({ PlaysenseTestPanel: () => null }))
// The mixer's popover renders its content in place so its labels can be read.
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-popover>{children}</div>,
}))
vi.mock('../exercise-score', async () => {
  const bridge = await vi.importActual<typeof import('../exercise-workspace')>('../exercise-workspace')
  return { ExerciseScore: () => {
    const ws = bridge.useExerciseWorkspace()
    return <div data-score data-position={ws?.position} />
  } }
})
vi.mock('@/components/playsense-studio/player/notation/renderers/staff-renderer', () => ({ StaffRenderer: () => null }))
vi.mock('@/components/playsense-studio/player/notation/staff-layout-switch', () => ({ useStaffLayoutPreference: () => ['stacked', () => {}] }))
vi.mock('@/contexts/playsense-context', () => ({ usePlaysense: () => ({ connectionStatus: 'disconnected', connect: async () => {}, isConnected: () => false }) }))
const actions = vi.hoisted(() => ({
  getUserAttempts: vi.fn(async () => [] as unknown[]),
  getBestAttemptAccuracy: vi.fn(async () => null as number | null),
  saveAttempt: vi.fn(async () => ({})),
}))
vi.mock('@/app/actions/play-sense', () => actions)

import { ScoreExerciseGame } from '../score-exercise-game'
import { timelineToEngineSeconds } from '@/lib/play-sense/backing-track-timing'

const exercise = {
  id: 'ex1', title: 'Tumbao', bpm: 90, timeSignature: [4, 4], measures: 2, loopCount: 1, instrument: 'congas',
  events: [{ measure: 1, beat: 1 }, { measure: 2, beat: 1 }],
} as unknown as ExerciseDefinition

const baseSession = () => ({
  sessionState: 'selecting', exercise: null, audioMode: 'headphones', audioError: null, isListening: false, inputLevel: 0,
  playheadProgress: 0, eventResults: [], attemptStats: null, calibrationData: null, isCalibrating: false, calibrationBeat: 0,
  totalCalibrationBeats: 8, calibrationError: null, countdownBeat: 0, audioMetronome: true, metronomeBeat: 0,
  currentScore: 0, currentCombo: 0, currentAccuracy: 0,
  getElapsedSeconds: () => 0, selectExercise: () => {}, startExercise: async () => {}, stopExercise: () => {}, pauseExercise: () => {},
  resumeExercise: () => {}, restartExercise: async () => {}, retry: () => {}, testMic: () => {}, setAudioMode: () => {},
  startCalibration: () => {}, goToSelect: () => {}, clearAudioMode: () => {}, setAudioMetronome: () => {},
})

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)) }, removeItem: (k: string) => { store.delete(k) } })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {})
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  session = baseSession()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const video = { url: 'https://v.test/demo.mp4', startSeconds: 0, trimOutSeconds: null, timeMap: null }
const render = (props: Partial<React.ComponentProps<typeof ScoreExerciseGame>> = {}) =>
  act(() => root.render(<ScoreExerciseGame exercise={exercise} preview exerciseVideo={video} {...props} />))

describe('ScoreExerciseGame workspace media (W4)', () => {
  it('keeps the PiP video hidden while the session is still preparing', () => {
    render()
    expect(host.textContent).toContain('dashboard.classViewer.exercise.preparing')
    expect(host.querySelector('video')).toBeNull()
  })

  it('shows the video once the session is live', () => {
    session = { ...baseSession(), exercise, sessionState: 'playing' }
    render()
    expect(host.querySelector('video')?.getAttribute('aria-label')).toBe('dashboard.classViewer.exercise.referenceVideo')
  })

  it('is muted, with no pitch preservation forced, when mediaAudible is unset (an exercise\'s play-along video)', () => {
    session = { ...baseSession(), exercise, sessionState: 'playing' }
    render()
    const el = host.querySelector('video') as HTMLVideoElement
    expect(el.muted).toBe(true)
    expect((el as unknown as { preservesPitch?: boolean }).preservesPitch).toBeUndefined()
  })

  it('renders unmuted with pitch preservation when mediaAudible (a jam session\'s own track — Studio rework P5, Task 8 fix round 1)', () => {
    session = { ...baseSession(), exercise, sessionState: 'playing' }
    render({ mediaAudible: true })
    const el = host.querySelector('video') as HTMLVideoElement
    expect(el.muted).toBe(false)
    expect((el as unknown as { preservesPitch: boolean }).preservesPitch).toBe(true)
  })
})

const stats = (accuracy: number) => ({ score: accuracy, accuracy, perfectCount: 1, goodCount: 0, okCount: 0, missCount: 1, extraHits: 0,
  maxCombo: 1, maxStreak: 1, avgOffsetMs: 0, tempoDriftMs: 0, durationSeconds: 3, pitchAccuracy: null })
const hit = (eventIndex: number, grade: 'perfect' | 'miss') => ({ eventIndex, grade, offsetMs: grade === 'miss' ? null : 0, timing: grade === 'miss' ? null : 'on_time', onsetEnergy: null })

describe('ScoreExerciseGame Part done', () => {
  it('a take stopped with Finish take shows unreached bars as not played and the accuracy of what was played (L2)', () => {
    session = { ...baseSession(), exercise, sessionState: 'playing', playheadProgress: 0.5 }
    render({ preview: false })
    act(() => nowPlaying!.onStop())
    session = { ...session, sessionState: 'results', attemptStats: stats(50), eventResults: [hit(0, 'perfect'), hit(1, 'miss')] }
    render({ preview: false })
    const tiles = [...host.querySelectorAll('[data-bar-tile]')].map(t => t.getAttribute('data-status'))
    expect(tiles).toEqual(['clean', 'unplayed'])
    expect(host.querySelector('[data-accuracy-ring]')?.getAttribute('aria-label')).toContain('(100)')
  })

  it('Finish take during the count-in cancels back to the start instead of a 0% Part done', () => {
    const retry = vi.fn(); const stop = vi.fn()
    session = { ...baseSession(), exercise, sessionState: 'countdown', playheadProgress: 0, retry, stopExercise: stop }
    render({ preview: false })
    act(() => nowPlaying!.onStop())
    expect(retry).toHaveBeenCalledTimes(1)
    expect(stop).not.toHaveBeenCalled()
  })

  it('a take that ran to the end counts every bar', () => {
    session = { ...baseSession(), exercise, sessionState: 'results', attemptStats: stats(50), eventResults: [hit(0, 'perfect'), hit(1, 'miss')] }
    render({ preview: false })
    expect([...host.querySelectorAll('[data-bar-tile]')].map(t => t.getAttribute('data-status'))).toEqual(['clean', 'miss'])
  })

  it('a previous best that arrives after the count-in still gives the take its comparison (L11)', async () => {
    let resolve!: (v: number | null) => void
    actions.getBestAttemptAccuracy.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    session = { ...baseSession(), exercise, sessionState: 'countdown' }
    render({ preview: false })
    session = { ...session, sessionState: 'results', attemptStats: stats(90), eventResults: [hit(0, 'perfect'), hit(1, 'perfect')] }
    render({ preview: false })
    expect(host.textContent).not.toContain('part.first')
    await act(async () => { resolve(80) })
    expect(host.textContent).toContain('part.better(80)')
    expect(actions.getBestAttemptAccuracy).toHaveBeenCalledWith('ex1')
    expect(actions.getUserAttempts).not.toHaveBeenCalled()
  })
})

describe('ScoreExerciseGame translations (L10)', () => {
  it('shows a known input error in the student’s language', () => {
    session = { ...baseSession(), exercise, sessionState: 'playing', audioError: 'No microphone found. Please connect a microphone and try again.' }
    render({ preview: false })
    expect(host.textContent).toContain('dashboard.classViewer.exercise.audioErrors.micMissing')
    expect(host.textContent).not.toContain('No microphone found.')
  })

  it('labels the backing-track mixer through translations', () => {
    session = { ...baseSession(), exercise, sessionState: 'playing' }
    const track = { id: 't1', label: 'Bass', audioUrl: 'https://a.test/bass.mp3', timelineStartSeconds: 0, trimInSeconds: 0, trimOutSeconds: null, gain: 1 }
    render({ preview: false, backingTracks: [track] as never })
    const labels = [...document.body.querySelectorAll('[aria-label]')].map(el => el.getAttribute('aria-label'))
    expect(labels).toContain('dashboard.classViewer.exercise.muteTrack(Bass)')
    expect(labels).toContain('dashboard.classViewer.exercise.trackLevel(Bass)')
    expect(labels.join(' ')).not.toMatch(/Mute Bass|Bass level/)
  })
})

describe('ScoreExerciseGame score shape without a video', () => {
  const score = { tracks: [] } as never
  const stored = (layout: string) => localStorage.setItem('lmm-workspace:play:stacked', JSON.stringify({ v: 1, layout }))

  it('with a video, the score follows the student’s workspace layout', () => {
    stored('stack')
    session = { ...baseSession(), exercise, sessionState: 'playing' }
    render({ score })
    expect(host.querySelector('[data-score]')?.getAttribute('data-position')).toBe('top')
  })

  it('without a video, the score keeps the music-only shape whatever layout is stored', () => {
    stored('stack')
    session = { ...baseSession(), exercise, sessionState: 'playing' }
    render({ score, exerciseVideo: null })
    expect(host.querySelector('[data-score]')?.getAttribute('data-position')).toBe('right')
  })

  it('without a video, the score cannot change the saved layout of exercises that have one', () => {
    stored('pip')
    session = { ...baseSession(), exercise, sessionState: 'playing' }
    render({ score, exerciseVideo: null })
    // The score's own layout menu is gone (notation cleanup), so nothing can overwrite the
    // saved play layout without a video; the score reads the fixed music-only shape.
    const saved = localStorage.getItem('lmm-workspace:play:stacked')
    expect(saved === null || JSON.parse(saved).layout === 'pip').toBe(true)
    expect(host.querySelector('[data-score]')?.getAttribute('data-position')).toBe('right')
  })
})

describe('ScoreExerciseGame play settings (Studio rework P5)', () => {
  // 2 bars of 4/4 at 90 (secPerQN 2/3), then a confirmed change to 60 (1 s/qn).
  const graded = { ...exercise, grid: { measureStartSec: [0, 8 / 3, 16 / 3, 28 / 3], measureStartQN: [0, 4, 8, 12], secPerQN: [2 / 3, 2 / 3, 1], beatQN: [1, 1, 1] }, measures: 3 } as unknown as ExerciseDefinition
  const play = { bar1Seconds: 5, countInBars: 2 as const, preroll: true }

  it('passes the published count-in into the session, with or without a video', () => {
    render({ play })
    expect(sessionOptions.countInBars).toBe(2)
    render({ play, exerciseVideo: null })
    expect(sessionOptions.countInBars).toBe(2)
    render({ play: null })
    expect(sessionOptions.countInBars).toBe(1)
  })

  const bass = { id: 't1', label: 'Bass', audioUrl: 'https://a.test/bass.mp3', timelineStartSeconds: 5.346, trimInSeconds: 0.5, trimOutSeconds: null, gain: 1, positionQn: -3.96, timeMapId: null, orderIndex: 0, sourceDurationSeconds: null }
  const placed = () => sessionOptions.backingTracks as Array<{ id: string; startSeconds: number; trimInSeconds: number }>

  it('with a video, starts a backing track at its timeline position less bar 1, ignoring a stale positionQn', () => {
    render({ exercise: graded, play: { ...play, bar1Seconds: 5.34 }, backingTracks: [bass] })
    expect(placed()[0].startSeconds).toBeCloseTo(0.006, 9)
    expect(placed()[0].trimInSeconds).toBe(0.5)
    // Bar 1 unset: the trim-in point is bar 1.
    render({ exercise: graded, play: { ...play, bar1Seconds: null }, backingTracks: [bass], exerciseVideo: { ...video, startSeconds: 2 } })
    expect(placed()[0].startSeconds).toBeCloseTo(3.346, 9)
  })

  it('without a video, places a backing track exactly as before', () => {
    render({ exercise: graded, play, backingTracks: [bass], exerciseVideo: null })
    const old = timelineToEngineSeconds(bass.timelineStartSeconds, null, { bpm: graded.bpm, timeSignature: graded.timeSignature, grid: graded.grid }, 0)
    expect(placed()[0].startSeconds).toBe(old)
  })

  describe('the video follows the engine clock', () => {
    let frames: FrameRequestCallback[]
    let currentTime: number
    let paused: boolean
    let rate: number
    let duration: number
    let seeking: boolean
    let seeks: number[]
    let plays: number
    let cancelled: number[]
    let nextFrame: number
    beforeEach(() => {
      frames = []; cancelled = []; nextFrame = 0
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return ++nextFrame })
      vi.stubGlobal('cancelAnimationFrame', (id: number) => { cancelled.push(id) })
      currentTime = 0; paused = true; rate = 1; duration = NaN; seeking = false; seeks = []; plays = 0
      vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'get').mockImplementation(() => currentTime)
      vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set').mockImplementation((v: number) => { currentTime = v; seeks.push(v) })
      vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockImplementation(() => duration)
      // An element that reached the end of its file reports ended (and has paused itself).
      vi.spyOn(HTMLMediaElement.prototype, 'ended', 'get').mockImplementation(() => Number.isFinite(duration) && currentTime >= duration)
      vi.spyOn(HTMLMediaElement.prototype, 'seeking', 'get').mockImplementation(() => seeking)
      vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused)
      vi.spyOn(HTMLMediaElement.prototype, 'playbackRate', 'get').mockImplementation(() => rate)
      vi.spyOn(HTMLMediaElement.prototype, 'playbackRate', 'set').mockImplementation((v: number) => { rate = v })
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {
        plays++
        // A real element restarts from 0 when play() is called after it ended.
        if (Number.isFinite(duration) && currentTime >= duration) currentTime = 0
        paused = false
      })
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => { paused = true })
    })
    const tick = () => act(() => { const pending = frames; frames = []; pending.forEach(cb => cb(0)) })

    it('runs the pre-roll during the count-in and trims its rate toward bar 1 + engine time', () => {
      let e = -1
      session = { ...baseSession(), exercise, sessionState: 'countdown', getElapsedSeconds: () => e }
      render({ preview: false, play })
      tick()
      // 1 s before bar 1 → 4 s, far from 0: a hard seek, then play.
      expect(currentTime).toBe(4)
      expect(paused).toBe(false)
      e = 2; currentTime = 6.98
      tick()
      expect(currentTime).toBe(6.98)
      expect(rate).toBeCloseTo(1.01, 9)
    })

    it('holds at bar 1 without pre-roll, and at the trim-in point when bar 1 is unset', () => {
      session = { ...baseSession(), exercise, sessionState: 'countdown', getElapsedSeconds: () => -1 }
      render({ preview: false, play: { ...play, preroll: false } })
      tick()
      expect(currentTime).toBe(5)
      expect(paused).toBe(true)
      render({ preview: false, play: { ...play, bar1Seconds: null, preroll: false }, exerciseVideo: { ...video, startSeconds: 2 } })
      tick()
      expect(currentTime).toBe(2)
    })

    // `exercise`: 2 bars of 4/4 at 90 → a 16/3 s pass; bar 1 at 8 → the pass would run to 13.33 s.
    const loop = 16 / 3

    it('holds the last frame when the file ends before the pass does, then resumes at bar 1 on the next pass', () => {
      duration = 12
      let e = 3.8
      session = { ...baseSession(), exercise, sessionState: 'playing', getElapsedSeconds: () => e }
      currentTime = 11.8
      render({ preview: false, play: { ...play, bar1Seconds: 8 } })
      tick()
      expect(paused).toBe(false)
      // The element reaches the end of its file and pauses itself.
      currentTime = 12; paused = true
      const playsAtEnd = plays; const seeksAtEnd = seeks.length
      for (e = 4.0; e < loop; e += 0.1) tick()
      expect(plays).toBe(playsAtEnd)
      expect(seeks.length).toBe(seeksAtEnd)
      expect(currentTime).toBe(12)
      expect(paused).toBe(true)
      // The next pass brings bar 1 back inside the file.
      e = loop + 0.01
      tick()
      expect(currentTime).toBeCloseTo(8.01, 9)
      expect(paused).toBe(false)
      expect(seeks).not.toContain(0)
    })

    it('neither seeks nor trims the rate while the element is still seeking', () => {
      session = { ...baseSession(), exercise, sessionState: 'playing', getElapsedSeconds: () => 2 }
      currentTime = 1; seeking = true
      render({ preview: false, play })
      tick(); tick()
      expect(seeks).toEqual([])
      expect(rate).toBe(1)
      seeking = false
      tick()
      expect(seeks).toEqual([7])
    })

    it('seeks exactly once per loop wrap, and cancels its frame on unmount', () => {
      let e = 0
      session = { ...baseSession(), exercise, sessionState: 'playing', getElapsedSeconds: () => e }
      currentTime = 5
      render({ preview: false, play })
      const dt = 1 / 60
      for (; e < 2 * loop + 0.5; e += dt) {
        tick()
        currentTime += rate * dt
      }
      expect(seeks).toHaveLength(2)
      expect(seeks[0]).toBeCloseTo(5, 1)
      expect(seeks[1]).toBeCloseTo(5, 1)
      const pending = nextFrame
      act(() => root.unmount())
      expect(cancelled).toContain(pending)
      root = createRoot(host)
    })
  })
})
