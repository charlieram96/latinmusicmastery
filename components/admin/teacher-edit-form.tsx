'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { TeacherImageUpload } from './teacher-image-upload'
import { TiptapEditor } from './tiptap-editor'
import type { Json } from '@/types/database'

type BioDoc = Record<string, unknown>

function isEmptyDoc(doc: BioDoc | null): boolean {
  if (!doc) return true
  const content = (doc as { content?: unknown[] }).content
  if (!Array.isArray(content) || content.length === 0) return true
  const hasText = JSON.stringify(content).match(/"text"\s*:\s*"[^"]/)
  return !hasText
}

interface Teacher {
  id: string
  name: string
  instrument: string
  instrument_es?: string | null
  bio: unknown
  bio_es?: unknown
  email: string | null
  image_url: string | null
  specialties: string[] | null
}

interface TeacherEditFormProps {
  teacher: Teacher | null
}

export function TeacherEditForm({ teacher }: TeacherEditFormProps) {
  const router = useRouter()
  const isNew = teacher === null

  // For a new teacher we need a stable ID up front so the image upload
  // can name its storage object deterministically.
  const draftId = useMemo(
    () => teacher?.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `draft-${Date.now()}`),
    [teacher?.id]
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState(teacher?.image_url || '')
  const [nameValue, setNameValue] = useState(teacher?.name || '')
  const [bioDoc, setBioDoc] = useState<BioDoc | null>(
    teacher?.bio && typeof teacher.bio === 'object'
      ? (teacher.bio as BioDoc)
      : null
  )
  const [bioEsDoc, setBioEsDoc] = useState<BioDoc | null>(
    teacher?.bio_es && typeof teacher.bio_es === 'object'
      ? (teacher.bio_es as BioDoc)
      : null
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const name = (formData.get('name') as string).trim()
    const instrument = (formData.get('instrument') as string).trim()
    const instrumentEs = ((formData.get('instrument_es') as string) || '').trim()
    const email = (formData.get('email') as string).trim()
    const specialtiesRaw = formData.get('specialties') as string

    const specialties = specialtiesRaw
      ? specialtiesRaw.split(',').map(s => s.trim()).filter(Boolean)
      : null

    const supabase = createClient()
    const payload = {
      name,
      instrument,
      instrument_es: instrumentEs || null,
      bio: (isEmptyDoc(bioDoc) ? null : bioDoc) as Json | null,
      bio_es: (isEmptyDoc(bioEsDoc) ? null : bioEsDoc) as Json | null,
      email: email || null,
      image_url: imageUrl || null,
      specialties,
    }

    const { error: dbError } = isNew
      ? await supabase.from('teachers').insert({ id: draftId, ...payload })
      : await supabase
          .from('teachers')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', teacher!.id)

    if (dbError) {
      console.error('Error saving teacher:', dbError)
      setError(dbError.message)
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
        <h1 className="text-3xl font-bold">
          {isNew ? 'Add Teacher' : 'Edit Teacher'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isNew ? 'Create a new instructor profile' : 'Update teacher profile information'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Profile Image Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Image</CardTitle>
            </CardHeader>
            <CardContent>
              <TeacherImageUpload
                teacherId={draftId}
                currentImageUrl={teacher?.image_url ?? null}
                teacherName={nameValue || 'New Teacher'}
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
                  defaultValue={teacher?.name || ''}
                  onChange={(e) => setNameValue(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="instrument">Instrument</Label>
                <Input
                  id="instrument"
                  name="instrument"
                  defaultValue={teacher?.instrument || ''}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="instrument_es" className="text-muted-foreground">Instrument (Español)</Label>
                <Input
                  id="instrument_es"
                  name="instrument_es"
                  defaultValue={teacher?.instrument_es || ''}
                  placeholder="e.g., Percusión, Timbal (optional — auto-translated when empty)"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={teacher?.email || ''}
                  placeholder="teacher@example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <TiptapEditor
                  content={bioDoc}
                  onChange={(next) => setBioDoc(next)}
                />
                <p className="text-xs text-muted-foreground">
                  Supports rich formatting — headings, lists, links, images, and video.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bio_es" className="text-muted-foreground">Bio (Español)</Label>
                <TiptapEditor
                  content={bioEsDoc}
                  onChange={(next) => setBioEsDoc(next)}
                />
                <p className="text-xs text-muted-foreground">
                  Shown to students who use the site in Spanish. Falls back to the English bio when empty.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  name="specialties"
                  defaultValue={teacher?.specialties?.join(', ') || ''}
                  placeholder="Salsa, Timba, Son Cubano"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of specialties
                </p>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                isNew ? 'Create Teacher' : 'Save Changes'
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
