'use client'
import {CourseSequenceNavigation} from './course-sequence-navigation'
import {useState} from 'react'
import {useBookTranslation} from './use-book-translation'
import {LessonHeader,type LessonHeaderContext} from './lesson-header'
import {ManualBookPage,ManualVectorContext} from './manual-book-page'
import {QuizRunner} from '@/components/class-viewer/lesson-viewer/quiz-runner'
import {courseQuestions} from '@/lib/solfeo/course-assessment'
import type {CourseBookLesson} from './first-document-lesson'
export function CourseBookExam({book,headerContext}:{book:CourseBookLesson;headerContext?:LessonHeaderContext}){
 const {es,locale,t}=useBookTranslation(),[reference,setReference]=useState(0)
 return <div className="space-y-5"><LessonHeader title={es?book.title:`Final exam · Module ${book.module}`} context={headerContext} tabs={null}/><div className="space-y-6 px-3 md:px-6">
 <p>{es?'10 preguntas · 10 puntos por pregunta. Entrega el examen para ver tu resultado. Las respuestas evalúan comprensión y criterios escritos; no califican automáticamente tu voz.':'10 questions · 10 points each. Submit the exam to see your result. Answers assess understanding and written criteria; they do not automatically grade your voice.'}</p>
 <ManualVectorContext.Provider value={book.vectors}>{book.pages.filter(p=>p.blocks.length).map((page,i)=><div key={i} className="rounded-xl border bg-background"><ManualBookPage page={page} settings={{bpm:100,volume:.5}}/></div>)}</ManualVectorContext.Provider>
 <QuizRunner key={book.id+locale} classItemId={book.id+'-quiz'} title={es?book.title:`Final exam · Module ${book.module}`} questions={courseQuestions(book,locale)} settings={{mode:'sheet'}} nextHref={book.nextHref}/>
 {!!book.appendices?.length&&<details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">{es?'Apéndices del manual: solucionarios y referencias':'Manual appendices: answer keys and references'}</summary><label className="my-4 flex flex-wrap items-center gap-2">{es?'Consultar':'Read'}<select className="max-w-full rounded border bg-background p-2" value={reference} onChange={e=>setReference(Number(e.target.value))}>{book.appendices.map((p,i)=><option key={i} value={i}>{t(p.title)}</option>)}</select></label><ManualVectorContext.Provider value={book.vectors}><ManualBookPage page={book.appendices[reference]} settings={{bpm:100,volume:.5}}/></ManualVectorContext.Provider></details>}
 <CourseSequenceNavigation activity={es?'Examen':'Exam'}/>
 </div></div>
}
