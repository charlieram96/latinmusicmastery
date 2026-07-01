'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ImageIcon, Loader2, Music2, Upload, X } from 'lucide-react'

const ACCEPT = {
  audio: 'audio/mpeg,audio/wav,audio/ogg,audio/webm',
  image: 'image/jpeg,image/png,image/webp,image/gif',
} as const

const ALLOWED = {
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const

const MAX_BYTES = { audio: 50 * 1024 * 1024, image: 10 * 1024 * 1024 } as const

interface QuizMediaUploadProps {
  kind: 'audio' | 'image'
  /** Used to namespace the uploaded file (e.g. question id + a slot key). */
  slug: string
  value: string
  onChange: (url: string) => void
  compact?: boolean
}

/** Compact uploader for the `quiz-media` bucket, reused for prompt clips,
 *  per-choice clips, background images and instrument part images. */
export function QuizMediaUpload({ kind, slug, value, onChange, compact = false }: QuizMediaUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    if (!ALLOWED[kind].includes(file.type)) {
      setError(kind === 'audio' ? 'Use MP3, WAV, OGG or WebM' : 'Use JPEG, PNG, WebP or GIF')
      return
    }
    if (file.size > MAX_BYTES[kind]) {
      setError(`File must be under ${MAX_BYTES[kind] / (1024 * 1024)}MB`)
      return
    }
    setError(null)
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `${slug}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('quiz-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('quiz-media').getPublicUrl(fileName)
      onChange(data.publicUrl)
    } catch (err) {
      console.error('Quiz media upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void upload(file)
  }

  const Icon = kind === 'audio' ? Music2 : ImageIcon

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[kind]}
        onChange={onPick}
        disabled={uploading}
        className="hidden"
      />

      {value ? (
        <div className="flex items-center gap-2">
          {kind === 'audio' ? (
            <audio src={value} controls className="h-9 flex-1" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Uploaded" className="h-14 w-14 rounded-lg border border-border object-contain" />
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange('')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full justify-start"
        >
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
          {uploading ? 'Uploading…' : `Upload ${kind === 'audio' ? 'audio clip' : 'image'}`}
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
