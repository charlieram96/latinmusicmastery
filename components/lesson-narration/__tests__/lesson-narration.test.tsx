// @vitest-environment jsdom
import React, {act, useRef} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {beforeEach, afterEach, it, expect, vi} from 'vitest'
import {LessonNarration, collectNarration} from '../lesson-narration'
import {femaleVoices, narrationChunks} from '@/lib/narration/text'
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
let root:Root,host:HTMLDivElement
const speak=vi.fn(),cancel=vi.fn(),pause=vi.fn(),resume=vi.fn()
const voices=[{name:'Google español de Estados Unidos',lang:'es-US',voiceURI:'es-female',localService:false},{name:'Google US English',lang:'en-US',voiceURI:'en-female',localService:false}]
beforeEach(()=>{
 Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true})
 vi.stubGlobal('SpeechSynthesisUtterance',class {constructor(public text:string){}})
 vi.stubGlobal('speechSynthesis',{getVoices:()=>voices,speak,cancel,pause,resume,addEventListener:vi.fn(),removeEventListener:vi.fn()})
 vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
 host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.clearAllMocks()
})
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals()})
function Fixture({page=1,language='es',practice=false}:{page?:number;language?:string;practice?:boolean}) {
 const target=useRef<HTMLDivElement>(null)
 return <><div ref={target}><h2>Clase {page}</h2><p>El <strong>pentagrama</strong> tiene cinco líneas.</p><p hidden>Respuesta secreta</p><div data-lesson-community>Comentario privado</div><button>Guardar</button><svg><text>No leer glifo</text></svg></div>{!practice&&<LessonNarration target={target} resetKey={page} language={language}/>}</>
}
async function click(label:string){const b=host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);expect(b).not.toBeNull();await act(async()=>b!.click())}
it('reads authored paragraphs in order and excludes controls, hidden text, comments and notation',async()=>{
 await act(async()=>root.render(<Fixture/>))
 const target=host.firstElementChild as HTMLElement
 expect(collectNarration(target).map(p=>p.text)).toEqual(['Clase 1','El pentagrama tiene cinco líneas.'])
 await click('Escuchar la lección')
 expect(speak.mock.calls[0][0].text).toBe('Clase 1')
 await act(async()=>speak.mock.calls[0][0].onend())
 expect(speak.mock.calls[1][0].text).toBe('El pentagrama tiene cinco líneas.')
 expect(host.querySelector('[data-narration-active]')?.tagName).toBe('P')
})
it('pauses, resumes, cancels on page change and ignores stale callbacks',async()=>{
 await act(async()=>root.render(<Fixture/>));await click('Escuchar la lección')
 const old=speak.mock.calls[0][0]
 await click('Pausar narración');expect(pause).toHaveBeenCalledOnce()
 await click('Continuar narración');expect(resume).toHaveBeenCalledOnce()
 await act(async()=>root.render(<Fixture page={2}/>))
 expect(cancel).toHaveBeenCalled();expect(host.querySelector('[data-narration-active]')).toBeNull()
 await act(async()=>old.onend());expect(speak).toHaveBeenCalledOnce()
})
it('stops on practice navigation and uses the authored language',async()=>{
 await act(async()=>root.render(<Fixture language="en"/>));await click('Escuchar la lección')
 expect(speak.mock.calls[0][0].lang).toBe('en-US')
 await act(async()=>root.render(<Fixture practice/>));expect(cancel).toHaveBeenCalled()
 expect(host.querySelector('[aria-label="Escuchar la lección"]')).toBeNull()
})
it('stops when a musical example begins',async()=>{
 await act(async()=>root.render(<Fixture/>));await click('Escuchar la lección')
 await act(async()=>window.dispatchEvent(new Event('lmm-book-sound-start')))
 expect(cancel).toHaveBeenCalled();expect(host.querySelector('[data-narration-active]')).toBeNull()
})
it('never substitutes a voice from a different language or a male default',()=>{
 const male={name:'Jorge',lang:'es-ES',voiceURI:'male',localService:true}
 expect(femaleVoices([male,...voices],'es')).toEqual([voices[0]])
 expect(femaleVoices(voices,'fr')).toEqual([])
})
it('splits long lessons without losing words',()=>{
 const text='Una explicación extensa para escuchar con tranquilidad. '.repeat(50).trim()
 const chunks=narrationChunks(text)
 expect(chunks.length).toBeGreaterThan(1)
 expect(chunks.every(c=>c.length<=220)).toBe(true)
 expect(chunks.join(' ')).toBe(text)
})
async function seek(percent:number){
 const slider=host.querySelector<HTMLInputElement>('input[type="range"]')!
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!
 await act(async()=>{setter.call(slider,String(percent));slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}))})
}
it('seeks forward and backward and ignores callbacks from canceled speech',async()=>{
 await act(async()=>root.render(<Fixture/>));await click('Escuchar la lección')
 const old=speak.mock.calls[0][0]
 await seek(60)
 expect(speak.mock.calls.at(-1)![0].text).toContain('cinco líneas.')
 const count=speak.mock.calls.length
 await act(async()=>old.onend());expect(speak).toHaveBeenCalledTimes(count)
 await seek(0);expect(speak.mock.calls.at(-1)![0].text).toBe('Clase 1')
})
it('keeps a seek paused until resumed and resets progress on navigation',async()=>{
 await act(async()=>root.render(<Fixture/>));await click('Escuchar la lección');await click('Pausar narración')
 await seek(60);expect(speak).toHaveBeenCalledOnce()
 expect(host.querySelector('[data-narration-state]')?.getAttribute('data-narration-state')).toBe('paused')
 await click('Continuar narración');expect(speak).toHaveBeenCalledTimes(2)
 await act(async()=>root.render(<Fixture page={2}/>))
 expect(host.querySelector('input[type="range"]')).toBeNull()
})
it('cancels the old language and reads changed lesson text using the matching new voice',async()=>{
 function Localized({language}:{language:string}){
  const target=useRef<HTMLDivElement>(null)
  return <><div ref={target}><p>{language==='en'?'The staff has five lines.':'El pentagrama tiene cinco líneas.'}</p></div><LessonNarration target={target} resetKey="same-page" language={language}/></>
 }
 await act(async()=>root.render(<Localized language="es"/>));await click('Escuchar la lección')
 const old=speak.mock.calls[0][0]
 expect(old.lang).toBe('es-US')
 await act(async()=>root.render(<Localized language="en"/>))
 expect(cancel).toHaveBeenCalled();expect(host.querySelector('[data-narration-active]')).toBeNull()
 await click('Escuchar la lección')
 expect(speak.mock.calls.at(-1)![0].text).toBe('The staff has five lines.')
 expect(speak.mock.calls.at(-1)![0].lang).toBe('en-US')
 const count=speak.mock.calls.length
 await act(async()=>old.onend());expect(speak).toHaveBeenCalledTimes(count)
})
