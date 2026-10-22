'use client'
import {ModuleOneExperience} from './module-one-experience'
import {CourseBookExperience} from './course-book-experience'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Dialog,DialogContent,DialogDescription,DialogTitle,DialogTrigger } from '@/components/ui/dialog'
import { ProducedSolfeoLessonExperience } from './produced-lesson-experience'
import type { ProducedSolfeoLesson } from '@/lib/solfeo/produced-lesson'

export function ProducedSolfeoLessonPreview({classId,exercise=false}:{classId:string;exercise?:boolean}){
 const {locale}=useTranslation(),es=locale==='es'
 const [lesson,setLesson]=useState<ProducedSolfeoLesson|null>(null),[error,setError]=useState(false)
 const load=async(open:boolean)=>{if(!open||lesson||classId.startsWith('local-solfeo-m01-'))return;setError(false);try{const r=await fetch(`/api/local-solfeo/lessons/${encodeURIComponent(classId)}`);if(!r.ok)throw new Error();setLesson(await r.json())}catch{setError(true)}}
 return <Dialog onOpenChange={load}><DialogTrigger asChild><Button variant="outline">{exercise?(es?'Abrir ejercicios':'Open exercises'):(es?'Abrir clase completa':'Open complete lesson')}</Button></DialogTrigger><DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-6xl"><DialogTitle>{lesson?(es?lesson.title.es:lesson.title.en):(es?'Vista previa de la clase':'Lesson preview')}</DialogTitle><DialogDescription>{es?'El mismo libro interactivo y los mismos ejercicios de la vista del estudiante.':'The same player and exercises as the student view.'}</DialogDescription>{!classId.startsWith('local-solfeo-m01-')?<CourseBookExperience classId={classId} exercise={exercise}/>:<ModuleOneExperience number={Number(classId.slice(-2))} exercise={exercise}/>}</DialogContent></Dialog>
}
