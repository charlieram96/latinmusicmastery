'use client'
import {useBookTranslation} from './use-book-translation'
import {bookQuestions} from '@/lib/solfeo/book-translation'
import {FirstSolfeoDocumentLesson} from './first-document-lesson'
import {LessonHeader,type LessonHeaderContext} from './lesson-header'
import {QuizRunner} from '@/components/class-viewer/lesson-viewer/quiz-runner'
import {moduleOneExam} from '@/lib/solfeo/module-one-assessment'
export function ModuleOneExperience({nextHref,number,exercise=false,quiz=false,headerContext}:{nextHref?:string;number:number;exercise?:boolean;quiz?:boolean;headerContext?:LessonHeaderContext}){
 const {t,es,locale}=useBookTranslation()
 if(number===8)return <div className="space-y-5"><LessonHeader title={t("Examen final · Módulo 1")} context={headerContext} tabs={null}/><div className="px-3 md:px-6"><p className="mb-5 text-muted-foreground">{es?"10 preguntas · Responde y entrega el examen para ver tu resultado. Puedes escuchar los ejemplos las veces que necesites.":"10 questions · Submit the exam to see your result. You may listen to the examples as often as needed."}</p><QuizRunner key={locale} classItemId="local-solfeo-m01-c08-quiz" title={t("Examen final · Módulo 1")} questions={bookQuestions(moduleOneExam,locale)} settings={{mode:'sheet'}} nextHref={nextHref??"/solfeo-preview?class=local-solfeo-m02-c01"}/></div></div>
 return <FirstSolfeoDocumentLesson nextHref={nextHref} key={number} lessonNumber={number} exercise={exercise} initialTab={quiz?2:undefined} headerContext={headerContext}/>
}
