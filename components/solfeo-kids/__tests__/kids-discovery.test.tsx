// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
const audio=vi.hoisted(()=>({play:vi.fn().mockResolvedValue(undefined),stop:vi.fn()}))
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
vi.mock('@/components/solfeo/use-note-demonstration',()=>({useNoteDemonstration:()=>audio}))
import { KidsDiscovery } from '../kids-discovery'
import { lessonNote } from '@/lib/solfeo/notes'
let host:HTMLDivElement,root:Root
beforeEach(()=>{Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});vi.clearAllMocks();host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
describe('staff discovery sound',()=>{
 it('plays the matching pitch for each of the five lines and four spaces',async()=>{
  await act(async()=>root.render(<KidsDiscovery kind="staff"/>))
  const pitches=['E4','F4','G4','A4','B4','C5','D5','E5','F5']
  for(const [i,pitch] of pitches.entries()){
   const label=i%2?`Espacio ${(i+1)/2}`:`Línea ${i/2+1}`
   const button=host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
   await act(async()=>button.click())
   expect(audio.play).toHaveBeenLastCalledWith([{frequency:lessonNote(pitch).frequency,beats:1,index:i}],{preview:true})
   expect(button.getAttribute('aria-pressed')).toBe('true')
  }
 })
 it('keeps visual exploration available with sound off and resumes when enabled',async()=>{
  await act(async()=>root.render(<KidsDiscovery kind="staff"/>))
  const toggle=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.startsWith('Sonido'))!
  const line=host.querySelector<HTMLButtonElement>('button[aria-label="Línea 2"]')!
  await act(async()=>toggle.click());await act(async()=>line.click())
  expect(audio.play).not.toHaveBeenCalled();expect(line.getAttribute('aria-pressed')).toBe('true')
  await act(async()=>toggle.click());await act(async()=>line.click())
  expect(audio.play).toHaveBeenCalledOnce()
 })
})
