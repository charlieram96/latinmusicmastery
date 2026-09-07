'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Plus, Trash2 } from 'lucide-react'
import { QuestionType } from '@/types/modules'
import { QuizMediaUpload } from './quiz-media-upload'
import { PiecePlacementSummary } from './piece-placement/piece-placement-summary'
import { patchLocalizedEntry, pruneLocalizedEntries, readLocalizedField, type LocalizedOptions } from '@/lib/quiz/options-es'

interface QuizBuilderProps {
  questionId: string
  questionType: QuestionType
  question: string
  questionEs?: string
  options: any
  /** Spanish overlay for `options`: same lists and ids, translated strings only. */
  optionsEs?: LocalizedOptions
  correctAnswer: string
  audioUrl?: string
  imageUrl?: string
  explanation: string
  explanationEs?: string
  onChange: (data: {
    question?: string
    question_es?: string | null
    options?: any
    options_es?: unknown
    correct_answer?: string
    audio_url?: string | null
    image_url?: string | null
    explanation?: string
    explanation_es?: string | null
  }) => void
}

/** Secondary input row for the Spanish version of one option string. */
function EsField({
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  multiline?: boolean
}) {
  const className = 'flex-1 border-dashed'
  return (
    <div className="flex items-center gap-2 pl-6">
      <span className="w-5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ES</span>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className={className} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={className} />
      )}
    </div>
  )
}

