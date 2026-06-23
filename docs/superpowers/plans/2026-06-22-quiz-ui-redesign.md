# Quiz UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely redesign the in-course `QuizRunner` UI to be vibrant, playful, and intuitive while preserving all data shapes, grading logic, props, and completion behavior.

**Architecture:** Extract the pure grading/answer logic into a tested `lib/quiz/grading.ts` module, then rewrite `quiz-runner.tsx` as a presentation/interaction layer composed of small focused sub-components under `components/class-viewer/lesson-viewer/quiz/`. Uses `framer-motion` (already installed) for transitions, feedback, confetti, and a count-up score ring. No backend/schema/server-action changes.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS (HSL token theme) · framer-motion v12 · lucide-react · vitest (pure-logic tests only; no DOM test infra).

## Global Constraints

- **Props unchanged:** `QuizRunner` keeps `{ classItemId: string; questions: QuizQuestion[]; kind?: 'Quiz' | 'Exercise' }`.
- **Data types unchanged:** `QuizQuestion`, `QuestionType`, all `*Options` shapes in `types/modules.ts`. No edits to that file.
- **Grading behavior unchanged:** identical results for all 7 types (multiple_choice, true_false, text_answer, audio, fill_in_blank, matching_pairs, ordering_sequence).
- **Completion unchanged:** call `markClassItemComplete(classItemId)` once when the student reaches the end.
- **Stable shuffle** seeded by question id preserved for matching_pairs right-choices and ordering_sequence seed order.
- **No new dependencies.** Use only what is already in `package.json`.
- **Theme tokens:** use existing CSS-var tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary`, `bg-muted`, etc.) so light + dark both work. For raw SVG strokes use `hsl(var(--border))`.
- **Reduced motion:** wrap animated tree in `<MotionConfig reducedMotion="user">`.
- **Accessibility:** answer options are real `<button>`s; keyboard support `1`–`4`/`A`–`D` select, `Enter` checks then advances, `←`/`→` navigate; `T`/`F` for true/false.

---

### Task 1: Extract pure grading logic into a tested module

**Files:**
- Create: `lib/quiz/grading.ts`
- Test: `lib/quiz/__tests__/grading.test.ts`

**Interfaces:**
- Consumes: `QuizQuestion` from `@/types/modules`.
- Produces:
  - `type Choice = { id: string; text: string }`
  - `type Pair = { id: string; left: string; right: string }`
  - `type Blank = { id: string; answer: string }`
  - `type OrderItem = { id: string; text: string; correctPosition: number }`
  - `norm(s: string): string`
  - `shuffleStable<T>(arr: T[], seed: string): T[]`
  - `gradeQuestion(q: QuizQuestion, answer: unknown): boolean`
  - `hasAnswer(q: QuizQuestion, answer: unknown): boolean`

- [ ] **Step 1: Write the failing test**

Create `lib/quiz/__tests__/grading.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { gradeQuestion, hasAnswer, shuffleStable, norm } from '../grading'
import type { QuizQuestion } from '@/types/modules'

function q(partial: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q1',
    class_item_id: 'c1',
    order_index: 0,
    question: 'Q',
    question_type: 'multiple_choice',
    options: null,
    correct_answer: null,
    explanation: null,
    question_es: null,
    explanation_es: null,
    options_es: null,
    created_at: null,
    updated_at: null,
    ...partial,
  }
}

describe('norm', () => {
  it('lowercases and trims', () => {
    expect(norm('  HeLLo ')).toBe('hello')
  })
})

describe('shuffleStable', () => {
  it('is deterministic for a given seed', () => {
    const a = shuffleStable([1, 2, 3, 4, 5], 'seed')
    const b = shuffleStable([1, 2, 3, 4, 5], 'seed')
    expect(a).toEqual(b)
  })
  it('preserves all elements', () => {
    expect([...shuffleStable([1, 2, 3], 'x')].sort()).toEqual([1, 2, 3])
  })
})

