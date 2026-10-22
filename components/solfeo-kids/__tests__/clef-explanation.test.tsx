// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
const audio=vi.hoisted(()=>({play:vi.fn().mockResolvedValue(undefined),stop:vi.fn()}))
vi.mock('@/components/solfeo/use-note-demonstration',()=>({useNoteDemonstration:()=>audio}))
import {ClefExplanation} from '../clef-explanation'
import {lessonNote} from '@/lib/solfeo/notes'
it('teaches the clef before introducing only G, with repeatable sound and no answer grading',async()=>{
 Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true})
 const host=document.createElement('div'),root=createRoot(host)
 const click=async(text:string)=>act(async()=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===text);expect(b).toBeTruthy();b!.click()})
 await act(async()=>root.render(<ClefExplanation/>))
 expect(host.textContent).toContain('Esta es la clave de Sol')
 expect(host.querySelector('[aria-label="Escuchar Sol"]')).toBeNull()
 await click('Mira dónde está →')
 expect(host.textContent).toContain('Contamos desde abajo')
 expect(host.querySelectorAll('[data-kids-notehead]')).toHaveLength(1)
 await click('Escuchemos Sol →')
 expect(audio.play).toHaveBeenLastCalledWith([{frequency:lessonNote('G4').frequency,beats:1,index:0}],{preview:true})
 expect(host.textContent).not.toMatch(/Encuéntralo|correcta|incorrecta|Comprobar/)
 await click('Repetir explicación')
 expect(host.querySelector('[aria-label="Escuchar Sol"]')).toBeNull()
 await act(async()=>root.unmount())
})
