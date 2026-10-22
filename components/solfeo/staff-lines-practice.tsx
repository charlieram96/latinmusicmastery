'use client'
import {useNoteDemonstration,type DemonstrationSettings} from './use-note-demonstration'
import {lessonNote} from '@/lib/solfeo/notes'
import {useTranslation} from '@/components/language-provider'
import {Play,Square} from 'lucide-react'
import styles from './staff-lines-practice.module.css'
function SoundStaff({spaces,settings}:{spaces:boolean;settings:DemonstrationSettings&{volume?:number}}){
 const {locale}=useTranslation(),es=locale==='es',demo=useNoteDemonstration(settings)
 const pitches=spaces?['F4','A4','C5','E5']:['E4','G4','B4','D5','F5'],names=spaces?['Fa','La','Do','Mi']:['Mi','Sol','Si','Re','Fa']
 const notes=pitches.map((pitch,index)=>({frequency:lessonNote(pitch).frequency,beats:1,index}))
 const title=spaces?(es?'Espacios':'Spaces'):(es?'Líneas':'Lines')
 return <div className={styles.card} data-spaces={spaces}>
  <div className={styles.heading}><h3>{title} <span>· {names.join(' · ')}</span></h3><button onClick={()=>demo.playing?demo.stop():void demo.play(notes)} aria-label={`${demo.playing?(es?'Detener':'Stop'):(es?'Escuchar':'Listen to')} ${title.toLowerCase()}`}>{demo.playing?<Square size={15}/>:<Play size={15}/>} {demo.playing?(es?'Detener':'Stop'):(es?'Escuchar':'Listen')}</button></div>
  <svg viewBox="0 0 500 120" role="group" aria-label={`${title}: ${names.join(', ')}`}>
   {[25,39,53,67,81].map((y,i)=><line key={y} x1="18" x2="480" y1={y} y2={y} stroke={demo.active!==null&&!spaces&&i===4-demo.active?'#f58215':'currentColor'} strokeOpacity={demo.active!==null&&!spaces&&i===4-demo.active?1:.35} strokeWidth={demo.active!==null&&!spaces&&i===4-demo.active?2:1}/>)}
   <text x="24" y="72" fill="currentColor" fontSize="66" fontFamily="Bravura,serif">&#xe050;</text>
   {notes.map((n,i)=>{const x=110+i*(spaces?106:82),y=81-i*14-(spaces?7:0),active=demo.active===i;return <g key={i} role="button" tabIndex={0} aria-label={`${es?'Escuchar':'Play'} ${names[i]} · ${title} ${i+1}`} onClick={()=>void demo.play([n],{preview:true})} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();void demo.play([n],{preview:true})}}} className={styles.note}>
    <rect x={x-22} y="16" width="44" height="100" rx="8" fill={active?'#f5821528':'transparent'}/>
    {active&&spaces&&<rect x="80" y={y-7} width="385" height="14" fill="#265b4d18"/>}
    <ellipse cx={x} cy={y} rx="9" ry="6" fill={active?'#f58215':'currentColor'} transform={`rotate(-15 ${x} ${y})`}/>
    <text x={x} y="105" textAnchor="middle" fontSize="13" fill={active?'#f58215':'currentColor'}>{i+1} · {names[i]}</text>
   </g>})}
  </svg>
 </div>
}
export function StaffLinesPractice({settings}:{settings:DemonstrationSettings&{volume?:number}}){return <div className={styles.grid}><SoundStaff spaces={false} settings={settings}/><SoundStaff spaces settings={settings}/></div>}
