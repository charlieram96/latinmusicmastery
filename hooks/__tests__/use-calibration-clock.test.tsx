// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { calibrationVisual, useCalibration } from '../use-calibration'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('uses four count-in clicks, then sixteen measured clicks without drifting after delayed frames', () => {
  expect(calibrationVisual(9.99, 10)).toMatchObject({ countInBeat: 0, beat: 0, pulse: 0 })
  for (let i = 0; i < 20; i++) {
    expect(calibrationVisual(10 + i * .6, 10)).toMatchObject({
      phase: i < 4 ? 'count-in' : 'measuring', pulse: i % 4 + 1,
      beat: Math.max(0, i - 3), countInBeat: i < 4 ? i + 1 : 0,
    })
  }
  expect(calibrationVisual(13.85, 10)).toMatchObject({ beat: 3, pulse: 0 })
  expect(calibrationVisual(22, 10).pulse).toBe(0)
})
it('drives the mic visuals from audible output time and cancels queued clicks on mute/cancel', () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn, 16))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  let audibleTime = 0
  const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const context = {
    currentTime: 10, sampleRate: 48000, destination: {},
    getOutputTimestamp: () => ({ contextTime: audibleTime, performanceTime: performance.now() || .001 }),
    createOscillator: () => { const osc = { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; oscillators.push(osc); return osc },
    createGain: () => ({ gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }),
  }
  let session!: ReturnType<typeof useCalibration>
  function Harness() { session = useCalibration(); return null }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(<Harness />))
  act(() => session.startCalibration(context as unknown as AudioContext, { type: 'mic', workletNode: null }))
  expect(oscillators).toHaveLength(20)
  expect(oscillators[0].start).toHaveBeenCalledWith(10.05)
  context.currentTime = 10.5
  audibleTime = 10.06
  act(() => vi.advanceTimersByTime(16))
  expect(session.calibrationVisual).toMatchObject({ phase: 'count-in', countInBeat: 1, pulse: 1, beat: 0 })
  context.currentTime = 13
  audibleTime = 12.46
  act(() => vi.advanceTimersByTime(16))
  expect(session.calibrationVisual).toMatchObject({ phase: 'measuring', beat: 1, pulse: 1 })
  expect(session.getTimingElapsed()).toBeCloseTo(.01, 2)
  act(() => session.cancelCalibration())
  expect(session.calibrationVisual).toBeNull()
  expect(oscillators.every(osc => osc.stop.mock.calls.length === 2)).toBe(true)
  act(() => vi.advanceTimersByTime(1000))
  expect(session.calibrationBeat).toBe(0)
  act(() => root.unmount())
})

it.each([false,true])('keeps microphone timing provisional and rejects irregular input (irregular=%s)', irregular => {
  vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  vi.stubGlobal('requestAnimationFrame',(fn:()=>void)=>setTimeout(fn,16));vi.stubGlobal('cancelAnimationFrame',clearTimeout)
  const old=JSON.stringify({latencyMs:99})
  localStorage.setItem('playSenseCalibration',old)
  let handler:(event: {data:{type:string;timestamp:number;energy:number}})=>void=()=>{}
  const port={addEventListener:(_type:string,fn:typeof handler)=>{handler=fn},removeEventListener:vi.fn()}
  const context={currentTime:10,sampleRate:48000,destination:{},
    createOscillator:()=>({frequency:{value:0},connect:vi.fn(),start:vi.fn(),stop:vi.fn()}),
    createGain:()=>({gain:{value:0,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn()})}
  let session!:ReturnType<typeof useCalibration>
  function Harness(){session=useCalibration();return null}
  const root=createRoot(document.createElement('div'))
  act(()=>root.render(<Harness/>))
  act(()=>session.startCalibration(context as unknown as AudioContext,{type:'mic',workletNode:{port} as unknown as AudioWorkletNode}))
  act(()=>{
    for(let i=0;i<16;i++)handler({data:{type:'onset',timestamp:12.45+i*.6+(irregular?(i%2 ? .15 : -.15):.04),energy:.03}})
    context.currentTime=23;vi.advanceTimersByTime(16)
  })
  expect(session.timingHits).toHaveLength(16)
  if(irregular){expect(session.calibrationData).toBeNull();expect(session.calibrationError).toBe('timing-inconsistent')}
  else {expect(session.calibrationData?.latencyMs).toBeCloseTo(40);expect(session.calibrationError).toBeNull()}
  expect(localStorage.getItem('playSenseCalibration')).toBe(old)
  act(()=>root.unmount())
})
