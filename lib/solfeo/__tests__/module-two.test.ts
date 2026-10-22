import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import {moduleTwoQuiz,moduleTwoExam} from '../module-two-assessment'
import {gradeQuestionScore} from '@/lib/quiz/grading'
import type {OrderingSequenceOptions} from '@/types/modules'
const base='local-artifacts/solfeo-course/book-audit/'
const books=Array.from({length:10},(_,i)=>JSON.parse(fs.readFileSync(`${base}local-solfeo-m02-c${String(i+1).padStart(2,'0')}.json`,'utf8')))
describe('Module two manual and learning sequence',()=>{
 it('has nine lessons with practice and two quizzes, then only one ten-question exam',()=>{
  const section=JSON.parse(fs.readFileSync('local-artifacts/solfeo-course/structure.json','utf8')).sections[1]
  expect(section.classes).toHaveLength(10)
  books.slice(0,9).forEach((b,i)=>{expect(b.pages.length).toBeGreaterThan(0);expect(b.practice.length).toBeGreaterThan(0);expect(moduleTwoQuiz(i+1,'es')).toHaveLength(2);expect(section.classes[i].items.map((x:{item_type:string})=>x.item_type)).toEqual(['VIDEO','EXERCISE','QUIZ'])})
  expect(books[9].exam).toBe(true);expect(books[9].practice).toEqual([]);expect(section.classes[9].items.map((x:{item_type:string})=>x.item_type)).toEqual(['QUIZ']);expect(moduleTwoExam('es')).toHaveLength(10)
 })
 it('covers every source block and verified PDF paragraph',()=>{
  const audit=JSON.parse(fs.readFileSync(base+'module-two-organization.json','utf8'));expect(audit.missingBlocks).toEqual([]);expect(audit.otherModulesUnchanged).toBe(true)
  const comparison=JSON.parse(fs.readFileSync(base+'module-two-pdf-comparison.json','utf8'));expect(comparison).toHaveLength(122);expect(comparison.every((x:{matches:boolean})=>x.matches)).toBe(true)
 })
 it('keeps practice instructions out of lesson pages and every diagram linked to editable geometry and sound',()=>{
  for(const b of books){for(const p of b.pages){expect(p.blocks.some((x:{text?:string})=>['Ejercicios','Práctica','Cómo estudiar'].includes(x.text??''))).toBe(false)}
   for(const p of [...b.pages,...b.practice])for(const block of p.blocks.filter((x:{vector?:string})=>x.vector)){
    const v=b.vectors[block.vector];expect(v.svg).toContain('<');expect(v.svg).not.toContain('<image');if(v.notes.length){expect(v.audio.events.length).toBeGreaterThan(0);for(const event of v.audio.events){expect(event.frequency).toBeGreaterThan(0);expect(event.start+event.duration).toBeLessThanOrEqual(v.audio.duration+.001)}}
   }
  }
 })
 it('grades all quiz and exam answers consistently in both languages',()=>{
  for(const locale of ['es','en'])for(const q of [...books.slice(0,9).flatMap((_,i)=>moduleTwoQuiz(i+1,locale)),...moduleTwoExam(locale)]){
   const answer=q.question_type==='ordering_sequence'?(q.options as OrderingSequenceOptions).items.slice().sort((a,b)=>a.correctPosition-b.correctPosition).map(x=>x.id):q.correct_answer
   expect(gradeQuestionScore(q,answer),q.question).toBe(1);expect(gradeQuestionScore(q,undefined)).toBe(0)
  }
 })
 it('provides real local audio for the two listening questions',()=>{for(const q of moduleTwoExam('es').filter(q=>q.audio_url)){const data=fs.readFileSync('public'+q.audio_url);expect(data.subarray(0,4).toString()).toBe('RIFF');expect(data.length).toBeGreaterThan(40000)}})
})
