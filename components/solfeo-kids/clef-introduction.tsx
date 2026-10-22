'use client'
import { useMemo, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { GardenFrame } from './first-garden'
import { KidsCorcheita } from './answer-reaction'
import { useNoteDemonstration } from '@/components/solfeo/use-note-demonstration'
import { lessonNote } from '@/lib/solfeo/notes'
import s from './clef-introduction.module.css'
// The spiral wraps G4 on the second line; the same path guides the spider and thread.
const thread='M268 240 C267 226 281 219 291 230 C306 249 285 273 261 262 C235 251 236 231 250 210 C264 190 287 169 287 143 C287 127 283 116 279 111 C264 120 258 137 261 156 C265 185 271 214 276 243 C280 266 288 292 276 308 C267 320 248 314 248 303 C248 297 251 294 255 294'
function Spider(){return <g aria-hidden="true"><path d="M-7-6-16-15-23-8M-9-2-22-7-27 2M-9 3-23 5-25 15M-6 7-16 15-16 23M7-6l9-9 7 7M9-2l13-5 5 9M9 3l14 2 2 10M6 7l10 8v8" fill="none" stroke="#171920" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><ellipse cy="-5" rx="11" ry="12" fill="#111318" stroke="#8a94a6" strokeWidth=".8"/><circle cy="6" r="9" fill="#252832" stroke="#8a94a6" strokeWidth=".7"/><ellipse cx="-4" cy="-9" rx="3" ry="4" fill="#454b59"/><circle cx="-3.5" cy="4" r="3.3" fill="white"/><circle cx="3.5" cy="4" r="3.3" fill="white"/><circle cx="-3" cy="4.5" r="1.6" fill="#08090c"/><circle cx="3" cy="4.5" r="1.6" fill="#08090c"/><path d="M-3 10q3 3 6 0" fill="none" stroke="#f5f5ff" strokeWidth="1.2" strokeLinecap="round"/></g>}

export function ClefIntroduction(){
 const {locale}=useTranslation(),es=locale==='es'
 const [phase,setPhase]=useState<'ready'|'weaving'|'woven'|'handing'|'searching'|'done'>('ready'),[run,setRun]=useState(0),[info,setInfo]=useState<number|null>(null),[error,setError]=useState(false)
 const sound=useNoteDemonstration({metronome:false,countInBars:0,volume:.5})
 const reaction=useMemo(()=>phase==='done'?{result:'correct' as const,id:run}:undefined,[phase,run])
 const hearSol=()=>{setError(false);void sound.play([{frequency:lessonNote('G4').frequency,beats:1,index:0}],{preview:true}).catch(()=>setError(true))}
 const weave=()=>{setRun(n=>n+1);setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches?'woven':'weaving')}
 const deliver=()=>{setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches?'done':'handing')}
 const busy=['weaving','handing','searching'].includes(phase)
 const action=phase==='woven'?deliver:weave
 const actionLabel=phase==='weaving'?(es?'Tejiendo…':'Weaving…'):phase==='handing'?(es?'Corcheita entrega la nota…':'Corcheita hands over the note…'):phase==='searching'?(es?'Buscando su lugar…':'Finding its home…'):phase==='woven'?(es?'🎵 Dar la nota a la arañita':'🎵 Give the spider the note'):phase==='done'?(es?'🕷️ Empezar otra vez':'🕷️ Start again'):(es?'🕷️ Toca para tejer la clave':'🕷️ Tap to weave the clef')
 const detail=phase==='ready'||phase==='weaving'?(es?'Primero tejemos el símbolo. Sigue el hilo de la arañita.':'First we weave the symbol. Follow the spider’s thread.'):phase==='woven'?(es?'¡La clave está lista! Ahora toca a Corcheita para darle la nota a la arañita.':'The clef is ready! Now tap Corcheita to give the spider the note.'):phase==='handing'||phase==='searching'?(es?'Corcheita le entrega Sol. La arañita recorre las cinco líneas para encontrar su casa.':'Corcheita hands over G. The spider explores all five lines to find its home.'):(es?'¡Sol vive en la segunda línea! La clave nos dio la pista.':'G lives on the second line! The clef gave us the clue.')
 const cards=es?[
  ['🗝️','¿Qué es?','Soy la clave de Sol: un símbolo musical que nos ayuda a leer los nombres de las notas.'],
  ['🧵','¿Dónde va?','Me escriben al comienzo del pentagrama. Mi espiral abraza la segunda línea, contando desde abajo.'],
  ['🎵','¿Para qué sirve?','Esa segunda línea es la casa de Sol4. Con esa pista encontramos las demás notas, subiendo o bajando por líneas y espacios.']
 ]:[['🗝️','What is it?','I am the treble clef: a musical symbol that helps us read note names.'],['🧵','Where does it go?','Write me at the beginning of the staff. My spiral wraps around the second line, counting from the bottom.'],['🎵','What does it do?','That second line is G4’s home. From there we can find the other notes, moving up or down through lines and spaces.']]
 return <GardenFrame hideMascot reaction={reaction} title={es?'La arañita teje una clave':'A spider weaves a clef'} detail={detail}>
 <div className={s.stage}>
 <svg viewBox="0 0 760 310" className={s.staff} role="img" aria-label={es?'La clave de Sol se dibuja al principio del pentagrama y rodea la segunda línea':'The treble clef is drawn at the start of the staff and wraps around the second line'}>
 {[1,2,3,4,5].map((n)=><g key={n}><path d={`M170 ${290-n*40}H700`} stroke={phase==='done'&&n===2?'#f6bc43':'#8c9caf'} strokeWidth={phase==='done'&&n===2?3:2}/><text x="715" y={295-n*40} fill="currentColor" fontSize="15">{n}</text></g>)}
 <g transform="translate(-60 -30)">
 <path d={thread} fill="none" stroke="#a890cc" strokeWidth="2" opacity=".2"/>
 {phase!=='ready'&&<path key={run} className={phase==='weaving'?s.thread:undefined} d={thread} pathLength="1" fill="none" stroke="#a27ade" strokeWidth="5" strokeLinecap="round" onAnimationEnd={()=>setPhase('woven')}/>}
 {phase==='weaving'&&<g key={'spider'+run} className={s.tracing} style={{offsetPath:`path('${thread}')`}}><Spider/></g>}
 </g>
 {phase==='ready'&&<g transform="translate(208 210)"><Spider/></g>}
 {(phase==='woven'||phase==='handing')&&<g transform="translate(195 264)"><Spider/></g>}
 {(phase==='woven'||phase==='handing')&&<foreignObject x="55" y="205" width="65" height="85"><button className={s.stageMascot} onClick={deliver} disabled={phase==='handing'} aria-label={es?'Corcheita: entregar la nota':'Corcheita: hand over the note'}><KidsCorcheita/></button></foreignObject>}
 {phase==='handing'&&<g className={s.handoff} onAnimationEnd={()=>setPhase('searching')}><ellipse rx="17" ry="12" transform="rotate(-15)" fill="#ed9b21"/></g>}
 {phase==='searching'&&<g className={s.search} onAnimationEnd={()=>{setPhase('done');hearSol()}}><g transform="translate(0 -23)"><Spider/></g><ellipse rx="17" ry="12" transform="rotate(-15)" fill="#ed9b21"/></g>}
 {phase==='done'&&<g className={s.visitor}><path d="M70 0V125" stroke="#b8a6d3" strokeWidth="1"/><g transform="translate(70 125)"><Spider/></g><text x="52" y="163" fontSize="19">✦</text></g>}
 {phase==='done'&&<g role="button" tabIndex={0} aria-label={es?'Escuchar nota Sol':'Play G note'} onClick={hearSol} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hearSol()}}} className={s.note}><ellipse cx="430" cy="210" rx="17" ry="12" transform="rotate(-15 430 210)" fill="#ed9b21"/>
 <text x="460" y="216" fill="currentColor" fontSize="20">{es?'Sol · segunda línea':'G · second line'}</text></g>}
 </svg>
 </div>
 <div className={s.actions}><button onClick={action} disabled={busy}>{actionLabel}</button>{phase==='done'&&<button onClick={hearSol}>{es?'🔊 Escucha Sol':'🔊 Hear G'}</button>}</div>
 <div className={s.guide}><button className={s.mascot} onClick={()=>{if(phase==='woven')deliver();else setInfo(i=>i===null?0:null)}} aria-expanded={info!==null} aria-label={es?'Corcheita: descubre la clave de Sol':'Corcheita: discover the treble clef'}><KidsCorcheita/><span>{es?'¡Tócame!':'Tap me!'}</span></button><div className={s.explanation}>
 <div className={s.topics}>{cards.map(([icon,title],i)=><button key={title} aria-pressed={info===i} onClick={()=>setInfo(i)}>{icon} {title}</button>)}</div>
 <p role="status">{info===null?(es?'Toca a Corcheita o una pista para descubrir el secreto del símbolo.':'Tap Corcheita or a clue to discover the symbol’s secret.'):cards[info][2]}</p>
 </div></div>
 {error&&<p role="alert">{es?'Vuelve a tocar para iniciar el sonido.':'Tap again to start audio.'}</p>}
 </GardenFrame>
}
