'use client'

import { BpmInput } from './bpm-input'
import { FirstSolfeoDocumentLesson } from './first-document-lesson'
import { useTransportCountIn } from '@/components/playsense-studio/player/state/use-transport-count-in'
import { LESSON_PLAYBACK_DEFAULTS } from '@/lib/playsense-studio/lesson-playback-defaults'
import { PrecountControl } from '@/components/playsense-studio/shared/precount-control'
import { useEffect, useRef, useState } from 'react'
import { QuizRunner } from '@/components/class-viewer/lesson-viewer/quiz-runner'
import { solfeoExerciseQuestions } from '@/lib/solfeo/exercises'
import { segmentBounds } from '@/lib/solfeo/playback'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Repeat, Video, ListChecks, Music2, BookOpen, Settings2 } from 'lucide-react'
import { LessonTransport } from '@/components/class-viewer/lesson-viewer/lesson-transport'
import { SecondSolfeoLesson } from './second-lesson'
import { FirstSolfeoLesson } from './first-lesson'
import { LocalLessonCommunity } from './local-lesson-community'
import { SplitWorkspace } from '@/components/playsense-studio/player/split-workspace'
import { useWorkspaceLayout } from '@/components/playsense-studio/player/use-workspace-layout'
import { WATCH_WORKSPACE } from '@/lib/playsense-studio/workspace-layout'
import { LessonHeader, type LessonHeaderContext } from './lesson-header'
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { VideoWatermark } from '@/components/playsense-studio/shared/video-watermark'
import { LessonStartCard } from '@/components/playsense-studio/shared/lesson-start-card'
import '@/components/class-viewer/lesson-viewer/lesson-mode/lesson-mode.css'

