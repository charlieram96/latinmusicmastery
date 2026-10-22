'use client'
import { motion, useReducedMotion } from 'framer-motion'
import type { CoachingCue } from '@/lib/play-sense/cascara-coaching'
import './cascara-video-coaching.css'

/** Exact title/count/end card used by Ritmo básico de la cáscara. */
export function CoachingCard({ cue, beats = 4, instructor, mediaDriven = false }: { cue: CoachingCue; beats?: number; instructor?: string; mediaDriven?: boolean }) {
 const reducedMotion = useReducedMotion()
 return <motion.div initial={mediaDriven ? false : {opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reducedMotion||mediaDriven?0:cue.kind==='count'?.12:.65}} className={`lmm-coaching-card lmm-coaching-${cue.kind}`}>
  <div className="lmm-coaching-eyebrow">{cue.detail}</div>
  {cue.number !== undefined ? <div className="lmm-coaching-count-row"><strong className="lmm-coaching-number">{cue.number}</strong><div><span className="lmm-coaching-ready">{cue.text}</span><div className="lmm-coaching-dots" aria-hidden="true">{Array.from({length:beats},(_,i)=><i key={i} data-active={i+1===cue.number}/>)}</div></div></div> : <div className="lmm-coaching-title font-heading">{cue.text}</div>}
  {instructor && <div style={{fontSize:'1.2cqw',marginTop:'.8cqw',color:'#ffffffc0'}}>Instructor · {instructor}</div>}
 </motion.div>
}
