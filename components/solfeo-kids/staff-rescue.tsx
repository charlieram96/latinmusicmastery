'use client'
import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { GardenFrame } from './first-garden'
import { KidsCorcheita } from './answer-reaction'
import s from './staff-rescue.module.css'
export function StaffRescueExercise({onComplete}:{onComplete:()=>void}){return <StaffRescue onNext={onComplete}/>}
export function StaffRescue({onNext}:{onNext:()=>void}){
 const {locale}=useTranslation(),es=locale==='es'
 const [step,setStep]=useState(0),[journey,setJourney]=useState(false),[home,setHome]=useState(false)
 const built=step===9
 const actionLabel=home?(es?'Construir otra vez':'Build again'):journey?(es?'Corcheita acompaña al gorrión':'Corcheita is helping the sparrow'):built?(es?'Ayudar al gorrión a subir':'Help the sparrow climb'):es?step<5?`Construir línea ${step+1}`:`Pintar espacio ${step-4}`:step<5?`Build line ${step+1}`:`Paint space ${step-4}`
 const advance=()=>{
  if(home){setStep(0);setJourney(false);setHome(false);return}
  if(journey)return
  if(!built){setStep(n=>Math.min(n+1,9));return}
  setJourney(true)
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setHome(true)
 }
 const detail=home?(es?'¡El gorrión volvió con su familia! Cinco líneas y cuatro espacios forman el pentagrama.':'The sparrow is home! Five lines and four spaces make a staff.'):journey?(es?'Corcheita lo acompaña: un peldaño a la vez, hasta el nido.':'Corcheita helps: one step at a time, up to the nest.'):built?(es?'¡La escalera está lista! Ayuda al gorrión a subir.':'The staircase is ready! Help the sparrow climb.'):step<5?(es?`Construye la línea ${step+1}. Empezamos desde abajo.`:`Build line ${step+1}. Start at the bottom.`):(es?`Pinta el espacio ${step-4}, entre dos líneas. Cada peldaño empieza un poco más a la derecha.`:`Paint space ${step-4}, between two lines. Each step begins a little farther right.`)
 return <GardenFrame quiz hideMascot growth={home?8:undefined} title={es?'1 · Un camino hasta el nido':'1 · A path to the nest'} detail={detail} reaction={home?{result:'correct',id:1}:undefined}>
 <div className={s.scene}>
 <svg className={s.drawing} viewBox="0 0 900 340" role="img" aria-label={es?`${Math.min(step,5)} líneas, ${Math.max(0,step-5)} espacios. Un árbol con el nido a la altura de la quinta línea.`:`${Math.min(step,5)} lines, ${Math.max(0,step-5)} spaces. A tree with a nest at the fifth line.`}>
 <path d="M735 300Q760 180 746 70h40q-5 160 28 230" fill="#ab7951"/><path d="m769 167 64-52m-76 12-54-44" stroke="#ab7951" strokeWidth="18" strokeLinecap="round"/>
 <g fill="#6bae69"><circle cx="718" cy="65" r="49"/><circle cx="776" cy="46" r="56"/><circle cx="830" cy="73" r="52"/><circle cx="770" cy="94" r="57"/></g>
 <path d="M30 303Q450 286 870 303" stroke="#7ca364" strokeWidth="8" fill="none"/>
 {Array.from({length:Math.max(0,step-5)},(_,i)=><g key={'space'+i}><rect className={s.fill} x={145+i*125} y={220-i*40} width={575-i*125} height="40" rx="3" fill={['#f7cf70','#95d2b0','#aebceb','#e4aed0'][i]}/><text x={205+i*125} y={245-i*40} textAnchor="middle">{es?'Espacio':'Space'} {i+1}</text></g>)}
 {Array.from({length:Math.min(step,5)},(_,i)=><g key={'line'+i}><path className={s.line} d={`M100 ${260-i*40}H720`} pathLength="1"/><text className={s.lineNumber} x="85" y={265-i*40} textAnchor="end">{i+1}</text></g>)}
 <g transform="translate(742 100)" data-reunion={home}><ellipse cy="5" rx="43" ry="13" fill="#986941"/><path d="M-42 0q42 30 84 0m-75 4 12 12m2-10 12 13m4-12 12 10m4-10 12 6" stroke="#e1b578" strokeWidth="3" fill="none"/><text className={s.mother} x="-14" y="-8" style={{fontSize:34}}>🐦</text><text className={s.chick} x="20" y="-2" style={{fontSize:22}}>🐤</text><text className={s.chick} x="-40" y="-1" style={{fontSize:21}}>🐤</text></g>
 </svg>
 <div className={s.travellers} data-journey={journey} data-home={home} onAnimationEnd={event=>{if(event.target===event.currentTarget&&journey)setHome(true)}}><button type="button" className={s.actor} onClick={advance} disabled={journey&&!home} aria-label={`Corcheita: ${actionLabel}`}><KidsCorcheita/></button>{!journey&&<b className={s.tool} key={step} aria-hidden="true">{step<5?'🏹':'🖌️'}</b>}<span aria-hidden="true">🐥</span></div>
 </div>
 <p className={s.count} role="status">{Math.min(step,5)} / 5 {es?'líneas':'lines'} · {Math.max(0,step-5)} / 4 {es?'espacios':'spaces'}{home?(es?' · ¡En casa!':' · Home!'):''}</p>
 <div className={s.actions}>{!journey||home?<><button onClick={advance}>{!built?(step<5?'🏹 ':'🖌️ '):!home?'🐥 ':''}{actionLabel}</button>{home&&<button onClick={onNext}>{es?'2 · Encontrar líneas y espacios →':'2 · Find lines and spaces →'}</button>}</>:<p>{es?'¡Vamos, pequeño!':'You can do it, little one!'}</p>}</div>
 </GardenFrame>
}
