// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseDefinition, OnsetEvent } from '@/lib/play-sense/types'

const mocks = vi.hoisted(() => {
  const context = {
    currentTime: 0, state: 'running',
    suspend: vi.fn(async () => { context.state = 'suspended' }),
    resume: vi.fn(async () => { context.state = 'running' }),
  }
  const source = () => ({
    isListening: true, hasPermission: true, error: null, inputLevel: 0,
    recentOnsets: [] as OnsetEvent[], startListening: vi.fn(async () => context),
    stopListening: vi.fn(), clearOnsets: vi.fn(), getFrequency: vi.fn(() => null),
    getWorkletNode: vi.fn(() => null), chromaByOnsetRef: { current: new Map() }, subscribeToHits: vi.fn(),
  })
  return {
    context, mic: source(), midi: source(), ble: source(),
    metronome: { startMetronome: vi.fn(() => 2), stopMetronome: vi.fn(), setSilent: vi.fn(), currentBeat: 0, isDownbeat: false },
    calibration: { calibrationData: null, loadStoredCalibration: vi.fn(), setActiveSourceType: vi.fn(), startCalibration: vi.fn(), cancelCalibration: vi.fn() },
    backing: { isLoaded: true, isLoading: false, startPlayback: vi.fn(), stopPlayback: vi.fn() },
  }
})
vi.mock('../use-onset-detection', () => ({ useOnsetDetection: () => mocks.mic }))
vi.mock('../use-midi-onsets', () => ({ useMidiOnsets: () => mocks.midi }))
vi.mock('../use-playsense-onsets', () => ({ usePlaysenseOnsets: () => mocks.ble }))
vi.mock('../use-metronome', () => ({ useMetronome: () => mocks.metronome }))
vi.mock('../use-calibration', () => ({ useCalibration: () => mocks.calibration }))
vi.mock('../use-backing-track', () => ({ useBackingTrack: () => mocks.backing }))
import { useExerciseSession } from '../use-exercise-session'

const exercise: ExerciseDefinition = {
  id: 'session-test', title: 'Test', description: '', instrument: 'piano', bpm: 120, timeSignature: [4, 4],
  measures: 1, loopCount: 1, swing: 0, difficulty: 'beginner',
  events: [60, 64, 67].map(expectedPitch => ({ expectedPitch, measure: 1, beat: 1, instrument: 'piano', technique: 'open', hand: 'R', duration: 1, vexKey: 'c/4', accent: false, chordId: 'c' })),
}
let session: ReturnType<typeof useExerciseSession>
let root: Root
function Harness({playbackOnly=false}:{playbackOnly?:boolean}) {
  const value = useExerciseSession({playbackOnly})
  useLayoutEffect(() => { session = value }, [value])
  return null
}
async function render() { await act(async () => { root.render(<Harness />) }) }
async function begin() {
  await act(async () => { session.selectExercise(exercise) })
  await act(async () => { session.setAudioMode('midi') })
  await act(async () => { await session.startExercise() })
  mocks.context.currentTime = 2
  await act(async () => { vi.advanceTimersByTime(30) })
}

