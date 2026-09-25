'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, CircleHelp, FileText, Music, Play, Trophy, Video } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { cn } from '@/lib/utils'
import type { PathCheckpointNode, PathItem, PathLessonNode, PathLessonType } from '@/lib/courses/path-nodes'

const T = 'dashboard.pages.course.path'
const TYPE_ICON: Record<PathLessonType, typeof Video> = { video: Video, play: Music, quiz: CircleHelp, other: FileText }

// Geometry. TOP leaves room above the highest node for the "Continue" bubble
// (34px offset + ~52px tall + 6px of bob); with module flags it adds a 20px
// flag row on top. SIDE leaves room for half a 110px label beside the first and
// last nodes. Hover cards render outside the scroller (it clips vertically
// too), so they need no room here.
const TOP_PLAIN = 116
const TOP_FLAGS = 140
const SIDE = 60
const WAVE = 18
const CARD_W = 208

interface PathStripProps {
  items: PathItem[]
  size?: 'default' | 'compact'
  showArrows?: boolean
  /** Mark where each module starts with a flag linking to its overview (course page). */
  showModuleFlags?: boolean
  className?: string
  ariaLabel: string
}

/**
 * Horizontal Duolingo-style lesson path: 3D nodes on a wavy connector,
 * solid up to the current lesson, dotted after. Scrolls itself so the current
 * lesson (or the end, once the course is finished) is in view.
 */
