import { describe,it,expect,vi } from 'vitest'
import {readFile} from 'node:fs/promises'
const gate=vi.hoisted(()=>({host:'localhost:3000'}))
vi.mock('next/headers',()=>({headers:async()=>new Headers({host:gate.host})}))
import {readKidsOutline,readKidsLesson,kidsEnabled} from '../local-course'
type SourceOutline={sections:{classes:{items:{item_type:string}[]}[]}[]}
const original:SourceOutline=JSON.parse(await readFile('local-artifacts/solfeo-course/structure.json','utf8'))
describe('Independent local children’s course',()=>{
 it('mirrors all modules, classes and item kinds with independent IDs',async()=>{
  vi.stubEnv('NODE_ENV','development');gate.host='localhost:3000'
  const kids=await readKidsOutline()
  expect(kids.sections).toHaveLength(12)
  expect(kids.sections.flatMap(s=>s.classes)).toHaveLength(149)
  for(const [i,s] of kids.sections.entries()){
   expect(s.classes.map(c=>c.items.map(x=>x.item_type))).toEqual(original.sections[i].classes.map(c=>c.items.map(x=>x.item_type)))
   for(const c of s.classes){expect(c.id).toMatch(/^local-solfeo-kids-/);for(const item of c.items)expect(item.class_id).toBe(c.id)}
  }
 })
 it('loads every lesson with preserved notation, quiz and independent next navigation',async()=>{
  vi.stubEnv('NODE_ENV','development');gate.host='localhost:3000'
  const kids=await readKidsOutline()
  for(const c of kids.sections.flatMap(s=>s.classes)){
   const result=await readKidsLesson(c.id,'es')
   expect(result,c.id).not.toBeNull()
   expect(result!.quiz.length,c.id).toBeGreaterThan(0)
   expect(result!.quiz.every(q=>q.class_item_id===c.id+'-quiz')).toBe(true)
   expect(result!.book.nextHref).not.toContain('/solfeo-preview')
   if(result!.book.module>1){
    const src=JSON.parse(await readFile(`local-artifacts/solfeo-course/book-audit/${c.id.replace('local-solfeo-kids-','local-solfeo-')}.json`,'utf8'))
    expect(result!.book.vectors).toEqual(src.vectors)
    expect(result!.book.practice).toEqual(src.practice)
   }
  }
 },60000)
 it('keeps development local, enables the published course, and rejects unknown IDs',async()=>{
  gate.host='example.com';vi.stubEnv('NODE_ENV','development');expect(await kidsEnabled()).toBe(false)
  await expect(readKidsOutline()).rejects.toThrow('localhost')
  gate.host='localhost:3000';vi.stubEnv('NODE_ENV','production');expect(await kidsEnabled()).toBe(true)
  vi.stubEnv('NODE_ENV','development');expect(await readKidsLesson('../../x','es')).toBeNull()
  expect(await readKidsLesson('local-solfeo-kids-m99-c99','es')).toBeNull()
  vi.unstubAllEnvs()
 })
})
