// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReadyCheck, type ReadyCheckProps } from '../ready-check'
import type { CalibrationData } from '@/lib/play-sense/types'
const auth = vi.hoisted(() => ({userId:null as string | null}))
vi.mock('@/lib/supabase/client', () => ({createClient: () => ({auth:{getSession:async()=>({data:{session:auth.userId ? {user:{id:auth.userId}} : null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}})}})}))
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ locale:'en', t:(key:string) => key }) }))
let root: Root, host: HTMLDivElement, props: ReadyCheckProps
const render = (patch: Partial<ReadyCheckProps> = {}) => act(() => { props = {...props,...patch};root.render(<ReadyCheck {...props}/>) })
const click = (label:string) => act(() => {
  const button = [...host.querySelectorAll('button')].find(el=>el.textContent === label || el.getAttribute('aria-label') === label) as HTMLButtonElement
  expect(button, label).toBeDefined();expect(button.disabled,label).toBe(false);button.click()
})
beforeEach(async () => {
  auth.userId='student';localStorage.clear()
  vi.useFakeTimers(); Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
  host=document.createElement('div');document.body.append(host);root=createRoot(host)
  props={ instrument:'timbale',audioMode:'headphones',onMode:vi.fn(),inputLevel:.001,inputPeak:.01,micOpen:true,micHeard:false,deviceLabel:'Camera',onTestMic:vi.fn(),calibrating:false,calibrationBeat:0,totalCalibrationBeats:16,calibrationError:null,latencyMs:null,onCalibrate:vi.fn(),bleConnected:false,onConnectBle:vi.fn(),preview:null,meta:'test',onStart:vi.fn(),micSetup:{devices:[],selectedId:'camera',muted:false,onSelect:vi.fn(),onMute:vi.fn(),onsets:[],onFloor:vi.fn(),timingResult:null} }
  render()
  await act(async()=>{})
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers()})
it('walks through room, diagnostic timing and nine claps before permitting Start', () => {
  const guide = () => host.querySelector('[aria-label="Setup guide"]')!
  expect(guide().parentElement?.getAttribute('data-guide-column')).toBe('1')
  expect(guide().getAttribute('data-status')).toBe('active')
  click('Confirm Sound');click('Measure room noise')
  expect(guide().parentElement?.getAttribute('data-guide-column')).toBe('2')
  expect(host.querySelector('[data-guide-column="1"] .lx-guide-confirmed')).not.toBeNull()
  act(()=>vi.advanceTimersByTime(8000))
  expect(guide().parentElement?.getAttribute('data-guide-column')).toBe('3')
  expect(host.textContent).toContain('Follow the metronome clock')
  click('Measure Timing');expect(props.onCalibrate).toHaveBeenCalledTimes(1)
  render({calibrating:true})
  render({calibrating:false,micSetup:{...props.micSetup!,timingResult:{latencyMs:32,iqrMs:12} as CalibrationData}})
  expect(guide().getAttribute('data-status')).toBe('done')
  click('Continue to Instrument');click('Test claps')
  expect(guide().parentElement?.getAttribute('data-guide-column')).toBe('4')
  let t=1
  for (const energy of [.03,.06,.12]) {
    const onsets = [0,1,2].map(()=>({timestamp:t++,energy,peak:energy,rms:energy/2}))
    render({inputLevel:.1,inputPeak:.3,micSetup:{...props.micSetup!,onsets}})
    expect(host.querySelector('[aria-label="3 / 3"]')).not.toBeNull()
    click('Confirm')
  }
  expect(props.micSetup?.onFloor).toHaveBeenCalledWith(.012)
  expect(host.textContent).toContain('Setup complete')
  expect(guide().getAttribute('data-status')).toBe('done')
  click('Start exercise');expect(props.onStart).toHaveBeenCalledTimes(1)
})
it('does not apply the acoustic wizard or its extra card to PlaySense', () => {
  vi.mocked(props.micSetup!.onFloor).mockClear()
  render({audioMode:'playsense'})
  expect(host.querySelector('[aria-label="Setup guide"]')).toBeNull()
  expect(host.querySelector('[data-ready-panel="instrument"]')).toBeNull()
  click('dashboard.classViewer.lessonMode.ready.playsenseConnect')
  expect(props.onConnectBle).toHaveBeenCalledOnce()
  expect(props.micSetup?.onFloor).not.toHaveBeenCalled()
})
it('stops room measurement while muted and exposes browser microphone selection', () => {
  click('Confirm Sound');click('Measure room noise')
  act(()=>vi.advanceTimersByTime(1000))
  render({micOpen:false,micSetup:{...props.micSetup!,muted:true}})
  act(()=>vi.advanceTimersByTime(10000))
  expect(host.textContent).toContain('Select your microphone')
  expect(host.querySelector('[aria-label="Setup guide"]')?.getAttribute('data-status')).toBe('error')
  expect(host.textContent).not.toContain('Follow the metronome clock')
  click('Enable microphone');expect(props.micSetup?.onMute).toHaveBeenCalledOnce()
  expect(host.querySelector('select[aria-label="Select microphone"]')).not.toBeNull()
})

