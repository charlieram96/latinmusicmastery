'use client'
import type { CSSProperties } from 'react'
import { useCelebrationSound } from './use-celebration-sound'
import s from '@/components/class-viewer/lesson-viewer/quiz/kids-quiz.module.css'
export function KidsCorcheita({sad=false,lookingUp=false}:{sad?:boolean;lookingUp?:boolean}){
 return <svg className={s.corcheita} viewBox="0 0 100 120" role="img" aria-label={sad?'Corcheita, triste':'Corcheita'}><path d="M55 80V28Q85 30 76 52Q70 43 58 42" stroke="#7251b1" strokeWidth="7" fill="#bba1eb" strokeLinejoin="round"/><ellipse cx="40" cy="81" rx="22" ry="18" transform="rotate(-18 40 81)" fill="#bba1eb" stroke="#7251b1" strokeWidth="3"/><path d={sad?'M23 75L13 88M59 74L72 87M31 98L25 110H13M48 97L57 109H70':'M23 75L10 59M59 74L81 66M31 98L25 110H13M48 97L57 109H70'} stroke="#7251b1" strokeWidth="5" fill="none" strokeLinecap="round"/><circle cx="33" cy={lookingUp?71:77} r="3" fill="#283852"/><circle cx="47" cy={lookingUp?69:75} r="3" fill="#283852"/><path d={sad?'M35 90Q42 83 49 89':'M35 86Q42 92 49 84'} stroke="#283852" fill="none" strokeWidth="2.5" strokeLinecap="round"/>{sad&&<g fill="white" stroke="#dbefff" strokeWidth=".6"><path className={s.tear} d="M29 80q-6 8 0 9q6-1 0-9Z"/><path className={s.tear} d="M51 78q-6 8 0 9q6-1 0-9Z"/></g>}</svg>
}

export function AnswerFireworks({sound=true}:{sound?:boolean}){
 useCelebrationSound(sound)
 return <div className={s.answerFireworks} aria-hidden="true">{[18,50,82].map((left,j)=><div key={left} style={{left:`${left}%`,top:`${20+j%2*15}%`}}>{Array.from({length:10},(_,i)=><i key={i} style={{'--angle':`${i*36}deg`,'--spark':['#ffb52e','#b69aef','#68c8bc','#ff8ba6'][i%4],animationDelay:`${j*.16}s`} as CSSProperties}>✦</i>)}</div>)}</div>
}
