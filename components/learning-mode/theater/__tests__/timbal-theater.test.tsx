// @vitest-environment jsdom
import React, {act} from 'react'
import {createRoot, type Root} from 'react-dom/client'
let testRoot: Root | undefined
let host: HTMLDivElement | undefined
function render(node: React.ReactNode){
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true})
 host=document.createElement('div');document.body.append(host);testRoot=createRoot(host)
 act(()=>testRoot!.render(node));return {container:host}
}
function cleanup(){if(testRoot)act(()=>testRoot!.unmount());host?.remove();testRoot=undefined}
const screen={
 getByRole:(role:string,options?:{name:string})=>{const el=options?host!.querySelector(`[role="${role}"][aria-label="${options.name}"]`):host!.querySelector(`[role="${role}"]`);if(!el)throw new Error('Missing '+role);return el},
 queryByRole:(role:string)=>host!.querySelector(`[role="${role}"]`),
}
const fireEvent=Object.fromEntries(['click','play','pause','seeking','ended','pointerDown','mouseover'].map(name=>[name,(el:Element)=>act(()=>{el.dispatchEvent(new Event(name.toLowerCase(),{bubbles:true}))})]))
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimbalTheater } from '../timbal-theater'
import { timbalScenes } from '../timbal-scenes'
const state = vi.hoisted(() => ({mode:'kids',theme:'dark',setTheme:vi.fn()}))
vi.mock('../../store',()=>({useLearningMode:()=>state.mode}))
vi.mock('@/components/theme-provider',()=>({useTheme:()=>state}))
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
afterEach(()=>{cleanup();state.mode='kids';state.theme='dark'})
describe('Timbal module theater',()=>{
 it('prepares all fourteen distinct classes, preserving authored video URLs',()=>{
  expect(new Set(timbalScenes.map(s=>s[0])).size).toBe(14)
  for(const scene of timbalScenes){const html=renderToStaticMarkup(<TimbalTheater classId={scene[0]}><video src="/authored.mp4"/></TimbalTheater>);expect(html).toContain(scene[1]);expect(html).toContain('src="/authored.mp4"')}
 })
 it('does not apply to classic mode or other modules',()=>{
  expect(renderToStaticMarkup(<TimbalTheater classId="other"><p>Content</p></TimbalTheater>)).toBe('<p>Content</p>');state.mode='classic';expect(renderToStaticMarkup(<TimbalTheater classId={timbalScenes[0][0]}><p>Content</p></TimbalTheater>)).toBe('<p>Content</p>')
 })
 it('renders the shared day setting and an honest empty stage',()=>{
  state.theme='light';const html=renderToStaticMarkup(<TimbalTheater classId={timbalScenes[0][0]} empty>{null}</TimbalTheater>);expect(html).toContain('data-day="true"');expect(html).toContain('El escenario está listo para el video');expect(html).not.toContain('<video')
 })
})

describe('Classroom interactions',()=>{
 it('opens object tips on click before and during playback, never on hover',()=>{
  const {container}=render(<TimbalTheater classId={timbalScenes[0][0]}><div data-lesson-video><video/></div></TimbalTheater>)
  for(const name of ['Solfeo','Arpa','Trompeta','Xilófono','Batería','Ventana','Reloj']){
   const object=screen.getByRole('button',{name})
   fireEvent.mouseover(object)
   expect(object.getAttribute('aria-expanded')).toBe('false')
   fireEvent.click(object)
   expect(screen.queryByRole('status')).not.toBeNull()
  }
  fireEvent.play(container.querySelector('video')!)
  fireEvent.click(screen.getByRole('button',{name:'Solfeo'}))
  expect(screen.queryByRole('status')).not.toBeNull()
 })

 it('keeps object tips available after pausing away from the beginning',()=>{
  const {container}=render(<TimbalTheater classId={timbalScenes[0][0]}><div data-lesson-video><video/></div></TimbalTheater>)
  const video=container.querySelector('video')!
  fireEvent.click(screen.getByRole('button',{name:'Reloj'}))
  expect(screen.getByRole('status').textContent).toContain('15 a 30')
  fireEvent.play(video)
  expect(screen.queryByRole('status')).toBeNull()
  video.currentTime=21
  fireEvent.pause(video)
  fireEvent.click(screen.getByRole('button',{name:'Reloj'}))
  expect(screen.getByRole('status').textContent).toContain('15 a 30')
  fireEvent.seeking(video)
  fireEvent.click(screen.getByRole('button',{name:'Reloj'}))
  expect(screen.getByRole('status').textContent).toContain('15 a 30')
 })
 it('invites the learner forward only at video end and dismisses on any control interaction',()=>{
  const {container}=render(<TimbalTheater classId={timbalScenes[0][0]}><div data-lesson-video><video/></div></TimbalTheater>)
  fireEvent.ended(container.querySelector('video')!)
  expect(screen.getByRole('status').textContent).toContain('pulsa Siguiente')
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('status')).toBeNull()
 })
})
