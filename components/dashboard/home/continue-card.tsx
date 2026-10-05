'use client'

import Link, { useLinkStatus } from 'next/link'
import Image from 'next/image'
import { ChevronRight, Compass, Play, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { coverStyle } from '@/lib/course-covers'
import { initialsFor } from '@/lib/dashboard/initials'
import { cn } from '@/lib/utils'
import type { ContinueCard as ContinueCardData } from '@/types/dashboard'

const BASE = 'dashboard.pages.home.continue'

function ResumeLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus()
  const { locale } = useTranslation()
  return <span className="inline-flex items-center gap-2" role="status" aria-live="polite" aria-busy={pending}>
    {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Play aria-hidden className="h-4 w-4 fill-current" />}
    {pending ? (locale === 'es' ? 'Abriendo lección…' : 'Opening lesson…') : label}
  </span>
}

function Sep() {
  return <span aria-hidden className="h-3.5 w-px bg-white/30" />
}

function EmptyContinue() {
  const { t } = useTranslation()
  return (
    <section
      aria-labelledby="home-continue"
      className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:flex-row sm:items-center"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/[0.14] text-primary">
        <Compass className="h-6 w-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="home-continue" className="font-heading text-xl font-bold tracking-tight">
          {t(`${BASE}.emptyTitle`)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(`${BASE}.emptyBody`)}</p>
      </div>
      <Button asChild>
        <Link href="/dashboard/courses">{t(`${BASE}.browse`)}</Link>
      </Button>
    </section>
  )
}

/**
 * "Card B": the cover stays crisp on the left with a large lesson number; the
 * body floats on a blurred, darkened copy of the same cover. Always dark.
 */
export function ContinueCard({ card }: { card: ContinueCardData | null }) {
  const { t } = useTranslation()
  if (!card) return <EmptyContinue />

  const doneCount = card.segments.filter((s) => s === 'done').length
  const isFresh = doneCount === 0 && card.classPct === 0
  const coverBg = card.thumbnailUrl
    ? { backgroundImage: `url(${card.thumbnailUrl})` }
    : { background: coverStyle(card.styleName) }

  return (
    <section
      aria-labelledby="home-continue"
      className="relative isolate grid animate-fade-in-up overflow-hidden rounded-2xl bg-[hsl(20_10%_5%)] text-white shadow-lift md:grid-cols-[minmax(280px,36%)_minmax(0,1fr)]"
    >
      {/* Blurred copy of the cover behind everything, then a left-to-right scrim. */}
      <span aria-hidden className="absolute -inset-16 -z-10 bg-cover bg-center blur-[40px] brightness-50 saturate-[1.2]" style={coverBg} />
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/15 to-black/55" />

      <div className="relative min-h-[220px] md:min-h-[340px]">
        {card.thumbnailUrl ? (
          <Image
            src={card.thumbnailUrl}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 36vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span aria-hidden className="absolute inset-0" style={{ background: coverStyle(card.styleName) }} />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <p className="absolute bottom-4 left-5 leading-none">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">{t(`${BASE}.lesson`)}</span>
          <span className="mt-1 block font-heading text-[88px] font-extrabold tracking-tighter drop-shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
            {String(card.classIndex + 1).padStart(2, '0')}
          </span>
        </p>
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-2.5 p-6 md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          {t(`${BASE}.eyebrow`, { course: card.courseTitle, n: card.classIndex + 1, total: card.totalClasses })}
        </p>
        <h2 id="home-continue" className="text-balance font-heading text-2xl font-bold tracking-tight md:text-[34px] md:leading-[1.1]">
          {card.classTitle}
        </h2>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-white/75">
          {card.teacherName && (
            <span className="inline-flex items-center gap-2">
              <Avatar className="h-6 w-6">
                {card.teacherImage ? <AvatarImage src={card.teacherImage} alt="" /> : null}
                <AvatarFallback className="bg-white/15 text-[9px] text-white">{initialsFor(card.teacherName)}</AvatarFallback>
              </Avatar>
              {card.teacherName}
            </span>
          )}
          {card.classMinutes ? (
            <>
              <Sep />
              <span>{t(`${BASE}.minutes`, { count: card.classMinutes })}</span>
            </>
          ) : null}
          <Sep />
          <span>{t(`${BASE}.watched`, { pct: card.classPct })}</span>
        </div>

        <div className="mt-1">
          <div className="flex justify-between text-xs text-white/70">
            <span>{t(`${BASE}.lessonsDone`, { done: doneCount, total: card.totalClasses })}</span>
            <span>{t(`${BASE}.toGo`, { count: Math.max(0, card.totalClasses - doneCount) })}</span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {card.segments.map((state, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  state === 'done' && 'bg-primary',
                  state === 'current' && 'bg-transparent ring-[1.5px] ring-inset ring-primary',
                  state === 'todo' && 'bg-white/20'
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button asChild variant="chunky">
            <Link href={card.resumeHref}>
              <ResumeLabel label={isFresh ? t(`${BASE}.start`) : t(`${BASE}.resume`)} />
            </Link>
          </Button>
          <Button asChild variant="ondark" size="lg">
            <Link href={card.courseHref}>{t(`${BASE}.courseDetails`)}</Link>
          </Button>
          {card.nextClassTitle && (
            <span className="inline-flex min-w-0 items-center gap-1 text-sm text-white/75 lg:ml-auto">
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{t(`${BASE}.upNext`, { title: card.nextClassTitle })}</span>
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
