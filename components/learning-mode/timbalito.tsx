'use client'
import {createContext,useContext,useId,useState} from 'react'
import {useTranslation} from '@/components/language-provider'
import s from './timbalito.module.css'
export const TimbalitoContext=createContext(false)
export const useTimbalito=()=>useContext(TimbalitoContext)
export function Timbalito({sad=false,celebrating=false,paused=false}:{sad?:boolean;celebrating?:boolean;paused?:boolean}){
 const id=useId().replace(/:/g,'')
 return <svg className={s.character} data-sad={sad} data-celebrating={celebrating} data-paused={paused} viewBox="0 0 180 170" role="img" aria-label="Timbalito">
 <defs><linearGradient id={id} x2="1" y2="0"><stop stopColor="#e99c35"/><stop offset=".4" stopColor="#ffe5a0"/><stop offset="1" stopColor="#df9b37"/></linearGradient></defs>
 <ellipse cx="90" cy="155" rx="58" ry="7" fill="#263d4020"/>
 <g className={s.body}>
 <path d="M64 117l-7 25-14 3m69-28 7 25 15 3" stroke="#45616d" strokeWidth="7" strokeLinecap="round" fill="none"/><path d="M39 145h22m55 0h23" stroke="#e98121" strokeWidth="9" strokeLinecap="round"/>
 <g className={s.arm}><path d="M39 81Q16 75 18 51" stroke="#45616d" strokeWidth="6" fill="none" strokeLinecap="round"/><circle cx="18" cy="49" r="7" fill="#fff2ce" stroke="#45616d" strokeWidth="2"/><path d="M15 48L7 19" stroke="#b67d3c" strokeWidth="4" strokeLinecap="round"/></g>
 <g className={s.wave}><path d="M143 80q21-8 16-30" stroke="#45616d" strokeWidth="6" fill="none" strokeLinecap="round"/><circle cx="158" cy="48" r="7" fill="#fff2ce" stroke="#45616d" strokeWidth="2"/><path d="M160 46l10-28" stroke="#b67d3c" strokeWidth="4" strokeLinecap="round"/></g>
 <path d="M37 65v43c0 27 61 27 61 0V65M101 62v40c0 24 49 24 49 0V62" fill={`url(#${id})`} stroke="#765338" strokeWidth="3"/>
 <ellipse cx="67" cy="65" rx="31" ry="12" fill="#fff5d7" stroke="#8ca6a7" strokeWidth="4"/><ellipse cx="125" cy="62" rx="25" ry="11" fill="#fff5d7" stroke="#8ca6a7" strokeWidth="4"/>
 <path d="M43 81v27m48-27v27m17-31v25m35-25v25" stroke="#effcfa" strokeWidth="4" strokeLinecap="round"/>
 <g className={s.eyes} fill="#344752"><ellipse cx="57" cy="91" rx="4" ry="6"/><ellipse cx="78" cy="91" rx="4" ry="6"/><ellipse cx="117" cy="86" rx="3" ry="5"/><ellipse cx="133" cy="86" rx="3" ry="5"/></g>
 <g fill="none" stroke="#344752" strokeWidth="2.5" strokeLinecap="round"><path d={sad?'M59 111q9-10 18 0':'M58 104q10 15 20 0'}/><path d={sad?'M118 102q7-7 14 0':'M118 98q7 9 14 0'}/></g>
 <g fill="#df826b" opacity=".65"><ellipse cx="50" cy="101" rx="5" ry="3"/><ellipse cx="84" cy="101" rx="5" ry="3"/></g>
 <path d="M92 54V35" stroke="#78969e" strokeWidth="5"/><path d="M80 20h24l10 24H70Z" fill="#597782" stroke="#344e5b" strokeWidth="3"/><path d="M72 43h40" stroke="#a6c7c7" strokeWidth="4"/>
 {sad&&<g fill="white" stroke="#d9edf8"><path className={s.tear} d="M54 98q-6 10 0 10t0-10M81 98q-6 10 0 10t0-10"/></g>}
 </g></svg>
}
export function TimbalitoGuide({paused=false,compact=false,toolbar=false}:{paused?:boolean;compact?:boolean;toolbar?:boolean}){
 const {locale}=useTranslation();const es=locale==='es';const [open,setOpen]=useState(false)
 return <aside className={s.guide} data-compact={compact} data-toolbar={toolbar} aria-label={es?'Tu guía Timbalito':'Your guide Timbalito'}>
 <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={es?'Timbalito: mostrar u ocultar mi consejo':'Timbalito: show or hide my tip'}><Timbalito paused={paused}/><strong>Timbalito</strong></button>
 {open&&<div className={s.bubble}><strong>{es?'¡Hola! Soy Timbalito.':'Hi! I’m Timbalito.'}</strong><p>{es?'Mira al maestro, escucha y practica a tu ritmo. ¡Vamos paso a paso!':'Watch the teacher, listen and practise at your own pace. One step at a time!'}</p></div>}
 </aside>
}
