'use client'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { useNoteDemonstration } from '@/components/solfeo/use-note-demonstration'
import { lessonNote } from '@/lib/solfeo/notes'
import s from './clef-explanation.module.css'
export function ClefExplanation(){
 const {locale}=useTranslation(),es=locale==='es'
 const [step,setStep]=useState(0),[error,setError]=useState(false)
 const sound=useNoteDemonstration({metronome:false,countInBars:0,volume:.5})
 const hear=()=>{setError(false);void sound.play([{frequency:lessonNote('G4').frequency,beats:1,index:0}],{preview:true}).catch(()=>setError(true))}
 const captions=es?[
  'Esta es la clave de Sol. Se escribe al comienzo del pentagrama. Su espiral rodea una línea y nos da una pista.',
  'Contamos desde abajo: primera línea, segunda línea. La espiral rodea la segunda. Por eso, una nota colocada aquí se llama Sol.',
  'Esta nota es Sol. La línea pasa por el centro de su cabecita. Escucha su sonido; después conoceremos las otras notas.'
 ]:[
  'This is the treble clef. It is written at the start of the staff. Its spiral wraps around a line and gives us a clue.',
  'Count from the bottom: first line, second line. The spiral wraps around the second. A note placed here is called G.',
  'This note is G. The line crosses the centre of its notehead. Listen to its sound; we will meet the other notes later.'
 ]
 return <section className={s.lesson} aria-label={es?'Explicación de la clave y la nota Sol':'Explanation of the clef and G note'}>
 <div className={s.steps} aria-label={es?'Pasos de la explicación':'Explanation steps'}>{(es?['La clave','La segunda línea','La nota Sol']:['The clef','The second line','The G note']).map((label,i)=><button key={label} aria-current={step===i?'step':undefined} onClick={()=>{setStep(i);sound.stop()}}>{i+1} · {label}</button>)}</div>
 <svg viewBox="0 0 720 310" className={s.staff} aria-label={es?'La espiral de la clave y Sol comparten la segunda línea':'The clef spiral and G share the second line'}>
 {[0,1,2,3,4].map(i=><path key={i} d={`M110 ${250-i*40}H640`} stroke="#899bad" strokeWidth="2"/>)}
 <path transform="translate(-120 -30)" d="M268 240 C267 226 281 219 291 230 C306 249 285 273 261 262 C235 251 236 231 250 210 C264 190 287 169 287 143 C287 127 283 116 279 111 C264 120 258 137 261 156 C265 185 271 214 276 243 C280 266 288 292 276 308 C267 320 248 314 248 303 C248 297 251 294 255 294" fill="none" stroke="#aa83df" strokeWidth="5" strokeLinecap="round"/>
 {step===0&&<g className={s.clue}><circle cx="151" cy="210" r="34" fill="none" stroke="#d5b7fc" strokeWidth="2" strokeDasharray="4 5"/><text x="205" y="214" fill="currentColor" fontSize="19">{es?'La espiral nos da una pista':'The spiral gives us a clue'}</text></g>}
 {step>=1&&<g key={step} className={s.reveal}>
 <text x="78" y="256" fill="currentColor" fontSize="18">1</text><text x="78" y="216" fill="currentColor" fontSize="18">2</text>
 <path className={s.connection} d="M190 185Q290 110 402 185" fill="none" stroke="#bb96ea" strokeWidth="2" strokeDasharray="5 7"/><path d="m394 174 8 11-14-2" fill="none" stroke="#bb96ea" strokeWidth="2"/>
 <g className={s.note} role="button" tabIndex={0} aria-label={es?'Escuchar Sol':'Hear G'} onClick={hear} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hear()}}}>
 <rect x="385" y="185" width="55" height="50" fill="transparent"/><ellipse data-kids-notehead="svg" cx="412" cy="210" rx="18" ry="12" transform="rotate(-15 412 210)" fill="#ed9626"/>
 </g><text x="453" y="216" fill="currentColor" fontSize="22" fontWeight="700">{es?'Sol':'G'}</text>
 </g>}
 </svg>
 <p className={s.caption} role="status">{captions[step]}</p>
 <div className={s.actions}>{step>0&&<button onClick={()=>{sound.stop();setStep(i=>i-1)}}>{es?'← Volver a mirar':'← Look again'}</button>}{step<2?<button onClick={()=>{setStep(i=>i+1);if(step===1)hear()}}>{step===0?(es?'Mira dónde está →':'See where it is →'):(es?'Escuchemos Sol →':'Let’s hear G →')}</button>:<><button onClick={hear}>{es?'🔊 Escuchar Sol otra vez':'🔊 Hear G again'}</button><button onClick={()=>{sound.stop();setStep(0)}}>{es?'Repetir explicación':'Repeat explanation'}</button></>}</div>
 {error&&<p role="alert">{es?'Vuelve a tocar para iniciar el sonido.':'Tap again to start audio.'}</p>}
 </section>
}
