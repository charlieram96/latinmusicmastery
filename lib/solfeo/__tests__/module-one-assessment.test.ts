import {describe,it,expect} from 'vitest'
import {moduleOneTeachingLessons,moduleOneQuiz,moduleOneExam} from '../module-one-assessment'
import {gradeQuestionScore,type OrderItem,type Pair} from '@/lib/quiz/grading'
import type {OrderingSequenceOptions,MatchingPairsOptions} from '@/types/modules'
import fs from 'node:fs'
describe('Module one chapter organisation',()=>{
 it('contains seven teaching sections, each with separate practice and two topic questions',()=>{
  expect(moduleOneTeachingLessons).toHaveLength(7)
  for(let i=1;i<=7;i++){expect(moduleOneTeachingLessons[i-1].practice.length).toBeGreaterThan(0);expect(moduleOneQuiz(i)).toHaveLength(2)}
 })
 it('places a single ten-question exam last with no extra exercise or quiz items',()=>{
  const section=JSON.parse(fs.readFileSync('local-artifacts/solfeo-course/structure.json','utf8')).sections[0]
  expect(section.classes).toHaveLength(8);expect(section.classes[7].items).toHaveLength(1);expect(section.classes[7].items[0].item_type).toBe('QUIZ');expect(moduleOneExam).toHaveLength(10)
 })
 it('grades the complete correct exam and rejects wrong answers',()=>{
  for(const q of moduleOneExam){let answer:unknown=q.correct_answer
   if(q.question_type==='ordering_sequence')answer=(q.options as OrderingSequenceOptions).items.slice().sort((a:OrderItem,b:OrderItem)=>a.correctPosition-b.correctPosition).map(i=>i.id)
   if(q.question_type==='matching_pairs')answer=Object.fromEntries((q.options as MatchingPairsOptions).pairs.map((p:Pair)=>[p.id,p.right]))
   expect(gradeQuestionScore(q,answer)).toBe(1);expect(gradeQuestionScore(q,undefined)).toBe(0)
  }
 })
 it('has two real local audio stimuli',()=>{for(const q of moduleOneExam.filter(q=>q.audio_url)){const wav=fs.readFileSync('public'+q.audio_url);expect(wav.subarray(0,4).toString()).toBe('RIFF');expect(wav.length).toBeGreaterThan(40000)}})
})
