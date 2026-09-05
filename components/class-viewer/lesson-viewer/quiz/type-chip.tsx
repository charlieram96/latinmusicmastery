'use client'

import { Ear, Hand, Link2, List, ListOrdered, RectangleHorizontal, ToggleLeft, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import type { QuestionType } from '@/types/modules'

const META: Record<QuestionType, { key: string; icon: LucideIcon }> = {
  multiple_choice: { key: 'dashboard.classViewer.quiz.types.multipleChoice', icon: List },
  true_false: { key: 'dashboard.classViewer.quiz.types.trueFalse', icon: ToggleLeft },
  text_answer: { key: 'dashboard.classViewer.quiz.types.textAnswer', icon: Type },
  audio: { key: 'dashboard.classViewer.quiz.types.audio', icon: Ear },
  audio_choice: { key: 'dashboard.classViewer.quiz.types.audioChoice', icon: Ear },
  piece_placement: { key: 'dashboard.classViewer.quiz.types.piecePlacement', icon: Hand },
  fill_in_blank: { key: 'dashboard.classViewer.quiz.types.fillInBlank', icon: RectangleHorizontal },
  matching_pairs: { key: 'dashboard.classViewer.quiz.types.matchingPairs', icon: Link2 },
  ordering_sequence: { key: 'dashboard.classViewer.quiz.types.orderingSequence', icon: ListOrdered },
}

export function typeIcon(type: QuestionType): LucideIcon {
  return META[type]?.icon ?? List
}

export function TypeChip({ type }: { type: QuestionType }) {
  const { t } = useTranslation()
  const meta = META[type]
  const Icon = meta?.icon ?? List
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-primary/12 px-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-primary">
      <Icon className="h-3 w-3" />
      {meta ? t(meta.key) : type}
    </span>
  )
}
