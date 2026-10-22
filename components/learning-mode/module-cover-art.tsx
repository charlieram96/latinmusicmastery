'use client'
import { ClassroomLamps } from './classroom-lamps'
import { useId } from 'react'
import { useLearningMode } from './store'
import { useTranslation } from '@/components/language-provider'

const modules = ['local-timbal-welcome','616b3242-53e7-4748-9024-5b7bcdd0a7ff','9e335db1-98b5-4772-b944-92c64716097b','63979dc6-19b4-4ccf-ab28-8092c85a24ba','eebb8b6a-7b75-4668-babb-617e9c44f70a']
export function hasModuleCoverArt(id?: string) { return !!id && modules.includes(id) }
const captions = [
 ['Tu espacio para descubrir la música','Your space to discover music'],
 ['Cada gran ritmo empieza con una buena base','Every great rhythm starts with a strong foundation'],
 ['El pulso y las raíces del son','The pulse and roots of son'],
 ['Más sonidos, nuevas posibilidades','More sounds, new possibilities'],
 ['Todo lo aprendido, ahora en tus manos','Everything you have learned, now in your hands'],
]
function Drums({x=150,y=170,scale=1}:{x?:number;y?:number;scale?:number}) {
 return <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinejoin="round">
  <path d="M55 55V136M55 115L18 151M55 115L95 151" fill="none" stroke="#ccd6d5" strokeWidth="7" strokeLinecap="round"/>
  <path d="M-35 0V53Q0 77 37 53V0M52 0V49Q85 73 119 49V0" fill="#6f969d" stroke="#d7e5df" strokeWidth="3"/>
  <path d="M-25 16V49M27 16V49M63 16V46M109 16V46" stroke="#eff0dc" strokeWidth="4"/>
  <ellipse cy="0" rx="37" ry="15" fill="#fff1c6" stroke="#f4b956" strokeWidth="5"/>
  <ellipse cx="85" cy="0" rx="35" ry="14" fill="#fff1c6" stroke="#f4b956" strokeWidth="5"/>
  <path d="M13 -47L68 -16M97 -48L50 -15" stroke="#edb67d" strokeWidth="6" strokeLinecap="round"/>
 </g>
}
export function ModuleCoverArt({ moduleId }: {moduleId:string}) {
 const mode=useLearningMode(), {locale}=useTranslation(), id=useId().replace(/:/g,'')
 const index=modules.indexOf(moduleId)
 if(index<0)return null
 const kids=mode==='kids', es=locale==='es'
 const colors=kids?['#b9e4dc','#234f67','#f6c56b']:['#173940','#f5e6c6','#dd9e52']
 return <figure className="relative m-0 w-full self-center overflow-hidden rounded-3xl border border-primary/15" style={{background:colors[0]}}>
  <ClassroomLamps cover/>
  <svg viewBox="0 0 480 380" role="img" aria-label={captions[index][es?0:1]} className="block w-full">
   <defs><linearGradient id={`${id}sky`} x2="0" y2="1"><stop stopColor={colors[0]}/><stop offset="1" stopColor={kids?'#edf6d7':'#34666a'}/></linearGradient><radialGradient id={`${id}glow`}><stop stopColor="#ffe2a4" stopOpacity=".5"/><stop offset="1" stopColor="#ffe2a4" stopOpacity="0"/></radialGradient></defs>
   <rect width="480" height="380" fill={`url(#${id}sky)`}/><circle cx="330" cy="110" r="175" fill={`url(#${id}glow)`}/>
   <circle cx="375" cy="76" r="35" fill={colors[2]} opacity=".9"/>
   <path d="M0 295Q110 230 230 294T480 275V380H0Z" fill={kids?'#80b8ac':'#24484e'}/><path d="M0 330Q135 277 280 327T480 316V380H0Z" fill={kids?'#5f9f95':'#102f36'}/>
   <g fill="none" stroke={colors[1]} opacity=".17" strokeWidth="1.5">{[0,1,2,3,4].map(i=><path key={i} d={`M18 ${70+i*12}Q140 ${15+i*12} 280 ${80+i*12}T470 ${60+i*12}`}/>)}</g>
   {index===0 ? <g>
    <rect x="85" y="103" width="290" height="180" rx="16" fill="#112f3d" stroke="#e4b96f" strokeWidth="5"/>
    <rect x="98" y="116" width="264" height="151" rx="8" fill="#edf1e2"/>
    <rect x="108" y="127" width="45" height="130" rx="5" fill="#c4d9cc"/>
    {[0,1,2,3].map(i=><rect key={i} x="117" y={140+i*26} width="26" height="12" rx="4" fill={i===0?'#eaa04b':'#729c9d'}/>)}
    <rect x="164" y="127" width="184" height="85" rx="6" fill="#38636b"/><path d="M242 148L242 190L275 169Z" fill="#f8cf83"/>
    {[0,1,2].map(i=><rect key={i} x={165+i*63} y="222" width="56" height="32" rx="5" fill={['#d5b872','#94b7ac','#a3b0c5'][i]}/>)}
    <path d="M230 285V309M183 311H277" stroke="#dfbc7e" strokeWidth="9" strokeLinecap="round"/>
    <path d="M52 270Q25 213 61 200Q89 191 102 226" fill="none" stroke="#f0c980" strokeWidth="9"/><rect x="47" y="236" width="20" height="35" rx="8" fill="#e48f51"/>
   </g> : index===1 ? <g><ellipse cx="235" cy="328" rx="140" ry="17" fill="#112c3555"/><Drums x={178} y={183} scale={1.25}/><path d="M68 285L86 214L112 285Z" fill="#ecc481" stroke="#815e44" strokeWidth="3"/><path d="M88 269L107 228" stroke="#394e59" strokeWidth="4"/><circle cx="88" cy="269" r="5" fill="#fff1cb"/></g> : index===2 ? <g>
    <g fill="#dca55f" stroke="#efcd94" strokeWidth="2"><path d="M64 255V166H126V255M133 255V143H199V255M207 255V174H260V255"/><path d="M60 166L96 139L131 166M128 143L166 116L204 143"/></g>
    <g fill="#31585f">{[78,103,147,174,219,239].map((x,i)=><rect key={x} x={x} y={180+(i%2)*20} width="12" height="29" rx="6"/>)}</g>
    <path d="M360 260Q370 173 350 121" stroke="#ae7c4f" strokeWidth="10" fill="none"/><g fill="#47866b"><path d="M350 126Q290 78 281 139Q319 115 350 126M350 126Q386 64 412 103Q370 104 350 126M350 126Q414 108 428 151Q388 131 350 126M350 126Q328 72 306 91Q321 104 350 126"/></g><Drums x={248} y={247} scale={.65}/>
   </g> : index===3 ? <g>
    <path d="M71 283Q109 77 266 103Q386 121 402 269" fill="none" stroke="#e8b76e" strokeWidth="19" opacity=".7"/>
    <path d="M91 286Q126 104 267 126Q365 145 380 271" fill="none" stroke="#98b9b8" strokeWidth="13"/>
    <Drums x={185} y={223} scale={.8}/><g fill={colors[1]}>{[0,1,2].map(i=><g key={i} transform={`translate(${105+i*100} ${210-(i%2)*58})`}><ellipse rx="10" ry="7" transform="rotate(-20)"/><path d="M7 0V-44H12V0Z"/></g>)}</g>
   </g> : <g>
    <path d="M55 93H425V112H55Z" fill="#d8af6d"/><path d="M55 112V294Q80 277 91 112M425 112V294Q400 277 389 112" fill="#a36174"/>
    <path d="M87 310H393L425 338H55Z" fill="#c19268"/><Drums x={182} y={190} scale={1.05}/>
    <g fill="#f9d389">{[80,144,208,272,336,400].map(x=><circle key={x} cx={x} cy="102" r="4"/>)}</g>
   </g>}
   {kids && <g><path d="M40 326Q40 298 61 298Q82 298 82 326" fill="#f4b5be"/><circle cx="60" cy="283" r="19" fill="#ffdbab"/><path d="M42 279Q40 256 61 261Q82 260 79 280" fill="#614747"/><circle cx="54" cy="285" r="2" fill="#3b4158"/><circle cx="67" cy="285" r="2" fill="#3b4158"/><path d="M55 292Q61 297 67 292" fill="none" stroke="#754d50" strokeWidth="2"/><path d="M395 327Q397 299 418 299Q439 299 441 327" fill="#a49ad5"/><circle cx="418" cy="284" r="19" fill="#b77c55"/><path d="M399 279Q397 259 418 259Q439 259 437 279" fill="#3f3544"/><circle cx="412" cy="285" r="2" fill="#302e3e"/><circle cx="425" cy="285" r="2" fill="#302e3e"/><path d="M413 293Q419 297 425 292" fill="none" stroke="#fff0cc" strokeWidth="2"/></g>}
   <g fill={colors[1]} opacity=".65"><path d="M45 72l3 8 8 3-8 3-3 8-3-8-8-3 8-3ZM410 203l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/></g>
  </svg>
  <figcaption className="px-5 pb-5 text-center text-sm font-medium" style={{color:colors[1]}}>{captions[index][es?0:1]}</figcaption>
 </figure>
}
