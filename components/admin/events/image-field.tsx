'use client'

import { useRef, useState } from 'react'
import { ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useAdminLabel } from './shared'

const BUCKET = 'event-images'

/**
 * Downscale and re-encode in the browser: keeps emails/PDFs light and
 * guarantees PNG/JPEG, the only formats the PDF renderer can embed.
 */
async function prepareImage(file: File, maxSize: number, keepAlpha: boolean): Promise<{ blob: Blob; ext: 'png' | 'jpg' }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const png = keepAlpha && (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif')
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, png ? 'image/png' : 'image/jpeg', 0.86))
  if (!blob) throw new Error('Could not process the image')
  return { blob, ext: png ? 'png' : 'jpg' }
}

interface ImageFieldProps {
  id: string
  eventId: string
  /** Storage file prefix (e.g. "hero", "logo", "ticket-art"). */
  kind: string
  value: string | null
  onChange: (url: string | null) => void
  /** Longest side after downscaling. */
  maxSize?: number
  /** Keep transparency (logos). */
  keepAlpha?: boolean
  aspect?: string
}

export function ImageField({ id, eventId, kind, value, onChange, maxSize = 2000, keepAlpha = false, aspect = 'aspect-[16/10]' }: ImageFieldProps) {
  const L = useAdminLabel()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return setError(L('Choose an image file (JPEG, PNG or WebP).'))
    if (file.size > 20 * 1024 * 1024) return setError(L('Images must be smaller than 20 MB.'))
    setError(null)
    setBusy(true)
    try {
      const { blob, ext } = await prepareImage(file, maxSize, keepAlpha)
      const path = `${eventId}/${kind}-${Date.now()}.${ext}`
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        cacheControl: '31536000',
      })
      if (uploadError) throw uploadError
      onChange(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : L('Upload failed.'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-2">
      <div className={`relative overflow-hidden rounded-xl border bg-muted/40 ${aspect}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- Storage URL preview
          <img src={value} alt="" className={`h-full w-full ${keepAlpha ? 'object-contain p-4' : 'object-cover'}`} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="h-6 w-6" /> {L('No image')}
          </div>
        )}
        {busy && <div className="absolute inset-0 grid place-items-center bg-background/60"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={inputRef} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }} />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> {L(value ? 'Replace image' : 'Upload image')}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
            <X className="h-4 w-4" /> {L('Remove')}
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  )
}
