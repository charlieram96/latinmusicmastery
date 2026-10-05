'use client'

import { adminLabel } from '@/lib/i18n/admin-labels'
import { AdminText } from '@/components/admin/admin-text'


import { useTranslation } from '@/components/language-provider'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COURSE_INSTRUMENTS, getCourseInstrumentLabel, sortCourseInstruments } from '@/lib/instruments'
import { createCourseDraft } from '@/app/actions/course-builder'
import type { MusicalStyleOption, TeacherOption } from './types'

interface NewCourseFormProps {
  courseInstruments?: readonly string[]
  musicalStyles: MusicalStyleOption[]
  teachers: TeacherOption[]
}

/** Deliberately minimal: name the course, place it in the catalog, and land in
    the studio — everything else is edited there. */
export function NewCourseForm({ musicalStyles, teachers, courseInstruments = COURSE_INSTRUMENTS }: NewCourseFormProps) {
  const { locale } = useTranslation()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [instrument, setInstrument] = useState<string>('unselected')
  const [isFundamentals, setIsFundamentals] = useState(false)
  const [musicalStyleId, setMusicalStyleId] = useState<string | null>(null)
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (instrument === 'unselected') {
      setError(locale === 'es' ? 'Selecciona la clasificación del curso antes de continuar.' : 'Select the course classification before continuing.')
      return
    }
    setCreating(true)
    try {
      const result = await createCourseDraft({
        title,
        instrument: instrument === 'unselected' ? null : instrument,
        isFundamentals,
        musicalStyleId: isFundamentals ? null : musicalStyleId,
        teacherId,
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        setCreating(false)
        return
      }
      router.push(`/admin/courses/${result.data.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10 md:min-h-dvh">
      <div className="w-full max-w-md">
        <Link
          href="/admin/courses"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> <AdminText text={"Back to courses"} /> </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold"> <AdminText text={"Course Studio"} /> </span>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground"> <AdminText text={"Create a new course"} /> </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground"> <AdminText text={"Name it and place it in the catalog — you&rsquo;ll build everything else in the studio."} /> </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="new-title" className="text-xs"> <AdminText text={"Course title"} /> </Label>
              <Input
                id="new-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={adminLabel("e.g. Salsa Piano Foundations", locale)}
                required
              />
            </div>

            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-warm-surface/60 px-3.5 py-3">
              <span className="space-y-0.5">
                <span className="block text-[13px] font-medium text-foreground"> <AdminText text={"Fundamentals course"} /> </span>
                <span className="block text-xs leading-relaxed text-muted-foreground"> <AdminText text={"The instrument&rsquo;s genreless beginner course."} /> </span>
              </span>
              <Switch checked={isFundamentals} onCheckedChange={setIsFundamentals} />
            </label>

            {!isFundamentals && (
              <div className="grid gap-1.5">
                <Label className="text-xs"><AdminText text={"Musical style"} /></Label>
                <Select
                  value={musicalStyleId ?? undefined}
                  onValueChange={(value) => setMusicalStyleId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={adminLabel("Select a genre", locale)} />
                  </SelectTrigger>
                  <SelectContent>
                    {musicalStyles.map((style) => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.name} ({style.country.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs">{locale === 'es' ? 'Instrumento / clasificación del curso' : 'Course instrument / classification'}</Label>
              <Select value={instrument} onValueChange={setInstrument}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unselected" disabled>{locale === 'es' ? 'Selecciona la clasificación del curso' : 'Select the course classification'}</SelectItem>
                  {sortCourseInstruments(courseInstruments, locale).map((inst) => (
                    <SelectItem key={inst} value={inst}>
                      {getCourseInstrumentLabel(inst, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs"><AdminText text={"Teacher"} /></Label>
              <Select
                value={teacherId ?? 'unassigned'}
                onValueChange={(value) => setTeacherId(value === 'unassigned' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned"><AdminText text={"Unassigned"} /></SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name} — {teacher.instrument}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={creating || !title.trim()}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> <AdminText text={"Creating…"} /> </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> <AdminText text={"Create course"} /> </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
