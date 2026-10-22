'use client'

import { QuizQuestionsEditor } from '../quiz-questions-editor'
import { ProducedSolfeoLessonPreview } from '@/components/solfeo/produced-lesson-preview'
import { FullSolfeoLessonPreview } from '@/components/solfeo/full-lesson-preview'
import { VideoWatermark } from '@/components/playsense-studio/shared/video-watermark'
import { useTranslation } from '@/components/language-provider'
import { PlaysenseStudioScoreAttach } from '../playsense-studio-score-attach'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminText } from '@/components/admin/admin-text'
import { updateClassItem } from '@/app/actions/course-builder'
import type { ClassItem } from '@/types/modules'
import { useAutosave } from './use-autosave'
import { useSaveStatus } from './save-status'

/** Local exercise editor with the shared question builder and grading preview. */
export function LocalOutlineItemEditor({ item, onPatched }: { item: ClassItem; onPatched: (patch: Partial<ClassItem>) => void }) {
  const { locale } = useTranslation()
  const { track } = useSaveStatus()
  const { queue } = useAutosave<Record<string, unknown>>({ save: patch => track(updateClassItem(item.id, patch)) })
  return <div className="space-y-4 p-5">
    {['local-solfeo-m01-c01-exercise','local-solfeo-m01-c02-exercise'].includes(item.id) && <FullSolfeoLessonPreview lessonNumber={item.id.includes('c02')?2:1} exercise/>}
    {item.item_type === 'EXERCISE' && !['local-solfeo-m01-c01-exercise','local-solfeo-m01-c02-exercise'].includes(item.id) && <ProducedSolfeoLessonPreview classId={item.class_id} exercise/>}
    {item.item_type === 'VIDEO' && item.video_url?.startsWith('/local-course-assets/') && <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-black"><video controls playsInline preload="metadata" src={item.video_url} className="aspect-video w-full object-contain" aria-label={locale === 'es' ? 'Introducción de la primera clase' : 'First lesson introduction'}/><VideoWatermark nativeControls/></div>
      <a href={item.video_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">{locale === 'es' ? 'Abrir video local' : 'Open local video'} ↗</a>
    </div>}
    {item.item_type === 'VIDEO' && <PlaysenseStudioScoreAttach classItemId={item.id} itemType="VIDEO" currentScoreDocumentId={null}/>}
    {item.item_type==='EXERCISE' && !['local-solfeo-m01-c01-exercise','local-solfeo-m01-c02-exercise'].includes(item.id) && <QuizQuestionsEditor classItemId={item.id} kind="Exercise"/>}
    {(['title', 'title_es'] as const).map(field => <div className="grid gap-1.5" key={field}>
      <Label htmlFor={`outline-${field}`}><AdminText text={field === 'title' ? 'Title' : 'Title (Español)'} /></Label>
      <Input id={`outline-${field}`} value={item[field] ?? ''} onChange={event => {
        const patch = { [field]: event.target.value }; onPatched(patch); queue(patch)
      }} />
    </div>)}
  </div>
}
