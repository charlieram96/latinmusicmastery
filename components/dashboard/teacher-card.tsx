'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, ChevronRight, ExternalLink, Mail, MessageSquare, Music, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CourseThumb } from '@/components/dashboard/home/course-list'
import { TiptapReadOnly } from '@/components/class-viewer/tiptap-read-only'
import { useTranslation } from '@/components/language-provider'
import { coverStyle } from '@/lib/course-covers'
import { initialsFor } from '@/lib/dashboard/initials'
import { tiptapToPlainText } from '@/lib/tiptap/plain-text'
import { cn } from '@/lib/utils'
import { splitInstruments, type TeacherCardData } from '@/lib/dashboard/teachers'

export type { TeacherCardData }

/**
 * Photo when there is one; otherwise initials on the gradient of the teacher's
 * first course style, so a roster without photos still reads as people.
 */
export function TeacherAvatar({
  teacher,
  className,
}: {
  teacher: Pick<TeacherCardData, 'name' | 'image_url' | 'courses'>
  className?: string
}) {
  const styleName = teacher.courses[0]?.musical_style?.name ?? null
  if (teacher.image_url) {
    return (
      <span className={cn('relative block shrink-0 overflow-hidden rounded-xl bg-sunken', className)}>
        <Image src={teacher.image_url} alt="" fill sizes="128px" className="object-cover" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl font-heading font-bold tracking-tight text-white/90',
        className
      )}
      style={{ background: coverStyle(styleName) }}
    >
      {initialsFor(teacher.name)}
    </span>
  )
}

export function TeacherCard({ teacher }: { teacher: TeacherCardData }) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const instruments = splitInstruments(teacher.instrument)
  const specialties = teacher.specialties ?? []
  const bio = tiptapToPlainText(teacher.bio)
  const courseCount = t(
    teacher.courses.length === 1 ? 'dashboard.pages.teachers.courseCountOne' : 'dashboard.pages.teachers.courseCountOther',
    { count: teacher.courses.length }
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t('dashboard.pages.teachers.profileOf', { name: teacher.name })}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lift focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {/* The photo owns the corner: no padding, clipped by the card, radius from the card. */}
        <div className="flex items-start gap-4">
          <TeacherAvatar teacher={teacher} className="h-[124px] w-[124px] rounded-none text-3xl" />
          <div className="min-w-0 flex-1 pr-4 pt-4">
            <h3 className="truncate font-heading text-lg font-bold tracking-tight transition-colors group-hover:text-primary">
              {teacher.name}
            </h3>
            {instruments.length > 0 ? (
              <p className="truncate text-sm text-muted-foreground">{instruments.join(' · ')}</p>
            ) : null}
            {specialties.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {specialties.slice(0, 3).map((s) => (
                  <Badge key={s} variant="secondary" className="font-medium">
                    {s}
                  </Badge>
                ))}
                {specialties.length > 3 ? (
                  <Badge variant="outline" className="font-medium text-muted-foreground">
                    +{specialties.length - 3}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {bio ? <p className="mt-3 line-clamp-3 px-4 text-sm leading-relaxed text-muted-foreground">{bio}</p> : null}

        <div className="mx-4 mt-auto flex items-center justify-between border-t border-border pb-4 pt-3.5 [&:not(:first-child)]:mt-3.5">
          <div className="flex items-center gap-2.5">
            {teacher.courses.length > 0 ? (
              <div className="flex" aria-hidden>
                {teacher.courses.slice(0, 3).map((course, i) => (
                  <CourseThumb
                    key={course.id}
                    src={course.thumbnail_url}
                    styleName={course.musical_style?.name ?? null}
                    alt=""
                    className={cn('h-6 w-9 ring-2 ring-card', i > 0 && '-ml-2')}
                  />
                ))}
              </div>
            ) : null}
            <span className="text-xs text-muted-foreground">{courseCount}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            {t('dashboard.pages.teachers.viewProfile')}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">{t('dashboard.pages.teachers.profileOf', { name: teacher.name })}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <TeacherAvatar teacher={teacher} className="h-28 w-28 text-3xl" />
              <div className="flex-1 text-center sm:text-left">
                <h2 className="font-heading text-2xl font-bold tracking-tight">{teacher.name}</h2>
                {instruments.length > 0 ? (
                  <div className="mt-1.5 flex items-center justify-center gap-2 text-primary sm:justify-start">
                    <Music className="h-4 w-4" aria-hidden />
                    <span className="font-semibold">{instruments.join(' · ')}</span>
                  </div>
                ) : null}
                {specialties.length > 0 ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                    {specialties.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {teacher.bio ? (
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
                  {t('dashboard.pages.teachers.about')}
                </h3>
                <div className="text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/60 [&_blockquote]:pl-3 [&_blockquote]:italic [&_em]:italic [&_h1:first-child]:mt-0 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_iframe]:my-3 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-lg [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p:last-child]:mb-0 [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
                  <TiptapReadOnly
                    content={teacher.bio && typeof teacher.bio === 'object' ? (teacher.bio as Record<string, unknown>) : null}
                  />
                </div>
              </div>
            ) : null}

            {teacher.courses.length > 0 ? (
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                  {t('dashboard.pages.teachers.coursesBy', { name: teacher.name.split(' ')[0] })}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {teacher.courses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/dashboard/course/${course.slug || course.id}`}
                      onClick={() => setIsOpen(false)}
                      className="group"
                    >
                      <Card className="gap-0 overflow-hidden py-0 transition-colors hover:bg-accent/40">
                        <div className="flex items-center gap-3 p-3">
                          <CourseThumb
                            src={course.thumbnail_url}
                            styleName={course.musical_style?.name ?? null}
                            alt=""
                            className="h-10 w-16"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">{course.title}</p>
                            {course.musical_style ? (
                              <p className="text-xs text-muted-foreground">{course.musical_style.name}</p>
                            ) : null}
                          </div>
                          <ExternalLink
                            className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                            aria-hidden
                          />
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href="/dashboard/feedback" onClick={() => setIsOpen(false)}>
                  <Video aria-hidden />
                  {t('dashboard.pages.feedback.request.title')}
                </Link>
              </Button>
              {teacher.email ? (
                <Button variant="outline" asChild className="flex-1">
                  <a href={`mailto:${teacher.email}`}>
                    <Mail aria-hidden />
                    {t('dashboard.pages.teachers.contact')}
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
