'use client'

// Compact per-language subtitle uploader for lesson videos. Accepts .srt or
// .vtt, converts SRT → WebVTT client-side, and stores the file in the
// dedicated `lesson-subtitles` bucket (MIME allowlist = text/vtt only, so the
// upload must set contentType explicitly).

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Captions, Loader2, Upload, X } from 'lucide-react'
import { srtToVtt, SUBTITLE_LABELS, type SubtitleLang } from '@/lib/subtitles/srt-to-vtt'

interface SubtitleUploadProps {
  itemId: string
  lang: SubtitleLang
  currentUrl: string | null
  onChanged: (url: string | null) => void
}

export function SubtitleUpload({ itemId, lang, currentUrl, onChanged }: SubtitleUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [url, setUrl] = useState<string | null>(currentUrl)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!/\.(srt|vtt)$/i.test(file.name)) {
      setError('Please select a .srt or .vtt file')
      return
    }
    if (file.size > 1024 * 1024) {
      setError('Subtitle file must be less than 1MB')
      return
    }

    setError(null)
    setUploading(true)
    try {
      const vtt = srtToVtt(await file.text())
      const fileName = `${itemId}-${lang}-${Date.now()}.vtt`
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('lesson-subtitles')
        .upload(fileName, new Blob([vtt], { type: 'text/vtt' }), {
          contentType: 'text/vtt',
          cacheControl: '3600',
          upsert: true,
        })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('lesson-subtitles')
        .getPublicUrl(fileName)

      setUrl(publicUrl)
      onChanged(publicUrl)
    } catch (err) {
      console.error('Subtitle upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload subtitles')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    setUrl(null)
    onChanged(null)
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="flex w-8 flex-shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Captions className="h-3.5 w-3.5" />
          {lang}
        </span>
        {url ? (
          <>
            <span className="flex-1 truncate rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
              {SUBTITLE_LABELS[lang]} subtitles uploaded
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              disabled={uploading}
              onClick={handleRemove}
              aria-label={`Remove ${SUBTITLE_LABELS[lang]} subtitles`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 justify-start px-2 text-xs font-normal text-muted-foreground"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {uploading ? 'Uploading…' : `Upload ${SUBTITLE_LABELS[lang]} (.srt or .vtt)`}
          </Button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt,text/vtt"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
