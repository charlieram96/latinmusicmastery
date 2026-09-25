// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTranslation } from '@/lib/i18n'

vi.mock('@/app/actions/progress', () => ({ markClassItemComplete: vi.fn() }))
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params) }) }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))

import { LessonAction, LessonFrameProvider, ActionMessage, useActionClaims, type ActionTone } from '../lesson-frame'
import { LessonActionBar } from '../lesson-action-bar'
import { LessonProgressProvider } from '../../lesson-progress-context'
import type { LessonProgressInput } from '@/lib/courses/lesson-progress-summary'

const progress: LessonProgressInput = {
  courseId: 'c', classId: 'k', currentIndex: 0, totalItems: 2, itemIds: ['a', 'b'], completedItemIds: [],
  nextClassId: 'k2', activeItemId: 'a', activeItemType: 'VIDEO', isCompleted: false, nextLabel: 'Part two',
}

function Harness({ part, tone = 'neutral' }: { part: boolean; tone?: ActionTone }) {
  const claims = useActionClaims()
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [tools, setTools] = useState<HTMLElement | null>(null)
  void tools
  return <LessonProgressProvider itemIds={progress.itemIds} initialCompletedItemIds={[]}>
    <LessonFrameProvider value={{ actionHost: host, claim: claims.claim, advance: vi.fn(), teacherName: 'Livan' }}>
      {part && <LessonAction tone={tone}><ActionMessage icon={null} title="Check your answer" /><button data-check>Check</button></LessonAction>}
    </LessonFrameProvider>
    <LessonActionBar progress={progress} claimed={claims.claimed} tone={claims.tone} onActionHost={setHost} onToolsHost={setTools} onPrimary={() => {}} />
  </LessonProgressProvider>
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

describe('LessonActionBar', () => {
  it('shows the lesson message and the next destination by default', () => {
    act(() => root.render(<Harness part={false} />))
    expect(bar().textContent).toContain('Lesson in progress')
    expect(bar().querySelector('[data-lesson-next]')?.getAttribute('href')).toBe('/dashboard/course/c/class/k?item=1')
    expect(bar().getAttribute('data-tone')).toBe('neutral')
  })

  it('lets a part take over the bar and tint it', () => {
    act(() => root.render(<Harness part tone="success" />))
    expect(bar().querySelector('[data-action-host] [data-check]')).not.toBeNull()
    expect(bar().querySelector('[data-lesson-next]')).toBeNull()
    expect(bar().getAttribute('data-tone')).toBe('success')
  })

  it('claim released on unmount: the default message and neutral tone come back', () => {
    act(() => root.render(<Harness part tone="danger" />))
    expect(bar().getAttribute('data-tone')).toBe('danger')
    act(() => root.render(<Harness part={false} />))
    expect(bar().querySelector('[data-check]')).toBeNull()
    expect(bar().querySelector('[data-lesson-next]')).not.toBeNull()
    expect(bar().getAttribute('data-tone')).toBe('neutral')
  })

  it('renders a part action inline outside a lesson frame', () => {
    act(() => root.render(<LessonAction><button data-inline>Go</button></LessonAction>))
    expect(host.querySelector('.lx-action-inline [data-inline]')).not.toBeNull()
  })
})
