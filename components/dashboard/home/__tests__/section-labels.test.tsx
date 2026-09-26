// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedbackSummary, HomeCourseSummary } from '@/types/dashboard'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('next/image', () => ({ default: () => null }))

import { CourseList } from '../course-list'
import { FeedbackCard } from '../feedback-card'

const COURSE: HomeCourseSummary = {
  id: 'c', slug: 'son', title: 'Son', thumbnailUrl: null, styleName: 'Son', teacherName: 'Leo',
  totalClasses: 4, doneClasses: 1, currentClassIndex: 1, currentClassTitle: 'Two', pct: 25, href: '/dashboard/course/son',
}
const FEEDBACK: FeedbackSummary = {
  kind: 'completed', teacherName: 'Leo', teacherImage: null, message: 'Nice', hasVideo: false, createdAt: null, status: 'completed',
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

// D7: every home section built on SectionHeader must point aria-labelledby at a real heading.
describe('home sections built on SectionHeader are labelled by their heading', () => {
  const cases: [string, React.ReactElement][] = [
    ['courses', <CourseList key="c" courses={[COURSE]} />],
    ['feedback (review)', <FeedbackCard key="f" feedback={FEEDBACK} />],
    ['feedback (invite)', <FeedbackCard key="n" feedback={{ ...FEEDBACK, kind: 'none' } as FeedbackSummary} />],
  ]
  for (const [name, el] of cases) {
    it(name, () => {
      act(() => root.render(el))
      const section = host.querySelector('section[aria-labelledby]')!
      const target = document.getElementById(section.getAttribute('aria-labelledby')!)
      expect(target?.tagName).toBe('H2')
      expect(section.contains(target)).toBe(true)
    })
  }
})
