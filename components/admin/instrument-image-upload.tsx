'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'

interface InstrumentImageUploadProps {
  instrumentId: string
  currentImageUrl: string | null
  onImageChange?: (url: string) => void
}

export function InstrumentImageUpload({
  instrumentId,
  currentImageUrl,
  onImageChange,
}: InstrumentImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl)
  const [urlValue, setUrlValue] = useState<string>(currentImageUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const syncUrl = (next: string) => {
    setUrlValue(next)
    setPreviewUrl(next || null)
    onImageChange?.(next)
  }

  const handleFileSelect = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `${instrumentId}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('instrument-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('instrument-images')
        .getPublicUrl(fileName)

      syncUrl(publicUrl)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err?.message || 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleRemoveImage = () => {
    syncUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      {/* Hidden form field carrying the URL into the server action */}
      <input type="hidden" name="image_url" value={urlValue} />

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        disabled={uploading}
        className="hidden"
        id="instrument-image-input"
      />

      {previewUrl ? (
        <div className="relative group">
          <div className="aspect-video rounded-xl overflow-hidden border-2 border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Instrument" className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> <AdminText text={"Replace"} /> </>
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemoveImage}
              disabled={uploading}
            >
              <X className="w-4 h-4 mr-2" /> <AdminText text={"Remove"} /> </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
          className={`
            aspect-video rounded-xl border-2 border-dashed cursor-pointer
            flex flex-col items-center justify-center gap-3
            transition-all duration-200
            ${isDragging
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'}
            ${uploading ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground"><AdminText text={"Uploading..."} /></p>
            </>
          ) : (
            <>
              <div className="p-4 rounded-full bg-muted">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground"> <AdminText text={"Drop an image here or click to upload"} /> </p>
                <p className="text-sm text-muted-foreground mt-1">
                  JPEG, PNG, WebP, or GIF • Max 10MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="pt-2">
        <label htmlFor="instrument-image-url-input" className="text-sm font-medium"> <AdminText text={"Or paste an image URL"} /> </label>
        <Input
          id="instrument-image-url-input"
          type="url"
          value={urlValue}
          onChange={(e) => syncUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="mt-1"
        />
      </div>
    </div>
  )
}
