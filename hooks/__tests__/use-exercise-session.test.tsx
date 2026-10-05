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
    getLiveAudioInput: vi.fn(), stopListening: vi.fn(), clearOnsets: vi.fn(), getFrequency: vi.fn(() => null),
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
import { recordSessionLatency } from '@/lib/audio/session-latency'
import { saveTimingCompensation } from '@/lib/audio/timing-compensation'
import type { LoopbackResult } from '@/lib/audio/loopback-latency'
import { useExerciseSession } from '../use-exercise-session'

const exercise: ExerciseDefinition = {
  id: 'session-test', title: 'Test', description: '', instrument: 'piano', bpm: 120, timeSignature: [4, 4],
  measures: 1, loopCount: 1, swing: 0, difficulty: 'beginner',
  events: [60, 64, 67].map(expectedPitch => ({ expectedPitch, measure: 1, beat: 1, instrument: 'piano', technique: 'open', hand: 'R', duration: 1, vexKey: 'c/4', accent: false, chordId: 'c' })),
}
let session: ReturnType<typeof useExerciseSession>
let root: Root
function Harness({playbackOnly=false, defaultAudioMetronome}:{playbackOnly?:boolean; defaultAudioMetronome?:boolean}) {
  const value = useExerciseSession({playbackOnly, defaultAudioMetronome})
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
  mocks.mic.getLiveAudioInput.mockReturnValue(null)
  mocks.context.state = 'running'
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
afterEach(async () => { await act(async () => root?.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('exercise session lifecycle', () => {
  it('applies the saved preset instead of stacking hardware latency, including after retry', async () => {
    const claps: ExerciseDefinition = { ...exercise, instrument: 'timbale', events: [1, 2, 3, 4].map(beat => ({ ...exercise.events[0], instrument: 'timbale', beat, expectedPitch: undefined, chordId: undefined })) }
    await act(async () => session.selectExercise(claps))
    await act(async () => session.setAudioMode('headphones'))
    const live = { context: mocks.context as unknown as AudioContext, stream: { active: true, getAudioTracks: () => [{ getSettings: () => ({ deviceId: 'saved-mic' }) }] } as unknown as MediaStream }
    mocks.mic.getLiveAudioInput.mockReturnValue(live)
    for (let i = 0; i < 2; i++) recordSessionLatency(live, { reliable: true, medianMs: 78, detected: 8, total: 8 } as LoopbackResult)
    expect(saveTimingCompensation(live, 'headphones', 125)).toBe(true)
    for (let attempt = 0; attempt < 2; attempt++) {
      mocks.context.currentTime = 0; mocks.mic.recentOnsets = []
      await act(async () => session.startExercise())
      mocks.context.currentTime = 2
      await act(async () => vi.advanceTimersByTime(30))
      mocks.mic.recentOnsets = [2.125, 2.625, 3.125, 3.625].map(timestamp => ({ timestamp, energy: .005 }))
      await render()
      expect(session.eventResults.map(result => result.grade)).toEqual(['perfect', 'perfect', 'perfect', 'perfect'])
      mocks.context.currentTime = 4.5
      await act(async () => vi.advanceTimersByTime(50))
      expect(session.attemptStats).toMatchObject({ micLatencyMs: 125, presetMicTiming: true, manualMicTimingTest: false })
      expect(session.attemptStats?.rhythm?.meanAbsoluteErrorMs).toBeCloseTo(0)
      await act(async () => session.retry())
    }
    await act(async () => session.setAudioMode('speaker-safe'))
    mocks.context.currentTime = 0; mocks.mic.recentOnsets = []
    await act(async () => session.startExercise())
    mocks.context.currentTime = 2
    await act(async () => vi.advanceTimersByTime(30))
    await act(async () => session.stopExercise())
    expect(session.attemptStats).toMatchObject({ micLatencyMs: 78, presetMicTiming: false })
  })
  it.each(['development', 'production'])('limits the manual 125ms experiment to local microphone grading (%s)', async environment => {
    vi.stubEnv('NODE_ENV', environment)
    const claps: ExerciseDefinition = { ...exercise, id: 'f7fee0dd-66bb-4e08-9af0-e38febfa415b', instrument: 'timbale', events: [1, 2, 3, 4].map(beat => ({ ...exercise.events[0], instrument: 'timbale', beat, expectedPitch: undefined, chordId: undefined })) }
    await act(async () => session.selectExercise(claps))
    await act(async () => session.setAudioMode('headphones'))
    const live = { context: mocks.context as unknown as AudioContext, stream: { active: true } as MediaStream }
    mocks.mic.getLiveAudioInput.mockReturnValue(live)
    for (let i = 0; i < 2; i++) recordSessionLatency(live, { reliable: true, medianMs: 78, detected: 8, total: 8 } as LoopbackResult)
    await act(async () => session.startExercise())
    mocks.context.currentTime = 2
    await act(async () => vi.advanceTimersByTime(30))
    mocks.mic.recentOnsets = [2.125, 2.625, 3.125, 3.625].map(timestamp => ({ timestamp, energy: .005 }))
    await render()
    if (environment === 'development') expect(session.eventResults.map(result => result.grade)).toEqual(['perfect', 'perfect', 'perfect', 'perfect'])
    mocks.context.currentTime = 4.5
    await act(async () => vi.advanceTimersByTime(50))
    expect(session.attemptStats?.micLatencyMs).toBe(environment === 'development' ? 125 : 78)
    expect(session.attemptStats?.manualMicTimingTest).toBe(environment === 'development')
    if (environment === 'development') expect(session.attemptStats?.rhythm?.meanAbsoluteErrorMs).toBeCloseTo(0)
  })
  it('preserves validated microphone compensation through results and retry, but closes on exit', async () => {
    const claps: ExerciseDefinition = { ...exercise, instrument: 'timbale', events: [1, 2, 3, 4].map(beat => ({ ...exercise.events[0], instrument: 'timbale', beat, expectedPitch: undefined, chordId: undefined })) }
    await act(async () => session.selectExercise(claps))
    await act(async () => session.setAudioMode('headphones'))
    await act(async () => session.testMic())
    const live = { context: mocks.context as unknown as AudioContext, stream: { active: true } as MediaStream }
    mocks.mic.getLiveAudioInput.mockReturnValue(live)
    for (const medianMs of [77, 79]) recordSessionLatency(live, { reliable: true, medianMs, detected: 8, total: 8 } as LoopbackResult)
    const stops = mocks.mic.stopListening.mock.calls.length
    for (let attempt = 0; attempt < 2; attempt++) {
      mocks.context.currentTime = 0
      mocks.mic.recentOnsets = []
      await act(async () => session.startExercise())
      mocks.context.currentTime = 2
      await act(async () => vi.advanceTimersByTime(30))
      mocks.mic.recentOnsets = [2.078, 2.578, 3.078, 3.578].map(timestamp => ({ timestamp, energy: .005 }))
      await render()
      expect(session.eventResults.map(result => result.grade)).toEqual(['perfect', 'perfect', 'perfect', 'perfect'])
      mocks.context.currentTime = 4.4
      await act(async () => vi.advanceTimersByTime(50))
      expect(session.attemptStats?.micLatencyMs).toBe(78)
      expect(session.attemptStats?.rhythm?.meanAbsoluteErrorMs).toBeCloseTo(0)
      expect(mocks.mic.stopListening).toHaveBeenCalledTimes(stops)
      await act(async () => session.retry())
      expect(mocks.mic.stopListening).toHaveBeenCalledTimes(stops)
    }
    await act(async () => session.goToSelect())
    expect(mocks.mic.stopListening.mock.calls.length).toBeGreaterThan(stops)
  })
  it('scores microphone rhythm against its audio clock after a mic test, and on retry', async () => {
    const claps: ExerciseDefinition = { ...exercise, instrument: 'timbale', events: [1, 2, 3, 4].map(beat => ({ ...exercise.events[0], instrument: 'timbale', beat, expectedPitch: undefined, chordId: undefined })) }
    await act(async () => session.selectExercise(claps))
    await act(async () => session.setAudioMode('headphones'))
    await act(async () => session.testMic())
    for (let attempt = 0; attempt < 2; attempt++) {
      mocks.context.currentTime = 0
      mocks.mic.recentOnsets = []
      await act(async () => session.startExercise())
      mocks.context.currentTime = 2
      await act(async () => vi.advanceTimersByTime(30))
      mocks.mic.recentOnsets = [2.01, 2.49, 3.02, 3.5].map(timestamp => ({ timestamp, energy: .005 }))
      await render()
      mocks.context.currentTime = 4.4
      await act(async () => vi.advanceTimersByTime(50))
      expect(session.attemptStats?.rhythm).toMatchObject({ detected: 4, matched: 4, extra: 0, f1: 100 })
      expect(session.attemptStats?.accuracy).toBe(100)
      await act(async () => session.retry())
    }
  })
  it('keeps capture open when the already selected sound option is clicked again', async () => {
    await act(async () => session.setAudioMode('headphones'))
    const stops = mocks.mic.stopListening.mock.calls.length
    await act(async () => session.setAudioMode('headphones'))
    expect(mocks.mic.stopListening).toHaveBeenCalledTimes(stops)
  })
  it('stops microphone capture on mute and only restarts when enabled', async () => {
    await act(async () => session.setAudioMode('headphones'))
    await act(async () => session.toggleMicMute())
    expect(session.micMuted).toBe(true)
    expect(mocks.mic.stopListening).toHaveBeenCalled()
    const starts = mocks.mic.startListening.mock.calls.length
    await render()
    expect(mocks.mic.startListening).toHaveBeenCalledTimes(starts)
    await act(async () => session.toggleMicMute())
    expect(session.micMuted).toBe(false)
    expect(mocks.mic.startListening).toHaveBeenCalledTimes(starts + 1)
  })
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

it('retains microphone Good hits in the final rhythm score', async () => {
  const claps: ExerciseDefinition = { ...exercise, instrument:'timbale', events:[1,2,3,4].map(beat=>({...exercise.events[0],instrument:'timbale',beat,expectedPitch:undefined,chordId:undefined})) }
  await act(async()=>session.selectExercise(claps))
  await act(async()=>session.setAudioMode('headphones'))
  await act(async()=>session.startExercise())
  mocks.context.currentTime=2
  await act(async()=>vi.advanceTimersByTime(30))
  mocks.mic.recentOnsets=[2.079,2.579,3.079,3.579].map(timestamp=>({timestamp,energy:.005}))
  await render()
  expect(session.eventResults.filter(r=>r.grade==='good')).toHaveLength(4)
  mocks.context.currentTime=4.4
  await act(async()=>vi.advanceTimersByTime(50))
  expect(session.attemptStats?.rhythm).toMatchObject({toleranceMs:80,matched:4,f1:100})
})

it('awards the passing minimum to a complete all-Keep-going take although F1 is zero', async () => {
  const claps: ExerciseDefinition = { ...exercise, instrument:'timbale', events:[1,2,3,4].map(beat=>({...exercise.events[0],instrument:'timbale',beat,expectedPitch:undefined,chordId:undefined})) }
  await act(async()=>session.selectExercise(claps))
  await act(async()=>session.setAudioMode('headphones'))
  await act(async()=>session.startExercise())
  mocks.context.currentTime=2
  await act(async()=>vi.advanceTimersByTime(30))
  mocks.mic.recentOnsets=[2.09,2.59,3.09,3.59].map(timestamp=>({timestamp,energy:.005}))
  await render()
  expect(session.currentAccuracy).toBe(75)
  mocks.context.currentTime=4.4
  await act(async()=>vi.advanceTimersByTime(50))
  expect(session.attemptStats?.accuracy).toBe(75)
  expect(session.attemptStats?.rhythm?.f1).toBe(0)
})

it('subtracts validated hardware latency exactly once in live and final microphone grading', async()=>{
 const live={context:mocks.context as unknown as AudioContext,stream:{active:true} as MediaStream}
 mocks.mic.getLiveAudioInput.mockReturnValue(live)
 recordSessionLatency(live,{reliable:true,medianMs:80,detected:8,total:8} as LoopbackResult)
 recordSessionLatency(live,{reliable:true,medianMs:80,detected:8,total:8} as LoopbackResult)
 // Browser estimates can drift without a device or session change.
 Object.assign(mocks.context,{outputLatency:.020001,baseLatency:.005})
 const claps:ExerciseDefinition={...exercise,instrument:'timbale',events:[1,2,3,4].map(beat=>({...exercise.events[0],instrument:'timbale',beat,expectedPitch:undefined,chordId:undefined}))}
 await act(async()=>session.selectExercise(claps))
 await act(async()=>session.setAudioMode('headphones'))
 await act(async()=>session.startExercise())
 mocks.context.currentTime=2;await act(async()=>vi.advanceTimersByTime(30))
 mocks.mic.recentOnsets=[2.08,2.58,3.08,3.58].map(timestamp=>({timestamp,energy:.005}))
 await render()
 expect(session.eventResults.every(r=>r.grade==='perfect')).toBe(true)
 expect(session.eventResults).toHaveLength(4)
 mocks.context.currentTime=4.5;await act(async()=>vi.advanceTimersByTime(50))
 expect(session.attemptStats?.micLatencyMs).toBe(80)
 expect(session.attemptStats?.accuracy).toBe(100)
 expect(session.attemptStats?.rhythm?.meanAbsoluteErrorMs).toBeCloseTo(0)
 mocks.mic.getLiveAudioInput.mockReturnValue(null)
})


it('starts Your turn with the click on and restores it for the next exercise', async () => {
  await act(async () => { root.render(<Harness key="your-turn" defaultAudioMetronome />) })
  expect(session.audioMetronome).toBe(true)
  await act(async () => { session.setAudioMetronome(false) })
  expect(session.audioMetronome).toBe(false)
  await act(async () => { session.selectExercise(exercise) })
  expect(session.audioMetronome).toBe(true)
})
