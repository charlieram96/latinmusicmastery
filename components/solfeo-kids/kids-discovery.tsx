'use client'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { useNoteDemonstration } from '@/components/solfeo/use-note-demonstration'
import { lessonNote } from '@/lib/solfeo/notes'
import styles from './kids.module.css'
const colors=['#ffa3ae','#ffca87','#ffe28b','#bee69f','#92dfd6','#a7cbf7','#c9b5ef','#ffa3ae']
const notes=['C4','D4','E4','F4','G4','A4','B4','C5']
const names=['Do','Re','Mi','Fa','Sol','La','Si','Do']
const staffNotes=['E4','F4','G4','A4','B4','C5','D5','E5','F5']
const staffNames=['Mi','Fa','Sol','La','Si','Do','Re','Mi','Fa']
export function KidsDiscovery({kind}:{kind:'notes'|'staff'|'clef'}){
 const {locale}=useTranslation(),es=locale==='es',[selected,setSelected]=useState<number|null>(null),[sound,setSound]=useState(true),[error,setError]=useState(false),[noteX,setNoteX]=useState(50)
 const demo=useNoteDemonstration({metronome:false,countInBars:0,volume:sound?.5:0})
 const play=(index:number,pitch:string)=>{setSelected(index);setError(false);if(!sound)return;void demo.play([{frequency:lessonNote(pitch).frequency,beats:1,index}],{preview:true}).catch(()=>setError(true))}
 return <section className={styles.discovery}>
 <div className={styles.discoveryHeading}><span aria-hidden="true">{kind==='notes'?'🌈':kind==='staff'?'🏡':'🗝️'}</span><h2>{kind==='notes'?(es?'¡Conoce a las notas!':'Meet the notes!'):kind==='staff'?(es?'La casita de las notas':'A home for the notes'):(es?'Sol nos muestra el camino':'G shows us the way')}</h2></div>
 <p>{kind==='notes'?(es?'Toca cada personaje. Escucha cómo sube el sonido.':'Tap each friend. Listen as the sound goes higher.'):kind==='staff'?(es?'Cinco líneas, cuatro espacios. Toca y cuenta desde abajo.':'Five lines, four spaces. Tap and count from the bottom.'):(es?'La clave de Sol señala Sol4 en la segunda línea. ¡Encuéntralo!':'The treble clef marks G4 on the second line. Find it!')}</p>
 {kind==='notes'?<div className={styles.garden}>{notes.map((pitch,i)=><button key={i} className={styles.friend} style={{background:colors[i],marginBottom:i*5}} onClick={()=>play(i,pitch)} aria-label={`${names[i]} ${pitch}`} aria-pressed={selected===i}><span aria-hidden="true">• •</span><strong>{names[i]}</strong><small>{pitch}</small></button>)}</div>:<div className={styles.staff}>
 {[0,1,2,3,4].map(i=><div key={i} className={styles.line} style={{top:240-i*44}}><span>{i+1}</span></div>)}
 {kind==='clef'&&<svg className={styles.clef} viewBox="220 0 100 300" aria-label={es?'Clave de Sol':'Treble clef'}><path transform="translate(0,-156) scale(1,1.4666667)" d="M 268 240 C 267 226 281 219 291 230 C 306 249 285 273 261 262 C 235 251 236 231 250 210 C 264 190 287 169 287 143 C 287 127 283 116 279 111 C 264 120 258 137 261 156 C 265 185 271 214 276 243 C 280 266 288 292 276 308 C 267 320 248 314 248 303 C 248 297 251 294 255 294" fill="none" stroke="#8760bf" strokeWidth="4" strokeLinecap="round"/></svg>}
 {staffNotes.map((pitch,i)=><button key={pitch} className={`${styles.position} ${kind==='clef'?styles.noteOnly:''}`} style={{top:240-i*22}} aria-label={`${i%2?(es?'Espacio':'Space')+' '+((i+1)/2):(es?'Línea':'Line')+' '+(i/2+1)}`} onClick={event=>{const bounds=event.currentTarget.getBoundingClientRect();setNoteX(event.detail===0?50:Math.max(2,Math.min(98,(event.clientX-bounds.left)/bounds.width*100)));play(i,pitch)}} aria-pressed={selected===i}>{selected===i&&<><i data-kids-notehead="html" style={{left:`${noteX}%`}}/></>}</button>)}
 </div>}
 <div className={styles.discoveryFooter}><p role="status">{selected===null?(es?'¡Tú puedes explorar!':'You can explore!'):kind==='notes'?`${names[selected]} · ${notes[selected]}`:kind==='clef'?`${staffNames[selected]} · ${staffNotes[selected]}`:(es?'¡Así se cuentan desde abajo!':'Count from the bottom!')}</p><button onClick={()=>{setSound(!sound);demo.stop()}} aria-pressed={sound}>{es?'Sonido':'Sound'}: {sound?(es?'sí':'on'):(es?'no':'off')}</button></div>
 {error&&<p role="alert">{es?'No se pudo iniciar el sonido. Vuelve a tocar una nota.':'Audio could not start. Tap a note again.'}</p>}
 </section>
}
