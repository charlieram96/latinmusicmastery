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
vi.mock('@/components/play-sense/now-playing-bar', () => ({ NowPlayingBar: () => null }))
vi.mock('@/components/play-sense/calibration-wizard', () => ({ CalibrationWizard: () => null }))
vi.mock('@/components/play-sense/audio-mode-prompt', () => ({ AudioModePrompt: () => null }))
vi.mock('@/components/play-sense/playsense-test-panel', () => ({ PlaysenseTestPanel: () => null }))
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
    expect(host.querySelector('video')).not.toBeNull()
  })
})
