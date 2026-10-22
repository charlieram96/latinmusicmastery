'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {KidCharacter} from '@/components/learning-mode/art'
import {MascotEntrance} from './mascot-entrance'
import {AnswerFireworks} from './answer-reaction'
import {useNoteDemonstration} from '@/components/solfeo/use-note-demonstration'
import {VideoWatermark} from '@/components/playsense-studio/shared/video-watermark'
import { useTranslation } from '@/components/language-provider'
import { LessonHeader, type LessonHeaderContext } from '@/components/solfeo/lesson-header'
import { LessonNarration } from '@/components/lesson-narration/lesson-narration'
import { CourseSequenceNavigation } from '@/components/solfeo/course-sequence-navigation'
import { GardenFrame } from './first-garden'
import { AdventureThemeContext, adventureThemes } from './adventure-theme'
import s from './module-welcome.module.css'

export function ModuleWelcome({moduleNumber,startHref,lessons,headerContext}:{moduleNumber:number;startHref:string;lessons:string[];headerContext:LessonHeaderContext}) {
 const {locale}=useTranslation(),es=locale==='es'
 const [entered,setEntered]=useState(false)
 const [arrival,setArrival]=useState(false)
 const [discovery,setDiscovery]=useState(0)
 const music=useNoteDemonstration({bpm:140,metronome:false,countInBars:0,volume:.3})
 useEffect(()=>{if(!arrival)return;const timer=setTimeout(()=>setArrival(false),2400);return()=>clearTimeout(timer)},[arrival])
 const playEntrance=()=>{void music.play([523.25,659.25,783.99,659.25,698.46,880,783.99,1046.5].map((frequency,index)=>({frequency,index,beats:index===7?1.5:.5})),{preview:true}).catch(()=>{})}
 const narration=useRef<HTMLDivElement>(null)
 const theme=adventureThemes[moduleNumber-1]??adventureThemes[0]
 const name=es?theme.es:theme.en
 const discoveries=moduleNumber===1?[
  {icon:'🌱',title:es?'Las notas tienen nombre':'Notes have names',text:es?'Conoceremos a Do, Re, Mi, Fa, Sol, La y Si. Escucharemos sus sonidos y haremos crecer flores musicales.':'Meet Do, Re, Mi, Fa, Sol, La and Si. We will hear their sounds and grow musical flowers.'},
  {icon:'🏡',title:es?'Una casita para las notas':'A home for notes',text:es?'Construiremos cinco líneas y descubriremos cuatro espacios. Esa casita se llama pentagrama.':'We will build five lines and discover four spaces. This home is called the staff.'},
  {icon:'🗝️',title:es?'Signos que nos cuentan música':'Symbols that tell us music',text:es?'La clave nos ayudará a leer las notas. Después conoceremos figuras y silencios: cuándo suena la música y cuándo descansa.':'The clef will help us read notes. Then we will meet note values and rests: when music sounds and when it rests.'}
 ]:[
  {icon:theme.icon,title:name,text:es?theme.missionEs:theme.missionEn},
  {icon:theme.friends[0],title:es?'Primero miramos y escuchamos':'First we look and listen',text:es?`Corcheíta te mostrará cada idea. Nuestro primer descubrimiento será: ${lessons[0]}.`:`Corcheita will show you each idea. Our first discovery will be: ${lessons[0]}.`},
  {icon:theme.friends[1],title:es?'Después lo probamos juntos':'Then we try together',text:es?'Practicaremos paso a paso y jugaremos con preguntas. Puedes repetir y pedir ayuda; cada intento te ayuda a aprender.':'We will practise step by step and play with questions. You can repeat and ask for help; every try helps you learn.'}
 ]
 const selected=discoveries[discovery]
 const greeting=es?'¡Hola! Soy Corcheíta, la mascota de este curso. Te acompañaré en todas las aventuras: vamos a escuchar, leer, escribir y cantar música, paso a paso, hasta aprender a solfear. ¡Aprendamos juntos!':'Hello! I’m Corcheita, your course mascot. I’ll guide you through every adventure: we will listen, read, write and sing music, step by step, as we learn solfege. Let’s learn together!'
 return <AdventureThemeContext.Provider value={theme}><div className="space-y-5 p-3 md:p-6" data-kids-course>
  <LessonHeader title={name} context={{...headerContext,title:name}} tabs={null}/>
  {!entered?<MascotEntrance onMusic={playEntrance} onEnter={()=>{setEntered(true);setArrival(true)}}/>:<>
  <button className="rounded-xl border bg-background px-4 py-2 font-semibold" onClick={()=>{music.stop();setEntered(false);setArrival(false);setDiscovery(0)}}>{es?'↺ Volver al principio con Corcheíta':'↺ Back to the beginning with Corcheita'}</button>
  <div ref={narration} className={s.welcome}>
   <GardenFrame label={es?`SOLFEO INFANTIL APLICADO · BIENVENIDA AL MÓDULO ${moduleNumber}`:`APPLIED SOLFEGE FOR KIDS · WELCOME TO MODULE ${moduleNumber}`} title={moduleNumber===1?(es?'Solfeo aplicado infantil':'Applied solfege for kids'):name} detail={es?'Lectura y comprensión del lenguaje musical':'Reading and understanding musical language'} mascotMessage={selected?.text??greeting} onDreamReplay={()=>setDiscovery(i=>(i+1)%discoveries.length)}>
    {discovery<0&&<div className={s.publication}><p>{es?'MANUAL DE ESTUDIO':'STUDY MANUAL'}</p><p>{es?'Teoría · lectura · escritura · entonación':'Theory · reading · writing · singing'}</p><p>{es?'Dirección pedagógica: Raffy Pérez':'Pedagogical direction: Raffy Pérez'}</p><small>{es?'Edición de trabajo 0.3 · Octubre 2026':'Working edition 0.3 · October 2026'}</small></div>}
    {discovery>=0&&<><h3 className={s.discovery}>{name}</h3>
    <p className={s.promise}>{es?'Toca una sorpresa para conocer lo que aprenderemos. Toca a Corcheíta para seguir descubriendo.':'Tap a surprise to discover what we will learn. Tap Corcheita to keep exploring.'}</p>
    <div className={s.path} role="group" aria-label={es?'Descubre el módulo':'Discover the module'}>{discoveries.map((item,i)=><button key={item.title} onClick={()=>setDiscovery(i)} aria-pressed={discovery===i} className={s.stop}><span aria-hidden="true">{item.icon}</span><strong>{item.title}</strong></button>)}</div>
    <h3 className={s.discovery} aria-live="polite">{selected?.title}</h3></>}
    <p className={s.promise}>{es?'Primero te enseñamos. Después practicamos. Y al final, ¡jugamos a descubrir!':'First we teach you. Then we practise. Finally, we play and discover!'}</p>
    <div className={s.actions}><button className={s.explore} onClick={()=>setDiscovery(discovery<0?0:-1)}>{discovery<0?(es?'🌱 Descubrir el módulo':'🌱 Discover the module'):(es?'Volver a la bienvenida':'Back to welcome')}</button><Link className={s.start} href={startHref}>{es?'Empezar':'Start'} <span aria-hidden="true">→</span><small>{lessons[0]}</small></Link></div>
   </GardenFrame>{arrival&&<AnswerFireworks/>}<VideoWatermark staticStage/>
  </div>
  <div className="flex items-center gap-3"><LessonNarration target={narration} resetKey={`${moduleNumber}:${discovery}`} language={locale}/><span className="text-sm">{es?'Escuchar la bienvenida':'Listen to the welcome'}</span></div>
  <details className={s.map}><summary><KidCharacter name="journey" index={3} className={s.mapIcon}/><span>{es?'Nuestro camino por este módulo':'Our path through this module'}</span><span className={s.mapToggle} aria-hidden="true">＋</span></summary><ol className="mt-3 space-y-2">{lessons.map((title,i)=><li key={title}><KidCharacter name="music" index={i} className={s.mapIcon}/><span>{title}</span></li>)}</ol></details>
  <CourseSequenceNavigation currentTitle={name} activity={es?'Bienvenida':'Welcome'} nextActivity={{title:lessons[0],href:startHref}}/></>}
 </div></AdventureThemeContext.Provider>
}