beforeEach(async () => {
  vi.useFakeTimers(); vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear() })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  localStorage.clear(); mocks.context.currentTime = 0
  mocks.mic.recentOnsets = []; mocks.midi.recentOnsets = []; mocks.ble.recentOnsets = []
  root = createRoot(document.createElement('div'))
  await render()
})
afterEach(async () => { await act(async () => root?.unmount()); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('exercise session lifecycle', () => {
  it('opens MIDI without a microphone and scores an unordered first chord', async () => {
    await begin()
    expect(session.sessionState).toBe('playing')
    expect(mocks.midi.startListening).toHaveBeenCalledOnce()
    expect(mocks.mic.startListening).not.toHaveBeenCalled()
    mocks.midi.recentOnsets = [67, 60, 64].map(midiNote => ({ timestamp: 2, energy: 1, midiNote }))
    await render()
    expect(session.eventResults.map(r => r.grade)).toEqual(['perfect', 'perfect', 'perfect'])
    expect(session.currentCombo).toBe(3)
    expect(session.currentScore).toBe(100)
  })
  it('cancels an old countdown when another exercise is selected', async () => {
    await act(async () => session.selectExercise(exercise))
    await act(async () => { await session.startExercise() })
    expect(session.sessionState).toBe('countdown')
    await act(async () => session.selectExercise({ ...exercise, id: 'replacement' }))
    mocks.context.currentTime = 10
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(session.sessionState).toBe('selecting')
    expect(session.exercise?.id).toBe('replacement')
    expect(mocks.backing.stopPlayback).toHaveBeenCalled()
  })
  it('finishes using the current input source, then supports a fresh retry', async () => {
    await begin()
    const stopBefore = mocks.midi.stopListening.mock.calls.length
    mocks.context.currentTime = 4.4
    await act(async () => { vi.advanceTimersByTime(50) })
    expect(session.sessionState).toBe('results')
    expect(mocks.midi.stopListening.mock.calls.length).toBeGreaterThan(stopBefore)
    expect(session.eventResults).toHaveLength(3)
    await act(async () => session.retry())
    expect(session.eventResults).toHaveLength(0)
    expect(session.playheadProgress).toBe(0)
    mocks.context.currentTime = 0
    await act(async () => { await session.startExercise() })
    expect(session.sessionState).toBe('countdown')
  })
  it('does not consume count-in hits but accepts an early first note inside tolerance', async () => {
    await begin()
    mocks.midi.recentOnsets = [{ timestamp: 1, energy: 1, midiNote: 60 }, { timestamp: 1.97, energy: 1, midiNote: 60 }]
    await render()
    expect(session.eventResults).toHaveLength(1)
    expect(session.eventResults[0].grade).toBe('perfect')
  })
  it('does not start two count-ins from repeated Play clicks', async () => {
    await act(async () => session.selectExercise(exercise))
    await act(async () => { await Promise.all([session.startExercise(), session.startExercise()]) })
    expect(mocks.metronome.startMetronome).toHaveBeenCalledOnce()
  })

  it('pauses by suspending the shared clock and resumes without a jump', async () => {
    await begin()
    mocks.context.currentTime = 3
    await act(async () => { vi.advanceTimersByTime(50) })
    const progressBefore = session.playheadProgress
    expect(progressBefore).toBeGreaterThan(0)
    await act(async () => { session.pauseExercise() })
    expect(session.sessionState).toBe('paused')
    expect(mocks.context.suspend).toHaveBeenCalledOnce()
    // A suspended context's clock does not advance, so nothing moves.
    await act(async () => { vi.advanceTimersByTime(200) })
    expect(session.playheadProgress).toBe(progressBefore)
    expect(session.getElapsedSeconds()).toBe(1)
    await act(async () => { session.resumeExercise() })
    expect(session.sessionState).toBe('playing')
    expect(mocks.context.resume).toHaveBeenCalledOnce()
    mocks.context.currentTime = 3.5
    await act(async () => { vi.advanceTimersByTime(50) })
    expect(session.playheadProgress).toBeGreaterThan(progressBefore)
  })
  it('restarts from playing or paused with a fresh count-in and no results', async () => {
    await begin()
    mocks.context.currentTime = 3
    await act(async () => { vi.advanceTimersByTime(50) })
    const stopsBefore = mocks.midi.stopListening.mock.calls.length
    await act(async () => { await session.restartExercise() })
    expect(session.sessionState).toBe('countdown')
    expect(session.playheadProgress).toBe(0)
    expect(session.attemptStats).toBeNull()
    expect(mocks.metronome.startMetronome).toHaveBeenCalledTimes(2)
    expect(mocks.backing.startPlayback).toHaveBeenCalledTimes(2)
    expect(mocks.midi.stopListening.mock.calls.length).toBe(stopsBefore)
    mocks.context.currentTime = 2
    await act(async () => { vi.advanceTimersByTime(30) })
    expect(session.sessionState).toBe('playing')
    await act(async () => { session.pauseExercise() })
    await act(async () => { await session.restartExercise() })
    expect(mocks.context.resume).toHaveBeenCalledOnce()
    expect(session.sessionState).toBe('countdown')
    expect(mocks.metronome.startMetronome).toHaveBeenCalledTimes(3)
  })
})

it('plays the preview on an output context without opening mic, MIDI or BLE; closes it on exit', async () => {
  const close=vi.fn(async()=>{})
  vi.stubGlobal('AudioContext', class { currentTime=0; state='running'; resume=mocks.context.resume; close=close })
  await act(async()=>root.render(<Harness playbackOnly />))
  await act(async()=>session.selectExercise(exercise))
  await act(async()=>session.startExercise())
  expect(mocks.mic.startListening).not.toHaveBeenCalled()
  expect(mocks.midi.startListening).not.toHaveBeenCalled()
  expect(mocks.ble.startListening).not.toHaveBeenCalled()
  expect(session.sessionState).toBe('countdown')
  expect(mocks.backing.startPlayback).toHaveBeenCalledWith(expect.any(Object),2)
  await act(async()=>session.retry())
  expect(session.sessionState).toBe('selecting')
  expect(mocks.backing.stopPlayback).toHaveBeenCalled()
  await act(async()=>root.render(null))
  expect(close).toHaveBeenCalledOnce()
})

it('keeps a note-selected starting point and starts the shared audio there', async () => {
  await render()
  await act(async () => { session.selectExercise(exercise); session.setAudioMode('midi') })
  act(() => session.seekExercise(1))
  expect(session.getElapsedSeconds()).toBe(1)
  expect(session.playheadProgress).toBe(.5)
  await act(async () => { await session.startExercise() })
  expect(mocks.metronome.startMetronome).toHaveBeenLastCalledWith(mocks.context, 1)
  expect(mocks.backing.startPlayback).toHaveBeenCalled()
  expect(session.sessionState).toBe('playing')
})
