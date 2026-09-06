'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import { QuizQuestionCard } from './quiz-question-card'
import { QuizQuestion } from '@/types/modules'
import {
  getQuizQuestions,
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  reorderQuizQuestions,
} from '@/app/actions/quiz'
import { useSaveStatus } from './course-studio/save-status'
import { useItemSave } from './course-studio/item-save-context'

interface QuizQuestionsEditorProps {
  classItemId: string
  kind: 'Quiz' | 'Exercise'
}

export function QuizQuestionsEditor({ classItemId, kind }: QuizQuestionsEditorProps) {
  const { track } = useSaveStatus()
  const { setDirty, registerFlush } = useItemSave()

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Latest unsaved snapshot per question id, so a flush persists current values.
  const pending = useRef<Record<string, QuizQuestion>>({})

  useEffect(() => {
    let active = true
    getQuizQuestions(classItemId).then((res) => {
      if (active) {
        setQuestions(res.data)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [classItemId])

  const saveQuestion = useCallback(
    (id: string) => {
      const q = pending.current[id]
      if (!q) return
      delete pending.current[id]
      clearTimeout(saveTimers.current[id])
      const promise = track(
        updateQuizQuestion(q.id, {
          question: q.question,
          question_type: q.question_type,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          audio_url: q.audio_url,
          image_url: q.image_url,
          question_es: q.question_es,
          explanation_es: q.explanation_es,
          options_es: q.options_es,
        })
      )
      promise.finally(() => {
        if (Object.keys(pending.current).length === 0) setDirty('quiz', false)
      })
    },
    [track, setDirty]
  )

  const scheduleSave = (q: QuizQuestion) => {
    pending.current[q.id] = q
    setDirty('quiz', true)
    clearTimeout(saveTimers.current[q.id])
    saveTimers.current[q.id] = setTimeout(() => saveQuestion(q.id), 600)
  }

  // Flush every pending question immediately (Save button / item switch).
  const flush = useCallback(() => {
    Object.keys(pending.current).forEach((id) => saveQuestion(id))
  }, [saveQuestion])

  useEffect(() => registerFlush(flush), [registerFlush, flush])
  useEffect(() => () => flush(), [flush])

  const patchQuestion = (id: string, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => {
      const next = prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
      const changed = next.find((q) => q.id === id)
      if (changed) scheduleSave(changed)
      return next
    })
  }

  const addQuestion = async () => {
    setBusy(true)
    const res = await track(
      createQuizQuestion(classItemId, {
        question: '',
        question_type: 'multiple_choice',
        options: { choices: [] },
        correct_answer: '',
        explanation: '',
      })
    )
    if (res.data) setQuestions((prev) => [...prev, res.data as QuizQuestion])
    setBusy(false)
  }

  const removeQuestion = async (id: string) => {
    delete pending.current[id]
    clearTimeout(saveTimers.current[id])
    setQuestions((prev) => prev.filter((q) => q.id !== id))
    await track(deleteQuizQuestion(id))
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [previewId, setPreviewId] = useState<string | null>(null)
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = questions.findIndex((q) => q.id === active.id)
    const to = questions.findIndex((q) => q.id === over.id)
    const reindexed = arrayMove(questions, from, to).map((q, i) => ({ ...q, order_index: i }))
    setQuestions(reindexed)
    await track(reorderQuizQuestions(classItemId, reindexed.map((q) => q.id)))
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading questions…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">
          {kind} Questions{' '}
          <span className="text-muted-foreground font-normal">({questions.length})</span>
        </h4>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No questions yet. Add the first question below — a {kind.toLowerCase()} is a series of questions.
        </p>
      )}

      <DndContext id={`quiz-dnd-${classItemId}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {questions.map((q, index) => (
              <QuizQuestionCard
                key={q.id}
                question={q}
                index={index}
                onPatch={(patch) => patchQuestion(q.id, patch)}
                onRemove={() => removeQuestion(q.id)}
                previewOpen={previewId === q.id}
                onTogglePreview={() => setPreviewId(previewId === q.id ? null : q.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" onClick={addQuestion} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
        Add Question
      </Button>
    </div>
  )
}