describe('gradeQuestion', () => {
  it('multiple_choice: correct when answer id matches correct_answer', () => {
    const question = q({ question_type: 'multiple_choice', correct_answer: 'b', options: { choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] } })
    expect(gradeQuestion(question, 'b')).toBe(true)
    expect(gradeQuestion(question, 'a')).toBe(false)
    expect(gradeQuestion(question, undefined)).toBe(false)
  })

  it('true_false: case-insensitive match to correct_answer', () => {
    const question = q({ question_type: 'true_false', correct_answer: 'true' })
    expect(gradeQuestion(question, 'true')).toBe(true)
    expect(gradeQuestion(question, 'TRUE')).toBe(true)
    expect(gradeQuestion(question, 'false')).toBe(false)
  })

  it('text_answer and audio: normalized string match', () => {
    const t = q({ question_type: 'text_answer', correct_answer: 'Dorian' })
    expect(gradeQuestion(t, ' dorian ')).toBe(true)
    expect(gradeQuestion(t, 'phrygian')).toBe(false)
    const a = q({ question_type: 'audio', correct_answer: 'C major' })
    expect(gradeQuestion(a, 'c MAJOR')).toBe(true)
  })

  it('fill_in_blank: all blanks must match', () => {
    const question = q({ question_type: 'fill_in_blank', options: { text: '{{x}} and {{y}}', blanks: [{ id: 'x', answer: 'one' }, { id: 'y', answer: 'two' }] } })
    expect(gradeQuestion(question, { x: 'ONE', y: ' two ' })).toBe(true)
    expect(gradeQuestion(question, { x: 'one', y: 'three' })).toBe(false)
    expect(gradeQuestion(question, { x: 'one' })).toBe(false)
  })

  it('matching_pairs: each left maps to its right text', () => {
    const question = q({ question_type: 'matching_pairs', options: { pairs: [{ id: 'l1', left: 'A', right: 'Alpha' }, { id: 'l2', left: 'B', right: 'Beta' }] } })
    expect(gradeQuestion(question, { l1: 'Alpha', l2: 'Beta' })).toBe(true)
    expect(gradeQuestion(question, { l1: 'Beta', l2: 'Alpha' })).toBe(false)
  })

  it('ordering_sequence: ids must land in correctPosition order', () => {
    const question = q({ question_type: 'ordering_sequence', options: { items: [{ id: 'a', text: 'A', correctPosition: 0 }, { id: 'b', text: 'B', correctPosition: 1 }, { id: 'c', text: 'C', correctPosition: 2 }] } })
    expect(gradeQuestion(question, ['a', 'b', 'c'])).toBe(true)
    expect(gradeQuestion(question, ['b', 'a', 'c'])).toBe(false)
    expect(gradeQuestion(question, ['a', 'b'])).toBe(false)
  })
})

