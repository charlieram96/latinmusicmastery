import {describe,it,expect} from 'vitest'
import book from '../module-one-book.json'
import source from './fixtures/manual-content.es.json'
import {lessonNote} from '../notes'
import {LESSON_PLAYBACK_DEFAULTS} from '@/lib/playsense-studio/lesson-playback-defaults'
describe('module one manual book',()=>{
 it('preserves every authored paragraph across lesson and exercise tabs, excluding the index',()=>{
  const sourceBlocks=(source.pages as {blocks?:{type:string;text?:string}[]}[]).filter((_,i)=>[1,2,16,17,18,19,20,21,22,23].includes(i)).flatMap(p=>'blocks' in p?p.blocks??[]:[])
  const authored=book.lessons.flatMap(l=>[...l.pages,...l.practice]).flatMap(p=>p.blocks).map(b=>'text' in b?b.text:undefined)
  for(const b of sourceBlocks)if(['p','small'].includes(b.type)&&'text' in b)expect(authored).toContain(b.text)
  expect(JSON.stringify(book.lessons)).not.toContain('Índice de contenidos')
 })
 it('keeps exercises out of lesson pages and exposes all ten local classes',()=>{
  expect(book.lessons.map(l=>l.number)).toEqual([1,2,3,4,5,6,7,8,9,10])
  for(const l of book.lessons)for(const page of l.pages)for(const b of page.blocks){
   if('text' in b)expect(b.text).not.toMatch(/^(?:1\.|<b>[1-9]\.|Copia |Dibuja |Reconoce )/)
   if('kind' in b)expect(b.kind).not.toBe('blank')
  }
 })
 it('uses editable vectors and exact reference pitches, with no PDF/image embedding',()=>{
  for(const vector of Object.values(book.vectors)){
   expect(vector.svg).not.toMatch(/<(?:image|iframe|object)\b/)
   for(const n of vector.notes){expect(lessonNote(n.pitch).frequency).toBeGreaterThan(0);expect(n.dur).toBeGreaterThan(0)}
  }
  const staff=(book.lessons[2].pages.flatMap(p=>p.blocks) as {kind?:string;rows?:{events:{pitch:string}[]}[]}[]).find(b=>'kind' in b&&b.kind==='score')
  expect(staff&&'rows' in staff&&staff.rows?.[1].events.map(e=>e.pitch)).toEqual(['F4','A4','C5','E5'])
 })
 it('starts lesson playback without a count-in',()=>expect(LESSON_PLAYBACK_DEFAULTS.countInBars).toBe(0))
})

describe('authored workshop and exam sections',()=>{
 const diagrams=(i:number)=>book.lessons[i].pages.flatMap(p=>p.blocks).filter(b=>'kind' in b&&b.kind==='score') as unknown as {rows:{title:string;events:{pitch:string;dur:number}[]}[]}[]
 it('does not duplicate the exam models as two complete lessons',()=>{
  expect(diagrams(7)[0].rows).toHaveLength(2)
  expect(diagrams(8)[0].rows).toHaveLength(1)
  expect(diagrams(9)[0].rows).toHaveLength(1)
  expect(diagrams(8)[0].rows[0].events.map(n=>n.dur)).toEqual([1,2,4,8])
  expect(diagrams(9)[0].rows[0].events.map(n=>n.pitch)).toEqual(['C4','E4','F4','G4','B4','D5'])
 })
 it('keeps the original question sets independent and complete',()=>{
  const texts=(i:number)=>(book.lessons[i].practice as {blocks:{text?:string}[]}[]).flatMap(p=>p.blocks).filter(b=>'text' in b).map(b=>(b as {text:string}).text).join(' ')
  expect(texts(8)).toContain('<b>1.</b>')
  expect(texts(8)).toContain('<b>5.</b>')
  expect(texts(8)).not.toContain('<b>6.</b>')
  expect(texts(9)).toContain('<b>6.</b>')
  expect(texts(9)).toContain('<b>10.</b>')
  expect(texts(9)).not.toContain('<b>1.</b>')
 })
 it('keeps all nine values together on a single page',()=>{
  const pages=book.lessons[4].pages
  expect(pages).toHaveLength(1)
  const value=pages[0].blocks.find(b=>'kind' in b&&b.kind==='values') as unknown as {vector:string}
  const svg=(book.vectors as Record<string,{svg:string}>)[value.vector].svg
  for(const name of ['Redonda','Blanca','Negra','Corchea','Semicorchea','Fusa','Semifusa','Garrapatea','Semigarrapatea'])expect(svg).toContain(name)
 })
})
