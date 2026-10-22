'use client'
import {ClefGuideChest,ClefWoodpecker} from '@/components/solfeo-kids/clef-writing-friends'
import {useBookTranslation} from './use-book-translation'
import {useEffect,useRef,useState} from 'react'
import {useReducedMotion} from 'framer-motion'
import {Pencil,RotateCcw,Volume2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {useNoteDemonstration,type DemonstrationSettings} from './use-note-demonstration'
import {lessonNote} from '@/lib/solfeo/notes'
import styles from './treble-clef-writing.module.css'

// One continuous handwriting centreline, beginning at G4 on the second line.
const CLEF='M 268 240 C 267 226 281 219 291 230 C 306 249 285 273 261 262 C 235 251 236 231 250 210 C 264 190 287 169 287 143 C 287 127 283 116 279 111 C 264 120 258 137 261 156 C 265 185 271 214 276 243 C 280 266 288 292 276 308 C 267 320 248 314 248 303 C 248 297 251 294 255 294'
export function TrebleClefWriting({legend,settings,childFriendly=false}:{legend:string;settings:DemonstrationSettings;childFriendly?:boolean}){
 const {t}=useBookTranslation()
 const [run,setRun]=useState(0),[time,setTime]=useState(0)
 const duration=childFriendly?14500:11000
 const pageRef=useRef<HTMLElement>(null)
 const path=useRef<SVGPathElement>(null),pencil=useRef<SVGGElement>(null)
 const reduce=useReducedMotion(),demo=useNoteDemonstration(settings)
 useEffect(()=>{let frame=0,elapsed=0,last=performance.now();setTime(reduce?duration:0)
  if(reduce)return
  const tick=()=>{const now=performance.now();if(!pageRef.current?.closest('[data-paused=true]'))elapsed=Math.min(duration,elapsed+now-last);last=now;setTime(elapsed)
   const shape=path.current;if(shape&&pencil.current){const p=shape.getPointAtLength(shape.getTotalLength()*Math.max(0,Math.min(1,(elapsed-1600)/6200)));pencil.current.setAttribute('transform',`translate(${p.x} ${p.y})`)}
   if(elapsed<duration)frame=requestAnimationFrame(tick)
  };frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[run,reduce,duration])
 const progress=Math.max(0,Math.min(1,(time-1600)/6200)),done=time>=duration
 const stage=time<1600?'1 · Dibujamos las cinco líneas':time<7800?'2 · Escribimos la clave desde Sol':time<(childFriendly?13000:9200)?'3 · Señalamos la segunda línea':'4 · Escribimos una redonda en Sol'
 return <section ref={pageRef} className={styles.page}>
  <header><span>{t("SOLFEO APLICADO · OBSERVA EL TRAZO")}</span><h2>{t("Así se escribe la clave de Sol")}</h2><i/></header>
  <div className={styles.layout}>
   <aside>{childFriendly?<ClefGuideChest/>:<><div className={styles.legend} dangerouslySetInnerHTML={{__html:legend}}/><p className={styles.guide}><strong>{t("Los dos puntos naranjas son guías.")}</strong> {t("Señalan la segunda línea; no forman parte de la clave de Sol convencional.")}</p></>}</aside>
   <div className={styles.figure}>
    <p className={styles.stage} aria-live="off">{t(stage)}</p>
    <svg style={{maxWidth:'none',maxHeight:340}} viewBox="80 70 760 310" role="img" aria-label={t("Escritura animada de la clave de Sol desde la segunda línea, seguida de una redonda Sol4")}>
     {[150,180,210,240,270].map((y,i)=><line key={y} x1="110" y1={y} x2={110+680*Math.max(0,Math.min(1,(time-i*180)/650))} y2={y} stroke="currentColor" strokeOpacity=".35" strokeWidth="1.6"/>)}
     <path ref={path} d={CLEF} pathLength="1" fill="none" stroke="currentColor" strokeWidth="5.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" strokeDashoffset={1-progress}/>
     <circle cx="255" cy="294" r="5.5" fill="currentColor" opacity={Math.max(0,Math.min(1,(time-7550)/250))}/>
     <g ref={pencil} visibility={time>=1600&&time<7800?'visible':'hidden'} aria-hidden="true"><Pencil x="-1" y="-23" width="26" height="26" color="#f58215" strokeWidth="2"/></g>
     {childFriendly?<><g fill="#f58215">{time>=9900&&<circle cx="324" cy="225" r="4"/>}{time>=11500&&<circle cx="324" cy="255" r="4"/>}</g><ClefWoodpecker time={time}/></>:<g opacity={Math.max(0,Math.min(1,(time-8000)/500))} fill="#f58215"><circle cx="324" cy="225" r="4"/><circle cx="324" cy="255" r="4"/><text x="325" y="345" textAnchor="middle" fontSize="14">{t("Guías · segunda línea")}</text></g>}
     <g opacity={Math.max(0,Math.min(1,(time-(childFriendly?13300:9400))/700))}>
      <ellipse cx="546" cy="240" rx="16" ry="10" fill="none" stroke="currentColor" strokeWidth="4"/>
      <text x="546" y="315" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="700">Sol4</text>
     </g>
    </svg>
   </div>
  </div>
  <div className={styles.actions}><Button variant="outline" onClick={()=>{demo.stop();setTime(0);setRun(r=>r+1)}}><RotateCcw size={17}/>{t(done?'Volver a ver cómo se escribe':'Reiniciar el dibujo')}</Button><Button variant="outline" disabled={time<(childFriendly?14000:10100)} onClick={()=>void demo.play([{frequency:lessonNote('G4').frequency,beats:4,index:0}],{preview:true})}><Volume2 size={17}/>{t("Escuchar Sol")}</Button></div>
 </section>
}