describe('hasAnswer', () => {
  it('multiple_choice needs a non-empty string', () => {
    const question = q({ question_type: 'multiple_choice' })
    expect(hasAnswer(question, 'a')).toBe(true)
    expect(hasAnswer(question, '')).toBe(false)
    expect(hasAnswer(question, undefined)).toBe(false)
  })
  it('fill_in_blank needs at least one entry', () => {
    const question = q({ question_type: 'fill_in_blank' })
    expect(hasAnswer(question, { x: 'a' })).toBe(true)
    expect(hasAnswer(question, {})).toBe(false)
  })
  it('ordering_sequence always has an order', () => {
    expect(hasAnswer(q({ question_type: 'ordering_sequence' }), undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/quiz/__tests__/grading.test.ts`
Expected: FAIL — cannot resolve `../grading` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/quiz/grading.ts`:

```ts
import type { QuizQuestion } from '@/types/modules'

export type Choice = { id: string; text: string }
export type Pair = { id: string; left: string; right: string }
export type Blank = { id: string; answer: string }
export type OrderItem = { id: string; text: string; correctPosition: number }

export function norm(s: string): string {
  return s.toLowerCase().trim()
}

/** Stable shuffle seeded by a string so option order doesn't reshuffle on every render. */
export function shuffleStable<T>(arr: T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const j = h % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Grade a single question against the student's answer. Behavior preserved from the original QuizRunner. */
export function gradeQuestion(q: QuizQuestion, answer: unknown): boolean {
  const opts = (q.options ?? {}) as Record<string, unknown>
  switch (q.question_type) {
    case 'multiple_choice':
      return typeof answer === 'string' && !!q.correct_answer && answer === q.correct_answer
    case 'true_false':
      return typeof answer === 'string' && norm(answer) === norm(q.correct_answer ?? '')
    case 'text_answer':
    case 'audio':
      return typeof answer === 'string' && norm(answer) === norm(q.correct_answer ?? '')
    case 'fill_in_blank': {
      const blanks = (opts.blanks as Blank[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      return blanks.length > 0 && blanks.every((b) => norm(given[b.id] ?? '') === norm(b.answer))
    }
    case 'matching_pairs': {
      const pairs = (opts.pairs as Pair[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      return pairs.length > 0 && pairs.every((p) => norm(given[p.id] ?? '') === norm(p.right))
    }
    case 'ordering_sequence': {
      const items = (opts.items as OrderItem[]) ?? []
      const order = (answer as string[]) ?? []
      if (order.length !== items.length || items.length === 0) return false
      const byId = new Map(items.map((it) => [it.id, it]))
      return order.every((id, idx) => byId.get(id)?.correctPosition === idx)
    }
    default:
      return false
  }
}

/** Whether the student has provided enough of an answer to allow grading. */
export function hasAnswer(q: QuizQuestion, answer: unknown): boolean {
  if (q.question_type === 'fill_in_blank' || q.question_type === 'matching_pairs') {
    return !!answer && Object.keys(answer as object).length > 0
  }
  if (q.question_type === 'ordering_sequence') return true
  return typeof answer === 'string' && answer.trim().length > 0
}

/** Friendly label for the correct answer, used on the results review. */
export function correctAnswerLabel(q: QuizQuestion): string {
  const opts = (q.options ?? {}) as Record<string, unknown>
  if (q.question_type === 'multiple_choice') {
    const choices = (opts.choices as Choice[]) ?? []
    return choices.find((c) => c.id === q.correct_answer)?.text ?? q.correct_answer ?? ''
  }
  return q.correct_answer ?? ''
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/quiz/__tests__/grading.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/quiz/grading.ts lib/quiz/__tests__/grading.test.ts
git commit -m "feat: extract tested quiz grading module"
```

---

### Task 2: Presentational atoms (confetti, score ring, progress, feedback, option tile)

**Files:**
- Create: `components/class-viewer/lesson-viewer/quiz/confetti.tsx`
- Create: `components/class-viewer/lesson-viewer/quiz/score-ring.tsx`
- Create: `components/class-viewer/lesson-viewer/quiz/progress-segments.tsx`
- Create: `components/class-viewer/lesson-viewer/quiz/feedback-banner.tsx`
- Create: `components/class-viewer/lesson-viewer/quiz/option-tile.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`; `framer-motion`; `lucide-react`.
- Produces:
  - `Confetti({ count?: number })`
  - `ScoreRing({ pct: number; size?: number; stroke?: number })`
  - `ProgressSegments({ total: number; current: number })`
  - `FeedbackBanner({ correct: boolean; explanation?: string | null })`
  - `type TileState = 'idle' | 'selected' | 'correct' | 'incorrect'`
  - `OptionTile({ label?: string; children: ReactNode; state: TileState; disabled?: boolean; onClick?: () => void })`

- [ ] **Step 1: Create `confetti.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'

const COLORS = ['#f59e0b', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa']

/** Deterministic framer-motion confetti burst. No randomness so it is SSR-safe. */
export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: ((i * 71) % 100) + (((i * 37) % 11) - 5) / 10,
        delay: ((i * 53) % 45) / 100,
        duration: 1.6 + ((i * 29) % 90) / 100,
        rotate: (i * 91) % 360,
        color: COLORS[i % COLORS.length],
        size: 6 + ((i * 17) % 8),
      })),
    [count],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block rounded-[2px]"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.6, backgroundColor: p.color }}
          initial={{ y: '-12%', opacity: 0, rotate: 0 }}
          animate={{ y: '120%', opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `score-ring.tsx`**

```tsx
'use client'

import { animate } from 'framer-motion'
import { useEffect, useState } from 'react'

/** SVG progress ring that counts up to `pct` on mount. */
export function ScoreRing({ pct, size = 168, stroke = 14 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(0, pct, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    })
    return () => controls.stop()
  }, [pct])

  const offset = circumference - (display / 100) * circumference
  const tone = pct >= 80 ? 'hsl(145 55% 42%)' : pct >= 50 ? 'hsl(30 85% 55%)' : 'hsl(0 72% 55%)'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl font-black tabular-nums">{display}%</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `progress-segments.tsx`**

```tsx
'use client'

import { cn } from '@/lib/utils'

/** Segmented progress bar — one segment per question. */
export function ProgressSegments({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                i < current && 'w-full bg-primary',
                i === current && 'w-full bg-primary/40',
                i > current && 'w-0',
              )}
            />
          </div>
        ))}
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {Math.min(current + 1, total)} / {total}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Create `feedback-banner.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FeedbackBanner({ correct, explanation }: { correct: boolean; explanation?: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex items-start gap-3 rounded-2xl border-2 p-4',
        correct ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10',
      )}
    >
      {correct ? (
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
      ) : (
        <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
      )}
      <div>
        <p className={cn('font-bold', correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
          {correct ? 'Correct!' : 'Not quite right'}
        </p>
        {explanation && <p className="mt-1 text-sm text-muted-foreground">{explanation}</p>}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 5: Create `option-tile.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TileState = 'idle' | 'selected' | 'correct' | 'incorrect'

/** Large tappable answer tile with an optional letter badge and graded states. */
export function OptionTile({
  label,
  children,
  state,
  disabled,
  onClick,
}: {
  label?: string
  children: ReactNode
  state: TileState
  disabled?: boolean
  onClick?: () => void
}) {
  const isWrong = state === 'incorrect'
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      animate={isWrong ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: isWrong ? 0.4 : 0.2 }}
      aria-pressed={state === 'selected'}
      className={cn(
        'group flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all disabled:cursor-default',
        state === 'idle' && 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5',
        state === 'selected' && 'border-primary bg-primary/10 ring-2 ring-primary/30',
        state === 'correct' && 'border-green-500 bg-green-500/10',
        state === 'incorrect' && 'border-red-500 bg-red-500/10',
      )}
    >
      {label && (
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-bold transition-colors',
            state === 'idle' && 'border-border text-muted-foreground group-hover:border-primary/50',
            state === 'selected' && 'border-primary bg-primary text-primary-foreground',
            state === 'correct' && 'border-green-500 bg-green-500 text-white',
            state === 'incorrect' && 'border-red-500 bg-red-500 text-white',
          )}
        >
          {state === 'correct' ? <Check className="h-5 w-5" /> : state === 'incorrect' ? <X className="h-5 w-5" /> : label}
        </span>
      )}
      <span className="flex-1 text-base font-medium">{children}</span>
    </motion.button>
  )
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors introduced by the new files).

- [ ] **Step 7: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/
git commit -m "feat: quiz presentational atoms (confetti, ring, progress, feedback, tile)"
```

---

### Task 3: Per-type question input widgets

**Files:**
- Create: `components/class-viewer/lesson-viewer/quiz/question-input.tsx`

**Interfaces:**
- Consumes: `OptionTile`/`TileState` (Task 2); `shuffleStable`, `norm`, `Choice`, `Pair`, `Blank`, `OrderItem` from `@/lib/quiz/grading` (Task 1); `Input`, `Select*` from `@/components/ui/*`; `QuizQuestion` from `@/types/modules`.
- Produces: `QuestionInput({ question: QuizQuestion; answer: unknown; isGraded: boolean; onChange: (v: unknown) => void })`.

- [ ] **Step 1: Create `question-input.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { norm, shuffleStable, type Blank, type Choice, type OrderItem, type Pair } from '@/lib/quiz/grading'
import type { QuizQuestion } from '@/types/modules'
import { OptionTile, type TileState } from './option-tile'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export function QuestionInput({
  question: q,
  answer,
  isGraded,
  onChange,
}: {
  question: QuizQuestion
  answer: unknown
  isGraded: boolean
  onChange: (v: unknown) => void
}) {
  const opts = (q.options ?? {}) as Record<string, unknown>

  switch (q.question_type) {
    case 'multiple_choice': {
      const choices = (opts.choices as Choice[]) ?? []
      return (
        <div className="space-y-3">
          {choices.map((c, i) => {
            const selected = answer === c.id
            let state: TileState = selected ? 'selected' : 'idle'
            if (isGraded) state = q.correct_answer === c.id ? 'correct' : selected ? 'incorrect' : 'idle'
            return (
              <OptionTile key={c.id} label={LETTERS[i]} state={state} disabled={isGraded} onClick={() => onChange(c.id)}>
                {c.text}
              </OptionTile>
            )
          })}
        </div>
      )
    }

    case 'true_false': {
      const values = [
        { v: 'true', label: 'True' },
        { v: 'false', label: 'False' },
      ]
      return (
        <div className="grid grid-cols-2 gap-3">
          {values.map(({ v, label }) => {
            const selected = norm(String(answer ?? '')) === v
            let state: TileState = selected ? 'selected' : 'idle'
            if (isGraded) state = norm(q.correct_answer ?? '') === v ? 'correct' : selected ? 'incorrect' : 'idle'
            return (
              <OptionTile key={v} state={state} disabled={isGraded} onClick={() => onChange(v)}>
                <span className="block w-full text-center text-lg font-semibold">{label}</span>
              </OptionTile>
            )
          })}
        </div>
      )
    }

    case 'text_answer':
    case 'audio':
      return (
        <Input
          className="h-12 rounded-xl text-base"
          placeholder={q.question_type === 'audio' ? 'Type what you hear…' : 'Type your answer…'}
          value={(answer as string) ?? ''}
          disabled={isGraded}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'fill_in_blank': {
      const blanks = (opts.blanks as Blank[]) ?? []
      const text = (opts.text as string) ?? ''
      const given = (answer as Record<string, string>) ?? {}
      const blankById = new Map(blanks.map((b) => [b.id, b]))

      if (text && /\{\{(\w+)\}\}/.test(text)) {
        const parts = text.split(/(\{\{\w+\}\})/g)
        return (
          <p className="text-lg leading-loose">
            {parts.map((part, i) => {
              const m = part.match(/^\{\{(\w+)\}\}$/)
              if (!m) return <span key={i}>{part}</span>
              const id = m[1]
              const b = blankById.get(id)
              const val = given[id] ?? ''
              const ok = isGraded && b && norm(val) === norm(b.answer)
              return (
                <input
                  key={i}
                  value={val}
                  disabled={isGraded}
                  onChange={(e) => onChange({ ...given, [id]: e.target.value })}
                  placeholder="…"
                  className={cn(
                    'mx-1 inline-block w-32 rounded-lg border-b-2 bg-primary/5 px-2 py-0.5 text-center font-semibold outline-none focus:border-primary',
                    isGraded ? (ok ? 'border-green-500 text-green-700 dark:text-green-400' : 'border-red-500 text-red-700 dark:text-red-400') : 'border-primary/40',
                  )}
                />
              )
            })}
          </p>
        )
      }

      // Fallback: labeled inputs when there is no placeholder text.
      return (
        <div className="space-y-3">
          {blanks.map((b) => {
            const val = given[b.id] ?? ''
            const ok = isGraded && norm(val) === norm(b.answer)
            return (
              <div key={b.id} className="flex items-center gap-3">
                <span className="min-w-[90px] rounded-lg bg-muted px-2 py-1 font-mono text-xs">{b.id}</span>
                <Input
                  value={val}
                  disabled={isGraded}
                  onChange={(e) => onChange({ ...given, [b.id]: e.target.value })}
                  placeholder="Your answer"
                  className={cn('rounded-xl', isGraded && (ok ? 'border-green-500' : 'border-red-500'))}
                />
              </div>
            )
          })}
        </div>
      )
    }

    case 'matching_pairs': {
      const pairs = (opts.pairs as Pair[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      const rightChoices = shuffleStable(pairs.map((p) => p.right), q.id)
      return (
        <div className="space-y-3">
          {pairs.map((p) => {
            const val = given[p.id] ?? ''
            const ok = isGraded && norm(val) === norm(p.right)
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border-2 p-3 transition-colors',
                  isGraded ? (ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5') : 'border-border',
                )}
              >
                <span className="flex-1 font-medium">{p.left}</span>
                <span className="text-muted-foreground">→</span>
                <Select value={val} disabled={isGraded} onValueChange={(v) => onChange({ ...given, [p.id]: v })}>
                  <SelectTrigger className="flex-1 rounded-xl">
                    <SelectValue placeholder="Choose match" />
                  </SelectTrigger>
                  <SelectContent>
                    {rightChoices.map((r, i) => (
                      <SelectItem key={`${r}-${i}`} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      )
    }

    case 'ordering_sequence': {
      const items = (opts.items as OrderItem[]) ?? []
      const current = (answer as string[]) ?? items.map((it) => it.id)
      const byId = new Map(items.map((it) => [it.id, it]))
      const move = (from: number, dir: -1 | 1) => {
        const to = from + dir
        if (to < 0 || to >= current.length) return
        const next = [...current]
        ;[next[from], next[to]] = [next[to], next[from]]
        onChange(next)
      }
      return (
        <div className="space-y-2">
          {current.map((id, i) => {
            const it = byId.get(id)
            const ok = isGraded && it?.correctPosition === i
            return (
              <motion.div
                key={id}
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border-2 p-3',
                  isGraded ? (ok ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5') : 'border-border bg-card',
                )}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{it?.text}</span>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={isGraded || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isGraded || i === current.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )
    }

    default:
      return <p className="text-sm text-muted-foreground">Unsupported question type: {q.question_type}</p>
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/question-input.tsx
git commit -m "feat: redesigned per-type quiz question inputs"
```

---

### Task 4: Results screen

**Files:**
- Create: `components/class-viewer/lesson-viewer/quiz/results-screen.tsx`

**Interfaces:**
- Consumes: `ScoreRing`, `Confetti` (Task 2); `correctAnswerLabel` from `@/lib/quiz/grading` (Task 1); `Button` from `@/components/ui/button`; `QuizQuestion` from `@/types/modules`.
- Produces: `ResultsScreen({ kind: string; questions: QuizQuestion[]; graded: Record<string, boolean>; onRestart: () => void })`.

- [ ] **Step 1: Create `results-screen.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { correctAnswerLabel } from '@/lib/quiz/grading'
import type { QuizQuestion } from '@/types/modules'
import { Confetti } from './confetti'
import { ScoreRing } from './score-ring'

export function ResultsScreen({
  kind,
  questions,
  graded,
  onRestart,
}: {
  kind: string
  questions: QuizQuestion[]
  graded: Record<string, boolean>
  onRestart: () => void
}) {
  const correctCount = questions.filter((q) => graded[q.id]).length
  const pct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0
  const [open, setOpen] = useState<string | null>(null)

  const headline = pct >= 90 ? 'Perfect!' : pct >= 70 ? 'Great work!' : pct >= 50 ? 'Nice effort!' : 'Keep practicing'
  const sub =
    pct >= 90
      ? `You nailed this ${kind.toLowerCase()}.`
      : pct >= 70
        ? "You're getting the hang of it."
        : 'Review the answers below and try again.'

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10">
      {pct >= 80 && <Confetti />}

      <div className="relative flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <ScoreRing pct={pct} />
        </motion.div>
        <h2 className="mt-6 text-3xl font-black">{headline}</h2>
        <p className="mt-1 text-muted-foreground">{sub}</p>
        <p className="mt-4 text-sm font-semibold">
          <span className="text-primary">{correctCount}</span>
          <span className="text-muted-foreground"> / {questions.length} correct</span>
        </p>
      </div>

      <div className="relative mt-8 space-y-2">
        {questions.map((q, i) => {
          const isCorrect = !!graded[q.id]
          const isOpen = open === q.id
          const label = correctAnswerLabel(q)
          return (
            <div key={q.id} className="overflow-hidden rounded-2xl border border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : q.id)}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50"
              >
                {isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                )}
                <span className="flex-1 text-sm font-medium">
                  {i + 1}. {q.question}
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="border-t border-border bg-muted/30 p-4 text-sm">
                  {label && (
                    <p>
                      <span className="font-semibold text-muted-foreground">Correct answer: </span>
                      {label}
                    </p>
                  )}
                  {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
                  {!label && !q.explanation && <p className="text-muted-foreground">No additional details.</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Button onClick={onRestart} size="lg" className="relative mt-8 w-full rounded-xl">
        <RotateCcw className="mr-2 h-4 w-4" /> Try Again
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz/results-screen.tsx
git commit -m "feat: celebratory quiz results screen"
```

---

### Task 5: Rewrite the QuizRunner orchestrator

**Files:**
- Modify (full rewrite): `components/class-viewer/lesson-viewer/quiz-runner.tsx`

**Interfaces:**
- Consumes: `gradeQuestion`, `hasAnswer`, `shuffleStable`, `OrderItem` from `@/lib/quiz/grading`; `ProgressSegments`, `QuestionInput`, `FeedbackBanner`, `ResultsScreen` from `./quiz/*`; `markClassItemComplete` from `@/app/actions/progress`; `Button` from `@/components/ui/button`; `QuizQuestion` from `@/types/modules`.
- Produces: `QuizRunner({ classItemId, questions, kind })` — same exported name and props as before (drop-in for `class-item-renderer.tsx`).

- [ ] **Step 1: Replace the file contents**

Overwrite `components/class-viewer/lesson-viewer/quiz-runner.tsx` with:

```tsx
'use client'

import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { markClassItemComplete } from '@/app/actions/progress'
import { gradeQuestion, hasAnswer, shuffleStable, type OrderItem } from '@/lib/quiz/grading'
import type { QuizQuestion } from '@/types/modules'
import { FeedbackBanner } from './quiz/feedback-banner'
import { ProgressSegments } from './quiz/progress-segments'
import { QuestionInput } from './quiz/question-input'
import { ResultsScreen } from './quiz/results-screen'

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  text_answer: 'Short answer',
  audio: 'Listening',
  fill_in_blank: 'Fill in the blank',
  matching_pairs: 'Match the pairs',
  ordering_sequence: 'Put in order',
}

interface QuizRunnerProps {
  classItemId: string
  questions: QuizQuestion[]
  /** Label shown in the header — "Quiz" or "Exercise". */
  kind?: 'Quiz' | 'Exercise'
}

/** Seed ordering questions with a stable shuffled order so grading has a defined answer. */
function seedAnswers(questions: QuizQuestion[]): Record<string, unknown> {
  const init: Record<string, unknown> = {}
  for (const qq of questions) {
    if (qq.question_type === 'ordering_sequence') {
      const items = ((qq.options ?? {}) as Record<string, unknown>).items as OrderItem[] | undefined
      init[qq.id] = shuffleStable((items ?? []).map((it) => it.id), qq.id)
    }
  }
  return init
}

export function QuizRunner({ classItemId, questions, kind = 'Quiz' }: QuizRunnerProps) {
  const ordered = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions])
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => seedAnswers(questions))
  const [graded, setGraded] = useState<Record<string, boolean>>({})
  const [finished, setFinished] = useState(false)

  const q = ordered[index]
  const isGraded = q ? q.id in graded : false
  const answer = q ? answers[q.id] : undefined
  const canCheck = q ? hasAnswer(q, answer) : false
  const wasCorrect = q ? graded[q.id] : false

  const setAnswer = (value: unknown) => {
    if (q) setAnswers((prev) => ({ ...prev, [q.id]: value }))
  }

  const handleCheck = () => {
    if (!q || isGraded || !canCheck) return
    setGraded((prev) => ({ ...prev, [q.id]: gradeQuestion(q, answer) }))
  }

  const goNext = () => {
    if (index < ordered.length - 1) {
      setDirection(1)
      setIndex((i) => i + 1)
    } else {
      setFinished(true)
      void markClassItemComplete(classItemId).catch(() => {})
    }
  }

  const goPrev = () => {
    if (index > 0) {
      setDirection(-1)
      setIndex((i) => i - 1)
    }
  }

  const handleRestart = () => {
    setAnswers(seedAnswers(questions))
    setGraded({})
    setIndex(0)
    setDirection(1)
    setFinished(false)
  }

  // Keyboard shortcuts: 1-4/A-D select, Enter check/next, arrows navigate, T/F for true-false.
  useEffect(() => {
    if (finished || !q) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === 'Enter') {
        e.preventDefault()
        if (isGraded) goNext()
        else handleCheck()
        return
      }
      if (inField) return
      if (e.key === 'ArrowLeft') {
        goPrev()
      } else if (e.key === 'ArrowRight' && isGraded) {
        goNext()
      } else if (!isGraded && q.question_type === 'multiple_choice') {
        const choices = ((q.options ?? {}) as { choices?: { id: string }[] }).choices ?? []
        const idx = /^[1-9]$/.test(e.key)
          ? Number(e.key) - 1
          : /^[a-h]$/i.test(e.key)
            ? e.key.toLowerCase().charCodeAt(0) - 97
            : -1
        if (idx >= 0 && idx < choices.length) setAnswer(choices[idx].id)
      } else if (!isGraded && q.question_type === 'true_false') {
        if (e.key.toLowerCase() === 't') setAnswer('true')
        if (e.key.toLowerCase() === 'f') setAnswer('false')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, isGraded, finished, answer, index, canCheck])

  if (ordered.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card py-10 text-center text-muted-foreground">
        This {kind.toLowerCase()} has no questions yet.
      </div>
    )
  }

  if (finished) {
    return (
      <MotionConfig reducedMotion="user">
        <ResultsScreen kind={kind} questions={ordered} graded={graded} onRestart={handleRestart} />
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-6">
          <ProgressSegments total={ordered.length} current={index} />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                {TYPE_LABELS[q.question_type] ?? kind}
              </span>
              <h3 className="text-xl font-bold leading-snug sm:text-2xl">{q.question}</h3>
            </div>

            <QuestionInput question={q} answer={answer} isGraded={isGraded} onChange={setAnswer} />

            {isGraded && <FeedbackBanner correct={!!wasCorrect} explanation={q.explanation} />}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={goPrev} disabled={index === 0} className="rounded-xl">
            <ArrowLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          {!isGraded ? (
            <Button onClick={handleCheck} disabled={!canCheck} size="lg" className="rounded-xl px-8">
              <Check className="mr-1 h-4 w-4" /> Check Answer
            </Button>
          ) : (
            <Button onClick={goNext} size="lg" className="rounded-xl px-8">
              {index < ordered.length - 1 ? 'Next' : 'Finish'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </MotionConfig>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Lint the changed files**

Run: `npx eslint components/class-viewer/lesson-viewer/quiz-runner.tsx components/class-viewer/lesson-viewer/quiz lib/quiz`
Expected: no errors (warnings acceptable).

- [ ] **Step 4: Commit**

```bash
git add components/class-viewer/lesson-viewer/quiz-runner.tsx
git commit -m "feat: redesign QuizRunner UI (vibrant, animated, intuitive)"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the grading tests**

Run: `npx vitest run lib/quiz`
Expected: PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors and no missing-module errors for the quiz files.

- [ ] **Step 3: Manual verification matrix**

Run `npm run dev`, open a course lesson containing a quiz and an exercise, and confirm:
- Each question type renders and is answerable: multiple_choice, true_false, text_answer, audio, fill_in_blank (inline chips), matching_pairs, ordering_sequence.
- Check Answer reveals correct/incorrect; wrong MCQ shakes the chosen tile and highlights the correct one green; feedback banner shows explanation.
- Progress segments fill as you advance; Previous/Next work; question transitions slide.
- Keyboard: number/letter keys select an MCQ option, `Enter` checks then advances, `←`/`→` navigate, `T`/`F` pick true/false.
- Finishing shows the results screen: score ring counts up, headline matches score, confetti appears only when score ≥ 80%, review rows expand to show correct answer + explanation, Try Again resets.
- Works with both `kind="Quiz"` and `kind="Exercise"`.
- Toggle dark mode — colors remain legible.
- Confirm completion: finishing marks the class item complete (progress persists on reload).

- [ ] **Step 4: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "fix: quiz redesign verification tweaks"
```

---

## Self-Review

**Spec coverage:** structure/progress (Task 2/5) · vibrant tiles & visual language (Task 2/3) · per-type micro-interactions incl. inline fill-blank, animated ordering (Task 3) · immediate feedback with reveal + shake (Task 3/5) · celebratory results with count-up ring + ≥80% confetti + expandable review (Task 4) · keyboard + reduced-motion + a11y (Task 5) · unchanged props/types/grading/completion (Task 1 + Global Constraints) · no new deps (Global Constraints). All spec sections map to a task.

**Placeholder scan:** none — all steps contain full code or exact commands.

**Type consistency:** `TileState`, `QuestionInput`, `ResultsScreen`, `ProgressSegments`, `FeedbackBanner`, `ScoreRing`, `Confetti`, `correctAnswerLabel`, `seedAnswers`, `gradeQuestion`, `hasAnswer`, `shuffleStable` signatures are defined once and consumed with matching names/params across tasks.
