'use client'

import { BookOpen, LibraryBig, GraduationCap, Trophy, Tv, Presentation, Sun, Moon, Trees, Mountain, TrainFront, Castle, FlaskConical, Route, Flower2, Hammer, Ear, Theater, History, Pencil, Clock3, Hand, KeyRound, Pause, ListMusic, Settings, Languages, Users, Heart, TrendingUp, Compass, Mail, ChartNoAxesCombined, CircleDollarSign, Tags, Globe, Guitar, type LucideIcon } from 'lucide-react'
import { lessonSubject, worldSubject } from './subjects'
export { worldName } from './subjects'
import { useLearningMode } from './store'

const colors = ['#ffa8b6', '#ffd187', '#ffe684', '#bce891', '#8cded6', '#a6cdff', '#cbb5f0']
const pictures: Record<string, LucideIcon> = {
  myCourses: LibraryBig, courses: LibraryBig, browseCourses: BookOpen, teachers: GraduationCap,
  teacherPortal: GraduationCap, achievements: Trophy, teacherFeedback: Tv, learning: Presentation,
  sun: Sun, moon: Moon, theme: Sun, forest: Trees, mountain: Mountain, train: TrainFront,
  castle: Castle, lab: FlaskConical, trail: Route, garden: Flower2, workshop: Hammer,
  ear: Ear, stage: Theater, journey: Compass, history: History, writing: Pencil,
  clock: Clock3, conduct: Hand, key: KeyRound, rest: Pause, staff: ListMusic,
  settings: Settings, language: Languages, profile: Users, community: Heart, progress: TrendingUp,
  dashboard: Compass, users: Users, waitlist: Mail, feedback: Tv, analytics: ChartNoAxesCombined,
  financials: CircleDollarSign, pricing: Tags, countries: Globe, instruments: Guitar,
  'musical styles': Theater, 'play sense': Theater,
}
function seed(key: string) { return [...key].reduce((n,c) => n+c.charCodeAt(0), 0) }
export function KidCharacter({ name='music', index, className='' }: {name?:string; index?:number; className?:string}) {
  const i = index ?? seed(name)
  const Picture = pictures[name]
  return <svg aria-hidden="true" viewBox="0 0 64 64" className={`kid-character ${className}`}>
    <rect x="5" y="10" width="54" height="51" rx="19" fill="#263654" opacity=".13" />
    <rect x="5" y="5" width="54" height="51" rx="19" fill={colors[i % colors.length]} stroke="white" strokeWidth="2" />
    {name === 'home' ? <g stroke="#293a59" strokeWidth="2.5" strokeLinejoin="round"><path d="M17 25L32 13 47 25" fill="#ff8a65"/><path d="M21 24V36H43V24" fill="#fff9dd"/><path d="M29 36V27H35V36" fill="#87c6ff"/></g>
      : name === 'browseCourses' ? <g stroke="#293a59" strokeWidth="2"><path d="M17 16Q25 12 32 18Q39 12 47 16V34Q39 30 32 36Q25 30 17 34Z" fill="#fffdf7"/><path d="M32 18V35M21 22H27M37 22H43M21 27H27M37 27H43"/></g>
      : name === 'tuner' ? <g stroke="#293a59" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M24 14V25Q24 32 32 32Q40 32 40 25V14M32 32V37"/><path d="M17 19V24M47 19V24" stroke="#e46b55"/></g>
      : name === 'adminPanel' ? <g stroke="#293a59" strokeWidth="2"><path d="M32 12L45 17V25Q44 33 32 37Q20 33 19 25V17Z" fill="#fff2b9"/><path d="M25 24L30 29 39 20" fill="none"/></g>
      : name === 'playSense' ? <g stroke="#293a59" strokeWidth="2"><path d="M18 22V34Q32 40 46 34V22" fill="#fc8f85"/><ellipse cx="32" cy="22" rx="14" ry="5" fill="#fff9dd"/><path d="M23 12L38 21M42 12L27 21" strokeLinecap="round"/></g>
      : name === 'masterClass' ? <g stroke="#293a59" strokeWidth="2" strokeLinejoin="round">
        <path d="M19 12L26 17H38L45 12V28Q43 38 32 38Q21 38 19 28Z" fill="#bd8b61"/>
        <circle cx="26" cy="25" r="7" fill="#fff8df"/><circle cx="38" cy="25" r="7" fill="#fff8df"/>
        <circle cx="27" cy="25" r="2" fill="#293a59"/><circle cx="37" cy="25" r="2" fill="#293a59"/>
        <path d="M29 31L32 35 35 31" fill="#ffab34"/>
      </g>
      : name === 'rest' ? <g stroke="#293a59" strokeWidth="2" strokeLinecap="round"><circle cx="32" cy="24" r="13" fill="#fff2d6"/><path d="M25 22H27M37 22H39M30 29H34"/><path d="M32 35V26Q32 23 35 24Q37 24 37 27V37H29V33" fill="#ffc898"/></g>
      : name === 'stairs' ? <g stroke="#293a59" strokeWidth="2" strokeLinejoin="round"><path d="M17 36V29H25V22H34V15H46V36Z" fill="#fff5cc"/><path d="M18 21L37 10M32 10H38V16" fill="none"/></g>
      : Picture ? <Picture x="17" y="11" width="30" height="27" stroke="#293a59" strokeWidth="2" fill={name === 'forest' || name === 'garden' ? '#8cc779' : name === 'sun' || name === 'achievements' ? '#ffe386' : name === 'community' ? '#fa859b' : 'none'} />
      : <g stroke="#293a59" strokeWidth="3" fill="#293a59"><path d="M29 31V15L42 12V28" fill="none"/><ellipse cx="25" cy="32" rx="5" ry="3"/><ellipse cx="38" cy="29" rx="5" ry="3"/></g>}

    {name !== 'rest' && <><circle cx="23" cy="41" r="2" fill="#293a59"/><circle cx="41" cy="41" r="2" fill="#293a59"/>
    <path d="M28 46 Q32 50 36 46" fill="none" stroke="#293a59" strokeWidth="2" strokeLinecap="round"/></>}
  </svg>
}
export function LearningIcon({name, icon: Icon, className='h-5 w-5 shrink-0'}:{name:string;icon:LucideIcon;className?:string}) {
  const kids = useLearningMode() === 'kids'
  return kids ? <KidCharacter name={name} className="h-9 w-9 shrink-0"/> : <Icon className={className}/>
}
export function LearningBrand({children}:{children:React.ReactNode}) {
  const kids = useLearningMode() === 'kids'
  return kids ? <span className="kid-brand" aria-label="Latin Music Mastery"><KidCharacter name="music"/><span>LMM</span></span> : children
}
export function LessonArt({title,index,kind='lesson'}:{title:string;index:number;kind?:'lesson'|'world'}) {
  const kids = useLearningMode() === 'kids'
  if (!kids) return null
  const name = kind === 'world' ? worldSubject(title)?.[1] ?? 'journey' : lessonSubject(title)
  return <KidCharacter name={name} index={index} className="h-11 w-11 shrink-0"/>
}
