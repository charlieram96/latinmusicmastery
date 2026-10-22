import { publishedContentEnabled } from '@/lib/release/content'
import { readReleaseDocument } from '@/lib/release/documents'
/** Independent file-backed course. No remote mutation or fallback is allowed. */
import { headers } from 'next/headers'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SectionWithClasses } from '@/components/admin/course-studio/types'
import type { CourseBookLesson } from '@/components/solfeo/first-document-lesson'
import type { QuizQuestion } from '@/types/modules'
import { moduleOneTeachingLessons, moduleOneExam, moduleOneQuiz } from '@/lib/solfeo/module-one-assessment'
import { moduleTwoQuiz, moduleTwoExam } from '@/lib/solfeo/module-two-assessment'
import { courseQuestions } from '@/lib/solfeo/course-assessment'
import { bookQuestions } from '@/lib/solfeo/book-translation'
export const KIDS_COURSE_ID = 'solfeo-infantil-aplicado'
export const KIDS_ROUTE = '/dashboard/course/solfeo-aplicado'
const root = path.join(process.cwd(), 'local-artifacts/solfeo-infantil-course')
export async function kidsEnabled() {
 if (publishedContentEnabled()) return true
 const host = (await headers()).get('host')?.split(':')[0]
 return process.env.NODE_ENV === 'development' && (host === 'localhost' || host === '127.0.0.1')
}
async function read<T>(file:string):Promise<T> {
 if (!await kidsEnabled()) throw new Error('Children’s course is available only on localhost')
 return JSON.parse(publishedContentEnabled() ? await readReleaseDocument('local-artifacts/solfeo-infantil-course/'+file) : await readFile(path.join(root,file),'utf8'))
}
export function readKidsOutline(){return read<{courseId:string;title:string;title_es:string;description:string;description_es:string;thumbnail_url:string;sections:SectionWithClasses[]}>('structure.json')}
export function rekeyQuestions(questions:QuizQuestion[],classId:string,kind='quiz') {
 return questions.map((q,i)=>({...q,id:`${classId}-${kind}-q${i+1}`,class_item_id:`${classId}-${kind}`}))
}
export async function readKidsLesson(id:string,locale:string) {
 if(!/^local-solfeo-kids-m\d{2}-c\d{2}$/.test(id))return null
 const outline=await readKidsOutline(),classes=outline.sections.flatMap(m=>m.classes),index=classes.findIndex(c=>c.id===id)
 if(index<0)return null
 const moduleNumber=Number(id.match(/-m(\d+)/)![1]),number=Number(id.slice(-2))
 let book:CourseBookLesson
 if(moduleNumber===1){
  const snapshot=await read<{vectors:CourseBookLesson['vectors'];lessons:typeof moduleOneTeachingLessons}>('module-one-book.json')
  const lesson=snapshot.lessons[number-1]
  // Keep the authored workshop placement and additional clef-writing page.
  const teaching=moduleOneTeachingLessons[number-1]
  book={id,module:moduleNumber,number,title:classes[index].title_es||classes[index].title,pages:number===8?[]:number===3?[...lesson.pages,{title:'Así se escribe la clave de Sol',blocks:[{type:'treble-writing'}]}]:lesson.pages,practice:number===8?[]:number===5?teaching.practice:lesson.practice,vectors:snapshot.vectors,nextHref:'',exam:number===8}
 }else book=await read<CourseBookLesson>(`books/${id}.json`)
 book.nextHref=classes[index+1]?`${KIDS_ROUTE}?class=${classes[index+1].id}`:'/dashboard/courses'
 const stored=await read<Record<string,QuizQuestion[]>>('questions.json')
 let quiz=stored[id+'-quiz']??(moduleNumber===1?(number===8?moduleOneExam:moduleOneQuiz(number)):moduleNumber===2?(book.exam?moduleTwoExam(locale):moduleTwoQuiz(number,locale)):courseQuestions(book,locale))
 quiz=bookQuestions(quiz,locale)
 const exercise=bookQuestions(stored[id+'-exercise']??[],locale)
 return {book,quiz:rekeyQuestions(quiz,id),exercise:rekeyQuestions(exercise,id,'exercise')}
}