export function QuizBuilder({
  questionId,
  questionType,
  question,
  questionEs = '',
  options,
  optionsEs = null,
  correctAnswer,
  audioUrl = '',
  imageUrl = '',
  explanation,
  explanationEs = '',
  onChange,
}: QuizBuilderProps) {
  const renderOptionsBuilder = () => {
    switch (questionType) {
      case 'multiple_choice':
        return (
          <MultipleChoiceBuilder
            options={options}
            optionsEs={optionsEs}
            correctAnswer={correctAnswer}
            onChange={onChange}
          />
        )
      case 'matching_pairs':
        return <MatchingPairsBuilder options={options} optionsEs={optionsEs} onChange={onChange} />
      case 'fill_in_blank':
        return <FillInBlankBuilder options={options} optionsEs={optionsEs} onChange={onChange} />
      case 'ordering_sequence':
        return <OrderingSequenceBuilder options={options} optionsEs={optionsEs} onChange={onChange} />
      case 'true_false':
        return (
          <TrueFalseBuilder correctAnswer={correctAnswer} onChange={onChange} />
        )
      case 'text_answer':
        return (
          <TextAnswerBuilder correctAnswer={correctAnswer} onChange={onChange} />
        )
      case 'audio_choice':
        return (
          <AudioChoiceBuilder
            questionId={questionId}
            options={options}
            optionsEs={optionsEs}
            correctAnswer={correctAnswer}
            audioUrl={audioUrl}
            onChange={onChange}
          />
        )
      case 'piece_placement':
        return <PiecePlacementSummary questionId={questionId} question={question} options={options} optionsEs={optionsEs} imageUrl={imageUrl} onChange={onChange} />
      case 'audio':
        return (
          <div className="text-sm text-muted-foreground">
            Audio response questions allow students to record audio answers.
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="question">Question</Label>
        <Textarea
          id="question"
          value={question}
          onChange={(e) => onChange({ question: e.target.value })}
          rows={3}
          placeholder="Enter your question here..."
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="question-es" className="text-muted-foreground">Question (Español)</Label>
        <Textarea
          id="question-es"
          value={questionEs}
          onChange={(e) => onChange({ question_es: e.target.value || null })}
          rows={3}
          placeholder="Escribe la pregunta en español (opcional)…"
        />
      </div>

      {renderOptionsBuilder()}

      <div className="grid gap-2">
        <Label htmlFor="explanation">Explanation (shown after answer)</Label>
        <Textarea
          id="explanation"
          value={explanation}
          onChange={(e) => onChange({ explanation: e.target.value })}
          rows={2}
          placeholder="Explain the correct answer..."
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="explanation-es" className="text-muted-foreground">Explanation (Español)</Label>
        <Textarea
          id="explanation-es"
          value={explanationEs}
          onChange={(e) => onChange({ explanation_es: e.target.value || null })}
          rows={2}
          placeholder="Explica la respuesta correcta (opcional)…"
        />
      </div>
    </div>
  )
}

// Multiple Choice Builder
function MultipleChoiceBuilder({
  options,
  optionsEs,
  correctAnswer,
  onChange,
}: {
  options: any
  optionsEs: LocalizedOptions
  correctAnswer: string
  onChange: (data: any) => void
}) {
  const choices = options?.choices || []

  const addChoice = () => {
    onChange({
      options: {
        choices: [...choices, { id: crypto.randomUUID(), text: '' }],
      },
    })
  }

  const updateChoice = (id: string, text: string) => {
    onChange({
      options: {
        choices: choices.map((c: any) => (c.id === id ? { ...c, text } : c)),
      },
    })
  }

  const updateChoiceEs = (id: string, text: string) => {
    onChange({ options_es: patchLocalizedEntry(optionsEs, 'choices', id, { text }) })
  }

  const removeChoice = (id: string) => {
    const remaining = choices.filter((c: any) => c.id !== id)
    onChange({
      options: { choices: remaining },
      options_es: pruneLocalizedEntries(optionsEs, 'choices', remaining.map((c: { id: string }) => c.id)),
    })
  }

  return (
    <div className="space-y-3">
      <Label>Answer Choices (select the correct one)</Label>
      {choices.map((choice: any, index: number) => (
        <div key={choice.id} className="space-y-1.5">
          <div className="flex gap-2 items-center">
            <input
              type="radio"
              name="correct"
              checked={correctAnswer === choice.id}
              onChange={() => onChange({ correct_answer: choice.id })}
              className="h-4 w-4"
            />
            <Input
              value={choice.text}
              onChange={(e) => updateChoice(choice.id, e.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeChoice(choice.id)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <EsField
            value={readLocalizedField(optionsEs, 'choices', choice.id, 'text')}
            onChange={(v) => updateChoiceEs(choice.id, v)}
            placeholder={`Opción ${index + 1} (Español, opcional)`}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addChoice}>
        <Plus className="w-4 h-4 mr-2" /> Add Choice
      </Button>
    </div>
  )
}

// Matching Pairs Builder
function MatchingPairsBuilder({
  options,
  optionsEs,
  onChange,
}: {
  options: any
  optionsEs: LocalizedOptions
  onChange: (data: any) => void
}) {
  const pairs = options?.pairs || []

  const addPair = () => {
    onChange({
      options: {
        pairs: [...pairs, { id: crypto.randomUUID(), left: '', right: '' }],
      },
    })
  }

  const updatePair = (id: string, field: 'left' | 'right', value: string) => {
    onChange({
      options: {
        pairs: pairs.map((p: any) =>
          p.id === id ? { ...p, [field]: value } : p
        ),
      },
    })
  }

  const updatePairEs = (id: string, field: 'left' | 'right', value: string) => {
    onChange({ options_es: patchLocalizedEntry(optionsEs, 'pairs', id, { [field]: value }) })
  }

  const removePair = (id: string) => {
    const remaining = pairs.filter((p: any) => p.id !== id)
    onChange({
      options: { pairs: remaining },
      options_es: pruneLocalizedEntries(optionsEs, 'pairs', remaining.map((p: { id: string }) => p.id)),
    })
  }

  return (
    <div className="space-y-3">
      <Label>Matching Pairs</Label>
      <div className="grid grid-cols-2 gap-2 text-sm font-medium text-muted-foreground mb-2">
        <span>Left Column</span>
        <span>Right Column (Correct Match)</span>
      </div>
      {pairs.map((pair: any) => (
        <div key={pair.id} className="space-y-1.5">
          <div className="flex gap-2 items-center">
            <Input
              value={pair.left}
              onChange={(e) => updatePair(pair.id, 'left', e.target.value)}
              placeholder="Left item"
              className="flex-1"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              value={pair.right}
              onChange={(e) => updatePair(pair.id, 'right', e.target.value)}
              placeholder="Right item"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removePair(pair.id)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <span className="w-5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">ES</span>
            <Input
              value={readLocalizedField(optionsEs, 'pairs', pair.id, 'left')}
              onChange={(e) => updatePairEs(pair.id, 'left', e.target.value)}
              placeholder="Izquierda (Español, opcional)"
              className="flex-1 border-dashed"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              value={readLocalizedField(optionsEs, 'pairs', pair.id, 'right')}
              onChange={(e) => updatePairEs(pair.id, 'right', e.target.value)}
              placeholder="Derecha (Español, opcional)"
              className="flex-1 border-dashed"
            />
            <span className="w-8" />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addPair}>
        <Plus className="w-4 h-4 mr-2" /> Add Pair
      </Button>
    </div>
  )
}

// Fill in the Blank Builder
function FillInBlankBuilder({
  options,
  optionsEs,
  onChange,
}: {
  options: any
  optionsEs: LocalizedOptions
  onChange: (data: any) => void
}) {
  const text = options?.text || ''
  const blanks = options?.blanks || []
  const textEs = typeof optionsEs?.text === 'string' ? optionsEs.text : ''

  const updateTextEs = (value: string) => {
    onChange({ options_es: { ...(optionsEs ?? {}), text: value } })
  }

  const updateBlankAnswerEs = (id: string, answer: string) => {
    onChange({ options_es: patchLocalizedEntry(optionsEs, 'blanks', id, { answer }) })
  }

  const updateText = (newText: string) => {
    // Extract blanks from text (format: {{blank_id}})
    const blankMatches = newText.match(/\{\{(\w+)\}\}/g) || []
    const blankIds = blankMatches.map((m) => m.replace(/[{}]/g, ''))

    // Keep existing blanks that are still in text, add new ones
    const updatedBlanks = blankIds.map((id) => {
      const existing = blanks.find((b: any) => b.id === id)
      return existing || { id, answer: '' }
    })

    onChange({
      options: {
        text: newText,
        blanks: updatedBlanks,
      },
    })
  }

  const updateBlankAnswer = (id: string, answer: string) => {
    onChange({
      options: {
        text,
        blanks: blanks.map((b: any) => (b.id === id ? { ...b, answer } : b)),
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label>Text with Blanks</Label>
        <Textarea
          value={text}
          onChange={(e) => updateText(e.target.value)}
          rows={3}
          placeholder="Use {{blank1}} for blanks. Example: The capital of France is {{capital}}."
        />
        <p className="text-xs text-muted-foreground">
          Use {"{{blank_name}}"} to create blanks. Example: The {"{{instrument}}"} is
          a percussion instrument.
        </p>
      </div>

      <div className="grid gap-2">
        <Label className="text-muted-foreground">Text with Blanks (Español)</Label>
        <Textarea
          value={textEs}
          onChange={(e) => updateTextEs(e.target.value)}
          rows={3}
          className="border-dashed"
          placeholder="Usa los mismos {{blank_name}} que en inglés. Ejemplo: La {{instrument}} es un instrumento de percusión."
        />
      </div>

      {blanks.length > 0 && (
        <div className="space-y-2">
          <Label>Correct Answers for Blanks</Label>
          {blanks.map((blank: any) => (
            <div key={blank.id} className="space-y-1.5">
              <div className="flex gap-2 items-center">
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[100px]">
                  {blank.id}
                </span>
                <Input
                  value={blank.answer}
                  onChange={(e) => updateBlankAnswer(blank.id, e.target.value)}
                  placeholder="Correct answer"
                  className="flex-1"
                />
              </div>
              <EsField
                value={readLocalizedField(optionsEs, 'blanks', blank.id, 'answer')}
                onChange={(v) => updateBlankAnswerEs(blank.id, v)}
                placeholder="Respuesta en español (opcional, si difiere)"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Ordering/Sequence Builder
function OrderingSequenceBuilder({
  options,
  optionsEs,
  onChange,
}: {
  options: any
  optionsEs: LocalizedOptions
  onChange: (data: any) => void
}) {
  const items = options?.items || []

  const updateItemEs = (id: string, text: string) => {
    onChange({ options_es: patchLocalizedEntry(optionsEs, 'items', id, { text }) })
  }

  const addItem = () => {
    const newPosition = items.length
    onChange({
      options: {
        items: [
          ...items,
          { id: crypto.randomUUID(), text: '', correctPosition: newPosition },
        ],
      },
    })
  }

  const updateItem = (id: string, text: string) => {
    onChange({
      options: {
        items: items.map((item: any) =>
          item.id === id ? { ...item, text } : item
        ),
      },
    })
  }

  const removeItem = (id: string) => {
    const newItems = items
      .filter((item: any) => item.id !== id)
      .map((item: any, index: number) => ({ ...item, correctPosition: index }))
    onChange({
      options: {
        items: newItems,
      },
      options_es: pruneLocalizedEntries(optionsEs, 'items', newItems.map((item: { id: string }) => item.id)),
    })
  }

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const index = items.findIndex((item: any) => item.id === id)
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === items.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const newItems = [...items]
    const [removed] = newItems.splice(index, 1)
    newItems.splice(newIndex, 0, removed)

    // Update correct positions
    const updatedItems = newItems.map((item: any, i: number) => ({
      ...item,
      correctPosition: i,
    }))

    onChange({
      options: {
        items: updatedItems,
      },
    })
  }

  return (
    <div className="space-y-3">
      <Label>Items in Correct Order (drag to reorder)</Label>
      <p className="text-xs text-muted-foreground">
        Add items in the correct order. Students will see them shuffled and need
        to put them back in order.
      </p>
      {items.map((item: any, index: number) => (
        <div key={item.id} className="space-y-1.5">
          <div className="flex gap-2 items-center">
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => moveItem(item.id, 'up')}
                disabled={index === 0}
                className="h-6 w-6 p-0"
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => moveItem(item.id, 'down')}
                disabled={index === items.length - 1}
                className="h-6 w-6 p-0"
              >
                ↓
              </Button>
            </div>
            <span className="text-sm font-medium w-6">{index + 1}.</span>
            <Input
              value={item.text}
              onChange={(e) => updateItem(item.id, e.target.value)}
              placeholder={`Step ${index + 1}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(item.id)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="pl-8">
            <EsField
              value={readLocalizedField(optionsEs, 'items', item.id, 'text')}
              onChange={(v) => updateItemEs(item.id, v)}
              placeholder={`Paso ${index + 1} (Español, opcional)`}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <Plus className="w-4 h-4 mr-2" /> Add Item
      </Button>
    </div>
  )
}

// True/False Builder
function TrueFalseBuilder({
  correctAnswer,
  onChange,
}: {
  correctAnswer: string
  onChange: (data: any) => void
}) {
  return (
    <div className="space-y-3">
      <Label>Correct Answer</Label>
      <RadioGroup
        value={correctAnswer}
        onValueChange={(value) => onChange({ correct_answer: value })}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="true" id="true" />
          <Label htmlFor="true" className="font-normal">
            True
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="false" id="false" />
          <Label htmlFor="false" className="font-normal">
            False
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}

// Text Answer Builder
function TextAnswerBuilder({
  correctAnswer,
  onChange,
}: {
  correctAnswer: string
  onChange: (data: any) => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="correct_answer">Correct Answer</Label>
      <Input
        id="correct_answer"
        value={correctAnswer}
        onChange={(e) => onChange({ correct_answer: e.target.value })}
        placeholder="Enter the correct answer"
      />
      <p className="text-xs text-muted-foreground">
        Student answers will be compared to this text (case-insensitive).
      </p>
    </div>
  )
}

// Audio — Listen & Choose Builder
// Author uploads a prompt clip; answer choices are either text or audio clips.
function AudioChoiceBuilder({
  questionId,
  options,
  optionsEs,
  correctAnswer,
  audioUrl,
  onChange,
}: {
  questionId: string
  options: any
  optionsEs: LocalizedOptions
  correctAnswer: string
  audioUrl: string
  onChange: (data: any) => void
}) {
  const mode: 'text' | 'audio' = options?.optionMode ?? 'text'
  const choices = options?.choices ?? []

  const setOptions = (next: { optionMode?: 'text' | 'audio'; choices?: any[] }, extra: Record<string, unknown> = {}) => {
    onChange({ options: { optionMode: mode, choices, ...next }, ...extra })
  }

  const addChoice = () => setOptions({ choices: [...choices, { id: crypto.randomUUID(), text: '', audioUrl: '' }] })
  const updateChoice = (id: string, patch: any) =>
    setOptions({ choices: choices.map((c: any) => (c.id === id ? { ...c, ...patch } : c)) })
  const updateChoiceEs = (id: string, text: string) =>
    onChange({ options_es: patchLocalizedEntry(optionsEs, 'choices', id, { text }) })
  const removeChoice = (id: string) => {
    const remaining = choices.filter((c: any) => c.id !== id)
    setOptions(
      { choices: remaining },
      { options_es: pruneLocalizedEntries(optionsEs, 'choices', remaining.map((c: { id: string }) => c.id)) }
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Prompt clip (students listen to this)</Label>
        <QuizMediaUpload
          kind="audio"
          slug={`${questionId}-prompt`}
          value={audioUrl}
          onChange={(url) => onChange({ audio_url: url || null })}
        />
      </div>

      <div className="grid gap-2">
        <Label>Answer choices are…</Label>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setOptions({ optionMode: v as 'text' | 'audio' })}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id={`${questionId}-mode-text`} />
            <Label htmlFor={`${questionId}-mode-text`} className="font-normal">Text</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="audio" id={`${questionId}-mode-audio`} />
            <Label htmlFor={`${questionId}-mode-audio`} className="font-normal">Audio clips</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label>Choices (select the correct one)</Label>
        {choices.map((choice: any, index: number) => (
          <div key={choice.id} className="flex items-start gap-2">
            <input
              type="radio"
              name={`correct-${questionId}`}
              checked={correctAnswer === choice.id}
              onChange={() => onChange({ correct_answer: choice.id })}
              className="mt-3 h-4 w-4"
            />
            <div className="flex-1 space-y-2">
              <Input
                value={choice.text ?? ''}
                onChange={(e) => updateChoice(choice.id, { text: e.target.value })}
                placeholder={mode === 'audio' ? `Optional label for clip ${index + 1}` : `Option ${index + 1}`}
              />
              <div className="-ml-6">
                <EsField
                  value={readLocalizedField(optionsEs, 'choices', choice.id, 'text')}
                  onChange={(v) => updateChoiceEs(choice.id, v)}
                  placeholder={mode === 'audio' ? `Etiqueta del clip ${index + 1} (Español, opcional)` : `Opción ${index + 1} (Español, opcional)`}
                />
              </div>
              {mode === 'audio' && (
                <QuizMediaUpload
                  kind="audio"
                  slug={`${questionId}-choice-${choice.id}`}
                  value={choice.audioUrl ?? ''}
                  onChange={(url) => updateChoice(choice.id, { audioUrl: url })}
                  compact
                />
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeChoice(choice.id)} className="mt-1 h-8 w-8 p-0">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addChoice}>
          <Plus className="mr-2 h-4 w-4" /> Add Choice
        </Button>
      </div>
    </div>
  )
}
