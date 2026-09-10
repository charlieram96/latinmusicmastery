'use client'

import { useState } from 'react'
import { Check, ChevronRight, Music2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LessonFooter } from '@/components/class-viewer/lesson-viewer/lesson-footer'
import { LessonActivityBoundary, LessonProgressProvider, useLessonActivity, useLessonProgress } from '@/components/class-viewer/lesson-viewer/lesson-progress-context'
import { LessonVideoPlayer } from '@/components/class-viewer/lesson-viewer/lesson-video-player'
import { QuizRunner } from '@/components/class-viewer/lesson-viewer/quiz-runner'
import { completionRequirements } from '@/lib/courses/lesson-completion'
import { cn } from '@/lib/utils'
import type { QuizQuestion } from '@/types/modules'

const items = [
  { id: 'intro', title: 'Find the groove', type: 'VIDEO', label: 'Lesson' },
  { id: 'quiz', title: 'Check your understanding', type: 'QUIZ', label: 'Quiz' },
  { id: 'exercise', title: 'Put the rhythm into practice', type: 'EXERCISE', label: 'Exercise' },
  { id: 'jam', title: 'Play with the band', type: 'JAM_SESSION', label: 'Jam session' },
]
const ids = items.map(item => item.id)
const question: QuizQuestion = { id: 'preview-clave', class_item_id: 'quiz', order_index: 0,
  question: 'The clave is a repeating rhythmic pattern.', question_type: 'true_false', correct_answer: 'true',
  explanation: 'The clave provides a repeating rhythmic foundation for the music.', options: null,
  question_es: null, explanation_es: null, options_es: null, audio_url: null, image_url: null, created_at: null, updated_at: null,
}
const savePreview = async () => ({ success: true as const })

export function CompletionPreview() {
  return <LessonProgressProvider itemIds={ids} initialCompletedItemIds={[]} saveCompletion={savePreview}><PreviewLesson /></LessonProgressProvider>
}

function PreviewLesson() {
  const [index, setIndex] = useState(0)
  const active = items[index]
  const progress = useLessonProgress()!
  return <main className="min-h-screen bg-background pb-24 text-foreground [&_[data-lesson-completion-bar]]:left-0"
    onClickCapture={event => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href*="/dashboard/course/preview"]')
      if (!link) return
      event.preventDefault()
      const next = new URL(link.href).searchParams.get('item')
      if (next !== null) setIndex(Number(next))
    }}>
    <div className="border-b border-border px-5 py-4 md:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>My courses <ChevronRight className="mx-2 inline h-3 w-3" /> Son Cubano Timbal</span>
        <span>Local preview · progress isn’t saved</span>
      </div>
    </div>
    <div className="mx-auto max-w-6xl px-5 pt-7 md:px-10">
      <p className="text-[11px] font-semibold uppercase tracking-[.15em] text-terracotta">Fundamentals of the timbal in son</p>
      <h1 className="mt-2 font-heading text-3xl font-bold">Basic Timbal Rhythm in Son</h1>
      <nav className="mb-6 mt-6 flex gap-2 overflow-x-auto border-b border-border" aria-label="Lesson parts">
        {items.map((item, i) => <button key={item.id} onClick={() => setIndex(i)} className={cn('flex min-w-32 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold', index === i ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
          {item.label}{progress.completedItemIds.includes(item.id) && <Check className="h-3.5 w-3.5 text-primary" />}
        </button>)}
      </nav>
      <LessonActivityBoundary key={active.id} classItemId={active.id} required={completionRequirements(active.type, active.type === 'EXERCISE', active.type === 'QUIZ')}>
        {active.type === 'QUIZ' ? <QuizRunner classItemId="quiz" title={active.title} questions={[question]} /> :
          active.type === 'EXERCISE' ? <ExerciseFinishPreview /> :
            <div className="mx-auto max-w-3xl space-y-4">
              <LessonVideoPlayer src="/videos/band-performing.mp4" />
              <h2 className="font-heading text-xl font-semibold">{active.title}</h2>
              <p className="text-sm text-muted-foreground">Play the short clip to its end to see the completion bar guide you forward.</p>
            </div>}
      </LessonActivityBoundary>
    </div>
    <LessonFooter courseId="preview" classId="rhythm" currentIndex={index} totalItems={items.length} itemIds={ids} completedItemIds={[]}
      nextClassId={null} activeItemId={active.id} activeItemType={active.type} isCompleted={false} nextLabel={items[index + 1]?.title} />
  </main>
}

function ExerciseFinishPreview() {
  const finish = useLessonActivity('performance')
  return <div className="flex min-h-64 flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-card p-8 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Music2 /></span>
    <div><h2 className="text-xl font-semibold">PlaySense completion</h2><p className="mt-2 text-sm text-muted-foreground">Preview the bar after a full exercise performance.</p></div>
    <Button variant="outline" onClick={finish}>Preview finished exercise</Button>
  </div>
}
