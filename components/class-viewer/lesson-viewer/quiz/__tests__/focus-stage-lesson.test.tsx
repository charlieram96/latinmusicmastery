// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTranslation } from '@/lib/i18n'
import type { QuizQuestion } from '@/types/modules'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params) }),
}))
vi.mock('@/lib/quiz/sounds', () => ({ playCue: vi.fn() }))
vi.mock('@/hooks/use-quiz-prefs', () => ({ useQuizPrefs: () => [{ sound: false }, vi.fn()] }))

import { FocusStage } from '../focus-stage'
import { QuizRunner } from '../../quiz-runner'
import { useQuizEngine } from '@/hooks/use-quiz-engine'
import { LessonFrameProvider, useActionClaims } from '../../lesson-mode/lesson-frame'
import { LessonActionBar } from '../../lesson-mode/lesson-action-bar'

const question = (id: string, correct: string): QuizQuestion => ({
  id, class_item_id: 'c', order_index: 0, question: `Is the clave a repeating pattern? (${id})`, question_type: 'true_false', options: null,
  correct_answer: correct, explanation: 'The clave repeats every two bars.', question_es: null, explanation_es: null, options_es: null,
  audio_url: null, image_url: null, created_at: null, updated_at: null,
})
const questions = [question('q1', 'true'), question('q2', 'false')]

function Stage({ onFinish = () => {} }: { onFinish?: () => void }) {
  const engine = useQuizEngine(questions)
  return <FocusStage questions={questions} engine={engine} kindLabel="Quiz" title="Clave check" onFinish={onFinish} />
}
vi.mock('@/app/actions/progress', () => ({ markClassItemComplete: vi.fn() }))
vi.mock('@/hooks/use-container-width', () => ({ useContainerWidth: () => [() => {}, 1200] }))
const advance = vi.fn()
function Lesson({ runner = false, kind = 'Quiz' }: { runner?: boolean; kind?: 'Quiz' | 'Exercise' }) {
  const claims = useActionClaims()
  const [host, setHost] = useState<HTMLElement | null>(null)
  return <LessonFrameProvider value={{ actionHost: host, topClaim: claims.top, claim: claims.claim, advance, teacherName: null }}>
    {runner ? <QuizRunner classItemId="c" questions={questions} kind={kind} /> : <Stage />}
    <LessonActionBar progress={null} claimed={claims.claimed} tone={claims.tone} onActionHost={setHost} onToolsHost={() => {}} onPrimary={() => {}} />
  </LessonFrameProvider>
}

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const bar = () => host.querySelector('[data-lesson-action-bar]') as HTMLElement
const tile = (label: string) => [...host.querySelectorAll('[role=radio]')].find(el => el.textContent?.includes(label)) as HTMLButtonElement
const barButton = (text: string) => [...bar().querySelectorAll('button')].find(b => b.textContent?.includes(text)) as HTMLButtonElement

describe('FocusStage in a lesson', () => {
  it('lays the question out in two columns and puts Check in the action bar', () => {
    act(() => root.render(<Lesson />))
    expect(host.querySelector('[data-quiz-question] h2')?.textContent).toContain('Is the clave a repeating pattern?')
    expect(host.querySelector('[data-quiz-answers] [role=radio]')).not.toBeNull()
    const check = barButton('Check')
    expect(check.disabled).toBe(true)
    act(() => tile('True').click())
    expect(barButton('Check').disabled).toBe(false)
  })

  it('tints the bar and shows the feedback there after checking', () => {
    act(() => root.render(<Lesson />))
    act(() => tile('False').click())
    act(() => barButton('Check').click())
    expect(bar().getAttribute('data-tone')).toBe('danger')
    expect(bar().textContent).toContain('The clave repeats every two bars.')
    expect(host.querySelector('[data-quiz-answers] [role=status]')).toBeNull()
    act(() => barButton('Continue').click())
    expect(bar().getAttribute('data-tone')).toBe('neutral')
    act(() => tile('False').click())
    act(() => barButton('Check').click())
    expect(bar().getAttribute('data-tone')).toBe('success')
  })

  it('ends with the results, Try again and Continue in the action bar', () => {
    act(() => root.render(<Lesson runner />))
    for (const answer of ['True', 'False']) {
      act(() => tile(answer).click())
      act(() => barButton('Check').click())
      act(() => bar().querySelector<HTMLButtonElement>('[data-primary]')!.click())
    }
    expect(bar().textContent).toContain('2 / 2')
    act(() => barButton('Continue').click())
    expect(advance).toHaveBeenCalledOnce()
  })

  it('an exercise’s follow-up questions leave the action bar to the game', () => {
    act(() => root.render(<Lesson runner kind="Exercise" />))
    expect(bar().querySelector('button')).toBeNull()
    expect([...host.querySelectorAll('button')].some(b => b.textContent?.includes('Check'))).toBe(true)
  })

  it('keeps the in-panel feedback and buttons outside a lesson', () => {
    act(() => root.render(<Stage />))
    act(() => tile('True').click())
    const check = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Check')) as HTMLButtonElement
    act(() => check.click())
    expect(host.querySelector('[role=status]')?.textContent).toContain('The clave repeats every two bars.')
  })
})