it('rejects medium claps quieter than soft and accepts a measured louder retry', () => {
  click('Confirm Sound');click('Measure room noise')
  act(()=>vi.advanceTimersByTime(8000))
  click('Measure Timing');render({calibrating:true})
  render({calibrating:false,micSetup:{...props.micSetup!,timingResult:{latencyMs:12,iqrMs:8} as CalibrationData}})
  click('Continue to Instrument');click('Test claps')
  let timestamp=1
  const clap = (peak:number) => {
    render({micSetup:{...props.micSetup!,onsets:[0,1,2].map(()=>({timestamp:timestamp++,energy:.03,peak,rms:peak/2}))}})
    click('Confirm')
  }
  clap(.1)
  expect(host.textContent).toContain('Med') // medium round
  clap(.05)
  expect(host.querySelector('[aria-label="3 / 3"] .text-green-500')).toBeNull()
  expect(host.textContent).toContain('awaiting validation')
  expect(host.textContent).toContain('Minimum target')
  expect(host.querySelector('[aria-label="Setup guide"]')?.getAttribute('data-status')).toBe('error')
  expect(host.textContent).toContain('3 dB')
  expect(host.textContent).not.toContain('Clap 3 times: strong')
  click('Repeat three claps');clap(.125)
  expect(host.textContent).toContain('Measured difference:')
  expect(host.textContent).not.toContain('Clap 3 times: strong')
  click('Repeat three claps');clap(.15)
  expect(host.textContent).toContain('Clap 3 times: strong')
})

it('allows rhythm-only calibration without claiming dynamics were calibrated', () => {
  click('Confirm Sound');click('Measure room noise')
  act(()=>vi.advanceTimersByTime(8000))
  click('Measure Timing');render({calibrating:true})
  render({calibrating:false,micSetup:{...props.micSetup!,timingResult:{latencyMs:12,iqrMs:8} as CalibrationData}})
  click('Continue to Instrument');click('Test claps')
  render({micSetup:{...props.micSetup!,onsets:[.1,.3,.3].map((peak,i)=>({timestamp:i+1,energy:.03,peak,rms:peak/2}))}})
  click('Use this level for rhythm')
  expect(host.textContent).toContain('dynamics remain uncalibrated')
  click('Start exercise')
  expect(props.onStart).toHaveBeenCalledOnce()
})

it('does not accept soft levels that leave an impossible target for strong claps', () => {
  click('Confirm Sound');click('Measure room noise')
  act(()=>vi.advanceTimersByTime(8000))
  click('Measure Timing');render({calibrating:true})
  render({calibrating:false,micSetup:{...props.micSetup!,timingResult:{latencyMs:12,iqrMs:8} as CalibrationData}})
  click('Continue to Instrument');click('Test claps')
  render({micSetup:{...props.micSetup!,onsets:[0,1,2].map(i=>({timestamp:i+1,energy:.03,peak:.9,rms:.6166}))}})
  expect(host.textContent).toContain('insufficient room')
  expect(host.textContent).not.toContain('Round approved')
  click('Continue with rhythm only')
  expect(host.textContent).toContain('dynamics remain uncalibrated')
  click('Start exercise')
  expect(props.onStart).toHaveBeenCalledOnce()
})

it('restores a saved user profile on a later visit without repeating the wizard', async () => {
  act(()=>root.unmount())
  auth.userId='student-a'
  localStorage.setItem('lmm.acoustic.v3.student-a.camera.claps.headphones',JSON.stringify({version:3,noise:.001,floor:.004,mode:'rhythm-only',at:new Date().toISOString()}))
  root=createRoot(host)
  props.onProfileRestored=vi.fn()
  await act(async()=>{root.render(<ReadyCheck {...props}/>);await Promise.resolve()})
  expect(props.micSetup?.onFloor).toHaveBeenCalledWith(.004)
  expect(host.textContent).toContain('Saved calibration restored')
  expect(host.textContent).toContain('Calibration saved in this browser')
  expect(props.onProfileRestored).toHaveBeenCalledOnce()
  click('Start exercise')
  expect(props.onStart).toHaveBeenCalledOnce()
})

it('starts explicit recalibration at Sound without loading or replacing the previous profile', async () => {
  act(()=>root.unmount())
  const key='lmm.acoustic.v3.student.camera.claps.headphones'
  const profile=JSON.stringify({version:3,noise:.001,floor:.004,mode:'rhythm-only',at:'2026-10-01T10:00:00Z'})
  localStorage.setItem(key,profile)
  props.forceFresh=true;props.onProfileRestored=vi.fn()
  root=createRoot(host)
  await act(async()=>{root.render(<ReadyCheck {...props}/>);await Promise.resolve()})
  expect(host.textContent).toContain('Choose how you will listen')
  expect(props.onProfileRestored).not.toHaveBeenCalled()
  expect(localStorage.getItem(key)).toBe(profile)
})

it('hides calibration panels while restoring a saved profile and opening the mic', async () => {
  localStorage.setItem('lmm.acoustic.v3.student.camera.claps.headphones', JSON.stringify({version:3,noise:.001,floor:.003,mode:'rhythm-only',at:new Date().toISOString()}))
  act(() => root.unmount())
  root=createRoot(host)
  const restored=vi.fn()
  render({micOpen:false,onProfileRestored:restored})
  expect(host.querySelector('[data-ready-panel]')).toBeNull()
  await act(async()=>{})
  expect(host.textContent).toContain('Preparing your turn')
  expect(host.querySelector('[data-ready-panel]')).toBeNull()
  render({micOpen:true})
  expect(restored).toHaveBeenCalledOnce()
  expect(props.micSetup?.onFloor).toHaveBeenCalledWith(.003)
})
