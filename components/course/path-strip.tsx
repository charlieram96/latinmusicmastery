'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
// Compact (dashboard card): a one-line bubble (26px offset + ~26px + 6px of bob)
// over 40×36 nodes on a flatter wave, so the whole strip is 144px tall.
const COMPACT = { top: 74, wave: 10, below: 70, step: 104, side: 52, label: 92 }
// Compact in a narrow container (phones): five nodes fit in 324px, the inside of a card on a 390px screen.
const COMPACT_NARROW = { ...COMPACT, step: 64, side: 34, label: 60 }
const NARROW_BELOW = 480
const DEFAULT = { wave: 18, below: 110, step: 118, side: 60, label: 110 }
const CARD_W = 208
// The arrow pair (2 × 36px buttons + an 8px gap) plus 4px of air: cards keep clear of it.
const ARROWS_W = 84
// Room a compact card needs above its node before it flips below (card ~110px + offset).
const CARD_ROOM = 150

interface PathStripProps {
  items: PathItem[]
  size?: 'default' | 'compact'
  showArrows?: boolean
  /** Mark where each module starts with a flag linking to its overview (course page). */
  showModuleFlags?: boolean
  /** Extra classes for the arrow pair, e.g. to lift it into a heading row above the strip. */
  arrowsClassName?: string
  className?: string
  ariaLabel: string
}

/**
 * Horizontal Duolingo-style lesson path: 3D nodes on a wavy connector,
 * solid up to the current lesson, dotted after. Scrolls itself so the current
 * lesson (or the end, once the course is finished) is in view.
 */
