'use client'
import {CourseSequenceNavigation} from './course-sequence-navigation'
import {useBookTranslation} from './use-book-translation'
import {LessonHeader,type LessonHeaderContext} from './lesson-header'
import {ManualBookPage,ManualVectorContext} from './manual-book-page'
import {QuizRunner} from '@/components/class-viewer/lesson-viewer/quiz-runner'
import {moduleTwoExam} from '@/lib/solfeo/module-two-assessment'
import type {CourseBookLesson} from './first-document-lesson'
export function ModuleTwoExam({book,headerContext}:{book:CourseBookLesson;headerContext?:LessonHeaderContext}){
 const {es,locale}=useBookTranslation()
 const title=es?'Examen final · Módulo 2':'Final exam · Module 2'
 return <div className="space-y-5"><LessonHeader title={title} context={headerContext} tabs={null}/><div className="space-y-6 px-3 md:px-6">
 <p className="text-muted-foreground">{es?'10 preguntas · Cada pregunta vale 10 puntos. Entrega el examen para ver tu resultado.':'10 questions · Each question is worth 10 points. Submit the exam to see your result.'}</p>
 <ManualVectorContext.Provider value={book.vectors}><div className="rounded-xl border bg-background"><ManualBookPage page={book.pages[0]} settings={{bpm:60,countInBars:0,volume:.5}}/></div></ManualVectorContext.Provider>
 <p className="text-sm text-muted-foreground">{es?'Caso del manual, páginas 54–55: lectura de una frase de cuatro compases. En las preguntas de ejecución, practica primero y responde después. La nota evalúa tus respuestas; no mide tu voz ni tu percusión.':'Manual case, pages 54–55: reading a four-measure phrase. For performance questions, practice first and then answer. The score evaluates your answers; it does not measure your voice or tapping.'}</p>
 <QuizRunner key={locale} classItemId={book.id+'-quiz'} title={title} questions={moduleTwoExam(locale)} settings={{mode:'sheet'}} nextHref={book.nextHref}/>
 <CourseSequenceNavigation activity={es?'Examen':'Exam'}/>
 </div></div>
}
