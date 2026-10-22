'use client'
import {useState} from 'react'
import {useTranslation} from '@/components/language-provider'
import {KidsCorcheita} from './answer-reaction'
import s from './clef-writing-friends.module.css'
export function ClefGuideChest(){
 const {locale}=useTranslation(),es=locale==='es',[open,setOpen]=useState(false)
 return <div className={s.secret} data-open={open}>
 {open&&<div className={s.cloud} role="status"><svg viewBox="0 0 320 240" preserveAspectRatio="none" aria-hidden="true"><path d="M45 205C5 205 0 163 21 145C-6 115 13 75 46 77C39 35 81 15 112 35C131 2 179 4 197 32C232 10 269 33 269 62C312 56 331 101 306 126C334 160 312 195 281 193C275 224 231 235 205 216C176 245 134 237 117 216C91 236 57 232 45 205Z" fill="var(--garden-card,#fff9ef)" stroke="#bea3de" strokeWidth="2"/></svg><div><strong>{es?'¡Un secreto del dibujo!':'A drawing secret!'}</strong><p>{es?'El carpintero hizo dos puntitos naranjas: uno encima y otro debajo de la segunda línea. Son guías de este juego.':'The woodpecker made two orange dots: one above and one below the second line. They are guides for this game.'}</p><p><b>{es?'La clave de Sol de las partituras no lleva estos puntitos.':'The treble clef in sheet music does not have these dots.'}</b></p></div></div>}
 <div className={s.chestRow}><button className={s.actor} onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={es?'Corcheita: abrir o cerrar el secreto':'Corcheita: open or close the secret'}><KidsCorcheita/></button><button className={s.chest} onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={es?'Abrir o cerrar el cofre de los puntitos':'Open or close the dots’ treasure chest'}><svg viewBox="0 0 120 100" aria-hidden="true"><path d="M18 40h85v47H18Z" fill="#b97938" stroke="#83512e" strokeWidth="4"/><g className={s.lid}><path d="M18 40V27Q60-2 103 27v13Z" fill="#e9ae55" stroke="#83512e" strokeWidth="4"/><path d="M19 39h83" stroke="#ffd776" strokeWidth="7"/></g><path d="M35 43v41m50-41v41" stroke="#ffda6a" strokeWidth="8"/><rect x="52" y="40" width="18" height="23" rx="4" fill="#ffe49c"/><circle cx="61" cy="50" r="3" fill="#805336"/></svg><span>{open?(es?'Cerrar el secreto':'Close the secret'):(es?'El secreto de los puntitos':'The dots’ secret')}</span></button></div>
 </div>
}
export function ClefWoodpecker({time}:{time:number}){
 if(time<7800||time>13300)return null
 const arrival=Math.min(1,(time-7800)/1300),leaving=Math.max(0,(time-12100)/1200)
 const x=arrival<1?650-326*arrival:324-260*leaving
 const y=arrival<1?90+150*arrival:240-190*leaving
 const pecking=arrival===1&&leaving===0
 const lower=time>=10400
 const nod=pecking?Math.sin(time/65)*9:0
 return <g transform={`translate(${x} ${y})`} aria-hidden="true"><g transform={`translate(26 ${lower?15:-15}) rotate(${nod})`}>
 <path d="M-5 4q42 13 22 44L2 41-8 21Z" fill="#2b3949"/><path d="m22 34 17 22-25-8" fill="#303d4c"/><ellipse cx="9" cy="24" rx="9" ry="17" fill="#f8eed9"/>
 <path d="M11 15Q42 5 25 40" fill="#566d83" transform={`rotate(${pecking?0:Math.sin(time/65)*35} 15 22)`}/>
 <path d="M-5-9 2-23 12-11" fill="#ef634c"/><circle cx="0" cy="0" r="12" fill="#263442"/><path d="M-8 1q7 12 15 2" fill="#fff8df"/><circle cx="-4" cy="-3" r="3" fill="white"/><circle cx="-5" cy="-3" r="1.5" fill="#15202d"/><path d="M-10-3-26 0-10 4Z" fill="#efb64b"/><path d="M4 39 0 44m12-4-2 5" stroke="#dca656" strokeWidth="3"/>
 </g></g>
}
