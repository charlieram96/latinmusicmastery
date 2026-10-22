'use client'

import { createContext, useContext } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/language-provider'

type Destination = { title: string; href?: string; onClick?: () => void }
export const CourseSequenceContext = createContext<{previous?: Destination; current?: Destination; next?: Destination}>({})

/** Course order comes from the same ordered classes as the sidebar. */
export function CourseSequenceNavigation({activity,currentTitle,previousActivity,nextActivity}:{activity?:string;currentTitle?:string;previousActivity?:Destination;nextActivity?:Destination}) {
 const course=useContext(CourseSequenceContext)
 const {locale}=useTranslation(),es=locale==='es'
 const previous=previousActivity??course.previous,next=nextActivity??course.next
 const current=[currentTitle??course.current?.title,activity].filter(Boolean).join(' · ')
 const item=(destination:Destination|undefined,label:string,forward=false)=>{
  const content=<><span className="block text-xs font-medium">{forward?'': '‹ '}{label}{forward?' ›':''}</span><span className="mt-1 block text-sm font-semibold leading-snug">{destination?.title??(forward?(es?'Fin del curso':'End of course'):(es?'Inicio del curso':'Start of course'))}</span></>
  const className=`min-w-0 px-3 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${destination?'hover:text-primary':'opacity-50'}`

  return destination?.href?<Link className={className} href={destination.href}>{content}</Link>:<button type="button" className={className} disabled={!destination} onClick={destination?.onClick}>{content}</button>
 }
 return <nav data-course-sequence aria-label={es?'Secuencia del curso':'Course sequence'} className="grid grid-cols-3 items-center gap-2 border-t border-border bg-background px-2 py-3 sm:gap-4 sm:px-3">
  {item(previous,es?'Anterior':'Previous')}
  <div aria-current="step" className="min-w-0 rounded-lg bg-primary px-4 py-2 text-center text-primary-foreground"><span className="block text-xs font-medium">{es?'Estás aquí':'Current'}</span><span className="mt-1 block text-sm font-semibold leading-snug">{current||activity}</span></div>
  {item(next,es?'Siguiente':'Next',true)}
 </nav>
}
