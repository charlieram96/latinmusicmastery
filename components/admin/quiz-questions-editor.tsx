'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { QuizBuilder } from './quiz-builder'
import { QuestionType, QuizQuestion } from '@/types/modules'
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

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  text_answer: 'Text Answer',
  true_false: 'True/False',
  matching_pairs: 'Matching Pairs',
  fill_in_blank: 'Fill in the Blank',
  ordering_sequence: 'Ordering/Sequence',
  audio: 'Audio Response',
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
          question_es: q.question_es,
          explanation_es: q.explanation_es,
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

  const move = async (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= questions.length) return
    const next = [...questions]
    ;[next[index], next[to]] = [next[to], next[index]]
    const reindexed = next.map((q, i) => ({ ...q, order_index: i }))
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

      <div className="space-y-5">
        {questions.map((q, index) => (
          <div key={q.id} className="rounded-lg border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">
                Question {index + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={index === questions.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={() => removeQuestion(q.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Question Type</Label>
              <Select
                value={q.question_type}
                onValueChange={(v) =>
                  patchQuestion(q.id, {
                    question_type: v as QuestionType,
                    options: null,
                    correct_answer: '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <QuizBuilder
              questionType={q.question_type}
              question={q.question}
              questionEs={q.question_es ?? ''}
              options={q.options}
              correctAnswer={q.correct_answer ?? ''}
              explanation={q.explanation ?? ''}
              explanationEs={q.explanation_es ?? ''}
              onChange={(data) => patchQuestion(q.id, data as Partial<QuizQuestion>)}
            />
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addQuestion} disabled={busy}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
        Add Question
      </Button>
    </div>
  )
}
