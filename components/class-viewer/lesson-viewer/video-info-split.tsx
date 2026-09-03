'use client'

// No-score video lesson workspace.
//
// When a VIDEO lesson has no notation attached, we still want the resizable
// split feel of the PlaySense player rather than a giant full-width video.
// This reuses the shared SplitWorkspace shell: the video sits in the primary
// pane (sensibly sized, not stretched edge-to-edge of the page) and an
// "About this lesson" panel fills the secondary pane.

import { Clock } from 'lucide-react'
import { SplitWorkspace, OrientationToggle } from '@/components/playsense-studio/player/split-workspace'
import { Badge } from '@/components/ui/badge'
import { TiptapReadOnly } from '@/components/class-viewer/tiptap-read-only'
import { useTranslation } from '@/components/language-provider'

interface VideoInfoSplitProps {
  videoUrl: string
  title: string
  description: string | null
  richContent: Record<string, unknown> | null
  durationSeconds: number | null
  bpm: number | null
  keySignature: string | null
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoInfoSplit({
  videoUrl,
  title,
  description,
  richContent,
  durationSeconds,
  bpm,
  keySignature,
}: VideoInfoSplitProps) {
  const { t } = useTranslation()
  const durationLabel = formatDuration(durationSeconds)
  const hasFacts = Boolean(durationLabel || bpm || keySignature)
  const hasBody = Boolean(description || richContent)

  return (
    <SplitWorkspace
      primary={
        <div className="flex flex-1 items-center justify-center overflow-hidden p-3">
          <video
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-full max-w-full rounded-lg bg-black object-contain"
          />
        </div>
      }
      secondaryHeader={({ orient, setOrient }) => (
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-secondary px-4 py-2.5">
          <div className="min-w-0">
            <div className="text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-primary">
              {t('dashboard.pages.modules.aboutLesson')}
            </div>
            <div className="mt-1 truncate font-heading text-[13.5px] font-bold tracking-tight text-foreground">
              {title}
            </div>
          </div>
          <OrientationToggle value={orient} onChange={setOrient} />
        </div>
      )}
      secondary={
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-foreground">
          {hasFacts && (
            <div className="flex flex-wrap items-center gap-2">
              {durationLabel && (
                <Badge variant="outline" className="gap-1.5">
                  <Clock className="h-3 w-3" />
                  {durationLabel}
                </Badge>
              )}
              {bpm && (
                <Badge variant="outline">BPM: {bpm}</Badge>
              )}
              {keySignature && (
                <Badge variant="outline">{t('dashboard.classViewer.renderer.key', { key: keySignature })}</Badge>
              )}
            </div>
          )}

          {description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
              {description}
            </p>
          )}

          {richContent && <TiptapReadOnly content={richContent} />}

          {!hasBody && (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.classViewer.renderer.noNotes')}
            </p>
          )}
        </div>
      }
    />
  )
}