export function PathStrip({ items, size = 'default', showArrows = false, showModuleFlags = false, arrowsClassName, className, ariaLabel }: PathStripProps) {
  const { t } = useTranslation()
  const outer = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const tipId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  // True while the last pointer was a finger or pen: touch has no hover, so a
  // first tap on a lesson pins its card (with a "Go to lesson" link) instead of
  // navigating, and the compatibility mouse/focus events it fires are ignored.
  const touch = useRef(false)
  // Node index whose next click pins its card, decided once at pointerdown so the
  // click and the page-loader flag always agree (the card may close in between).
  const pinNext = useRef<number | null>(null)
  const goRef = useRef<HTMLAnchorElement>(null)
  // `key` ties the card to the items it was opened on; a new path closes it.
  // `below` opens the card under the node (compact cards near the top of the viewport).
  const [tip, setTip] = useState<{ key: string; index: number; left: number; top: number; pinned: boolean; below: boolean } | null>(null)
  const compact = size === 'compact'
  // Tap-to-pin cards on touch (course page). Compact strips sit in small cards
  // that could clip a pinned card, so they navigate on the first tap.
  const tapCards = !compact
  // Compact strips measure their container so a phone gets a tighter step.
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = outer.current
    if (!compact || !el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < NARROW_BELOW))
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact])
  const geo = compact ? (narrow ? COMPACT_NARROW : COMPACT) : DEFAULT
  const STEP = geo.step
  const SIDE = geo.side
  const WAVE = geo.wave
  const TOP = compact ? COMPACT.top : showModuleFlags ? TOP_FLAGS : TOP_PLAIN

  const pos = items.map((_, i) => ({ x: SIDE + i * STEP, y: Math.round(TOP + Math.sin(i * 1.1) * WAVE) }))
  const width = SIDE * 2 + Math.max(0, items.length - 1) * STEP
  const height = TOP + geo.below
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
  }, [currentIndex, STEP, SIDE, itemsKey])

  // Any key press means the keyboard is in use again (Tab after a touch must show
  // focus cards), and Escape dismisses any card, hover and focus ones included (WCAG 1.4.13).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      touch.current = false
      if (e.key === 'Escape') setTip(null)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  // Compact cards are fixed to the viewport (portaled), so any scroll or resize makes them stale.
  const tipOpen = tip !== null
  useEffect(() => {
    if (!compact || !tipOpen) return
    const close = () => setTip(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [compact, tipOpen])

  const pinned = tip?.pinned ?? false
  // A pinned card is a dialog: move focus to its Go link so screen readers announce it.
  useEffect(() => {
    if (pinned) goRef.current?.focus()
  }, [pinned, tip?.index])
  useEffect(() => {
    if (!pinned) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (target?.closest?.('[data-path-node]') || cardRef.current?.contains(target)) return
      setTip(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [pinned])

  const scroll = (dir: 1 | -1) => {
    const el = scroller.current
    el?.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const showTip = (index: number, pin = false, node?: HTMLElement) => {
    if (compact && node) {
      // Compact strips sit inside dashboard cards: the card is portaled to <body>
      // and fixed to the node's spot in the viewport, so no ancestor can clip it.
      const r = node.getBoundingClientRect()
      const vw = window.innerWidth
      const left = vw > CARD_W + 16 ? Math.min(Math.max(r.left, CARD_W / 2 + 8), vw - CARD_W / 2 - 8) : r.left
      const below = r.top < CARD_ROOM
      setTip({ key: itemsKey, index, left, top: below ? r.top + 30 : r.top - 26, pinned: false, below })
      return
    }
    const scrollLeft = scroller.current?.scrollLeft ?? 0
    const outerWidth = outer.current?.clientWidth ?? 0
    const x = pos[index].x - scrollLeft
    // Keep the card inside the strip horizontally, and clear of the arrow pair.
    const maxLeft = outerWidth - CARD_W / 2 - (showArrows ? ARROWS_W : 0)
    const left = maxLeft > CARD_W / 2 ? Math.min(Math.max(x, CARD_W / 2), maxLeft) : x
    setTip({ key: itemsKey, index, left, top: pos[index].y - (compact ? 26 : 34), pinned: pin, below: false })
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

  // Compact cards go to <body> (see showTip); the others stay beside the scroller.
  const portal = (card: React.ReactNode) => (compact && typeof document !== 'undefined' ? createPortal(card, document.body) : card)

  const tipNode = tip && tip.key === itemsKey ? items[tip.index] : undefined
  const tipItem: PathLessonNode | null = tipNode?.kind === 'lesson' ? tipNode : null

  return (
    <div ref={outer} className={cn('relative', className)} role="group" aria-label={ariaLabel}>
      {showArrows && (
        <div className={cn('absolute right-0 top-0 z-10 flex gap-2', arrowsClassName)}>
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
        className={cn('overflow-x-auto overflow-y-hidden [scroll-snap-type:x_proximity] [scrollbar-width:thin]', !compact && 'max-md:[scroll-snap-type:x_mandatory]')}
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
                  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => { if (!touch.current) showTip(i, false, e.currentTarget) },
                  onMouseLeave: hideTip,
                  onFocus: (e: React.FocusEvent<HTMLDivElement>) => { if (!touch.current) showTip(i, false, e.currentTarget) },
                  onBlur: hideTip,
                }
              : {}
            return (
              <div
                key={item.id}
                data-path-node
                className="group absolute"
                style={{ left: x, top: y }}
                onPointerDown={(e) => {
                  touch.current = e.pointerType !== 'mouse'
                  const willPin = tapCards && isLesson && touch.current && !(tipItem && tip?.index === i && tip.pinned)
                  pinNext.current = willPin ? i : null
                  // A first tap only opens the card: keep the global page loader
                  // (a capture-phase link listener) from showing for it.
                  e.currentTarget.querySelector('a')?.toggleAttribute('data-no-page-loader', willPin)
                }}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') touch.current = false }}
                onKeyDown={(e) => {
                  touch.current = false
                  pinNext.current = null
                  e.currentTarget.querySelector('a')?.removeAttribute('data-no-page-loader')
                }}
                {...hover}
              >
                {/* Snap point centred on the node. The wrapper is 0×0, and Chrome ignores
                    zero-size snap areas (every scroll then snapped back to the start). */}
                <span data-snap-anchor aria-hidden className="pointer-events-none absolute -left-px -top-px h-[2px] w-[2px]" style={{ scrollSnapAlign: 'center' }} />
                {current && isLesson && (
                  <div
                    data-path-bubble
                    className={cn(
                      'pointer-events-none absolute left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap border-2 border-border bg-card font-extrabold text-primary shadow-lift group-focus-within:opacity-0 group-hover:opacity-0 motion-safe:animate-bob',
                      compact
                        ? 'bottom-[26px] flex items-baseline gap-1.5 rounded-lg px-2 py-0.5 text-[11px]'
                        : 'bottom-[34px] grid justify-items-center rounded-xl px-3 py-1.5 text-[13px]'
                    )}
                  >
                    <span className="uppercase">{t(`${T}.continue`)}</span>
                    {item.minutes !== null && <span className="text-[11px] font-semibold text-muted-foreground">{t(`${T}.minutes`, { n: item.minutes })}</span>}
                  </div>
                )}
                <Link
                  href={item.href}
                  aria-label={isLesson ? `${t(`${T}.lessonN`, { n: item.number })}: ${item.title}` : label}
                  aria-current={current ? 'step' : undefined}
                  aria-describedby={tipItem && tip?.index === i && !tip.pinned ? tipId : undefined}
                  onClick={(e) => {
                    if (pinNext.current !== i) return
                    pinNext.current = null
                    e.preventDefault()
                    // The loader listener already ran; a later click on this link should show it.
                    e.currentTarget.removeAttribute('data-no-page-loader')
                    showTip(i, true)
                  }}
                  className={cn(
                    'absolute left-0 top-0 grid -translate-x-1/2 -translate-y-1/2 place-items-center transition-[transform,box-shadow] duration-tap ease-smooth active:translate-y-[calc(-50%+6px)] active:shadow-none',
                    compact ? 'h-[36px] w-[40px]' : 'h-[52px] w-[56px]',
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
                <span
                  data-path-label
                  className={cn(
                    'absolute left-0 line-clamp-2 -translate-x-1/2 text-center leading-tight',
                    compact ? 'top-[30px] text-[10px]' : 'top-[34px] text-[11px]',
                    current ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                  )}
                  style={{ width: geo.label }}
                >
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {tip && tipItem && portal(
        <div
          ref={cardRef}
          id={tipId}
          role={tip.pinned ? 'dialog' : 'tooltip'}
          aria-label={tip.pinned ? `${t(`${T}.lessonN`, { n: tipItem.number })}: ${tipItem.title}` : undefined}
          className={cn(
            'w-52 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 text-left shadow-pop',
            compact ? 'fixed z-[60]' : 'absolute z-20',
            !tip.below && '-translate-y-full',
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
            <Link ref={goRef} href={tipItem.href} className="mt-2.5 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              {t(`${T}.goToLesson`)}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
