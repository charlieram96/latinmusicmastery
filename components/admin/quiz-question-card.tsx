'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { QuestionType, QuizQuestion } from '@/types/modules'
import { QuizBuilder } from './quiz-builder'

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  text_answer: 'Text Answer',
  true_false: 'True/False',
  matching_pairs: 'Matching Pairs',
  fill_in_blank: 'Fill in the Blank',
  ordering_sequence: 'Ordering/Sequence',
  audio: 'Audio Response',
  audio_choice: 'Audio — Listen & Choose',
  piece_placement: 'Drag into place',
}

/** One sortable question row: grip, index, type select, the builder form, and an optional preview pane (children). */
export function QuizQuestionCard({
  question: q,
  index,
  onPatch,
  onRemove,
  previewOpen,
  onTogglePreview,
  children,
}: {
  question: QuizQuestion
  index: number
  onPatch: (patch: Partial<QuizQuestion>) => void
  onRemove: () => void
  previewOpen: boolean
  onTogglePreview: () => void
  children?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('space-y-4 rounded-lg border border-border bg-card p-4', isDragging && 'z-10 border-primary shadow-lg')}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <button type="button" {...attributes} {...listeners} title="Drag to reorder" aria-label="Drag to reorder" className="grid h-7 w-6 cursor-grab place-items-center rounded text-muted-foreground/60 hover:text-foreground active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </button> <AdminText text={"Question"} /> {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" aria-pressed={previewOpen} onClick={onTogglePreview}>
            {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} <AdminText text={"Preview"} /> </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onRemove} aria-label="Delete question">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label><AdminText text={"Question Type"} /></Label>
        <Select
          value={q.question_type}
          onValueChange={(v) => onPatch({ question_type: v as QuestionType, options: null, options_es: null, correct_answer: '', audio_url: null, image_url: null })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QuizBuilder
        questionId={q.id}
        questionType={q.question_type}
        question={q.question}
        questionEs={q.question_es ?? ''}
        options={q.options}
        optionsEs={q.options_es}
        correctAnswer={q.correct_answer ?? ''}
        audioUrl={q.audio_url ?? ''}
        imageUrl={q.image_url ?? ''}
        explanation={q.explanation ?? ''}
        explanationEs={q.explanation_es ?? ''}
        onChange={(data) => onPatch(data as Partial<QuizQuestion>)}
      />

      {previewOpen && children}
    </div>
  )
}
