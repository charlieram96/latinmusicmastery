'use client'

import Link from 'next/link'
import { CourseSequenceNavigation, CourseSequenceContext } from './course-sequence-navigation'
import { BpmInput } from './bpm-input'

import {BOOK_PLAYBACK_STATE,BOOK_SOUND_STOP,type BookPlaybackState} from '@/lib/solfeo/book-playback'
import {bookText,bookQuestions} from '@/lib/solfeo/book-translation'
import { LessonNarration } from '@/components/lesson-narration/lesson-narration'
import styles from './first-document-lesson.module.css'
import {Pendulum} from '@/components/playsense-studio/player/transport/chronometer-control'
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, ListChecks, Music2, Settings2 } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { useMetronome } from '@/hooks/use-metronome'
import { SplitWorkspace } from '@/components/playsense-studio/player/split-workspace'
import { useWorkspaceLayout } from '@/components/playsense-studio/player/use-workspace-layout'
import { WATCH_WORKSPACE } from '@/lib/playsense-studio/workspace-layout'
import { VideoWatermark } from '@/components/playsense-studio/shared/video-watermark'
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { LessonStartCard } from '@/components/playsense-studio/shared/lesson-start-card'
import { QuizRunner } from '@/components/class-viewer/lesson-viewer/quiz-runner'
import { moduleOneTeachingLessons, moduleOneQuiz } from '@/lib/solfeo/module-one-assessment'
import { ManualBookPage, ManualPractice, ManualVectorContext, type ManualPage, type Vector } from './manual-book-page'
import {vectors as moduleOneVectors} from '@/lib/solfeo/module-one-book.json'
import type { QuizQuestion } from '@/types/modules'
import { LessonHeader, type LessonHeaderContext } from './lesson-header'
import { LocalLessonCommunity } from './local-lesson-community'

export type CourseBookLesson={id:string;module:number;number:number;title:string;pages:ManualPage[];practice:ManualPage[];vectors:Record<string,Vector>;nextHref:string;exam?:boolean;questions?:import('@/lib/solfeo/course-assessment').CourseQuestion[];appendices?:ManualPage[]}

