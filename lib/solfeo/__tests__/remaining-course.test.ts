import {expect,it} from 'vitest'
import fs from 'node:fs'
import {courseQuestions} from '../course-assessment'
import {gradeQuestionScore} from '@/lib/quiz/grading'
const base='local-artifacts/solfeo-course/book-audit/'
const read=(f:string)=>JSON.parse(fs.readFileSync(f,'utf8'))
const structure=read('local-artifacts/solfeo-course/structure.json')
const books=structure.sections.slice(2).flatMap((s:any)=>s.classes.map((c:any)=>read(base+c.id+'.json')))
it('installs each chapter as lesson/practice/quiz, ending in exactly one ten-question exam',()=>{
 for(const section of structure.sections.slice(2)){
  const items=section.classes.map((c:any)=>read(base+c.id+'.json'))
  expect(items.filter((b:any)=>b.exam)).toHaveLength(1);expect(items.at(-1).exam).toBe(true)
  items.forEach((b:any,i:number)=>{
   expect(b.questions).toHaveLength(b.exam?10:2)
   expect(section.classes[i].items.map((x:any)=>x.item_type)).toEqual(b.exam?['QUIZ']:['VIDEO','EXERCISE','QUIZ'])
   if(!b.exam){expect(b.pages.length).toBeGreaterThan(0);expect(b.practice.length).toBeGreaterThan(0)}
  })
 }
})
it('retains every manual block from chapter three onward, with exact original text',()=>{
 const source=read(base+'complete-book-editable.json');const installed=new Map<string,any>()
 for(const b of books)for(const x of [...b.pages,...b.practice,...(b.appendices??[])].flatMap((p:any)=>p.blocks).concat(b.sourceQuestions??[],b.sourceExamBlocks??[])){
  if(x.sourceBlock!==undefined)installed.set(`${x.pdfPage}:${x.sourceBlock}`,x)
 }
 for(const p of source.pages.filter((p:any)=>p.pdfPage>=56))for(const b of p.blocks.filter((b:any)=>b.type!=='topic')){
  const match=installed.get(`${b.pdfPage}:${b.sourceBlock}`);expect(match,`${b.pdfPage}:${b.sourceBlock}`).toBeDefined();if(b.text)expect(match.text).toBe(b.text)
 }
})
it('grades all 342 questions identically in both languages, with real audio files',()=>{
 let count=0
 for(const b of books)for(const locale of ['es','en'])for(const q of courseQuestions(b,locale)){
  expect(gradeQuestionScore(q,q.correct_answer),q.question).toBe(1);expect(gradeQuestionScore(q,undefined)).toBe(0)
  expect(q.question?.length).toBeGreaterThan(8)
  if(q.audio_url)expect(fs.readFileSync('public'+q.audio_url).subarray(0,4).toString()).toBe('RIFF')
  count++
 }
 expect(count).toBe(684)
})
it('every displayed score is editable SVG with linked audio and retains the PDF source audit',()=>{
 for(const b of books)for(const p of [...b.pages,...b.practice])for(const block of p.blocks.filter((x:any)=>x.vector)){
  const v=b.vectors[block.vector];expect(v.svg).toContain('<');expect(v.svg).not.toContain('<image')
  if(v.notes.length)expect(v.audio?.events.length,`${b.id}:${block.vector}`).toBeGreaterThan(0)
 }
 expect(read(base+'source-comparison.json').summary.mismatches).toBe(0)
})
