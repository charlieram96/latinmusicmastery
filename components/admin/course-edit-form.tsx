'use client'

import { adminLabel } from '@/lib/i18n/admin-labels'
import { AdminText } from '@/components/admin/admin-text'


import { useTranslation } from '@/components/language-provider'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { CourseThumbnailUpload } from './course-thumbnail-upload'
import { createClient } from '@/lib/supabase/client'
import { COURSE_INSTRUMENTS, getCourseInstrumentLabel, sortCourseInstruments } from '@/lib/instruments'

interface MusicalStyle {
  id: string
  name: string
  country: { name: string }
}

interface Teacher {
  id: string
  name: string
  instrument: string
}

interface Course {
  id: string
  title: string
  slug: string
  description: string | null
  musical_style_id: string
  teacher_id: string | null
  is_published: boolean | null
  thumbnail_url: string | null
  instrument: string | null
}

interface CourseEditFormProps {
  course: Course
  musicalStyles: MusicalStyle[]
  teachers: Teacher[]
}

export function CourseEditForm({ course, musicalStyles, teachers }: CourseEditFormProps) {
  const { locale } = useTranslation()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url || '')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const slug = formData.get('slug') as string
    const description = formData.get('description') as string
    const musicalStyleId = formData.get('musical_style_id') as string
    const teacherId = formData.get('teacher_id') as string
    const instrumentValue = formData.get('instrument') as string
    if (!instrumentValue || instrumentValue === 'unselected') {
      setSaving(false)
      setError(locale === 'es' ? 'Selecciona la clasificación del curso.' : 'Select the course classification.')
      return
    }
    const isPublished = formData.get('is_published') === 'on'

    try {
      const supabase = createClient()

      // Get teacher name for backward compatibility
      let teacherName = 'Unassigned'
      if (teacherId && teacherId !== 'unassigned') {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('name')
          .eq('id', teacherId)
          .single()
        if (teacher) {
          teacherName = teacher.name
        }
      }

      const { error } = await supabase
        .from('courses')
        .update({
          title,
          slug,
          description: description || null,
          musical_style_id: musicalStyleId,
          teacher_id: teacherId === 'unassigned' ? null : teacherId,
          teacher_name: teacherName,
          instrument: instrumentValue === 'unselected' ? null : (instrumentValue || null),
          is_published: isPublished,
          thumbnail_url: thumbnailUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', course.id)

      if (error) {
        console.error('Error updating course:', error)
        return
      }

      router.push('/admin/courses')
      router.refresh()
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="space-y-6">
        {/* Thumbnail Card - At the top for visual prominence */}
        <Card>
          <CardHeader>
            <CardTitle><AdminText text={"Course Thumbnail"} /></CardTitle>
          </CardHeader>
          <CardContent>
            <CourseThumbnailUpload
              courseId={course.id}
              currentImageUrl={course.thumbnail_url}
              onImageUploaded={setThumbnailUrl}
            />
          </CardContent>
        </Card>

        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle><AdminText text={"Basic Information"} /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title"><AdminText text={"Course Title"} /></Label>
              <Input
                id="title"
                name="title"
                defaultValue={course.title}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={course.slug}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description"><AdminText text={"Description"} /></Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={course.description || ''}
                rows={4}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="musical_style_id"><AdminText text={"Musical Style"} /></Label>
              <Select name="musical_style_id" defaultValue={course.musical_style_id}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {musicalStyles?.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name} ({style.country.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="instrument">{locale === 'es' ? 'Instrumento / clasificación del curso' : 'Course instrument / classification'}</Label>
              <Select name="instrument" defaultValue={course.instrument || 'unselected'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unselected" disabled>{locale === 'es' ? 'Selecciona la clasificación del curso' : 'Select the course classification'}</SelectItem>
                  {sortCourseInstruments(COURSE_INSTRUMENTS, locale).map((inst) => (
                    <SelectItem key={inst} value={inst}>
                      {getCourseInstrumentLabel(inst, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground"> {locale === 'es' ? 'La clasificación del curso es independiente del profesor.' : 'The course classification is independent of its teacher.'} </p>
            </div>
          </CardContent>
        </Card>

        {/* Teacher Assignment Card */}
        <Card>
          <CardHeader>
            <CardTitle><AdminText text={"Teacher Assignment"} /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="teacher_id"><AdminText text={"Assign Teacher"} /></Label>
              <Select name="teacher_id" defaultValue={course.teacher_id || 'unassigned'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned"><AdminText text={"Unassigned"} /></SelectItem>
                  {teachers?.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.instrument}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground"> <AdminText text={"Select a teacher to assign to this course"} /> </p>
            </div>
          </CardContent>
        </Card>

        {/* Publishing Card */}
        <Card>
          <CardHeader>
            <CardTitle><AdminText text={"Publishing"} /></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="is_published"
                name="is_published"
                defaultChecked={course.is_published ?? false}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="is_published" className="font-normal"> <AdminText text={"Publish this course (make it visible to students)"} /> </Label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> <AdminText text={"Saving..."} /> </>
            ) : (
              'Save Changes'
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/courses"><AdminText text={"Cancel"} /></Link>
          </Button>
        </div>
      </div>
    </form>
  )
}
