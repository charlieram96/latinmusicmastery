'use client'

import { useTranslation } from '@/components/language-provider'
import { readComposition, readPieces } from '@/lib/quiz/composition'
import type { PiecePlacement } from '@/lib/quiz/grading'
import { ChoiceTiles, TrueFalseTiles } from './choice-tiles'
import { FillBlankInput } from './fill-blank-input'
import type { QuestionInputProps } from './input-props'
import { MatchingInput } from './matching-input'
import { OrderingInput } from './ordering-input'
import { PiecePlacementInput } from './piece-placement-input'
import { ShortAnswerInput } from './short-answer-input'

export function QuestionInput(props: QuestionInputProps) {
  const { t } = useTranslation()
  const { question: q, answer, isGraded, onChange } = props
  switch (q.question_type) {
    case 'multiple_choice':
    case 'audio_choice':
      return <ChoiceTiles {...props} />
    case 'true_false':
      return <TrueFalseTiles {...props} />
    case 'text_answer':
    case 'audio':
      return <ShortAnswerInput {...props} />
    case 'fill_in_blank':
      return <FillBlankInput {...props} />
    case 'matching_pairs':
      return <MatchingInput {...props} />
    case 'ordering_sequence':
      return <OrderingInput {...props} />
    case 'piece_placement':
      return (
        <PiecePlacementInput
          background={readComposition(q.options, q.image_url)}
          pieces={readPieces(q.options)}
          placement={((answer as Record<string, PiecePlacement>) ?? {})}
          isGraded={isGraded}
          onChange={(v) => onChange(v)}
        />
      )
    default:
      return <p className="text-sm text-muted-foreground">{t('dashboard.classViewer.quiz.unsupportedType', { type: q.question_type })}</p>
  }
}
