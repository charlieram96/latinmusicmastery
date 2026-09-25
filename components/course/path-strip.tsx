'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Check, ChevronLeft, ChevronRight, CircleHelp, FileText, Music, Play, Trophy, Video } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import type { PathItem, PathLessonType } from '@/lib/courses/path-nodes'

const T = 'dashboard.pages.course.path'
const TYPE_ICON: Record<PathLessonType, typeof Video> = { video: Video, play: Music, quiz: CircleHelp, other: FileText }

interface PathStripProps {
  items: PathItem[]
  size?: 'default' | 'compact'
  showArrows?: boolean
  className?: string
  ariaLabel: string
}

/**
 * Horizontal Duolingo-style lesson path: 3D nodes on a wavy connector,
 * solid up to the current lesson, dotted after. Scrolls itself so the current
 * lesson (or the end, once the course is finished) is in view.
 */
export function PathStrip({ items, size = 'default', showArrows = false, className, ariaLabel }: PathStripProps) {
  const { t } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const compact = size === 'compact'
  const STEP = compact ? 104 : 118
  const TOP = 84
  const WAVE = 18

  const pos = items.map((_, i) => ({ x: 44 + i * STEP, y: TOP + Math.sin(i * 1.1) * WAVE }))
  const width = 44 * 2 + Math.max(0, items.length - 1) * STEP
  const currentIndex = items.findIndex((i) => i.kind !== 'gap' && i.state === 'current')
  // The connector is solid up to the current lesson (or everything, once finished).
  const solidUntil = currentIndex === -1 ? items.length - 1 : currentIndex

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = currentIndex === -1 ? el.scrollWidth : 44 + currentIndex * STEP - el.clientWidth / 2
    el.scrollLeft = Math.max(0, target)
  }, [currentIndex, STEP, items.length])

  const scroll = (dir: 1 | -1) => {
    const el = scroller.current
    el?.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className={cn('relative', className)} role="group" aria-label={ariaLabel}>
      {showArrows && (
        <div className="absolute right-0 top-0 z-10 flex gap-2">
          <button type="button" aria-label={t(`${T}.prev`)} onClick={() => scroll(-1)} className="grid size-9 place-items-center rounded-lg border border-border bg-card shadow-card hover:bg-accent">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label={t(`${T}.next`)} onClick={() => scroll(1)} className="grid size-9 place-items-center rounded-lg border border-border bg-card shadow-card hover:bg-accent">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
      <div
        ref={scroller}
        data-path-scroller
        data-anchor={currentIndex === -1 ? 'end' : 'current'}
        className="overflow-x-auto overflow-y-hidden [scroll-snap-type:x_proximity] [scrollbar-width:thin]"
      >
        <div className="relative" style={{ width, height: TOP + (compact ? 96 : 110) }}>
          <svg aria-hidden className="absolute inset-0 overflow-visible" width={width} height={TOP + 110}>
            {pos.slice(1).map((b, k) => {
              const a = pos[k]
              const mx = (a.x + b.x) / 2
              const solid = k + 1 <= solidUntil
              return (
                <path
                  key={k}
                  d={`M${a.x} ${a.y} C${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={compact ? 6 : 8}
                  strokeDasharray={solid ? undefined : '2 14'}
                  className={solid ? 'stroke-primary' : 'stroke-border'}
                />
              )
            })}
          </svg>

          {items.map((item, i) => {
            const { x, y } = pos[i]
            if (item.kind === 'gap') {
              return (
                <span key={item.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground" style={{ left: x, top: y }}>
                  {t(item.count === 1 ? `${T}.moreOne` : `${T}.more`, { count: item.count })}
                </span>
              )
            }
            const isLesson = item.kind === 'lesson'
            const current = item.state === 'current'
            const done = item.state === 'done'
            const label = isLesson ? item.title : t(`${T}.checkpoint`, { n: item.moduleIndex + 1 })
            const Icon = isLesson ? (done ? Check : current ? Play : TYPE_ICON[item.types[0] ?? 'other']) : Trophy
            return (
              <div key={item.id} className="group absolute" style={{ left: x, top: y, scrollSnapAlign: 'center' }}>
                {current && isLesson && (
                  <div data-path-bubble className="pointer-events-none absolute bottom-[34px] left-1/2 z-[2] grid justify-items-center whitespace-nowrap rounded-xl border-2 border-border bg-card px-3 py-1.5 text-[13px] font-extrabold text-primary shadow-lift group-focus-within:opacity-0 group-hover:opacity-0 motion-safe:animate-bob">
                    <span className="uppercase">{t(`${T}.continue`)}</span>
                    {item.minutes !== null && <span className="text-[11px] font-semibold text-muted-foreground">{t(`${T}.minutes`, { n: item.minutes })}</span>}
                  </div>
                )}
                <Link
                  href={item.href}
                  aria-label={isLesson ? `${t(`${T}.lessonN`, { n: item.number })}: ${item.title}` : label}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'absolute left-0 top-0 grid -translate-x-1/2 -translate-y-1/2 place-items-center transition-[transform,box-shadow] duration-tap ease-smooth active:translate-y-[calc(-50%+6px)] active:shadow-none',
                    compact ? 'h-[42px] w-[46px]' : 'h-[52px] w-[56px]',
                    isLesson ? 'rounded-full' : 'rounded-[18px]',
                    done || current
                      ? isLesson
                        ? 'bg-primary text-primary-foreground shadow-[0_6px_0_hsl(var(--primary-deep))]'
                        : 'bg-gradient-to-br from-gold to-primary text-white shadow-[0_6px_0_hsl(var(--primary-deep))]'
                      : isLesson
                        ? 'bg-muted text-muted-foreground shadow-[0_6px_0_hsl(var(--border))]'
                        : 'bg-gold/20 text-gold shadow-[0_6px_0_hsl(var(--border))]',
                    current && 'ring-8 ring-primary/15'
                  )}
                >
                  {current && <span aria-hidden className="absolute -inset-2 rounded-full border-[3px] border-primary/60 motion-safe:animate-ring-pulse" />}
                  <Icon className={cn(compact ? 'size-5' : 'size-6', done && isLesson && 'stroke-[3]')} />
                </Link>
                <span className={cn('absolute left-0 top-[34px] line-clamp-2 w-[110px] -translate-x-1/2 text-center text-[11px] leading-tight', current ? 'font-bold text-foreground' : 'font-medium text-muted-foreground')}>
                  {label}
                </span>
                {isLesson && (
                  <div role="tooltip" className="pointer-events-none absolute bottom-[34px] left-1/2 z-[3] w-52 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 text-left opacity-0 shadow-pop transition-opacity duration-state group-focus-within:opacity-100 group-hover:opacity-100">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>{t(`${T}.lessonN`, { n: item.number })}</span>
                      <span className={cn(done && 'text-success', current && 'text-primary')}>{t(`${T}.state.${item.state}`)}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-snug">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.types.map((ty) => t(`${T}.types.${ty}`)).join(' · ')}
                      {item.minutes !== null && ` · ${t(`${T}.minutes`, { n: item.minutes })}`}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