/** Class 1 experiment: actual interactive pages, without any video transport. */
export function FirstSolfeoDocumentLesson({nextHref:nextHrefOverride,exercise=false,headerContext,lessonNumber=1,questions,book,initialTab,childFriendly=false,renderPage:PageRenderer,renderCover:CoverRenderer,renderPractice:PracticeRenderer,practiceRenderers,renderQuiz:QuizRenderer,exerciseQuestions=[]}:{nextHref?:string;practiceRenderers?:ComponentType<{onComplete:()=>void}>[];renderCover?:ComponentType<{complete:boolean}>;renderPractice?:ComponentType<{onComplete:()=>void}>;renderQuiz?:ComponentType<{questions:QuizQuestion[];classId:string;nextHref:string}>;childFriendly?:boolean;renderPage?:ComponentType<{page:ManualPage;settings:import('./use-note-demonstration').DemonstrationSettings&{volume?:number}}>;exerciseQuestions?:QuizQuestion[];exercise?:boolean;headerContext?:LessonHeaderContext;lessonNumber?:number;questions?:QuizQuestion[];book?:CourseBookLesson;initialTab?:number}) {
 const {locale}=useTranslation(),es=locale==='es'
 const courseSequence=useContext(CourseSequenceContext)
 const [page,setPage]=useState(0),[tab,setTab]=useState(initialTab??(exercise?1:0)),[practiceComplete,setPracticeComplete]=useState(false)
 const [practiceIndex,setPracticeIndex]=useState(0)
 const ActivePractice=practiceRenderers?.[practiceIndex]??PracticeRenderer
 const practiceCount=practiceRenderers?.length??1
 const sections=[{tab:0,index:0,label:es?'Lección':'Lesson'},...Array.from({length:practiceCount},(_,index)=>({tab:1,index,label:(es?'Ejercicio':'Exercise')+(practiceCount>1?` ${index+1}`:'')})),{tab:2,index:0,label:'Quiz'}]
 const sectionIndex=tab===0?0:tab===1?practiceIndex+1:practiceCount+tab-1
 const selectSection=(n:number)=>{const item=sections[n];if(!item)return;setTab(item.tab);if(item.tab===1)setPracticeIndex(item.index)}
 const finishPractice=()=>{if(practiceIndex+1<practiceCount)setPracticeIndex(i=>i+1);else setTab(2)}
 const workspace=useWorkspaceLayout(childFriendly?'solfeo-kids-theory':'solfeo-theory', {...WATCH_WORKSPACE,layout:'music'})
 const [bpm,setBpm]=useState(100),[volume,setVolume]=useState(.5)
 const [error,setError]=useState(false)
 const [linked,setLinked]=useState<BookPlaybackState>({playing:false,beat:0,beatsPerBar:4,count:0})
 const lessonTop=useRef<HTMLDivElement|null>(null)
 const narrationTarget=useRef<HTMLElement|null>(null)
 const audio=useRef<AudioContext|null>(null),request=useRef(0)
 const metro=useMetronome({bpm,timeSignature:[4,4],countInBeats:0,silent:false,volume})
 const stop=metro.stopMetronome
 useEffect(()=>{request.current++;stop();window.dispatchEvent(new Event(BOOK_SOUND_STOP))},[page,tab,practiceIndex,bpm,stop])
 useEffect(()=>()=>{request.current++;stop();void audio.current?.close()},[stop])
 useEffect(()=>{const update=(e:Event)=>{const state=(e as CustomEvent<BookPlaybackState>).detail;if(state.playing){request.current++;stop()}setLinked(state)};window.addEventListener(BOOK_PLAYBACK_STATE,update);return()=>window.removeEventListener(BOOK_PLAYBACK_STATE,update)},[stop])
 const toggleMetronome=async()=>{
  window.dispatchEvent(new Event('lmm-book-sound-start'))
  if(metro.isPlaying||linked.playing){request.current++;stop();return}
  const id=++request.current
  try{const ctx=audio.current??new AudioContext();audio.current=ctx;await ctx.resume();if(id!==request.current)return;metro.startMetronome(ctx);setError(false)}catch{setError(true)}
 }
 const manual=book??moduleOneTeachingLessons[lessonNumber-1],classId=book?.id??`local-solfeo-m01-c${String(lessonNumber).padStart(2,'0')}`,last=manual.pages.length+1
 // Pagination starts at the lesson heading, not at the previous footer position.
 useLayoutEffect(()=>{
  if(childFriendly){
   const panel=lessonTop.current?.closest<HTMLElement>('[data-course-scroll]')
   const target=page===0?lessonTop.current?.closest<HTMLElement>('[data-kids-course]'):lessonTop.current
   if(panel&&target)panel.scrollTo({top:panel.scrollTop+target.getBoundingClientRect().top-panel.getBoundingClientRect().top,behavior:'instant'})
  }else lessonTop.current?.scrollIntoView({block:'start',behavior:'instant'})
 },[classId,page,tab,practiceIndex,childFriendly])
 const introPage=!book&&lessonNumber===1?1:0
 const contentIndex=!book&&lessonNumber===1&&page===0?0:page-1
 const title=bookText(manual.title,locale)
 const pageTempo=book?.vectors[manual.pages[contentIndex]?.blocks.find(b=>b.vector)?.vector??'']?.audio?.bpm
 useEffect(()=>{if(pageTempo)setBpm(pageTempo)},[pageTempo,page])
 const settings={bpm,metronome:true,countInBars:1 as const,volume,onDemoStart:()=>{request.current++;stop();window.dispatchEvent(new Event('lmm-book-sound-start'))}}
 const quizQuestions=questions??(!book?bookQuestions(moduleOneQuiz(lessonNumber),locale):[])
 const nextHref=nextHrefOverride??book?.nextHref??(lessonNumber<7?`/solfeo-preview?class=local-solfeo-m01-c${String(lessonNumber+1).padStart(2,'0')}`:'/solfeo-preview?class=local-solfeo-m01-c08')
 const previousDestination=courseSequence.previous??(book?{title:es?'Inicio del módulo':'Module welcome',href:`${nextHref.split('?')[0]}?module=${book.id.replace(/-c\d+$/, '')}`}:undefined)
 const go=(next:number)=>{request.current++;stop();setPage(Math.max(0,Math.min(last,next)))}
 return <ManualVectorContext.Provider value={book?.vectors??moduleOneVectors}><div ref={lessonTop} className="scroll-mt-3 space-y-5 [&>header~*]:mx-3 md:[&>header~*]:mx-6">
  <LessonHeader title={title} context={headerContext} tabs={<nav aria-label={es?'Elementos de la clase':'Class elements'} className="flex max-w-full items-center gap-1 overflow-x-auto py-1 [&>button]:shrink-0 [&>button]:px-3">
   {sections.map((item,i)=>{const Icon=[BookOpen,BookOpen,ListChecks,Music2][item.tab];return <Button key={i} aria-current={sectionIndex===i?'page':undefined} variant={sectionIndex===i?'default':'ghost'} onClick={()=>selectSection(i)}><Icon size={16} className="mr-2"/>{item.label}</Button>})}
  </nav>}/>
  {tab===0?<SplitWorkspace controller={workspace} initialHeight={680} sizing="content" music={
   <article data-flow-page={book&&book.module>=3&&page!==introPage&&page!==last||undefined} ref={narrationTarget} lang={locale} aria-label={es?'Lección por páginas':'Paged lesson'} className={`${styles.page} ${manual.pages[contentIndex]?.blocks[0]?.type==='manual-cover'?styles.greenPage:''}`} aria-live="polite">
    <div key={`${page}:${locale}`} tabIndex={0} role="region" aria-label={es?'Contenido de la página':'Page content'} className={styles.content}><div className={page===introPage||page===last?styles.cover:undefined}>
      {(page===introPage||page===last)&&CoverRenderer?<CoverRenderer complete={page===last}/>:page===introPage||page===last?<LessonStartCard inFlow showAction={false} title={page===introPage?title:(es?['¡Bien hecho!','¡Sigues progresando!','¡Un paso más!'][(lessonNumber-1)%3]:'Well done!')} label={page===introPage?`${childFriendly?(es?"SOLFEO INFANTIL · CLASE":"SOLFEGE FOR KIDS · LESSON"):(es?"SOLFEO APLICADO · CLASE":"APPLIED SOLFEGE · LESSON")} ${book?.module??1}.${book?.number??lessonNumber}`:(es?'LECCIÓN COMPLETADA':'LESSON COMPLETE')} instructor={page===introPage?'Raffy Pérez':undefined} detail={page===introPage?(es?'Lee, escucha y comprende. Avanza una página a la vez, a tu ritmo.':'Read, listen and understand. Turn one page at a time, at your own pace.'):(es?'Terminaste la explicación. Continúa al ejercicio para aplicar lo aprendido.':'You have completed the lesson. Continue to the exercise to apply what you have learned.')} pills={es?['Escucha','Lectura','Precisión']:['Listen','Read','Precision']} action="" onStart={()=>{}}/>:PageRenderer?<PageRenderer page={manual.pages[contentIndex]} settings={settings}/>:<ManualBookPage key={page} page={manual.pages[contentIndex]} settings={settings}/>}
    </div></div>
<div className="relative z-10 flex justify-center border-t bg-background px-3 py-3">   <nav aria-label={es?'Páginas de la lección':'Lesson pages'} className={styles.navigation}>
    <Button variant="outline" asChild={page===0&&!!previousDestination?.href} disabled={page===0&&!previousDestination} onClick={page===0?previousDestination?.onClick:()=>go(page-1)} aria-label={page===0?(es?'Anterior: ':'Previous: ')+(previousDestination?.title??''):(es?'Página anterior':'Previous page')}>{page===0&&previousDestination?.href?<Link href={previousDestination.href}><ChevronLeft size={18}/><span className="ml-1 hidden sm:inline">{es?'Anterior':'Previous'}</span></Link>:<><ChevronLeft size={18}/><span className="ml-1 hidden sm:inline">{es?'Página anterior':'Previous page'}</span></>}</Button>
    <span role="status" className="text-sm tabular-nums text-muted-foreground">{es?'Página':'Page'} {page+1} / {last+1}</span>
    <Button onClick={()=>page===last?selectSection(1):go(page+1)}>{page===last?(es?'Siguiente: ejercicio':'Next: exercise'):(es?'Página siguiente':'Next page')}<ChevronRight size={18} className="ml-1"/></Button>
   </nav>
</div>
    <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[78px]"><VideoWatermark staticStage/></div>
   </article>
  } footer={<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
   <div className="flex items-center gap-2">
    <Button size="icon" variant="outline" className={metro.isPlaying||linked.playing?'border-primary bg-primary/10':undefined} onClick={()=>void toggleMetronome()} aria-pressed={metro.isPlaying||linked.playing} aria-label={metro.isPlaying||linked.playing?(es?'Detener metrónomo':'Stop metronome'):(es?'Iniciar metrónomo':'Start metronome')}><Pendulum size="sm" swingStyle={{}} active={metro.isPlaying||linked.playing}/></Button>
    <Dialog><DialogTrigger asChild><Button variant="outline" size="icon" aria-label={es?'Ajustes del metrónomo':'Metronome settings'}><Settings2 size={17}/></Button></DialogTrigger>
     <DialogContent><DialogTitle>{es?'Metrónomo':'Metronome'}</DialogTitle><DialogDescription>{es?'Ajusta el pulso y el sonido sin cambiar de página.':'Adjust the pulse and sound without changing pages.'}</DialogDescription>
      <label className="flex items-center gap-2 text-sm">BPM <BpmInput value={bpm} onChange={setBpm} className="w-20 rounded-md border bg-background px-2 py-1.5"/></label>
      <p className="text-sm text-muted-foreground">{es?"Al escuchar una partitura: un compás de precuenta y metrónomo sincronizado.":"Score playback: one measure of count-in and synchronized metronome."}</p>
      <label className="flex items-center gap-2 text-sm">{es?'Volumen':'Volume'}<input aria-label={es?'Volumen del metrónomo':'Metronome volume'} type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))} className="w-28 accent-primary"/></label>
     </DialogContent>
    </Dialog>
    <LessonNarration target={narrationTarget} resetKey={`${classId}:${page}:${tab}`} language={locale} onStart={()=>{request.current++;stop();window.dispatchEvent(new Event(BOOK_SOUND_STOP))}}/>
    {(metro.isPlaying||linked.playing)&&<span className="text-sm tabular-nums text-primary" aria-label={es?'Pulso actual':'Current beat'}>{linked.playing?linked.beat:metro.currentBeat} / {linked.playing?linked.beatsPerBar:4}{linked.count>0?` · ${es?"Precuenta":"Count-in"}`:""}</span>}
   </div>
   {error&&<p role="alert" className="text-sm">{es?'No se pudo iniciar el sonido. Vuelve a intentarlo.':'Audio could not start. Please try again.'}</p>}
  </div>}/>:tab===1&&ActivePractice?<ActivePractice key={`${classId}:${practiceIndex}`} onComplete={finishPractice}/>:tab===1?<>{manual.practice.length>0&&!practiceComplete?<ManualPractice manual={manual} number={lessonNumber} settings={settings} onComplete={()=>{setPracticeComplete(true);if(!childFriendly&&quizQuestions.length)setTab(2)}}/>:childFriendly&&exerciseQuestions.length>0?<div className="space-y-4"><QuizRunner key={classId+'-exercise-'+locale} kind="Exercise" classItemId={classId+'-exercise'} title={title} questions={exerciseQuestions}/><Button onClick={()=>setTab(2)}>{es?'Ir al quiz':'Go to quiz'}</Button><Button variant="outline" onClick={()=>setPracticeComplete(false)}>{es?'Volver a la práctica':'Back to practice'}</Button></div>:<div className="rounded-xl border p-8"><p>{es?"Práctica completada.":"Practice complete."}</p><Button onClick={()=>quizQuestions.length?setTab(2):setTab(0)}>{quizQuestions.length?(es?'Continuar al quiz':'Continue to quiz'):(es?'Volver a la lección':'Return to lesson')}</Button><Button variant="outline" onClick={()=>setPracticeComplete(false)}>{es?"Repetir práctica":"Repeat practice"}</Button></div>}</>:tab===2&&QuizRenderer?<QuizRenderer questions={quizQuestions} classId={classId} nextHref={nextHref}/>:tab===2&&quizQuestions.length>0?<QuizRunner key={classId+'-quiz-'+locale} classItemId={classId+'-quiz'} kind="Quiz" title={`Quiz · ${title}`} questions={quizQuestions} nextHref={nextHref}/>:<div className="rounded-xl border p-8 text-center"><p>{tab===2?(es?'Los quizzes se incorporarán más adelante.':'Quizzes will be added later.'):(es?'Esta clase no tiene una Jam Session independiente.':'This class has no separate Jam Session.')}</p><Button variant="outline" className="mt-4" onClick={()=>setTab(0)}>{es?'Volver a la lección':'Return to lesson'}</Button></div>}

  <CourseSequenceNavigation currentTitle={title} activity={sections[sectionIndex]?.label}
   previousActivity={sectionIndex>0?{title:sections[sectionIndex-1].label,onClick:()=>selectSection(sectionIndex-1)}:previousDestination}
   nextActivity={sectionIndex<sections.length-1?{title:sections[sectionIndex+1].label,onClick:()=>selectSection(sectionIndex+1)}:undefined}/>
  <LocalLessonCommunity classId={classId}/>
 </div></ManualVectorContext.Provider>
}
