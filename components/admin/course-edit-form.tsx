'use client'

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
import { SUBSCRIBABLE_INSTRUMENTS } from '@/lib/instruments'

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
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url || '')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const slug = formData.get('slug') as string
    const description = formData.get('description') as string
    const musicalStyleId = formData.get('musical_style_id') as string
    const teacherId = formData.get('teacher_id') as string
    const instrumentValue = formData.get('instrument') as string
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
          instrument: instrumentValue === 'auto' ? null : (instrumentValue || null),
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
      <div className="space-y-6">
        {/* Thumbnail Card - At the top for visual prominence */}
        <Card>
          <CardHeader>
            <CardTitle>Course Thumbnail</CardTitle>
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
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Course Title</Label>
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={course.description || ''}
                rows={4}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="musical_style_id">Musical Style</Label>
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
              <Label htmlFor="instrument">Instrument</Label>
              <Select name="instrument" defaultValue={course.instrument || 'auto'}>
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
              <p className="text-xs text-muted-foreground">
                Auto-set when teacher is assigned, but can be overridden
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Teacher Assignment Card */}
        <Card>
          <CardHeader>
            <CardTitle>Teacher Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="teacher_id">Assign Teacher</Label>
              <Select name="teacher_id" defaultValue={course.teacher_id || 'unassigned'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teachers?.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.instrument}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a teacher to assign to this course
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Publishing Card */}
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
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
              <Label htmlFor="is_published" className="font-normal">
                Publish this course (make it visible to students)
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/courses">Cancel</Link>
          </Button>
        </div>
      </div>
    </form>
  )
}
