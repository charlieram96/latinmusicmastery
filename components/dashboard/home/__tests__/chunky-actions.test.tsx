// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContinueCard as ContinueCardData, FeedbackSummary } from '@/types/dashboard'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}))
vi.mock('next/link', () => ({
  useLinkStatus: () => ({ pending: false }),
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('next/image', () => ({ default: () => null }))

import { ContinueCard } from '../continue-card'
import { FeedbackCard } from '../feedback-card'
import { UpgradeCard } from '../upgrade-card'

const CHUNKY_EDGE = 'shadow-[0_4px_0_hsl(var(--primary-deep))]'
const isChunky = (el: Element | undefined) => !!el && el.className.includes(CHUNKY_EDGE) && el.className.includes('rounded-[14px]')
const linkByText = (host: HTMLElement, text: string) => [...host.querySelectorAll('a')].find((a) => a.textContent?.includes(text))

const CARD: ContinueCardData = {
  courseTitle: 'Son Cubano Timbal',
  courseHref: '/dashboard/course/son',
  resumeHref: '/dashboard/course/son/class/7',
  thumbnailUrl: null,
  styleName: 'Son Cubano',
  classTitle: 'Cáscara on the shell',
  classIndex: 6,
  totalClasses: 14,
  classMinutes: 12,
  classPct: 40,
  teacherName: 'Leo Garcia',
  teacherImage: null,
  nextClassTitle: 'Mambo bell',
  segments: Array.from({ length: 14 }, (_, i) => (i < 6 ? 'done' : i === 6 ? 'current' : 'todo')),
}
const FEEDBACK: FeedbackSummary = {
  kind: 'completed',
  teacherName: 'Leo Garcia',
  teacherImage: null,
  message: 'Nice rolls',
  hasVideo: true,
  createdAt: null,
  status: 'completed',
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

describe('chunky primary actions on the home', () => {
  it('Resume lesson is chunky; Course details is not', () => {
    act(() => root.render(<ContinueCard card={CARD} />))
    expect(isChunky(linkByText(host, 'continue.resume'))).toBe(true)
    expect(isChunky(linkByText(host, 'continue.courseDetails'))).toBe(false)
  })

  it('Watch review is chunky; Send a new clip is not', () => {
    act(() => root.render(<FeedbackCard feedback={FEEDBACK} />))
    expect(isChunky(linkByText(host, 'feedback.watch'))).toBe(true)
    expect(isChunky(linkByText(host, 'feedback.sendNew'))).toBe(false)
  })

  it('View plans is chunky', () => {
    act(() => root.render(<UpgradeCard hasSubscription={false} />))
    expect(isChunky(linkByText(host, 'subscription.empty.cta'))).toBe(true)
  })
})
