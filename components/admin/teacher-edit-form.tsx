'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { TeacherImageUpload } from './teacher-image-upload'

interface Teacher {
  id: string
  name: string
  instrument: string
  bio: string | null
  email: string | null
  image_url: string | null
  specialties: string[] | null
}

interface TeacherEditFormProps {
  teacher: Teacher
}

export function TeacherEditForm({ teacher }: TeacherEditFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState(teacher.image_url || '')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const instrument = formData.get('instrument') as string
    const bio = formData.get('bio') as string
    const email = formData.get('email') as string
    const specialtiesRaw = formData.get('specialties') as string

    const specialties = specialtiesRaw
      ? specialtiesRaw.split(',').map(s => s.trim()).filter(Boolean)
      : null

    const supabase = createClient()

    const { error } = await supabase
      .from('teachers')
      .update({
        name,
        instrument,
        bio: bio || null,
        email: email || null,
        image_url: imageUrl || null,
        specialties,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teacher.id)

    if (error) {
      console.error('Error updating teacher:', error)
      setSaving(false)
      return
    }

    router.push('/admin/teachers')
    router.refresh()
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/teachers"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Teachers
        </Link>
        <h1 className="text-3xl font-bold">Edit Teacher</h1>
        <p className="text-muted-foreground mt-2">
          Update teacher profile information
        </p>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Profile Image Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Image</CardTitle>
            </CardHeader>
            <CardContent>
              <TeacherImageUpload
                teacherId={teacher.id}
                currentImageUrl={teacher.image_url}
                teacherName={teacher.name}
                onImageUploaded={setImageUrl}
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
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={teacher.name}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="instrument">Instrument</Label>
                <Input
                  id="instrument"
                  name="instrument"
                  defaultValue={teacher.instrument}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={teacher.email || ''}
                  placeholder="teacher@example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  defaultValue={teacher.bio || ''}
                  rows={4}
                  placeholder="Brief biography of the teacher..."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  name="specialties"
                  defaultValue={teacher.specialties?.join(', ') || ''}
                  placeholder="Salsa, Timba, Son Cubano"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of specialties
                </p>
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
              <Link href="/admin/teachers">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
