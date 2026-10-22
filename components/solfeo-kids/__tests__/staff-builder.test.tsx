// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {it,expect,vi} from 'vitest'
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
vi.mock('@/components/solfeo/use-note-demonstration',()=>({useNoteDemonstration:()=>({play:()=>Promise.resolve(),stop:()=>{}})}))
vi.mock('../first-garden',()=>({GardenFrame:({children,reaction}:{children:React.ReactNode;reaction?:{result:string}})=><section data-result={reaction?.result}>{children}</section>}))
import {StaffBuilder} from '../staff-builder'
it('builds five lines then four spaces, blocks double clicks and celebrates only after painting',async()=>{
 Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers()
 const host=document.createElement('div'),root=createRoot(host)
 try{
  await act(async()=>root.render(<StaffBuilder/>))
  for(let step=0;step<9;step++){
   const label=step<5?`Dibujar línea ${step+1}`:`Pintar espacio ${step-4}`
   const button=host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
   expect(button).toBeTruthy();await act(async()=>button.click())
   expect(button.disabled).toBe(true)
   expect(host.querySelectorAll('svg[role=img] rect')).toHaveLength(Math.max(0,step-4))
   expect(host.querySelector('[data-result=correct]')).toBeNull()
   await act(async()=>vi.advanceTimersByTime(800))
  }
  expect(host.querySelector('[data-result=correct]')).not.toBeNull()
  expect(host.textContent).toContain('5 / 5 líneas · 4 / 4 espacios')
  const reset=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Construir otra vez'))!
  await act(async()=>reset.click());expect(host.querySelector('svg[aria-label="0 líneas y 0 espacios construidos"]')).not.toBeNull()
 }finally{await act(async()=>root.unmount());vi.useRealTimers()}
})
it('offers the fruit-to-note comparison after completing the line and space demonstration',async()=>{
 Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers()
 const host=document.createElement('div'),root=createRoot(host)
 try{
  await act(async()=>root.render(<StaffBuilder fruits/>))
  for(let step=0;step<9;step++){
   const label=step<5?`Dibujar línea ${step+1}`:`Pintar espacio ${step-4}`
   await act(async()=>host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click())
   await act(async()=>vi.advanceTimersByTime(800))
  }
  const toggle=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Transformar en notas'))!
  expect(toggle).toBeTruthy()
  await act(async()=>toggle.click())
  expect(toggle.getAttribute('aria-pressed')).toBe('true')
  expect(host.querySelectorAll('ellipse[transform="rotate(-15)"]')).toHaveLength(9)
  expect(host.textContent).toContain('Una clave nos dirá sus nombres')
 }finally{await act(async()=>root.unmount());vi.useRealTimers()}
})
