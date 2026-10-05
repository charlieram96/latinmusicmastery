'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Upload, X, Loader2 } from 'lucide-react'

interface TeacherImageUploadProps {
  teacherId: string
  currentImageUrl: string | null
  teacherName: string
  onImageUploaded: (url: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function TeacherImageUpload({
  teacherId,
  currentImageUrl,
  teacherName,
  onImageUploaded,
}: TeacherImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()

      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${teacherId}-${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('teacher-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        throw uploadError
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('teacher-images')
        .getPublicUrl(fileName)

      setPreviewUrl(publicUrl)
      onImageUploaded(publicUrl)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setPreviewUrl(null)
    onImageUploaded('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <Avatar className="w-40 h-40">
          {previewUrl && <AvatarImage src={previewUrl} alt={teacherName} className="object-cover" />}
          <AvatarFallback className="bg-primary/10 text-primary text-4xl font-semibold">
            {getInitials(teacherName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id="teacher-image-input"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> <AdminText text={"Uploading..."} /> </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> <AdminText text={"Upload Image"} /> </>
              )}
            </Button>

            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveImage}
                disabled={uploading}
              >
                <X className="w-4 h-4 mr-2" /> <AdminText text={"Remove"} /> </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, or GIF. Max 5MB.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
