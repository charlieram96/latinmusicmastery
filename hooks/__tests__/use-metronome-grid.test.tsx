// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useMetronome } from '../use-metronome'
import type { ExerciseGrid } from '@/lib/play-sense/types'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderHook<T>(hook: () => T): { result: { current: T } } {
  const result = { current: undefined as unknown as T }
  function Probe() { result.current = hook(); return null }
  const root = createRoot(document.createElement('div'))
  act(() => { root.render(<Probe />) })
  return { result }
}

function fakeAudioContext() {
  const clicks: { time: number; downbeat: boolean }[] = []
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn((time: number) => clicks.push({ time, downbeat: osc.frequency.value === 4400 })),
        stop: vi.fn(),
      }
      return osc
    }),
    createGain: vi.fn(() => ({
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
  }
  return { ctx: ctx as unknown as AudioContext, clicks }
}

afterEach(() => vi.useRealTimers())

// 4/4 at 120 bpm for bar 1, then a confirmed tempo change to 4/4 at 60 bpm for
// bar 2 (bar 2 spans seconds 2-6, at 1 s/qn).
const GRID: ExerciseGrid = {
  measureStartSec: [0, 2, 6],
  measureStartQN: [0, 4, 8],
  secPerQN: [0.5, 1],
  beatQN: [1, 1],
}

function relativeTimes(clicks: { time: number; downbeat: boolean }[], origin: number) {
  return clicks.map(c => Math.round((c.time - origin) * 1000) / 1000)
}

describe('useMetronome with a grid', () => {
  it('shifts the student click phase without shifting the exercise clock', () => {
    vi.useFakeTimers()
    const grid:ExerciseGrid={measureStartSec:[0,2],measureStartQN:[0,4],secPerQN:[.5],beatQN:[1]}
    const {result}=renderHook(()=>useMetronome({bpm:120,timeSignature:[4,4],grid,silent:false,offsetSeconds:.125}))
    const {ctx,clicks}=fakeAudioContext()
    let start=0
    act(()=>{start=result.current.startMetronome(ctx)})
    expect(start).toBeCloseTo(2.05)
    clicks.length=0
    ;(ctx as unknown as {currentTime:number}).currentTime=start+1.7
    act(()=>vi.advanceTimersByTime(30))
    expect(relativeTimes(clicks,start)).toEqual([.125,.625,1.125,1.625])
    act(()=>result.current.stopMetronome())
  })

  it('schedules a 2-bar count-in from gridCountIn, then exercise clicks from gridBeats', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useMetronome({ bpm: 120, timeSignature: [4, 4], grid: GRID, countInBars: 2, silent: false })
    )
    const { ctx, clicks } = fakeAudioContext()

    let exerciseStart = 0
    act(() => { exerciseStart = result.current.startMetronome(ctx) })

    // 2 bars x 4 beats/bar (bar 1's meter) = 8 count-in clicks, all before exerciseStart.
    const countIn = clicks.filter(c => c.time < exerciseStart)
    expect(countIn).toHaveLength(8)
    expect(countIn[countIn.length - 1].time).toBeCloseTo(exerciseStart - 0.5, 9)
    clicks.length = 0

    // Advance well into the loop so every exercise click for one pass gets scheduled.
    ;(ctx as unknown as { currentTime: number }).currentTime = exerciseStart + 5.05
    act(() => { vi.advanceTimersByTime(30) })

    expect(relativeTimes(clicks, exerciseStart)).toEqual([0, 0.5, 1, 1.5, 2, 3, 4, 5])
    expect(relativeTimes(clicks.filter(c => c.downbeat), exerciseStart)).toEqual([0, 2])
    clicks.length = 0

    // Advance past the loop length (6 s): the next scheduled click must land
    // exactly at the loop boundary and be a downbeat (the next pass's bar 1).
    ;(ctx as unknown as { currentTime: number }).currentTime = exerciseStart + 6.05
    act(() => { vi.advanceTimersByTime(30) })

    expect(relativeTimes(clicks, exerciseStart)).toEqual([6])
    expect(clicks[0].downbeat).toBe(true)

    act(() => { result.current.stopMetronome() })
  })
})

it('seeks directly into a grid without replaying earlier clicks or a count-in', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useMetronome({ bpm:120, timeSignature:[4,4], grid:GRID, silent:false }))
  const { ctx, clicks } = fakeAudioContext()
  let origin = 0
  act(() => { origin = result.current.startMetronome(ctx, 3) })
  expect(origin).toBeCloseTo(-2.95)
  act(() => { vi.advanceTimersByTime(25) })
  expect(relativeTimes(clicks, origin)).toEqual([3])
  expect(clicks[0].time).toBeCloseTo(.05)
  act(() => result.current.stopMetronome())
})

it('plays each confirmed start exactly, keeps count-in separate, and seeks without restarting the phase',()=>{
  vi.useFakeTimers()
  const anchors=[{id:'a',seconds:.125},{id:'b',seconds:1.375}]
  const grid:ExerciseGrid={measureStartSec:[0,2],measureStartQN:[0,4],secPerQN:[.5],beatQN:[1]}
  const {result}=renderHook(()=>useMetronome({bpm:120,timeSignature:[4,4],grid,silent:false,clickAnchors:anchors,durationSeconds:2}))
  const {ctx,clicks}=fakeAudioContext()
  let start=0
  act(()=>{start=result.current.startMetronome(ctx)})
  expect(clicks.filter(c=>c.time<start)).toHaveLength(4)
  clicks.length=0
  ;(ctx as unknown as {currentTime:number}).currentTime=start+1.95
  act(()=>vi.advanceTimersByTime(30))
  expect(relativeTimes(clicks,start)).toEqual([.125,.625,1.125,1.375,1.875])
  expect(relativeTimes(clicks.filter(c=>c.downbeat),start)).toEqual([.125,1.375])
  act(()=>result.current.stopMetronome())
  clicks.length=0
  act(()=>{start=result.current.startMetronome(ctx,1.4)})
  ;(ctx as unknown as {currentTime:number}).currentTime=start+1.95
  act(()=>vi.advanceTimersByTime(30))
  expect(relativeTimes(clicks,start)).toEqual([1.875])
  act(()=>result.current.stopMetronome())
})

it('stops at final bars until the next anchor while preserving the manual mute switch',()=>{
 vi.useFakeTimers();
 const {result}=renderHook(()=>useMetronome({bpm:120,timeSignature:[4,4],grid:GRID,silent:false,clickAnchors:[{id:'a',seconds:0},{id:'b',seconds:3}],clickStopSeconds:[1,4],durationSeconds:6}));
 const {ctx,clicks}=fakeAudioContext();let start=0;
 act(()=>{start=result.current.startMetronome(ctx)});clicks.length=0;
 ;(ctx as unknown as {currentTime:number}).currentTime=start+5;
 act(()=>vi.advanceTimersByTime(30));
 expect(relativeTimes(clicks,start)).toEqual([0,.5,3,3.5]);
 act(()=>result.current.stopMetronome());
 clicks.length=0;act(()=>{result.current.setSilent(true);start=result.current.startMetronome(ctx,0)});
 ;(ctx as unknown as {currentTime:number}).currentTime=start+.6;
 act(()=>vi.advanceTimersByTime(30));expect(clicks).toHaveLength(0);
 act(()=>result.current.stopMetronome());
});
