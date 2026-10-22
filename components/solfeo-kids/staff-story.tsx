'use client'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { GardenFrame } from './first-garden'
import { KidsCorcheita } from './answer-reaction'
import s from './staff-story.module.css'

/** An explanatory story, before the staff-building practice. Steps only change on click. */
export function StaffStory(){
 const {locale}=useTranslation(),es=locale==='es'
 const [step,setStep]=useState(0)
 const chapters=es?[
  ['Una casita para escribir música','Soy Corcheíta. Las notas necesitan un lugar en el papel. Esa casita musical se llama pentagrama. Te voy a mostrar cómo es.'],
  ['Cinco líneas juntas','El pentagrama está formado por cinco líneas horizontales, paralelas y separadas por la misma distancia. ¡Son como cinco caminos que van juntos!'],
  ['Cuatro espacios entre ellas','Entre esas cinco líneas quedan cuatro espacios interiores. Las líneas y los espacios forman la casita donde escribimos las notas.'],
  ['Contamos desde abajo','Contamos las líneas del 1 al 5, de abajo hacia arriba. Los espacios también se cuentan desde abajo: 1, 2, 3 y 4.'],
  ['Un lugar para cada nota','Una nota puede escribirse sobre una línea o dentro de un espacio. Su posición nos ayuda a leer su altura cuando la clave nos da la referencia. Más adelante conoceremos la clave. Por ahora, ya conoces el pentagrama: cinco líneas y cuatro espacios.']
 ]:[
  ['A little home for written music','I’m Corcheita. Notes need a place on paper. That musical home is called the staff. Let me show you what it looks like.'],
  ['Five lines together','The staff has five horizontal, parallel lines, all the same distance apart. Like five little paths travelling together!'],
  ['Four spaces between them','Those five lines have four spaces between them. The lines and spaces form a little home where we write notes.'],
  ['Count from the bottom','We count the lines from 1 to 5, from bottom to top. We also count the spaces from the bottom: 1, 2, 3 and 4.'],
  ['A place for each note','A note can sit on a line or inside a space. Its position helps us read its pitch when a clef gives us a reference. We’ll meet the clef later. For now, you know the staff: five lines and four spaces.']
 ]
 const advance=()=>setStep(n=>Math.min(n+1,4))
 return <GardenFrame hideMascot title={es?'La pequeña historia del pentagrama':'The little story of the staff'} detail={es?'Primero conocemos su casita. Después construiremos juntos.':'First we learn about its little home. Then we’ll build together.'}>
 <div className={s.story}>
 <div className={s.picture} key={step}>
 <span className={s.roof} aria-hidden="true">🏡</span>
 <svg viewBox="0 0 640 260" role="img" aria-label={es?'Un pentagrama con cinco líneas y cuatro espacios interiores':'A staff with five lines and four interior spaces'}>
 {step>=2&&Array.from({length:4},(_,i)=><g key={'space'+i}><rect x="100" y={180-i*40} width="440" height="40" fill={['#ffdb82','#a7ddd3','#b9cef5','#dcc1ed'][i]} opacity=".4"/>{step>=3&&<text x="570" y={205-i*40}>{i+1}</text>}</g>)}
 {Array.from({length:5},(_,i)=><g key={i}><path d={`M100 ${220-i*40}H540`} stroke="currentColor" strokeWidth="3"/>{step>=3&&<text x="65" y={225-i*40}>{i+1}</text>}</g>)}
 {step>=3&&<><text x="38" y="30">{es?'Líneas':'Lines'}</text><text x="545" y="30">{es?'Espacios':'Spaces'}</text></>}
 {step===4&&<><ellipse cx="260" cy="180" rx="15" ry="10" transform="rotate(-15 260 180)" fill="#ff9518"/><ellipse cx="420" cy="160" rx="15" ry="10" transform="rotate(-15 420 160)" fill="#9364c5"/></>}
 </svg>
 </div>
 <div className={s.narration}>
 <button className={s.mascot} onClick={advance} disabled={step===4} aria-label={es?'Corcheíta: siguiente parte de la historia':'Corcheita: next part of the story'}><KidsCorcheita/></button>
 <div aria-live="polite"><small>{es?'Corcheíta te cuenta':'Corcheita tells you'} · {step+1} / 5</small><h3>{chapters[step][0]}</h3><p>{chapters[step][1]}</p></div>
 </div>
 <nav className={s.actions} aria-label={es?'Pequeña historia del pentagrama':'Little staff story'}>
 {step>0&&<button onClick={()=>setStep(n=>n-1)}>{es?'← Anterior':'← Previous'}</button>}
 {step<4?<button onClick={advance}>{step===0?(es?'Ver pequeña historia →':'See the little story →'):(es?'Siguiente →':'Next →')}</button>:<><button onClick={()=>setStep(0)}>{es?'Volver a ver la historia':'Read the story again'}</button><p>{es?'¡Ya conoces su nombre! Usa «Página siguiente» para ver cómo lo construimos.':'Now you know its name! Use “Next page” to see how we build it.'}</p></>}
 </nav>
 </div>
 </GardenFrame>
}
