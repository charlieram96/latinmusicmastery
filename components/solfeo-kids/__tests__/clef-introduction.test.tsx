// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
vi.mock('../first-garden',()=>({GardenFrame:({children}:{children:React.ReactNode})=><div>{children}</div>}))
vi.mock('../answer-reaction',()=>({KidsCorcheita:()=> <svg/>}))
const audio=vi.hoisted(()=>({play:vi.fn().mockResolvedValue(undefined)}))
vi.mock('@/components/solfeo/use-note-demonstration',()=>({useNoteDemonstration:()=>audio}))
import {ClefIntroduction} from '../clef-introduction'
it('introduces the clef before delivering, exploring and placing G',async()=>{
 Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true})
 vi.stubGlobal('matchMedia',()=>({matches:false}))
 const host=document.createElement('div'),root=createRoot(host)
 const click=async(text:string)=>act(async()=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===text);expect(b).toBeTruthy();b!.click()})
 const end=async(selector:string)=>act(async()=>{const el=host.querySelector(selector);expect(el).toBeTruthy();el!.dispatchEvent(new Event('animationend',{bubbles:true}))})
 await act(async()=>root.render(<ClefIntroduction/>))
 expect(host.querySelector('[aria-label="Escuchar nota Sol"]')).toBeNull()
 expect(host.textContent).not.toContain('Sol · segunda línea')
 await click('🕷️ Toca para tejer la clave')
 await end('path[pathLength="1"]')
 expect(host.textContent).toContain('Dar la nota a la arañita')
 expect(host.querySelector('[aria-label="Escuchar nota Sol"]')).toBeNull()
 await click('🎵 Dar la nota a la arañita')
 await end('g[class*="handoff"]')
 expect(host.querySelector('[aria-label="Escuchar nota Sol"]')).toBeNull()
 await end('g[class*="search"]')
 expect(host.querySelector('[aria-label="Escuchar nota Sol"]')).not.toBeNull()
 expect(audio.play).toHaveBeenCalledOnce()
 await click('🕷️ Empezar otra vez')
 expect(host.querySelector('[aria-label="Escuchar nota Sol"]')).toBeNull()
 await act(async()=>root.unmount())
 vi.unstubAllGlobals()
})