export function PathStrip({ items, size = 'default', showArrows = false, showModuleFlags = false, className, ariaLabel }: PathStripProps) {
  const { t } = useTranslation()
  const outer = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const tipId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  // True while the last pointer was a finger or pen: touch has no hover, so a
  // first tap on a lesson pins its card (with a "Go to lesson" link) instead of
  // navigating, and the compatibility mouse/focus events it fires are ignored.
  const touch = useRef(false)
  const [tip, setTip] = useState<{ index: number; left: number; top: number; pinned: boolean } | null>(null)
  const compact = size === 'compact'
  const STEP = compact ? 104 : 118
  const TOP = showModuleFlags ? TOP_FLAGS : TOP_PLAIN

  const pos = items.map((_, i) => ({ x: SIDE + i * STEP, y: Math.round(TOP + Math.sin(i * 1.1) * WAVE) }))
  const width = SIDE * 2 + Math.max(0, items.length - 1) * STEP
  const height = TOP + (compact ? 96 : 110)
  const currentIndex = items.findIndex((i) => i.kind !== 'gap' && i.state === 'current')
  // The connector is solid up to the current lesson (or everything, once finished).
  const solidUntil = currentIndex === -1 ? items.length - 1 : currentIndex
  // Re-run the scroll when the path itself changes (another course with the same length and current index).
  const itemsKey = items.map((i) => i.id).join('|')

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = currentIndex === -1 ? el.scrollWidth : SIDE + currentIndex * STEP - el.clientWidth / 2
    el.scrollLeft = Math.max(0, target)
  }, [currentIndex, STEP, itemsKey])

  const pinned = tip?.pinned ?? false
  useEffect(() => {
    if (!pinned) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (target?.closest?.('[data-path-node]') || cardRef.current?.contains(target)) return
      setTip(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTip(null) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  const scroll = (dir: 1 | -1) => {
    const el = scroller.current
    el?.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const showTip = (index: number, pin = false) => {
    const scrollLeft = scroller.current?.scrollLeft ?? 0
    const outerWidth = outer.current?.clientWidth ?? 0
    const x = pos[index].x - scrollLeft
    // Keep the card inside the strip horizontally.
    const left = outerWidth > CARD_W ? Math.min(Math.max(x, CARD_W / 2), outerWidth - CARD_W / 2) : x
    setTip({ index, left, top: pos[index].y - 34, pinned: pin })
  }
  // Hover and focus cards close when the pointer or focus leaves; a pinned (tapped) card stays.
  const hideTip = () => setTip((cur) => (cur?.pinned ? cur : null))

  // Module flags: one where each module's first lesson sits, titled and linked from its checkpoint.
  const flags: { key: string; x: number; n: number; title: string; href: string | null; later: boolean }[] = []
  if (showModuleFlags) {
    let prev = -1
    items.forEach((item, i) => {
      if (item.kind !== 'lesson' || item.moduleIndex === prev) return
      prev = item.moduleIndex
      const cp = items.find((c): c is PathCheckpointNode => c.kind === 'checkpoint' && c.moduleIndex === item.moduleIndex)
      const later = items.every((l) => l.kind !== 'lesson' || l.moduleIndex !== item.moduleIndex || l.state === 'upcoming')
      flags.push({ key: `flag-${item.moduleIndex}`, x: pos[i].x, n: item.moduleIndex + 1, title: cp?.moduleTitle ?? '', href: cp?.href ?? null, later })
    })
  }

  const tipItem = tip ? (items[tip.index] as PathLessonNode) : null

  return (
    <div ref={outer} className={cn('relative', className)} role="group" aria-label={ariaLabel}>
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
        onScroll={() => setTip(null)}
        className="overflow-x-auto overflow-y-hidden [scroll-snap-type:x_proximity] [scrollbar-width:thin] max-md:[scroll-snap-type:x_mandatory]"
      >
        <div className="relative" style={{ width, height }}>
          {flags.map((f) => {
            const content = (
              <>
                <span className={cn('text-[10px] font-bold uppercase tracking-[0.07em]', f.later ? 'text-muted-foreground' : 'text-primary')}>{t(`${T}.module`, { n: f.n })}</span>
                <span className="truncate font-heading text-[13px] font-bold">{f.title}</span>
              </>
            )
            const cls = cn(
              'absolute top-0 flex h-5 items-baseline gap-1.5 whitespace-nowrap border-l-[3px] pl-2 leading-5',
              f.later ? 'border-border' : 'border-primary'
            )
            const style = { left: Math.max(0, f.x - 30), maxWidth: STEP * 2 - 24 }
            return f.href ? (
              <Link key={f.key} data-path-flag href={f.href} className={cn(cls, 'transition-colors hover:text-primary')} style={style}>{content}</Link>
            ) : (
              <span key={f.key} data-path-flag className={cls} style={style}>{content}</span>
            )
          })}
          <svg aria-hidden className="absolute inset-0 overflow-visible" width={width} height={height}>
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
            const hover = isLesson
              ? {
                  onMouseEnter: () => { if (!touch.current) showTip(i) },
                  onMouseLeave: hideTip,
                  onFocus: () => { if (!touch.current) showTip(i) },
                  onBlur: hideTip,
                }
              : {}
            return (
              <div
                key={item.id}
                data-path-node
                className="group absolute"
                style={{ left: x, top: y, scrollSnapAlign: 'center' }}
                onPointerDown={(e) => { touch.current = e.pointerType !== 'mouse' }}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') touch.current = false }}
                onKeyDown={() => { touch.current = false }}
                {...hover}
              >
                {current && isLesson && (
                  <div data-path-bubble className="pointer-events-none absolute bottom-[34px] left-1/2 z-[2] grid -translate-x-1/2 justify-items-center whitespace-nowrap rounded-xl border-2 border-border bg-card px-3 py-1.5 text-[13px] font-extrabold text-primary shadow-lift group-focus-within:opacity-0 group-hover:opacity-0 motion-safe:animate-bob">
                    <span className="uppercase">{t(`${T}.continue`)}</span>
                    {item.minutes !== null && <span className="text-[11px] font-semibold text-muted-foreground">{t(`${T}.minutes`, { n: item.minutes })}</span>}
                  </div>
                )}
                <Link
                  href={item.href}
                  aria-label={isLesson ? `${t(`${T}.lessonN`, { n: item.number })}: ${item.title}` : label}
                  aria-current={current ? 'step' : undefined}
                  aria-describedby={tip?.index === i ? tipId : undefined}
                  onClick={(e) => {
                    if (!isLesson || !touch.current || (tip?.index === i && tip.pinned)) return
                    e.preventDefault()
                    showTip(i, true)
                  }}
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
              </div>
            )
          })}
        </div>
      </div>

      {tip && tipItem && (
        <div
          ref={cardRef}
          id={tipId}
          role="tooltip"
          className={cn(
            'absolute z-20 w-52 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-popover p-3 text-left shadow-pop',
            tip.pinned ? 'pointer-events-auto' : 'pointer-events-none'
          )}
          style={{ left: tip.left, top: tip.top }}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{t(`${T}.lessonN`, { n: tipItem.number })}</span>
            <span className={cn(tipItem.state === 'done' && 'text-success', tipItem.state === 'current' && 'text-primary')}>{t(`${T}.state.${tipItem.state}`)}</span>
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug">{tipItem.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tipItem.types.map((ty) => t(`${T}.types.${ty}`)).join(' · ')}
            {tipItem.minutes !== null && ` · ${t(`${T}.minutes`, { n: tipItem.minutes })}`}
          </p>
          {tip.pinned && (
            <Link href={tipItem.href} className="mt-2.5 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              {t(`${T}.goToLesson`)}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
