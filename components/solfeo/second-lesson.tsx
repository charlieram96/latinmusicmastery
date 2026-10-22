'use client'

import { useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { LessonTipCard } from '@/components/playsense-studio/shared/lesson-tip-card'
import { HistoryDetail, ManuscriptDetail } from './history-detail'
import { staffLessonNotes } from '@/lib/solfeo/notes'

import {useNoteDemonstration,type DemonstrationSettings} from './use-note-demonstration'

// Historical context: Cambridge, The Renaissance Reform of Medieval Music Theory, introduction;
// University of Bologna, “Guido d’Arezzo, il padre delle note musicali”.
export function SecondSolfeoLesson({controlledStep = 0,onStepChange,onComplete,exerciseOnly = false,volume = .7,bpm=100,metronome=true,countInBars=0,onDemoStart}: DemonstrationSettings & {exerciseOnly?:boolean;controlledStep?:number;onStepChange?:(step:number)=>void;onComplete?:()=>void;volume?:number}) {
 const {locale}=useTranslation(); const es=locale==='es'; const t=(a:string,b:string)=>es?a:b
 const step=controlledStep
 const demoAudio=useNoteDemonstration({bpm,metronome,countInBars,onDemoStart,volume})
 const demo=demoAudio.playing,selected=demoAudio.active
 const stopDemo=demoAudio.stop
 useEffect(()=>{stopDemo()},[step,stopDemo])
 function locate(index:number){void demoAudio.play([{frequency:staffLessonNotes(step)[index].frequency,beats:1,index}],{preview:true})}
 function runDemo(){if(demo){stopDemo();return}void demoAudio.play(staffLessonNotes(step).map((n,index)=>({frequency:n.frequency,beats:1,index})))}
 const [question,setQuestion]=useState(0),[answer,setAnswer]=useState<number|null>(null)
 const titles=[t('Cinco líneas, cuatro espacios','Five lines, four spaces'),t('Las líneas se cuentan desde abajo','Count lines from the bottom'),t('Los espacios también se cuentan desde abajo','Count spaces from the bottom'),t('La posición indica la altura','Position indicates pitch'),t('Leer y escribir con precisión','Read and write accurately'),t('Ahora prueba tú','Now try it yourself')]
 const questions=[{text:t('¿Cuántas líneas tiene el pentagrama?','How many lines are in a staff?'),choices:['4','5','6'],correct:1},{text:t('¿Cuántos espacios interiores tiene?','How many inner spaces does it have?'),choices:['3','4','5'],correct:1},{text:t('¿Dónde está la primera línea?','Where is the first line?'),choices:[t('Abajo','At the bottom'),t('Arriba','At the top'),t('En el centro','In the middle')],correct:0},{text:t('¿Qué signo fija la referencia para nombrar las notas?','Which sign establishes the reference for naming notes?'),choices:[t('La barra final','The final barline'),t('El silencio','The rest'),t('La clave','The clef')],correct:2}]
 const q=questions[question];const correct=answer===q.correct
 function go(next:number){stopDemo();onStepChange?.(next)}
 const diagram=<div className="relative w-full"><svg viewBox="0 0 700 245" className="mx-auto w-full max-w-3xl" role="img" aria-label={step===3?t('Claves de sol, fa y do entre paréntesis a la izquierda; notas ascendentes en el pentagrama','Treble, bass and C clefs in parentheses on the left; ascending notes on the staff'):step===4?t('Flechas señalan una nota sobre una línea y otra en un espacio; círculos rodean sus cabezas','Arrows point to a note on a line and another in a space; circles surround their noteheads'):t('Pentagrama: cinco líneas y cuatro espacios, numerados de abajo hacia arriba','Staff: five lines and four spaces, numbered from bottom to top')}>
  {step===2 && [0,1,2,3].map(i=><rect key={i} x="90" y={155-i*32} width="510" height="32" fill="#f58a20" opacity={selected===i?.3:.09}/>)}
  {[0,1,2,3,4].map(i=><g key={i}><line x1="90" x2="620" y1={187-i*32} y2={187-i*32} stroke={step===1&&selected===i?'#f58a20':'currentColor'} strokeWidth={step===1&&selected===i?4:2} className="solfeo-staff-line" style={{animationDelay:`${i*.15}s`}}/>{step===1&&<text x="58" y={194-i*32} fill="currentColor" fontSize="20">{i+1}</text>}</g>)}
  {step===2&&[0,1,2,3].map(i=><text key={i} x="58" y={177-i*32} fill="currentColor" fontSize="20">{i+1}</text>)}
  {step===3&&[0,1,2,3,4,5,6,7,8].map(i=><ellipse key={i} cx={125+i*55} cy={187-i*16} rx="11" ry="8" fill="#f58a20" className="solfeo-staff-note" style={{animationDelay:`${i*.25}s`}}/>)}
  {step===4&&<>
   <g fill="none" stroke="#f58a20" strokeWidth="2.5" aria-hidden="true">
    <circle cx="235" cy="155" r="22" className="solfeo-note-ring"/>
    <circle cx="455" cy="139" r="22" className="solfeo-note-ring" style={{animationDelay:'.6s'}}/>
    <g className="solfeo-location-arrow"><path d="M177 107 213 143m-12-3 12 3-3-12" strokeLinecap="round" strokeLinejoin="round"/></g>
    <g className="solfeo-location-arrow" style={{animationDelay:'.6s'}}><path d="M513 91 477 127m3-12-3 12 12-3" strokeLinecap="round" strokeLinejoin="round"/></g>
   </g>
   <ellipse cx="235" cy="155" rx="13" ry="9" fill="#f58a20"/><ellipse cx="455" cy="139" rx="13" ry="9" fill="#f58a20"/><text x="235" y="230" fill="currentColor" fontSize="18" textAnchor="middle">{t('En una línea','On a line')}</text><text x="455" y="230" fill="currentColor" fontSize="18" textAnchor="middle">{t('En un espacio','In a space')}</text></>}
  <path d="M655 187V59m-7 10 7-10 7 10" stroke="#f58a20" strokeWidth="3" fill="none"/>
 </svg>
  {step===3&&<svg viewBox="0 0 70 245" className="absolute top-0 h-full -translate-x-1/2 text-foreground" style={{left:"calc(25% - min(18.5714%, 8.9143rem))",width:"min(10%, 4.8rem)"}} fill="currentColor" aria-hidden="true">
   {[{glyph:'\uE050',name:t('Sol','G'),baseline:49},{glyph:'\uE062',name:t('Fa','F'),baseline:115},{glyph:'\uE05C',name:t('Do','C'),baseline:186}].map((clef,i)=><g key={clef.name}>
    <text x="0" y={49+i*70} fontSize="27">(</text>
    <text x="16" y={clef.baseline} fontSize="28" style={{fontFamily:'Bravura, serif'}}>{clef.glyph}</text>
    <text x="52" y={49+i*70} fontSize="27">)</text>
    <text x="29" y={88+i*70} fontSize="13" textAnchor="middle">{clef.name}</text>
   </g>)}
  </svg>}
 </div>
 return <section className="overflow-hidden rounded-2xl border bg-background" aria-label={t('Clase interactiva: pentagrama, líneas y espacios','Interactive lesson: staff, lines and spaces')}>
  <div className="flex justify-between bg-[#265b4d] px-5 py-4 text-white"><span className="text-xs font-semibold uppercase tracking-wider">{t('Observa · Ubica · Practica','Observe · Locate · Practice')}</span><span>{exerciseOnly?t('Ejercicio','Exercise'):`${step+1} / 5`}</span></div>
  <div className="flex gap-1 px-5 pt-5">{!exerciseOnly && titles.slice(0,5).map((title,i)=><button key={title} aria-label={`${i+1}. ${title}`} aria-current={step===i?'step':undefined} onClick={()=>go(i)} className={`h-2 flex-1 rounded-full ${step===i?'bg-primary':'bg-primary/20'}`}/>)}</div>
  <div className="space-y-5 p-5 sm:p-7"><h3 className="font-heading text-2xl font-bold">{titles[step]}</h3>
   <p className="text-xs text-muted-foreground">♩ = {bpm} BPM {demoAudio.count>0&&<span role="status"> · {demoAudio.count}</span>}</p>{step===0&&<><p>{t('El pentagrama está formado por cinco líneas paralelas y cuatro espacios interiores. Las notas se escriben sobre las líneas o entre ellas.','A staff has five parallel lines and four inner spaces. Notes are written on the lines or between them.')}</p>{diagram}<div className="grid gap-4 sm:grid-cols-3"><div className="flex items-center gap-3"><strong>Guido de Arezzo</strong><HistoryDetail/></div><ManuscriptDetail kind="tetragram"/><ManuscriptDetail kind="pentagram"/></div><p className="text-sm text-muted-foreground">{t('La escritura musical sobre líneas evolucionó durante siglos. Guido relacionó sonidos, posiciones escritas y sílabas para facilitar el aprendizaje. Guido de Arezzo fue un monje benedictino y maestro de música del siglo XI que trabajó en Italia. Impulsó el uso de un sistema de cuatro líneas, llamado tetragrama, que permitía indicar con mayor precisión la altura de los sonidos y fue un antecedente del pentagrama actual. Para enseñar a cantar, utilizó las sílabas ut, re, mi, fa, sol y la, tomadas del himno «Ut queant laxis», cuyas primeras seis frases comienzan en sonidos sucesivamente más agudos: así los alumnos podían recordar las alturas y aprender melodías nuevas sin depender solo de la imitación.','Musical notation on lines evolved over centuries. Guido connected sounds, written positions and syllables to make learning easier. Guido of Arezzo was an eleventh-century Benedictine monk and music teacher who worked in Italy. He promoted a four-line staff that indicated pitch more precisely and was a forerunner of today’s five-line staff. To teach singing, he used the syllables ut, re, mi, fa, sol and la from the hymn “Ut queant laxis”, whose first six phrases begin on successively higher pitches: this helped students remember pitches and learn new melodies without relying solely on imitation.')}</p></>}
   {step===1&&<><p>{t('La primera línea es la de abajo. Sigue hacia arriba hasta llegar a la quinta. Pulsa un número para destacar su línea.','The first line is at the bottom. Count upward to the fifth. Select a number to highlight its line.')}</p>{diagram}<div className="flex flex-wrap gap-2">{[1,2,3,4,5].map((n,i)=><Button key={n} variant={selected===i?'default':'outline'} data-note={staffLessonNotes(1)[i].name} data-frequency={staffLessonNotes(1)[i].frequency} onClick={()=>locate(i)}>{t('Línea','Line')} {n}</Button>)}</div></>}
   {step===2&&<><p>{t('El primer espacio está entre la primera y la segunda línea. Hay cuatro espacios interiores. Pulsa cada uno para localizarlo.','The first space lies between the first and second lines. There are four inner spaces. Select each one to locate it.')}</p>{diagram}<div className="flex flex-wrap gap-2">{[1,2,3,4].map((n,i)=><Button key={n} variant={selected===i?'default':'outline'} data-note={staffLessonNotes(2)[i].name} data-frequency={staffLessonNotes(2)[i].frequency} onClick={()=>locate(i)}>{t('Espacio','Space')} {n}</Button>)}</div></>}
   {step===3&&<><p>{t('Al subir por el pentagrama, las posiciones alternan línea y espacio. Una posición más alta representa un sonido más agudo cuando mantenemos la misma clave.','As we move up the staff, positions alternate between line and space. A higher position represents a higher pitch when the clef stays the same.')}</p>{diagram}<p>{t('La clave fija la referencia para nombrar las notas. La estudiaremos en la próxima clase.','The clef establishes the reference for naming notes. We will study it in the next lesson.')}</p></>}
   {step===4&&<><p>{t('Cuando una nota está en una línea, la línea cruza el centro de la cabeza. Cuando está en un espacio, la cabeza queda entre dos líneas.','When a note is on a line, the line crosses the center of its notehead. When it is in a space, the notehead sits between two lines.')}</p>{diagram}<p>{t('No confundas la altura con la duración: la posición indica altura; la figura indica duración.','Do not confuse pitch with duration: position indicates pitch; the note value indicates duration.')}</p></>}
   {(step===1||step===2)&&<div className="flex flex-wrap items-center gap-3"><Button onClick={runDemo}>{demo?t('Pausar recorrido','Pause demonstration'):t('Ver recorrido con sonido','Watch with sound')}</Button><span className="text-xs text-muted-foreground">{step===2?t('En clave de sol: Fa4 · La4 · Do5 · Mi5.','In treble clef: F4 · A4 · C5 · E5.'):t('En clave de sol: Mi4 · Sol4 · Si4 · Re5 · Fa5.','In treble clef: E4 · G4 · B4 · D5 · F5.')}</span></div>}
   {step<5&&<LessonTipCard inline icon={<BookOpen size={23}/>} label={t('LECTURA','READING')} title={t('Cuenta siempre desde abajo.','Always count from the bottom.')} detail={t('Cinco líneas. Cuatro espacios. Una posición precisa.','Five lines. Four spaces. Precise placement.')}/>}
   {step===5&&<><p className="text-sm text-muted-foreground">{t('Práctica breve, sin calificación.','Short, ungraded practice.')} {question+1}/4</p><p className="text-xl font-semibold">{q.text}</p><div className="flex flex-wrap gap-3">{q.choices.map((c,i)=><Button key={c} variant={answer===i?'default':'outline'} disabled={correct} onClick={()=>setAnswer(i)}>{c}</Button>)}</div><p role="status">{answer!==null?(correct?t('¡Correcto!','Correct!'):t('Inténtalo otra vez. Puedes repasar los pasos anteriores.','Try again. You can review the previous steps.')):'\u00a0'}</p>{correct&&<Button onClick={()=>{if(question===3)onComplete?.();else{setQuestion(question+1);setAnswer(null)}}}>{question===3?t('Terminar práctica','Finish practice'):t('Siguiente pregunta','Next question')}</Button>}</>}
  </div>{!exerciseOnly && <footer className="flex justify-between border-t p-5"><Button variant="outline" disabled={step===0} onClick={()=>go(step-1)}><ChevronLeft/>{t('Anterior','Back')}</Button><Button onClick={()=>step===4?onComplete?.():go(step+1)}>{step===4?t('Terminar lección','Finish lesson'):t('Siguiente','Next')}<ChevronRight/></Button></footer>}
  <style>{`
   @font-face{font-family:Bravura;src:url('/fonts/notation/bravura.woff2') format('woff2');font-display:swap}
   @keyframes solfeo-staff-arrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
   .solfeo-staff-line{stroke-dasharray:600;animation:solfeo-line-draw .8s both}
   @keyframes solfeo-line-draw{from{stroke-dashoffset:600}to{stroke-dashoffset:0}}
   .solfeo-staff-note{animation:solfeo-staff-arrive .4s both}
   .solfeo-note-ring{stroke-dasharray:5 4;transform-box:fill-box;transform-origin:center;animation:solfeo-ring-emphasis 2.4s ease-in-out infinite}
   @keyframes solfeo-ring-emphasis{0%,100%{opacity:.65;transform:scale(1)}50%{opacity:1;transform:scale(1.12);stroke-dashoffset:18}}
   .solfeo-location-arrow{animation:solfeo-arrow-emphasis 2.4s ease-in-out infinite}
   @keyframes solfeo-arrow-emphasis{0%,100%{opacity:.55}50%{opacity:1}}
   @media(prefers-reduced-motion:reduce){.solfeo-staff-note,.solfeo-staff-line,.solfeo-note-ring,.solfeo-location-arrow{animation:none}}
  `}</style>
 </section>
}
