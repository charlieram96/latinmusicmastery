'use client'

import { useId } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useLearningMode } from './store'

/** Decorative only: authored layers, drop coordinates and controls remain above it. */
export function TimbalAssemblyStage() {
  const mode = useLearningMode()
  const { theme } = useTheme()
  const id = useId().replace(/:/g, '')
  if (mode !== 'kids') return null
  const night = theme === 'dark'
  return <svg data-kids-assembly-stage data-night={night} aria-hidden="true" viewBox="0 0 500 500" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full select-none">
    <defs>
      <linearGradient id={`${id}-wall`} x2="0" y2="1"><stop stopColor={night?'#182c49':'#acdcd9'}/><stop offset="1" stopColor={night?'#49627a':'#e9f2d9'}/></linearGradient>
      <linearGradient id={`${id}-wood`} x2="0" y2="1"><stop stopColor={night?'#937653':'#e5bd7e'}/><stop offset="1" stopColor={night?'#514539':'#bc895b'}/></linearGradient>
      <linearGradient id={`${id}-curtain`}><stop stopColor={night?'#343363':'#7371ae'}/><stop offset=".4" stopColor={night?'#68629d':'#a2a1cd'}/><stop offset=".7" stopColor={night?'#353d69':'#657da5'}/><stop offset="1" stopColor={night?'#26747c':'#63b9b6'}/></linearGradient>
      <radialGradient id={`${id}-light`}><stop stopColor="#fff4bc" stopOpacity={night?'.62':'.38'}/><stop offset="1" stopColor="#fff4bc" stopOpacity="0"/></radialGradient>
      <linearGradient id={`${id}-beam`} x2="0" y2="1"><stop stopColor="#fff0ac" stopOpacity={night?'.32':'.12'}/><stop offset="1" stopColor="#fff0ac" stopOpacity="0"/></linearGradient>
    </defs>
    <path d="M0 0H500V500H0Z" fill={`url(#${id}-wall)`}/>
    <ellipse cx="250" cy="235" rx="220" ry="190" fill={`url(#${id}-light)`}/>
    <path d="M0 335H500V500H0Z" fill={`url(#${id}-wood)`}/>
    <path d="M0 335H500M0 362H500M0 401H500M0 451H500" stroke={night?'#443d37':'#aa774b'} strokeWidth="2" opacity=".5"/>
    {[0,100,200,300,400,500].map(x=><path key={x} d={`M${190+x*.24} 335L${x} 500`} stroke={night?'#443d37':'#aa774b'} strokeWidth="1.5" opacity=".4"/>)}
    <path d="M0 0H77Q85 145 47 260L55 367Q28 384 0 374ZM500 0H423Q415 145 453 260L445 367Q472 384 500 374Z" fill={`url(#${id}-curtain)`}/>
    <path d="M15 20Q43 166 20 360M43 12Q67 146 39 246M485 20Q457 166 480 360M457 12Q433 146 461 246" fill="none" stroke="#fff" strokeOpacity=".15" strokeWidth="5"/>
    <path d="M0 0H500V35Q375 75 250 35Q125 75 0 35Z" fill={`url(#${id}-curtain)`}/>
    <path d="M14 258L47 249M453 249L486 258" stroke="#e4b96b" strokeWidth="7" strokeLinecap="round"/>
    <path d="M95 75L42 332H290ZM405 75L458 332H210Z" fill={`url(#${id}-beam)`}/>
    {[95,405].map(x=><g key={x} transform="translate(0 35)"><path d={`M${x} 0V27`} stroke="#596675" strokeWidth="5"/><path d={`M${x-19} 28Q${x} 15 ${x+19} 28L${x+24} 41H${x-24}Z`} fill="#bc8b50" stroke="#785d40" strokeWidth="2"/><ellipse cx={x} cy="41" rx="22" ry="5" fill={night?'#fff1a4':'#e7d6ab'}/>{night&&<ellipse cx={x} cy="46" rx="48" ry="36" fill={`url(#${id}-light)`}/>}</g>)}
    <g fill={night?'#e3cc87':'#61978e'} opacity=".35" fontFamily="serif" fontSize="25"><text x="64" y="170">♪</text><text x="415" y="212">♫</text><text x="78" y="290">♩</text></g>
  </svg>
}
