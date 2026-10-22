import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import english from '../book-en.json'
import source from '../module-one-book.json'
import {bookText,bookSvg,bookQuestions} from '../book-translation'
import {moduleOneExam,moduleOneQuiz,moduleOneTeachingLessons} from '../module-one-assessment'
import {gradeQuestionScore} from '@/lib/quiz/grading'
import type {MatchingPairsOptions} from '@/types/modules'
const strings=new Set<string>()
function scan(v:unknown,key=''){
 if(typeof v==='string'){
  if(['text','title','label','question','explanation','left','right'].includes(key)&&/[A-Za-zÁÉÍÓÚáéíóúñ]/.test(v))strings.add(v.trim())
  if(key==='svg')for(const m of v.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g))if(/[A-Za-zÁÉÍÓÚáéíóúñ]/.test(m[1]))strings.add(m[1].trim())
 }else if(Array.isArray(v))v.forEach(item=>scan(item,key))
 else if(v&&typeof v==='object')Object.entries(v).forEach(([k,item])=>scan(item,k))
}
const dir='local-artifacts/solfeo-course/book-audit'
const files=fs.readdirSync(dir).filter(f=>/^local-solfeo-m\d+-c\d+\.json$/.test(f))
const books=files.map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')))
scan(source);books.forEach(b=>scan(b));scan(moduleOneTeachingLessons);scan(moduleOneExam);for(let n=1;n<=7;n++)scan(moduleOneQuiz(n))
describe('complete Solfeo book localization',()=>{
 it('covers every authored page, practice, diagram label and question in every module',()=>{
  expect(files.length).toBeGreaterThan(170)
  expect([...strings].filter(s=>!(s in english))).toEqual([])
  for(const s of strings)expect(bookText(s,'es')).toBe(s)
 })
 it('preserves markup and links in each translated paragraph',()=>{
  for(const [es,en] of Object.entries(english)){
   expect(en.match(/<[^>]+>/g)??[],es).toEqual(es.match(/<[^>]+>/g)??[])
  }
 })
 it('translates only score text, preserving paths, geometry and playback data',()=>{
  for(const b of [source,...books])for(const v of Object.values(b.vectors) as {svg:string}[]){
   const before=JSON.stringify(v)
   const translated=bookSvg(v.svg,'en')
   const strip=(svg:string)=>svg.replace(/(<text\b[^>]*>)[\s\S]*?(<\/text>)/g,'$1$2')
   expect(strip(translated)).toBe(strip(v.svg))
   expect(JSON.stringify(v)).toBe(before)
  }
 })
 it('switches all quiz copy while retaining Spanish variants, IDs and correct answers',()=>{
  const en=bookQuestions(moduleOneExam,'en')
  expect(bookQuestions(moduleOneExam,'es')).toBe(moduleOneExam)
  en.forEach((q,i)=>{
   expect(q.id).toBe(moduleOneExam[i].id);expect(q.correct_answer).toBe(moduleOneExam[i].correct_answer)
   expect(q.question_es).toBe(moduleOneExam[i].question_es)
   if(q.correct_answer!==null)expect(gradeQuestionScore(q,q.correct_answer)).toBe(1)
   if(q.question_type==='matching_pairs'){
    const answer=Object.fromEntries((q.options as MatchingPairsOptions).pairs.map(p=>[p.id,p.right]))
    expect(gradeQuestionScore(q,answer)).toBe(1)
   }
  })
  expect(en[0].question).toBe('Which letter corresponds to Do?')
 })
})
