'use client'
import {useEffect,useRef,useState} from 'react'
import {useReducedMotion} from 'framer-motion'
import {Pencil,RotateCcw,Volume2} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {useBookTranslation} from './use-book-translation'
import {useNoteDemonstration,type DemonstrationSettings} from './use-note-demonstration'
import {lessonNote} from '@/lib/solfeo/notes'
import styles from './treble-clef-writing.module.css'

const SHAPES={
 F:{path:'M 263 180 C 251 186 245 174 252 166 C 268 148 296 157 299 181 C 303 213 279 238 245 251',line:180,pitch:'F3',name:'Fa',heading:'Así se escribe la clave de Fa',legend:'La clave de Fa en cuarta línea fija Fa3 en esa línea. Comienza con la cabeza sobre la cuarta línea, dibuja la curva y añade los dos puntos: uno en el espacio superior y otro en el inferior.',guide:'Los dos puntos forman parte de la clave de Fa y rodean la cuarta línea.'},
 C:{path:'M 243 150 L 243 270 M 255 150 L 255 270 M 265 210 C 285 201 291 183 286 170 C 281 153 308 145 319 160 C 336 184 309 208 265 210 C 309 212 336 236 319 260 C 308 275 281 267 286 250 C 291 237 285 219 265 210',line:210,pitch:'C4',name:'Do',heading:'Así se escribe la clave de Do en tercera línea',legend:'La clave de Do en tercera línea fija Do4 en la línea central del pentagrama. Dibuja las dos barras verticales y los dos lóbulos. El centro del signo debe coincidir exactamente con la tercera línea.',guide:'Los puntos naranjas son guías de la tercera línea; no forman parte de la clave de Do convencional.'}
} as const
export function ClefWriting({clef,settings}:{clef:'F'|'C';settings:DemonstrationSettings}){
 const {t}=useBookTranslation(),shape=SHAPES[clef],reduce=useReducedMotion()
 const [run,setRun]=useState(0),[time,setTime]=useState(0),path=useRef<SVGPathElement>(null),pencil=useRef<SVGGElement>(null)
 const demo=useNoteDemonstration(settings)
 useEffect(()=>{let frame=0;const start=performance.now();setTime(reduce?11000:0)
  if(reduce)return
  const tick=()=>{const elapsed=Math.min(11000,performance.now()-start);setTime(elapsed)
   if(path.current&&pencil.current){const point=path.current.getPointAtLength(path.current.getTotalLength()*Math.max(0,Math.min(1,(elapsed-1600)/6200)));pencil.current.setAttribute('transform',`translate(${point.x} ${point.y})`)}
   if(elapsed<11000)frame=requestAnimationFrame(tick)
  };frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[run,reduce,clef])
 const progress=Math.max(0,Math.min(1,(time-1600)/6200))
 const stage=time<1600?'1 · Dibujamos las cinco líneas':time<7800?'2 · Dibujamos la clave':time<9200?'3 · Identificamos la línea de referencia':'4 · Escribimos la nota de referencia'
 return <section className={styles.page}>
  <header><span>{t('SOLFEO APLICADO · OBSERVA EL TRAZO')}</span><h2>{t(shape.heading)}</h2><i/></header>
  <div className={styles.layout}><aside><div className={styles.legend}>{t(shape.legend)}</div><p className={styles.guide}>{t(shape.guide)}</p></aside>
   <div className={styles.figure}><p className={styles.stage} aria-live="off">{t(stage)}</p>
    <svg style={{maxWidth:'none',maxHeight:340}} viewBox="80 70 760 310" role="img" aria-label={t(shape.heading)}>
     {[150,180,210,240,270].map((y,i)=><line key={y} x1="110" y1={y} x2={110+680*Math.max(0,Math.min(1,(time-i*180)/650))} y2={y} stroke="currentColor" strokeOpacity=".35" strokeWidth="1.6"/>)}
     <path ref={path} d={shape.path} pathLength="1" fill="none" stroke="currentColor" strokeWidth="5.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1" strokeDashoffset={1-progress}/>
     {clef==='F'&&<circle cx="258" cy="178" r="7" fill="currentColor" opacity={progress>0.05?1:0}/>}
     <g ref={pencil} visibility={time>=1600&&time<7800?'visible':'hidden'} aria-hidden="true"><Pencil x="-1" y="-23" width="26" height="26" color="#f58215" strokeWidth="2"/></g>
     <g fill={clef==='F'?'currentColor':'#f58215'}><circle cx="345" cy={shape.line-15} r="4" opacity={Math.max(0,Math.min(1,(time-8000)/350))}/><circle cx="345" cy={shape.line+15} r="4" opacity={Math.max(0,Math.min(1,(time-8450)/350))}/></g>
     <g opacity={Math.max(0,Math.min(1,(time-9400)/700))}><ellipse cx="546" cy={shape.line} rx="16" ry="10" fill="none" stroke="currentColor" strokeWidth="4"/><text x="546" y="315" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="700">{t(shape.name)}{shape.pitch.slice(-1)}</text></g>
    </svg>
   </div>
  </div>
  <div className={styles.actions}><Button variant="outline" onClick={()=>{demo.stop();setTime(0);setRun(n=>n+1)}}><RotateCcw size={17}/>{t('Volver a ver cómo se escribe')}</Button><Button variant="outline" disabled={time<10100} onClick={()=>void demo.play([{frequency:lessonNote(shape.pitch).frequency,beats:4,index:0}],{preview:true})}><Volume2 size={17}/>{t(clef==='F'?'Escuchar Fa':'Escuchar Do')}</Button></div>
 </section>
}
