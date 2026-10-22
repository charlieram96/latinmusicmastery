// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { beforeEach, afterEach } from 'vitest'
import React from 'react'
const audio=vi.hoisted(()=>({play:vi.fn().mockResolvedValue(undefined),stop:vi.fn()}))
vi.mock('@/components/solfeo/use-note-demonstration',()=>({useNoteDemonstration:()=>audio}))
import { lessonNote } from '@/lib/solfeo/notes'
import structure from '@/local-artifacts/solfeo-infantil-course/structure.json'
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
vi.mock('@/components/solfeo/use-book-translation',()=>({useBookTranslation:()=>({t:(s:string)=>s})}))
vi.mock('@/components/solfeo/manual-book-page',()=>({ManualBookPage:()=>null}))
vi.mock('@/components/class-viewer/lesson-viewer/quiz-runner',()=>({QuizRunner:()=>null}))
vi.mock('../kids-discovery',()=>({KidsDiscovery:()=>null}))
vi.mock('../first-garden',()=>({GardenFrame:({children,title,detail,reaction}:{children:React.ReactNode;title:string;detail:string;reaction?:{result:string}})=><section data-result={reaction?.result}><h2>{title}</h2><p>{detail}</p>{children}</section>}))
import { StaffAdventure } from '../course-adventure'
import { adventureThemes } from '../adventure-theme'
let host:HTMLDivElement,root:Root
beforeEach(()=>{audio.play.mockClear();Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(async()=>{await act(async()=>root.unmount());host.remove()})
async function render(node:React.ReactNode){await act(async()=>root.render(node))}
const button=(label:string)=>Array.from(host.querySelectorAll('button')).find(b=>(b.getAttribute('aria-label')??b.textContent)===label)
async function click(label:string){expect(button(label)).toBeTruthy();await act(async()=>button(label)!.click())}
describe('infantile adventure coverage',()=>{
 it('assigns a distinct bilingual environment to all 12 modules and 149 lessons',()=>{
  expect(structure.sections).toHaveLength(12)
  expect(structure.sections.flatMap(s=>s.classes)).toHaveLength(149)
  expect(new Set(adventureThemes.map(t=>t.id)).size).toBe(12)
  for(const [i,section] of structure.sections.entries()){
   expect(section.classes.length).toBeGreaterThan(0)
   expect(adventureThemes[i].missionEs.length).toBeGreaterThan(10)
   expect(adventureThemes[i].missionEn.length).toBeGreaterThan(10)
   expect(adventureThemes[i].friends).toHaveLength(3)
  }
 })
 it('keeps the target after a mistake and lets the learner recover',async()=>{
  await render(<StaffAdventure onComplete={()=>{}}/>)
  await click('Espacio 1')
  expect(host.textContent).toContain('0 / 9 hogares encontrados')
  expect(host.querySelector('[role=status]')?.textContent).toContain('línea 1')
  await click('Línea 1')
  expect(host.textContent).toContain('1 / 9 hogares encontrados')
  expect(host.querySelector('[role=status]')).toBeNull()
 })
 it('plays every staff pitch, including after completing the exercise',async()=>{
  await render(<StaffAdventure onComplete={()=>{}}/>)
  const labels=['Línea 1','Espacio 1','Línea 2','Espacio 2','Línea 3','Espacio 3','Línea 4','Espacio 4','Línea 5']
  const pitches=['E4','F4','G4','A4','B4','C5','D5','E5','F5']
  for(const i of [0,2,4,6,8,1,3,5,7])await click(labels[i])
  expect(host.textContent).toContain('9 / 9 hogares encontrados')
  for(let i=0;i<9;i++){
   await click(labels[i])
   expect(audio.play).toHaveBeenLastCalledWith([{frequency:lessonNote(pitches[i]).frequency,beats:1,index:i}],{preview:true})
  }
  expect(host.textContent).toContain('9 / 9 hogares encontrados')
 })
 it('requires all five lines and four spaces before offering the quiz',async()=>{
  const complete=vi.fn();await render(<StaffAdventure onComplete={complete}/>)
  expect(button('Ir al quiz →')).toBeUndefined()
  for(const label of ['Línea 1','Línea 2','Línea 3','Línea 4','Línea 5','Espacio 1','Espacio 2','Espacio 3','Espacio 4'])await click(label)
  expect(host.textContent).toContain('9 / 9 hogares encontrados')
  await click('Ir al quiz →');expect(complete).toHaveBeenCalledOnce()
  await click('Jugar otra vez');expect(host.textContent).toContain('0 / 9 hogares encontrados')
 })
})
