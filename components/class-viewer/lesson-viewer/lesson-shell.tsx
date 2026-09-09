'use client'

// Client orchestrator for the redesigned lesson viewer. Owns the sidebar
// collapse state and lays out sidebar + header + parts nav + workspace +
// body + fixed footer. Server-rendered content (the workspace + body) is
// passed in as slots so data-fetching stays on the server.

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LessonSidebar, type LessonSidebarSection } from './lesson-sidebar'
import { LessonHeader } from './lesson-header'
import { LessonPartsNav, type LessonPart } from './lesson-parts-nav'
import { LessonFooter } from './lesson-footer'
import { LessonShellProvider } from './lesson-shell-context'
import styles from './lesson-viewer.module.css'

interface LessonShellProps {
  sidebar: {
    courseId: string
    currentClassId: string | null
    currentSectionId?: string | null
    sections: LessonSidebarSection[]
    courseTitle: string
    courseImageUrl?: string | null
    teacherName?: string | null
    teacherImageUrl?: string | null
    hasAccess: boolean
  }
  header: {
    /** Breadcrumb above the title (module name on a lesson, course name on a
        module overview). Links when `eyebrowHref` is set. */
    eyebrow: string
    eyebrowHref?: string | null
    title: string
    subtitle?: string | null
  }
  parts?: {
    items: LessonPart[]
    activeIndex: number
    completedItemIds: string[]
    courseId: string
    classId: string
  } | null
  footer?: {
    courseId: string
    classId: string
    currentIndex: number
    totalItems: number
    nextClassId: string | null
    activeItemId: string | null
    isCompleted: boolean
    nextLabel?: string | null
  } | null
  /** Full-bleed media workspace (video / PlaySense split). Omit for non-media. */
  workspace?: ReactNode
  /** Scrollable lesson body (meta strip, prose, item content, comments). */
  body: ReactNode
}

export function LessonShell({
  sidebar,
  header,
  parts,
  footer,
  workspace,
  body,
}: LessonShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <LessonShellProvider collapsed={collapsed} setCollapsed={setCollapsed}>
      <div
        data-lesson-shell
        className={cn(
          styles.app,
          '-m-6 flex min-h-[calc(100vh-3.5rem)] items-stretch bg-background text-foreground'
        )}
        data-railed={collapsed}
      >
        <LessonSidebar
          {...sidebar}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />

        <div
          data-lesson-column
          className="relative flex min-w-0 flex-1 flex-col"
          style={{ paddingBottom: footer ? 68 : 0 }}
        >
          <div data-lesson-heading>
            <LessonHeader {...header} />
            {parts && <LessonPartsNav {...parts} />}
          </div>
          {workspace}
          {body}
          {footer && <div data-lesson-footer><LessonFooter {...footer} /></div>}
        </div>
      </div>
    </LessonShellProvider>
  )
}
