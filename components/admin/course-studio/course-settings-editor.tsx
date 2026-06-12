'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SUBSCRIBABLE_INSTRUMENTS } from '@/lib/instruments'
import { updateCourseSettings, type CourseSettingsPatch } from '@/app/actions/course-builder'
import { CourseThumbnailUpload } from '../course-thumbnail-upload'
import { useAutosave } from './use-autosave'
import { useSaveStatus } from './save-status'
import type { CourseStudioCourse, MusicalStyleOption, TeacherOption } from './types'

interface CourseSettingsEditorProps {
  settings: CourseStudioCourse
  musicalStyles: MusicalStyleOption[]
  teachers: TeacherOption[]
  onPatched: (patch: Partial<CourseStudioCourse>) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
      {children}
    </h4>
  )
}

export function CourseSettingsEditor({
  settings,
  musicalStyles,
  teachers,
  onPatched,
}: CourseSettingsEditorProps) {
  const { track } = useSaveStatus()
  const { queue, saveNow } = useAutosave<CourseSettingsPatch>({
    save: (patch) => track(updateCourseSettings(settings.id, patch)),
  })

  // Set when a fundamentals toggle can't be persisted yet because the
  // course is missing the field the new kind requires.
  const [kindHint, setKindHint] = useState<string | null>(null)

  const handleToggleFundamentals = (isFundamentals: boolean) => {
    onPatched({
      is_fundamentals: isFundamentals,
      ...(isFundamentals ? { musical_style_id: null } : {}),
    })
    if (isFundamentals) {
      if (settings.instrument) {
        setKindHint(null)
        saveNow({ is_fundamentals: true, musical_style_id: null })
      } else {
        setKindHint('Pick an instrument below to save this as a fundamentals course.')
      }
    } else {
      if (settings.musical_style_id) {
        setKindHint(null)
        saveNow({ is_fundamentals: false, musical_style_id: settings.musical_style_id })
      } else {
        setKindHint('Pick a musical style below to save this as a genre course.')
      }
    }
  }

  return (
    <div className="space-y-6 px-5 py-5">
      {/* Identity */}
      <div className="space-y-4">
        <SectionLabel>Identity</SectionLabel>

        <div className="grid gap-1.5">
          <Label className="text-xs">Thumbnail</Label>
          <CourseThumbnailUpload
            compact
            courseId={settings.id}
            currentImageUrl={settings.thumbnail_url}
            onImageUploaded={(url) => {
              onPatched({ thumbnail_url: url || null })
              saveNow({ thumbnail_url: url || null })
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="course-title" className="text-xs">
            Title
          </Label>
          <Input
            id="course-title"
            value={settings.title}
            onChange={(e) => {
              onPatched({ title: e.target.value })
              if (e.target.value.trim()) queue({ title: e.target.value.trim() })
            }}
            placeholder="Course title"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="course-slug" className="text-xs">
            Slug
          </Label>
          <Input
            id="course-slug"
            value={settings.slug}
            onChange={(e) => {
              onPatched({ slug: e.target.value })
              if (e.target.value.trim()) queue({ slug: e.target.value.trim() })
            }}
            placeholder="course-slug"
            className="font-mono text-[13px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Used in the course URL — keep it short and unique.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="course-description" className="text-xs">
            Description
          </Label>
          <Textarea
            id="course-description"
            value={settings.description ?? ''}
            onChange={(e) => {
              onPatched({ description: e.target.value || null })
              queue({ description: e.target.value || null })
            }}
            rows={4}
            placeholder="What students will learn in this course…"
          />
        </div>
      </div>

      {/* Catalog */}
      <div className="space-y-4 border-t border-border pt-5">
        <SectionLabel>Catalog</SectionLabel>

        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-border bg-warm-surface/60 px-3.5 py-3">
          <span className="space-y-0.5">
            <span className="block text-[13px] font-medium text-foreground">
              Fundamentals course
            </span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              The instrument&rsquo;s genreless beginner course.
            </span>
          </span>
          <Switch checked={settings.is_fundamentals} onCheckedChange={handleToggleFundamentals} />
        </label>

        {kindHint && (
          <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs leading-relaxed text-foreground/80">
            {kindHint}
          </p>
        )}

        {!settings.is_fundamentals && (
          <div className="grid gap-1.5">
            <Label className="text-xs">Musical style</Label>
            <Select
              value={settings.musical_style_id ?? undefined}
              onValueChange={(value) => {
                setKindHint(null)
                onPatched({ musical_style_id: value })
                saveNow({ musical_style_id: value, is_fundamentals: settings.is_fundamentals })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a genre" />
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
          <Label className="text-xs">Instrument</Label>
          <Select
            value={settings.instrument || 'auto'}
            onValueChange={(value) => {
              const instrument = value === 'auto' ? null : value
              setKindHint(null)
              onPatched({ instrument })
              saveNow({
                instrument,
                is_fundamentals: settings.is_fundamentals,
                ...(settings.is_fundamentals ? { musical_style_id: null } : {}),
              })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (from teacher)</SelectItem>
              {SUBSCRIBABLE_INSTRUMENTS.map((inst) => (
                <SelectItem key={inst} value={inst}>
                  {inst}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Auto-set when a teacher is assigned, but can be overridden.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs">Teacher</Label>
          <Select
            value={settings.teacher_id ?? 'unassigned'}
            onValueChange={(value) => {
              const teacherId = value === 'unassigned' ? null : value
              onPatched({ teacher_id: teacherId })
              saveNow({ teacher_id: teacherId })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {teachers.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.name} — {teacher.instrument}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
