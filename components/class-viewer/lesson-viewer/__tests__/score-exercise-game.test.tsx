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
vi.mock('@/hooks/use-exercise-session', () => ({ useExerciseSession: () => session }))
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
vi.mock('../exercise-score', () => ({ ExerciseScore: () => <div data-score /> }))
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
