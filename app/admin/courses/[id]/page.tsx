import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
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
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface CourseEditPageProps {
  params: {
    id: string
  }
}

export default async function CourseEditPage({ params }: CourseEditPageProps) {
  const supabase = await createClient()

  // Fetch course details
  const { data: course } = await supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        id,
        name,
        country:countries(name)
      ),
      teacher:teachers(
        id,
        name,
        instrument
      )
    `)
    .eq('id', params.id)
    .single()

  if (!course) {
    notFound()
  }

  // Fetch all musical styles for the dropdown
  const { data: musicalStyles } = await supabase
    .from('musical_styles')
    .select('id, name, country:countries(name)')
    .order('name')

  // Fetch all teachers for the dropdown
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, instrument')
    .order('name')

  async function updateCourse(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const courseId = formData.get('courseId') as string
    const title = formData.get('title') as string
    const slug = formData.get('slug') as string
    const description = formData.get('description') as string
    const musicalStyleId = formData.get('musical_style_id') as string
    const teacherId = formData.get('teacher_id') as string
    const isPublished = formData.get('is_published') === 'on'
    const previewVideoUrl = formData.get('preview_video_url') as string
    const thumbnailUrl = formData.get('thumbnail_url') as string

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
        description,
        musical_style_id: musicalStyleId,
        teacher_id: teacherId === 'unassigned' ? null : teacherId,
        teacher_name: teacherName,
        is_published: isPublished,
        preview_video_url: previewVideoUrl || null,
        thumbnail_url: thumbnailUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId)

    if (error) {
      console.error('Error updating course:', error)
      return
    }

    revalidatePath('/admin/courses')
    revalidatePath(`/admin/courses/${courseId}`)
    redirect('/admin/courses')
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/courses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Courses
        </Link>
        <h1 className="text-3xl font-bold">Edit Course</h1>
        <p className="text-muted-foreground mt-2">
          Update course details and assign a teacher
        </p>
      </div>

      {/* Edit Form */}
      <form action={updateCourse}>
        <input type="hidden" name="courseId" value={course.id} />

        <div className="space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Course Title</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={course.title}
                  required
                />
              </div>

              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={course.slug}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={course.description || ''}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="musical_style_id">Musical Style</Label>
                <Select name="musical_style_id" defaultValue={course.musical_style_id}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {musicalStyles?.map((style: any) => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.name} ({style.country.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Teacher Assignment Card */}
          <Card>
            <CardHeader>
              <CardTitle>Teacher Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="teacher_id">Assign Teacher</Label>
                <Select name="teacher_id" defaultValue={course.teacher_id || 'unassigned'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teachers?.map((teacher: any) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name} - {teacher.instrument}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Select a teacher to assign to this course
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Media Card */}
          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
                <Input
                  id="thumbnail_url"
                  name="thumbnail_url"
                  type="url"
                  defaultValue={course.thumbnail_url || ''}
                  placeholder="https://example.com/thumbnail.jpg"
                />
              </div>

              <div>
                <Label htmlFor="preview_video_url">Preview Video URL</Label>
                <Input
                  id="preview_video_url"
                  name="preview_video_url"
                  type="url"
                  defaultValue={course.preview_video_url || ''}
                  placeholder="https://example.com/video.mp4"
                />
              </div>
            </CardContent>
          </Card>

          {/* Publishing Card */}
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_published"
                  name="is_published"
                  defaultChecked={course.is_published ?? false}
                />
                <Label htmlFor="is_published" className="font-normal">
                  Publish this course (make it visible to students)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" className="flex-1">
              Save Changes
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/courses">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
