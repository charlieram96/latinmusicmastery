'use client'
import { SOLFEO_ID, solfeoPresentation } from '@/lib/solfeo/hybrid'
import { CourseSequenceContext } from './course-sequence-navigation'
import { LessonArt, worldName } from '@/components/learning-mode/art'
import { useLearningMode } from '@/components/learning-mode/store'
import { useState, type ReactNode, type MouseEvent } from 'react'
import Link from 'next/link'
import { LessonSidebar, type LessonSidebarSection } from '@/components/class-viewer/lesson-viewer/lesson-sidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ListMusic } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

export function CoursePreviewShell({sections,classId,sectionId,children,courseId='12468ffa-f23f-4e89-b2a2-ac28ffec3540',courseTitle,courseImageUrl='/local-course-assets/solfeo-aplicado-cover.png'}:{courseId?:string;courseTitle?:string;courseImageUrl?:string;sections:LessonSidebarSection[];classId:string|null;sectionId:string;children:ReactNode}) {
 const ordered=sections.flatMap(section=>section.classes)
 const currentIndex=ordered.findIndex(item=>item.id===classId)
 const sequence=currentIndex<0?{}:{previous:ordered[currentIndex-1],current:ordered[currentIndex],next:ordered[currentIndex+1]}
 const kids = useLearningMode() === 'kids'

 const [introVisit,setIntroVisit]=useState(0)
 const restartModule=(event:MouseEvent<HTMLDivElement>)=>{
  if(classId!==null||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return
  const anchor=(event.target as Element).closest('a')
  const section=sections.find(item=>item.id===sectionId)
  if(!anchor||!section?.href)return
  if(new URL(anchor.href,window.location.href).href===new URL(section.href,window.location.href).href){
   setIntroVisit(n=>n+1)
   event.currentTarget.querySelector('[data-course-scroll]')?.scrollTo({top:0,behavior:'instant'})
  }
 }
 const [collapsed,setCollapsed]=useState(false)
 const {locale}=useTranslation(); const es=locale==='es'
 if(courseId===SOLFEO_ID||courseId==='solfeo-infantil-aplicado'){const cover=solfeoPresentation(kids,es);courseTitle=cover.title;courseImageUrl=cover.thumbnailUrl}
 return <div onClickCapture={restartModule} className={`flex h-dvh items-start overflow-hidden [&>aside]:h-dvh ${collapsed?'[&>aside]:w-[76px]':'[&>aside]:w-[280px]'}`}>
  <LessonSidebar courseId={courseId} currentClassId={classId} currentSectionId={sectionId} sections={sections} courseTitle={courseTitle??(es?'Solfeo Aplicado':'Applied Solfege')} courseImageUrl={courseImageUrl} teacherName="Raffy Pérez" hasAccess collapsed={collapsed} onToggle={()=>setCollapsed(!collapsed)}/>
  <div data-course-scroll className="h-full min-w-0 flex-1 overflow-y-auto pb-24 md:pb-6">
   <div className="p-2 lg:hidden"><Sheet><SheetTrigger asChild><Button variant="outline"><ListMusic size={16} className="mr-2"/>{es?'Módulos y clases':'Modules and lessons'}</Button></SheetTrigger><SheetContent side="left" className={kids ? "overflow-y-auto p-4" : "overflow-y-auto"}><SheetTitle>{courseTitle??(es?'Solfeo Aplicado':'Applied Solfege')}</SheetTitle><nav className="mt-5 space-y-5">{sections.map((section,index)=><details key={section.id} open={section.id===sectionId}><summary className="cursor-pointer font-semibold">{kids ? worldName(section.title,index,es) : section.title}</summary><div className="mt-2 grid gap-2">{section.href&&<Link className="rounded-lg border border-primary/30 p-2 text-sm font-semibold text-primary" href={section.href}>{es?'Ir al inicio del módulo':'Go to module introduction'}</Link>}{section.classes.map((cls,lessonIndex)=><Link key={cls.id} href={cls.href!} className={`kid-mobile-lesson rounded p-2 text-sm ${cls.id===classId?'bg-primary/15 text-primary':''}`}>{kids && <LessonArt title={cls.title} index={lessonIndex}/ >}{cls.title}</Link>)}</div></details>)}</nav></SheetContent></Sheet></div>
   <CourseSequenceContext.Provider key={`${sectionId}:${introVisit}`} value={sequence}>{children}</CourseSequenceContext.Provider>
  </div>
 </div>
}
