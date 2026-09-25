'use client'

// Right-hand drawer: About this lesson (description, meta pills) and the
// comments, moved out of the page body; on phones it also lists the module's
// lessons, since the rail is hidden there.

import { useState, type ReactNode } from 'react'
import { BarChart3, Clock } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'

export type DrawerTab = 'about' | 'comments' | 'lessons'

export interface LessonMeta {
  duration?: string | null
  level?: string | null
  teacher?: { name: string; imageUrl: string | null } | null
}

const initials = (name: string) => name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

export function LessonDrawer({ open, onOpenChange, title, description, meta, comments, commentCount, lessons, initialTab = 'about' }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string | null
  meta: LessonMeta
  comments: ReactNode
  commentCount: number
  lessons: ReactNode
  initialTab?: DrawerTab
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<DrawerTab>(initialTab)
  const tabs: { id: DrawerTab; label: string; className?: string }[] = [
    { id: 'about', label: t('dashboard.classViewer.lessonMode.drawer.about') },
    { id: 'comments', label: commentCount > 0 ? t('dashboard.classViewer.lessonMode.drawer.commentsCount', { count: commentCount }) : t('dashboard.classViewer.lessonMode.drawer.comments') },
    { id: 'lessons', label: t('dashboard.classViewer.lessonMode.drawer.lessons'), className: 'md:hidden' },
  ]
  const paragraphs = (description ?? '').split(/\n{2,}/).filter(p => p.trim().length > 0)
  const pill = 'inline-flex items-center gap-1.5 rounded-full border border-border bg-raised px-3 py-1 text-xs font-medium text-foreground/80'

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" data-lesson-drawer
      className="w-[min(400px,92vw)] gap-0 overflow-y-auto p-0 sm:max-w-none motion-reduce:!animate-none">
      <div className="sticky top-0 z-10 grid gap-3 border-b border-border bg-background/95 px-5 pb-3 pt-5 backdrop-blur">
        <SheetTitle className="pr-8 font-heading text-lg font-extrabold leading-tight">{title}</SheetTitle>
        <SheetDescription className="sr-only">{t('dashboard.classViewer.lessonMode.drawer.title')}</SheetDescription>
        <div role="tablist" className="inline-flex w-fit gap-1 rounded-xl bg-muted p-1">
          {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={cn('rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors duration-tap ease-smooth',
              tab === item.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground', item.className)}>
            {item.label}
          </button>)}
        </div>
      </div>
      <div role="tabpanel" className="px-5 py-5">
        {tab === 'about' && <div data-about className="grid gap-4">
          {(meta.duration || meta.level || meta.teacher) && <div className="flex flex-wrap gap-2">
            {meta.duration && <span className={pill}><Clock className="h-3.5 w-3.5 text-muted-foreground" />{meta.duration}</span>}
            {meta.level && <span className={pill}><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />{meta.level}</span>}
            {meta.teacher && <span className={cn(pill, 'pl-1')}>
              {meta.teacher.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={meta.teacher.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                : <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary font-heading text-[9px] font-bold">{initials(meta.teacher.name)}</span>}
              {meta.teacher.name}
            </span>}
          </div>}
          {paragraphs.length > 0
            ? paragraphs.map((para, i) => <p key={i} className={cn('whitespace-pre-wrap text-[15px] leading-[1.7]', i === 0 ? 'text-foreground' : 'text-foreground/75')}>{para}</p>)
            : <p className="text-sm text-muted-foreground">{t('dashboard.classViewer.lessonMode.drawer.noDescription')}</p>}
        </div>}
        {/* Kept mounted so a half-written comment survives a tab switch. */}
        <div data-comments-panel hidden={tab !== 'comments'}>{comments}</div>
        {tab === 'lessons' && lessons}
      </div>
    </SheetContent>
  </Sheet>
}
