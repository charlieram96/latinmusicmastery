'use client'
import {CourseBookExam} from './course-book-exam'
import {courseQuestions} from '@/lib/solfeo/course-assessment'
import {moduleTwoQuiz} from '@/lib/solfeo/module-two-assessment'
import {ModuleTwoExam} from './module-two-exam'
import {useBookTranslation} from './use-book-translation'
import {useEffect,useState} from 'react'
import {FirstSolfeoDocumentLesson,type CourseBookLesson} from './first-document-lesson'
import type {LessonHeaderContext} from './lesson-header'
export function CourseBookExperience({nextHref,classId,exercise=false,quiz=false,headerContext}:{nextHref?:string;classId:string;exercise?:boolean;quiz?:boolean;headerContext?:LessonHeaderContext}){
 const {es,locale}=useBookTranslation()
 const [loadedBook,setBook]=useState<CourseBookLesson|null>(null),[error,setError]=useState(false)
 useEffect(()=>{
  const controller=new AbortController();setBook(null);setError(false)
  const load=()=>fetch(`/api/local-solfeo/book/${classId}?audioTimeline=2`,{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Book unavailable');return r.json()}).then(next=>{setBook(current=>JSON.stringify(current)===JSON.stringify(next)?current:next);setError(false)}).catch(e=>{if(e.name!=='AbortError')setError(true)})
  void load()
  // Local book data is generated outside React; refresh it when returning to an open class.
  window.addEventListener('focus',load)
  return()=>{controller.abort();window.removeEventListener('focus',load)}
 },[classId])
 const book=loadedBook&&nextHref?{...loadedBook,nextHref}:loadedBook
 if(error)return <p role="alert" className="p-8">{es?"No se pudo cargar el contenido del manual. Recarga esta página.":"The manual could not load. Reload this page."}</p>
 if(!book)return <p role="status" className="p-8">{es?"Cargando las páginas del manual…":"Loading the manual pages…"}</p>
 if(book.exam&&book.module!==2)return <CourseBookExam book={book} headerContext={headerContext}/>
 if(book.module===2&&book.exam)return <ModuleTwoExam book={book} headerContext={headerContext}/>
 return <FirstSolfeoDocumentLesson key={classId} book={book} lessonNumber={book.number} exercise={exercise} initialTab={quiz?2:undefined} questions={book.module===2?moduleTwoQuiz(book.number,locale):courseQuestions(book,locale)} headerContext={headerContext}/>
}
