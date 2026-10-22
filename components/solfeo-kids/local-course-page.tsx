import { kidsContentId, SOLFEO_ID, SOLFEO_AUTHOR_ROUTE } from '@/lib/solfeo/hybrid'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { kidsEnabled, readKidsOutline, readKidsLesson, KIDS_ROUTE } from '@/lib/solfeo-kids/local-course'
import { getServerLocale } from '@/lib/i18n/server'
import { CoursePreviewShell } from '@/components/solfeo/course-preview-shell'
import { KidsCourseExperience } from './kids-course-experience'
export async function KidsLocalCoursePage({searchParams,editor=false}:{searchParams:Promise<{class?:string;module?:string}>;editor?:boolean}) {
 if(!await kidsEnabled())notFound()
 const [locale,outline,query]=await Promise.all([getServerLocale(),readKidsOutline(),searchParams]),es=locale==='es'
 query.class=kidsContentId(query.class);query.module=kidsContentId(query.module)
 const route=editor?SOLFEO_AUTHOR_ROUTE:KIDS_ROUTE
 const sections=outline.sections.map(s=>({id:s.id,title:(es?s.title_es:s.title)||s.title,href:`${route}?module=${s.id}`,totalItems:s.classes.reduce((n,c)=>n+c.items.length,0),completedItems:0,classes:s.classes.map(c=>({id:c.id,title:(es?c.title_es:c.title)||c.title,href:`${route}?class=${c.id}`,totalItems:c.items.length,completedItems:0,isFree:true}))}))
 const classId=query.module?sections.find(s=>s.id===query.module)?.classes[0]?.id:query.class??sections[0]?.classes[0]?.id
 const section=sections.find(s=>s.classes.some(c=>c.id===classId)),lesson=section?.classes.find(c=>c.id===classId)
 if(!classId||!section||!lesson)notFound()
 const data=await readKidsLesson(classId,locale)
 if(!data)notFound()
 if(editor)data.book.nextHref=data.book.nextHref.replace(KIDS_ROUTE,route)
 const welcome=!query.class||!!query.module
 const title=es?outline.title_es:outline.title
 return <CoursePreviewShell sections={sections} classId={welcome?null:classId} sectionId={section.id} courseId={SOLFEO_ID} courseTitle={title} courseImageUrl={outline.thumbnail_url}>
  <div className="flex flex-wrap items-center gap-4 border-b px-4 py-2 text-sm"><Link className="text-primary" href="/dashboard/courses">← {es?'Buscar cursos':'Browse courses'}</Link><span className="text-muted-foreground">{es?'12 módulos · 149 clases':'12 modules · 149 lessons'}</span>{editor&&<span>{es?'Vista de autor':'Author preview'}</span>}</div>
  <KidsCourseExperience key={classId+locale+welcome} {...data} welcome={welcome?{startHref:lesson.href!,lessons:section.classes.map(item=>item.title)}:undefined} headerContext={{courseTitle:title,title:lesson.title,module:section.title,editorLinks:<Link className="text-primary" href={`${editor?KIDS_ROUTE:SOLFEO_AUTHOR_ROUTE}?class=${classId}`}>{editor?(es?'Vista del estudiante':'Student view'):(es?'Vista de autor':'Author preview')}</Link>}}/>
 </CoursePreviewShell>
}
