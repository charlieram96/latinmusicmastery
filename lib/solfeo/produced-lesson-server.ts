import { publishedContentEnabled } from '@/lib/release/content'
import { readReleaseDocument } from '@/lib/release/documents'
import { parseSubtitles } from '@/lib/subtitles/tracks'
import { localQuestions } from '@/lib/courses/local-solfeo-questions'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { usesLocalSolfeo, readLocalSolfeo } from '@/lib/courses/local-solfeo-draft'
import { localStudioSections,localStudio } from '@/lib/courses/local-solfeo-studio'
import type { ProducedSolfeoLesson } from './produced-lesson'

export async function readProducedSolfeoLesson(classId:string):Promise<ProducedSolfeoLesson|null>{
 if(!/^local-solfeo-m\d{2}-c\d{2}$/.test(classId)||!await usesLocalSolfeo(classId))return null
 try{
  const lesson=JSON.parse((publishedContentEnabled()?await readReleaseDocument('local-artifacts/solfeo-course/production/ready/'+classId+'.json'):await readFile(path.join(process.cwd(),'local-artifacts/solfeo-course/production/ready',classId+'.json'),'utf8'))) as ProducedSolfeoLesson
  const manifest=JSON.parse((publishedContentEnabled()?await readReleaseDocument('local-artifacts/solfeo-course/production/films/'+classId+'/manifest.json'):await readFile(path.join(process.cwd(),'local-artifacts/solfeo-course/production/films',classId,'manifest.json'),'utf8'))) as {chapters:NonNullable<ProducedSolfeoLesson['steps']>}
  lesson.steps=manifest.chapters.map(({start,end,title,kind})=>({start,end,title,kind}))
  const outline=await readLocalSolfeo()
  const item=outline.sections.flatMap(s=>s.classes).find(c=>c.id===classId)?.items.find(i=>i.item_type==='VIDEO')
  if(item?.video_url)lesson.videoUrl=item.video_url
  lesson.subtitles=parseSubtitles(item?.subtitles)
  lesson.description={es:item?.description_es??null,en:item?.description??null}
  lesson.richContent=item?.rich_content as Record<string,unknown>|null
  const repertoire=classId.match(/^local-solfeo-m11-c(\d{2})$/)
  if(repertoire)lesson.completeScoreUrl='/local-course-assets/solfeo/complete-scores/estudio-completo-'+repertoire[1]+'.musicxml'
  lesson.metronome=await localStudio(classId+'-video',store=>store.media[classId+'-video'])
  const {data}=await localStudioSections(classId+'-video',false)
  lesson.sections=data.map(s=>({id:s.sectionId,label:s.label,score:s.scoreDocument.parsedScore,tracks:s.tracks,activeTimeMap:s.activeTimeMap,videoStartSeconds:s.videoStartSeconds,videoEndSeconds:s.videoEndSeconds,metronomeAnchorSeconds:s.metronomeAnchorSeconds}))
  lesson.questions=await localQuestions(classId+'-exercise')
  return lesson
 }
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}
}