function InteractiveSolfeoLessonExperience({lessonNumber = 1, exercise = false, headerContext}: {lessonNumber?: 1 | 2; exercise?: boolean; headerContext?: LessonHeaderContext}) {
 const {locale}=useTranslation(); const es=locale==='es'
 const [time,setTime]=useState(exercise?66:0),[running,setRunning]=useState(false),[started,setStarted]=useState(exercise),[complete,setComplete]=useState(false)
 const [click,setClick]=useState<boolean>(LESSON_PLAYBACK_DEFAULTS.metronome),[bpm,setBpm]=useState(100),[loop,setLoop]=useState(false),[tab,setTab]=useState(exercise?2:0)
 const workspace=useWorkspaceLayout('solfeo-theory', {...WATCH_WORKSPACE, layout:'music'})
 const [seconds,setSeconds]=useState(12),[volume,setVolume]=useState(.7)
 const countIn=useTransportCountIn()
 const [countInBars,setCountInBars]=useState<0|1|2>(LESSON_PLAYBACK_DEFAULTS.countInBars)
 useEffect(()=>{countIn.cancel()},[tab,bpm,countIn.cancel])
 const audio=useRef<AudioContext|null>(null)
 const [segment,setSegment]=useState(-1)
 const step=Math.max(0,segment)
 const title=lessonNumber===2?(es?'Pentagrama, líneas y espacios':'Staff, lines and spaces'):(es?'Origen y nombres de las notas':'Origin and names of notes')
 const LessonContent=lessonNumber===2?SecondSolfeoLesson:FirstSolfeoLesson
 // Sound may run within the selected screen; navigation owns the timeline.
 useEffect(()=>{
  if(!running||complete||loop)return
  const bounds=segmentBounds(segment,seconds)
  const id=setTimeout(()=>setRunning(false),Math.max(0,bounds.end-time)*1000)
  return()=>clearTimeout(id)
 },[running,complete,time,segment,seconds,loop])
 useEffect(()=>{if(!click||!running)return; const tick=()=>{const ctx=audio.current;if(!ctx||ctx.state!=='running')return; const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=1000;g.gain.setValueAtTime(.1*volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.05);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.05);o.onended=()=>{o.disconnect();g.disconnect()}};tick();const id=setInterval(tick,60000/bpm);return()=>clearInterval(id)},[click,running,bpm,volume])
 useEffect(()=>()=>{void audio.current?.close()},[])
 const start=()=>{if(tab===2)return;if(segment<0){selectStep(0);return;}if(countIn.remaining){countIn.cancel();return;}if(!audio.current)audio.current=new AudioContext();void audio.current.resume();const bounds=segmentBounds(segment,seconds);if(time>=bounds.end)setTime(bounds.start);setStarted(true);void countIn.start({bpm,denominator:4,beats:4,bars:countInBars,volume:.2*volume},()=>setRunning(bounds.end>bounds.start))}
 const reset=()=>{countIn.cancel();setSegment(-1);setTime(0);setComplete(false);setStarted(false);setRunning(false);setTab(0)}
 const selectStep=(s:number)=>{countIn.cancel();setSegment(Math.min(s,4));setTime(6+Math.min(s,4)*seconds);setStarted(true);setRunning(false)}
 return <div className="space-y-5 [&>header~*]:mx-3 md:[&>header~*]:mx-6">
  <LessonHeader title={title} context={headerContext} tabs={<nav aria-label={es?'Elementos de la clase':'Class elements'} className="flex max-w-full items-center gap-1 overflow-x-auto py-1 [&>button]:shrink-0 [&>button]:px-3">{[Video,ListChecks,BookOpen,Music2].map((Icon,i)=><Button key={i} variant={tab===i?'default':'ghost'} onClick={()=>{setTab(i);setRunning(false);setComplete(false);if(i===0){setSegment(-1);setTime(0);setStarted(false)}}}><Icon size={16} className="mr-2"/>{[es?'Clase / Video':'Lesson / Video','Quiz',es?'Ejercicio':'Exercise','Jam Session'][i]}</Button>)}</nav>} settings={<Dialog><DialogTrigger asChild><Button variant="outline"><Settings2 size={16} className="mr-2"/>{es?'Ajustes':'Settings'}</Button></DialogTrigger><DialogContent><DialogTitle>{es?'Configuración de la clase':'Lesson settings'}</DialogTitle><DialogDescription>{es?'Ajusta la reproducción y el audio de esta clase teórica.':'Adjust playback and audio for this theory lesson.'}</DialogDescription><label className="flex items-center gap-3">{es?'Segundos por paso':'Seconds per step'}<input aria-label={es?'Segundos por paso':'Seconds per step'} type="number" min="8" max="60" value={seconds} onChange={e=>{setRunning(false);setSegment(-1);setTime(0);setSeconds(Math.max(8,Math.min(60,Number(e.target.value)||12)))}} className="w-20 rounded border p-2"/></label><label className="flex items-center gap-3">{es?'Volumen':'Volume'}<input aria-label={es?'Volumen':'Volume'} type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))} className="accent-primary"/></label><Button onClick={()=>{const ctx=audio.current??new AudioContext();audio.current=ctx;void ctx.resume().then(()=>{const o=ctx.createOscillator(),g=ctx.createGain();g.gain.setValueAtTime(.1*volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.5);o.frequency.value=440;o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.5);o.onended=()=>{o.disconnect();g.disconnect()}})}}>{es?'Probar sonido':'Test audio'}</Button><p className="text-sm text-muted-foreground">{es?'No necesitas micrófono ni calibración para esta clase de lectura y escucha.':'This reading and listening lesson does not require a microphone or calibration.'}</p></DialogContent></Dialog>}/>

  <SplitWorkspace controller={workspace} initialHeight={680} sizing="content" music={<div><div className="relative min-h-[370px]">
   {tab===1||tab===3?<div className="grid min-h-[370px] place-content-center gap-3 p-8 text-center"><h2 className="font-heading text-2xl">{tab===1?'Quiz':'Jam Session'}</h2><p className="text-muted-foreground">{es?(tab===1?'El examen corresponde al grupo de lecciones y se añadirá en su lugar.':'Esta clase introductoria no tiene Jam Session.'):(tab===1?'The group assessment will be added at its assigned point.':'This introductory lesson has no Jam Session.')}</p><Button onClick={()=>setTab(0)}>{es?'Volver a la clase':'Return to lesson'}</Button></div>:tab===2?<QuizRunner classItemId={`local-solfeo-m01-c0${lessonNumber}-exercise`} kind="Exercise" nextHref={`/solfeo-preview?class=local-solfeo-m01-c0${lessonNumber+1}`} questions={solfeoExerciseQuestions(lessonNumber,es)} title={es?`Práctica: ${title}`:`Practice: ${title}`}/>:complete?<div className="relative min-h-[540px] bg-background"><LessonStartCard inFlow title={lessonNumber===2?(es?'¡Sigues progresando!':'You’re making progress!'):(es?'¡Bien hecho!':'Well done!')} label={tab===2?(es?'PRÁCTICA COMPLETADA':'PRACTICE COMPLETE'):(es?'LECCIÓN COMPLETADA':'LESSON COMPLETE')} detail={tab===2?(es?'Completaste la práctica. Sigue aprendiendo a tu ritmo.':'You completed the practice. Keep learning at your own pace.'):(es?'Terminaste la explicación. La práctica está en la pestaña Ejercicio.':'You finished the lesson. Practice is in the Exercise tab.')} pills={es?['Escucha','Reconoce','Practica']:['Listen','Recognize','Practice']} action={es?'Repetir clase':'Replay lesson'} onStart={reset}/><VideoWatermark staticStage/></div>:segment<0&&tab!==2?<div className="relative min-h-[540px] bg-background"><LessonStartCard inFlow title={title} label={`${es?'SOLFEO APLICADO · CLASE':'APPLIED SOLFEGE · LESSON'} 1.${lessonNumber}`} instructor="Raffy Pérez" detail={lessonNumber===2?(es?'Descubre el pentagrama. Ubica cada línea y espacio.':'Explore the staff. Locate each line and space.'):(es?'Descubre las notas. Escucha y reconoce sus nombres.':'Discover the notes. Listen and recognize their names.')} pills={lessonNumber===2?(es?['Líneas','Espacios','Altura']:['Lines','Spaces','Pitch']):(es?['Escucha','Nombres','Altura']:['Listen','Names','Pitch'])} action={started?(es?'Siguiente':'Next'):(es?'Empezar':'Start')} onStart={()=>started?selectStep(0):start()}/><VideoWatermark staticStage/></div>:<LessonContent bpm={bpm} metronome={click} countInBars={countInBars} onDemoStart={()=>{countIn.cancel();setRunning(false)}} volume={volume} controlledStep={tab===2?5:step} exerciseOnly={tab===2} onStepChange={selectStep} onComplete={()=>{setComplete(true);setRunning(false);if(tab===0)setTime(6+5*seconds)}}/>}
   </div></div>} footer={<>
   <div className="border-t px-4 pt-3"><label className="flex items-center gap-3 text-xs"><span>{es?'Recorrido':'Timeline'}</span><input type="range" min="0" max={6+5*seconds} step=".1" value={time} onChange={e=>{countIn.cancel();const next=Number(e.target.value);setTime(next);setSegment(next<6?-1:Math.min(4,Math.floor((next-6)/seconds)));setStarted(true);setComplete(false)}} aria-label={es?'Posición de la clase':'Lesson position'} className="min-w-0 flex-1 accent-primary"/><span className="tabular-nums">{Math.floor(time)} / {6+5*seconds} s</span></label></div>
   {countIn.remaining>0&&<output role="status" className="block text-center font-mono text-3xl text-primary">{countIn.remaining}</output>}<div className="lx-action !relative"><LessonTransport state={countIn.remaining?'countdown':running?'playing':started?'paused':'selecting'} bpm={bpm} countdownBeat={countIn.remaining} click={click} onStart={start} onPause={()=>{countIn.cancel();setRunning(false)}} onResume={start} onRestart={reset} onStop={()=>{countIn.cancel();setRunning(false);setSegment(-1);setTime(0);setStarted(false)}} onFinish={()=>{countIn.cancel();setRunning(false);setComplete(true)}} onClickToggle={()=>{if(!audio.current)audio.current=new AudioContext();void audio.current.resume();setClick(!click)}} metronomeSettings={<><PrecountControl bars={countInBars} remaining={countIn.remaining} onChange={n=>{countIn.cancel();setCountInBars(n)}}/><label className="flex items-center gap-2">BPM <BpmInput value={bpm} onChange={setBpm} className="w-20 rounded border p-2"/></label></>} mix={<button aria-pressed={loop} onClick={()=>setLoop(!loop)} className={`flex h-9 items-center gap-1 rounded-full border px-3 text-xs ${loop?'bg-primary/15 text-primary':''}`}><Repeat size={14}/>{es?'Repetir paso':'Loop step'}</button>}/></div>
  </>}/>
  {(complete||tab===2)&&<nav aria-label={es?'Continuar aprendizaje':'Continue learning'} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
   <Button variant="outline" onClick={()=>{setComplete(false);setRunning(false);setTab(0);selectStep(4)}}>{es?'← Anterior: lección':'← Previous: lesson'}</Button>
   {tab===0&&<Button onClick={()=>{setTab(2);setComplete(false);setRunning(false)}}>{es?'Siguiente: ejercicio →':'Next: exercise →'}</Button>}
  </nav>}
  <p className="text-xs text-muted-foreground">{es?`La barra solo cambia al elegir una posición o pulsar Anterior y Siguiente. Play activa el sonido de la pantalla actual sin avanzar a la siguiente.`:`The timeline only changes when you seek or press Previous and Next. Play runs sound for the selected screen without advancing to the next one.`}</p>
  <LocalLessonCommunity lessonNumber={lessonNumber}/>
 </div>
}

/** Experiment scoped to class 1; student and editor use the same page reader. */
export function SolfeoLessonExperience(props: {lessonNumber?:1|2;exercise?:boolean;headerContext?:LessonHeaderContext}) {
 return <FirstSolfeoDocumentLesson lessonNumber={props.lessonNumber??1} exercise={props.exercise} headerContext={props.headerContext}/>
}
