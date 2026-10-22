'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { useNoteDemonstration } from '@/components/solfeo/use-note-demonstration'
import { lessonNote } from '@/lib/solfeo/notes'
import { GardenFrame } from './first-garden'
import { KidsCorcheita } from './answer-reaction'
import { useAdventureTheme } from './adventure-theme'
import s from './staff-builder.module.css'
function Fruit({x,y,index,notes}:{x:number;y:number;index:number;notes:boolean}){
 return <g transform={`translate(${x} ${y})`} aria-hidden="true"><ellipse data-kids-notehead={notes?'svg':undefined} rx={notes?15:14} ry={notes?10:13} transform={notes?'rotate(-15)':undefined} fill={notes?'#253653':['#ef7068','#f5bc42','#b7cf60','#f4a56d','#c698dc'][index%5]} stroke={notes?'#253653':'#8d6741'} strokeWidth="1.5"/>{!notes&&<><path d="M0-12q-2-3 3-5" stroke="#795735" strokeWidth="2" fill="none"/><path d="M2-15q8-4 10 0q-6 4-10 0" fill="#65a95a"/><ellipse cx="-5" cy="-4" rx="3" ry="5" fill="#ffffff66"/></>}</g>
}
export function StaffBuilder({fruits=false}:{fruits?:boolean}){
 const {locale}=useTranslation(),es=locale==='es',theme=useAdventureTheme()
 const [showNotes,setShowNotes]=useState(false)
 const [step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(false)
 const [reaction,setReaction]=useState<{result:'correct';id:number}>()
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const sound=useNoteDemonstration({metronome:false,countInBars:0,volume:.5})
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[])
 const displayStep=busy?step-1:step
 const complete=step===9&&!busy,painting=displayStep>=5,number=painting?displayStep-4:displayStep+1
 const constructionInstruction=complete?(es?'¡Cinco líneas y cuatro espacios! Construiste un pentagrama.':'Five lines and four spaces! You built a staff.'):(es?painting?`Toca la brocha. Pintemos el espacio ${number}, entre dos líneas.`:`Toca el arco. Dibujemos la línea ${number}, desde abajo.`:painting?`Tap the brush. Paint space ${number}, between two lines.`:`Tap the bow. Draw line ${number}, starting at the bottom.`)
 const instruction=fruits?(complete?(es?'La línea cruza el centro de la fruta. En el espacio, la fruta queda entre dos líneas.':'A line crosses the fruit’s centre. In a space, the fruit sits between two lines.'):(painting?(es?`Pinta el espacio ${number}. Su fruta queda entre las líneas, sin tocarlas.`:`Paint space ${number}. Its fruit sits between the lines, without touching them.`):(es?`Dispara hacia la fruta: la línea ${number} cruzará su centro.`:`Aim at the fruit: line ${number} will cross its centre.`))):constructionInstruction
 const build=()=>{
  if(busy||step>=9)return
  setBusy(true);setError(false);setStep(n=>n+1)
  void sound.play([{frequency:lessonNote(['E4','G4','B4','D5','F5','F4','A4','C5','E5'][step]).frequency,beats:.7,index:step}],{preview:true}).catch(()=>setError(true))
  timer.current=setTimeout(()=>{setBusy(false);if(step===8)setReaction({result:'correct',id:Date.now()})},800)
 }
 const actorStep=busy?step-1:step
 const actorY=actorStep<5?250-actorStep*40:230-(Math.min(actorStep,8)-5)*40
 return <GardenFrame quiz hideMascot reaction={reaction} growth={complete?8:undefined} title={fruits?(es?'¿Fruta en línea o en espacio?':'Fruit on a line or in a space?'):(es?'¡Construyamos el pentagrama!':'Let’s build a staff!')} detail={instruction}>
 <div className={s.stage} data-fruits={fruits} data-busy={busy} data-painting={actorStep>=5} data-complete={complete}>
 <svg className={s.staff} viewBox="0 0 800 320" preserveAspectRatio="none" role="img" aria-label={es?`${Math.min(step,5)} líneas y ${Math.max(step-5,0)} espacios construidos`:`${Math.min(step,5)} lines and ${Math.max(step-5,0)} spaces built`}>
 {Array.from({length:Math.max(0,step-5)},(_,i)=><g key={'space'+i}><rect className={s.paint} x="150" y={210-i*40} width="610" height="40" fill={['#ffe6a3','#bcebdc','#d5c6f5','#ffcbd5'][i]}/><text x={fruits?700:455} y={235-i*40} textAnchor="middle" className={s.spaceNumber}>{es?'Espacio':'Space'} {i+1}</text></g>)}
 {fruits&&Array.from({length:Math.min(step+(busy?0:1),5)},(_,i)=><Fruit key={'fruit-line'+i} x={320} y={250-i*40} index={i} notes={showNotes}/>)}
 {fruits&&Array.from({length:Math.max(0,step-5)},(_,i)=><Fruit key={'fruit-space'+i} x={580} y={230-i*40} index={i+1} notes={showNotes}/>)}
 {Array.from({length:Math.min(step,5)},(_,i)=><g key={'line'+i}><path className={s.draw} d={`M150 ${250-i*40}H760`} pathLength="1"/><text x="135" y={255-i*40} textAnchor="end" className={s.number}>{i+1}</text>{fruits&&<text x="355" y={255-i*40} className={s.lineLabel}>{es?'Línea':'Line'} {i+1}</text>}{busy&&step===i+1&&<g className={s.arrow}><path d={`M730 ${250-i*40}h30m-10 -8l10 8-10 8`} fill="none" stroke="#f18a13" strokeWidth="4"/></g>}</g>)}
 {!step&&<text x="455" y="260" textAnchor="middle" className={s.spaceNumber}>{es?'Aquí comienza la primera línea…':'The first line starts here…'}</text>}
 </svg>
 <button className={s.actor} style={{top:`${actorY/320*100}%`}} onClick={build} disabled={busy||complete} aria-label={complete?(es?'Pentagrama completo':'Staff complete'):es?painting?`Pintar espacio ${number}`:`Dibujar línea ${number}`:painting?`Paint space ${number}`:`Draw line ${number}`}>
 <KidsCorcheita/>{actorStep<5?<svg className={s.tool} viewBox="0 0 60 100" aria-hidden="true"><path d="M12 8Q78 50 12 92" fill="none" stroke="#c18442" strokeWidth="6"/><path d="M12 8L30 50 12 92" fill="none" stroke="#8263b0" strokeWidth="2"/><path d="M4 50H58m-10-7 10 7-10 7" fill="none" stroke="#ef8a17" strokeWidth="4"/></svg>:<span className={s.brush} aria-hidden="true">🖌️<small>🪣</small></span>}
 </button>
 {complete&&<div className={s.flowers} aria-hidden="true">{Array.from({length:9},(_,i)=><span key={i} style={{animationDelay:`${i*.09}s`}}>{theme.id==='garden'?['🌼','🌷','🌻'][i%3]:theme.decor[i%3]}</span>)}</div>}
 </div>
 {fruits&&complete&&<div className={s.comparison}><button aria-pressed={showNotes} onClick={()=>setShowNotes(v=>!v)}>{showNotes?(es?'🍎 Volver a las frutas':'🍎 Show fruits'):(es?'♪ Transformar en notas':'♪ Turn into notes')}</button><p>{es?'Las frutas representan cabezas de notas. Una clave nos dirá sus nombres.':'Fruits represent noteheads. A clef will tell us their names.'}</p></div>}
 <p className={s.status} role="status">{error?(es?'Toca de nuevo para volver a intentar el sonido.':'Tap again to retry the sound.'):busy?(es?step<=5?`¡Viaja, flecha! Línea ${step}.`:`La brocha pinta el espacio ${step-5}.`:step<=5?`Fly, arrow! Line ${step}.`:`Painting space ${step-5}.`):instruction}</p>
 <div className={s.controls}><span>{Math.min(step,5)} / 5 {es?'líneas':'lines'} · {Math.max(step-5,0)} / 4 {es?'espacios':'spaces'}</span>{complete?<button onClick={()=>{sound.stop();setStep(0);setShowNotes(false);setReaction(undefined);setError(false)}}>{es?'Construir otra vez':'Build again'} ↻</button>:<button onClick={build} disabled={busy}>{painting?'🖌️':'🏹'} {es?painting?`Pintar espacio ${number}`:`Dibujar línea ${number}`:painting?`Paint space ${number}`:`Draw line ${number}`}</button>}</div>
 </GardenFrame>
}
