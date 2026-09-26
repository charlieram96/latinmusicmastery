// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }))

import { ClassViewerLocked } from '@/app/dashboard/course/[courseId]/class/[classId]/class-viewer-locked'
import { LessonFrameProvider, useActionClaims } from '../lesson-frame'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

function InFrame() {
  const claims = useActionClaims()
  const [bar, setBar] = useState<HTMLElement | null>(null)
  return <>
    <LessonFrameProvider value={{ actionHost: bar, topClaim: claims.top, claim: claims.claim, advance: () => {}, teacherName: null }}>
      <ClassViewerLocked courseId="c" />
    </LessonFrameProvider>
    <footer data-bar ref={setBar} />
  </>
}

describe('ClassViewerLocked (L7)', () => {
  it('in a lesson, puts Subscribe and Back to course in the action bar', () => {
    act(() => root.render(<InFrame />))
    const bar = host.querySelector('[data-bar]')!
    expect(bar.querySelector('a[href="/dashboard/subscribe"]')?.textContent).toContain('locked.cta')
    expect(bar.querySelector('a[href="/dashboard/course/c"]')).not.toBeNull()
    expect(bar.querySelector('[data-primary]')).not.toBeNull()
    expect(host.querySelectorAll('a[href="/dashboard/subscribe"]')).toHaveLength(1)
  })

  it('outside a lesson, keeps the buttons with the message', () => {
    act(() => root.render(<ClassViewerLocked courseId="c" />))
    expect(host.querySelector('a[href="/dashboard/subscribe"]')).not.toBeNull()
  })
})
