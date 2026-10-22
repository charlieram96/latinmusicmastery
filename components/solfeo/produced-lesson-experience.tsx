'use client'
import {CourseBookExperience} from './course-book-experience'
import { ModuleOneExperience } from './module-one-experience'
import { ManualLessonNavigation } from '@/components/playsense-studio/shared/manual-lesson-navigation'
import { LessonWrittenContent } from '@/components/class-viewer/lesson-written-content'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { LessonHeader, type LessonHeaderContext } from './lesson-header'
import { Button } from '@/components/ui/button'
import { BookOpen, ListChecks, Music2, Video } from 'lucide-react'
import { LessonVideoPlayer } from '@/components/class-viewer/lesson-viewer/lesson-video-player'
import { PlaysenseStudioPlayer } from '@/components/playsense-studio/player/playsense-studio-player'
import { QuizRunner } from '@/components/class-viewer/lesson-viewer/quiz-runner'
import { LocalLessonCommunity } from './local-lesson-community'
import type { ProducedSolfeoLesson } from '@/lib/solfeo/produced-lesson'

/** Full shared platform players and exercise runner, for every produced class. */
function ProducedVideoLessonExperience({lesson,exercise=false,headerContext}:{lesson:ProducedSolfeoLesson;exercise?:boolean;headerContext?:LessonHeaderContext}){
 const {locale}=useTranslation(),es=locale==='es'
 const [tab,setTab]=useState(exercise?2:0),[complete,setComplete]=useState(false),[replay,setReplay]=useState(0)
 const title=es?lesson.title.es:lesson.title.en,first=lesson.sections[0]
 const reset=()=>{setComplete(false);setReplay(n=>n+1);setTab(0)}
 return <div className="space-y-5 [&>header~*]:mx-3 md:[&>header~*]:mx-6">
  <LessonHeader title={title} context={headerContext} tabs={<nav aria-label={es?'Elementos de la clase':'Class elements'} className="flex max-w-full items-center gap-1 overflow-x-auto py-1 [&>button]:shrink-0 [&>button]:px-3">
   {[Video,ListChecks,BookOpen,Music2].map((Icon,i)=><Button key={i} variant={tab===i?'default':'ghost'} onClick={()=>setTab(i)}><Icon size={16} className="mr-2"/>{[es?'Clase / Video':'Lesson / Video','Quiz',es?'Ejercicio':'Exercise','Jam Session'][i]}</Button>)}
  </nav>}/>

  {!es&&<p className="text-sm text-muted-foreground">This locally authored lesson and its exercises are in Spanish.</p>}
  {tab===0?<div className="space-y-4">
   <ManualLessonNavigation steps={lesson.steps??[{start:0,end:lesson.duration,title,kind:'lesson'}]} onComplete={()=>{setComplete(true);setTab(2)}}>
   {first?<PlaysenseStudioPlayer lessonMetronome={lesson.metronome} key={replay} readOnly classItemId={`${lesson.classId}-video`} classItemTitle={title} videoUrl={lesson.videoUrl} posterUrl={lesson.posterUrl} subtitles={lesson.subtitles} defaultSubtitleLang={locale} score={first.score} tracks={first.tracks} activeTimeMap={first.activeTimeMap} sections={lesson.sections} layout="split" onEnded={()=>setComplete(true)}/>:<LessonVideoPlayer key={replay} metronome={lesson.metronome??{bpm:100,anchorSeconds:null}} src={lesson.videoUrl} poster={lesson.posterUrl} subtitles={lesson.subtitles} defaultSubtitleLang={locale} onEnded={()=>setComplete(true)}/>}
   </ManualLessonNavigation>
   <nav aria-label={es?'Continuar aprendizaje':'Continue learning'} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
    <Button variant="outline" onClick={reset}>{es?'INTENTAR DE NUEVO':'TRY AGAIN'}</Button>
    <Button onClick={()=>setTab(2)}>{es?'CONTINUAR A LA SIGUIENTE PARTE →':'CONTINUE TO NEXT PART →'}</Button>
   </nav>
   {complete&&<p role="status" className="text-center font-semibold text-primary">{es?'¡Buen trabajo! Continúa al ejercicio para aplicar lo aprendido.':'Well done! Continue to the exercise to apply what you learned.'}</p>}
  </div>:tab===2?<><QuizRunner classItemId={`${lesson.classId}-exercise`} kind="Exercise" title={title} questions={lesson.questions} nextHref={lesson.nextHref}/><Button variant="outline" onClick={()=>setTab(0)}>{es?'← Anterior: lección':'← Previous: lesson'}</Button></>:<div className="rounded-xl border p-8 text-center"><p>{tab===1?(es?'Los quizzes se incorporarán más adelante.':'Quizzes will be added later.'):(es?'Esta clase no tiene una Jam Session independiente.':'This class has no separate Jam Session.')}</p><Button variant="outline" className="mt-4" onClick={()=>setTab(0)}>{es?'Volver a la lección':'Return to lesson'}</Button></div>}
  {tab===0&&<>{lesson.completeScoreUrl&&<a className="inline-flex rounded-lg border px-4 py-2 text-sm font-semibold text-primary" href={lesson.completeScoreUrl} download>{es?'Descargar partitura completa · MusicXML':'Download complete score · MusicXML'}</a>}<LessonWrittenContent narration locale={locale} description={(es?lesson.description?.es:lesson.description?.en)??null} richContent={lesson.richContent??null}/></>}
  <LocalLessonCommunity classId={lesson.classId}/>
 </div>
}

export function ProducedSolfeoLessonExperience(props:{lesson:ProducedSolfeoLesson;exercise?:boolean;headerContext?:LessonHeaderContext}){
 const match=props.lesson.classId.match(/^local-solfeo-m01-c(\d{2})$/)
 if(match&&Number(match[1])<=8)return <ModuleOneExperience number={Number(match[1])} exercise={props.exercise} headerContext={props.headerContext}/>
 return <CourseBookExperience classId={props.lesson.classId} exercise={props.exercise} headerContext={props.headerContext}/>
}
