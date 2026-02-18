'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, X, Loader2, Music2 } from 'lucide-react'

interface AudioUploadProps {
  itemId: string
  currentAudioUrl: string | null
  onAudioUploaded: (url: string) => void
}

export function AudioUpload({
  itemId,
  currentAudioUrl,
  onAudioUploaded,
}: AudioUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAudioUrl)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm']
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid audio file (MP3, WAV, OGG, or WebM)')
      return
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      setError('Audio must be less than 100MB')
      return
    }

    setError(null)
    setUploading(true)
    setProgress(0)

    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `${itemId}-${Date.now()}.${fileExt}`

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const { error: uploadError } = await supabase.storage
        .from('jam-session-audio')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      clearInterval(progressInterval)
      setProgress(100)

      if (uploadError) throw uploadError

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('jam-session-audio')
        .getPublicUrl(fileName)

      setPreviewUrl(publicUrl)
      onAudioUploaded(publicUrl)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Failed to upload audio')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const handleRemoveAudio = () => {
    setPreviewUrl(null)
    onAudioUploaded('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {previewUrl ? (
        <div className="relative rounded-lg overflow-hidden bg-muted p-4">
          <audio
            src={previewUrl}
            controls
            className="w-full"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={handleRemoveAudio}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Music2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Click to upload audio</p>
              <p className="text-sm text-muted-foreground">
                MP3, WAV, OGG, or WebM (max 100MB)
              </p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Uploading audio...</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {!previewUrl && !uploading && (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          Select Audio File
        </Button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
