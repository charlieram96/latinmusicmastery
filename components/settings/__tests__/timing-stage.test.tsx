// @vitest-environment jsdom
import React, {act,useEffect} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import type {ReadyCheckProps} from '@/components/class-viewer/lesson-viewer/ready-check'
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
vi.mock('@/components/ui/dialog',()=>({Dialog:({children}:any)=><div>{children}</div>,DialogContent:({children}:any)=><div>{children}</div>,DialogTitle:({children}:any)=><h2>{children}</h2>,DialogDescription:({children}:any)=><p>{children}</p>}))
vi.mock('@/components/play-sense/stage-highway/StageHighway',()=>({StageHighway:({onStatus}:any)=>{useEffect(()=>onStatus('ready'),[]);return <div/>}}))
import {TimingStage} from '../timing-stage'
import {readTimingCompensation} from '@/lib/audio/timing-compensation'
let root:Root, host:HTMLDivElement, setup:ReadyCheckProps
const close=vi.fn()
const live={context:{currentTime:1,sampleRate:48000},stream:{getAudioTracks:()=>[{getSettings:()=>({deviceId:'test'})}]}}
const render=async()=>{await act(async()=>root.render(<TimingStage setup={setup} onClose={close}/>))}
async function click(text:string){const button=[...host.querySelectorAll('button')].find(b=>b.textContent?.includes(text));expect(button).toBeTruthy();await act(async()=>button!.click())}
async function take(offset:number){
 setup={...setup,calibrating:true,timingHits:[],calibrationVisual:{phase:'measuring',countInBeat:0,beat:1,pulse:1}};await render()
 setup={...setup,calibrating:false,latencyMs:offset,timingHits:Array.from({length:16},(_,beat)=>({beat,offsetMs:offset,elapsed:beat*.6+offset/1000}))};await render()
}
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);close.mockClear()
 const data=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)})
 host=document.createElement('div');root=createRoot(host)
 setup={audioMode:'headphones',micOpen:true,calibrating:false,calibrationError:null,onCalibrate:vi.fn(),micSetup:{getLiveAudioInput:()=>live,onsets:[]},getTimingElapsed:()=>-1} as unknown as ReadyCheckProps
 await render()
})
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals()})
it('starts at zero, advances progressively, and keeps saving available',async()=>{
 await click('Comenzar sin');await take(150)
 const result=host.querySelector('[aria-label="Resultado de precisión"]')
 expect(result?.textContent).toContain('0.0 %')
 expect(result?.textContent).toContain('Aplausos atrasados')
 expect(result?.textContent).toContain('+150.0 ms')
 expect(host.textContent).toContain('0.0 %')
 await click('Probar Garrapatea');await take(150)
 await click('Probar Semifusa');await take(150)
 await click('Probar Fusa');await take(150)
 await click('Probar Semicorchea');await take(150)
 expect(host.querySelector('[aria-label="Resultado de precisión"]')?.textContent).toContain('Dentro del margen de sincronización')
 expect(host.textContent).toContain('100.0 %')
 expect(host.textContent).toContain('Guardar compensación y continuar')
 await click('Repetir este');await take(150)
 await click('Guardar compensación')
 expect(close).toHaveBeenCalledWith(true)
 expect(readTimingCompensation(live as any,'headphones')).toBe(150)
 expect(readTimingCompensation(live as any,'speaker-safe')).toBeNull()
})
it('shows a visible zero percent result even when no claps were captured',async()=>{
 await click('Comenzar sin')
 setup={...setup,calibrating:true};await render()
 setup={...setup,calibrating:false,timingHits:[],calibrationError:'timing-insufficient'};await render()
 const result=host.querySelector('[aria-label="Resultado de precisión"]')
 expect(result?.textContent).toContain('0.0 %')
 expect(result?.textContent).toContain('No se detectaron aplausos.')
 expect(result?.textContent).toContain('Prueba no válida')
 expect(close).not.toHaveBeenCalled()
})
it('allows any preset and a return to zero after successful takes without reusing old results',async()=>{
 await click('Semicorchea ·')
 expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain('150.0 ms')
 await click('Probar ajuste seleccionado');await take(150)
 await click('Repetir este');await take(150)
 expect(host.textContent).toContain('Guardar compensación y continuar')
 await click('Sin compensación ·')
 expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain('0.0 ms')
 expect(host.querySelector('[aria-label="Resultado de precisión"]')).toBeNull()
 expect(host.textContent).toContain('Guardar compensación y continuar')
 expect(readTimingCompensation(live as any,'headphones')).toBeNull()
 await click('Comenzar sin');await take(150)
 expect(host.querySelector('[aria-label="Resultado de precisión"]')?.textContent).toContain('0.0 %')
 expect(host.textContent).toContain('Guardar compensación y continuar')
})
it('blocks confirmation when count-in sound is detected without clapping',async()=>{
 await click('Comenzar sin')
 setup={...setup,audioMode:'speaker-safe',calibrating:true,calibrationVisual:{phase:'count-in',countInBeat:1,beat:0,pulse:1},micSetup:{...setup.micSetup!,onsets:[{timestamp:1.2,energy:.01}]}};await render()
 await take(0)
 expect(host.textContent).toContain('Se detectó sonido durante la cuenta')
 expect(host.textContent).toContain('Guardar compensación y continuar')
 expect(host.textContent).not.toContain('Probar Semifusa')
})

it('saves zero compensation even when the result is below the recommended target',async()=>{
 await click('Comenzar sin');await take(90)
 expect(host.textContent).toContain('75.0 %')
 await click('Guardar compensación')
 expect(close).toHaveBeenCalledWith(true)
 expect(readTimingCompensation(live as any,'headphones')).toBe(0)
})
it('saves a selected preset directly without requiring another take',async()=>{
 await click('Fusa ·')
 await click('Guardar compensación')
 expect(close).toHaveBeenCalledWith(true)
 expect(readTimingCompensation(live as any,'headphones')).toBe(75)
})

it('can select and save Garrapatea at its exact value',async()=>{
 await click('Garrapatea · 18.75 ms')
 await click('Guardar compensación')
 expect(readTimingCompensation(live as any,'headphones')).toBe(18.75)
})
