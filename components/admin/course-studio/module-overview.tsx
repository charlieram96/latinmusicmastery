'use client'
import { useTranslation } from '@/components/language-provider'
import { pick } from '@/lib/i18n/localize'

import { AdminText } from '@/components/admin/admin-text'


import { useState } from 'react'
import { ChevronRight, Plus, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import styles from './course-studio.module.css'
import { InlineComposer } from './outline-rail'
import type { SectionWithClasses } from './types'

interface ModuleOverviewProps {
  section: SectionWithClasses
  moduleIndex: number
  onSelectClass: (classId: string) => void
  onAddClass: (title: string) => Promise<void> | void
}

/** Center view shown when a module (not a class) is selected: its classes as
    cards plus an add-class affordance. Module fields are edited in the drawer. */
export function ModuleOverview({ section, moduleIndex, onSelectClass, onAddClass }: ModuleOverviewProps) {
  const { locale } = useTranslation()
  const [addingClass, setAddingClass] = useState(false)

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-7 md:px-8">
      <header className={styles.rise}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold"> <AdminText text={"Module"} /> {moduleIndex + 1}
        </span>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">
          {pick(locale, section.title, section.title_es ?? '')}
        </h2>
        {section.description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {pick(locale, section.description, section.description_es ?? '')}
          </p>
        )}
        <p className="mt-2 text-[11px] tabular-nums text-muted-foreground/60">
          {section.classes.length} {section.classes.length === 1 ? 'class' : <AdminText text={"classes"} />}
        </p>
      </header>

      <div className="mt-6 space-y-2">
        {section.classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-warm-surface/50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-foreground/80"><AdminText text={"This module is empty"} /></p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground"> <AdminText text={"Add a class below to start building lessons."} /> </p>
          </div>
        ) : (
          section.classes.map((cls, ci) => (
            <button
              key={cls.id}
              type="button"
              onClick={() => onSelectClass(cls.id)}
              className={cn(
                styles.rise,
                'group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]'
              )}
              style={{ animationDelay: `${Math.min(ci, 8) * 35}ms` }}
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-warm-surface text-[12px] font-semibold tabular-nums text-muted-foreground">
                {ci + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-foreground">
                  {pick(locale, cls.title, cls.title_es ?? '')}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {cls.items.length} {cls.items.length === 1 ? 'item' : 'items'}
                </span>
              </span>
              {cls.is_free && (
                <Unlock className="h-3.5 w-3.5 flex-shrink-0 text-gold" aria-label="Free preview" />
              )}
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
            </button>
          ))
        )}

        <div className="pt-2">
          {addingClass ? (
            <InlineComposer
              placeholder="Class title…"
              onSubmit={async (title) => {
                await onAddClass(title)
              }}
              onDismiss={() => setAddingClass(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingClass(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> <AdminText text={"Add class"} /> </button>
          )}
        </div>
      </div>
    </div>
  )
}
