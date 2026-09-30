'use client'

// No-score video lesson workspace.
//
// When a VIDEO lesson has no notation attached, we still want the resizable
// split feel of the PlaySense player rather than a giant full-width video.
// This reuses the lesson workspace: the video sits in the media region
// (sensibly sized, not stretched edge-to-edge of the page) and an "About this
// lesson" panel fills the music region. Only side and stack make sense here.

import { VideoWatermark } from '@/components/playsense-studio/shared/video-watermark';
import { Clock } from 'lucide-react'
import { SplitWorkspace, WorkspaceLayoutSwitcher } from '@/components/playsense-studio/player/split-workspace'
import { useWorkspaceLayout } from '@/components/playsense-studio/player/use-workspace-layout'
import { WATCH_WORKSPACE, type WorkspaceLayout, type WorkspaceState } from '@/lib/playsense-studio/workspace-layout'
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

const INFO_WORKSPACE: WorkspaceState = { ...WATCH_WORKSPACE, split: 55 }
const INFO_LAYOUTS: readonly WorkspaceLayout[] = ['side', 'stack']

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
  const workspace = useWorkspaceLayout('video-info', INFO_WORKSPACE, { layouts: INFO_LAYOUTS })

  return (
    <SplitWorkspace
      controller={workspace}
      media={
        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3">
          <video controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback onContextMenu={event => event.preventDefault()}
            src={videoUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-full max-w-full rounded-lg bg-black object-contain"
          /><VideoWatermark nativeControls />
        </div>
      }
      music={
        <>
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-secondary px-4 py-2.5">
          <div className="min-w-0">
            <div className="text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-primary">
              {t('dashboard.pages.modules.aboutLesson')}
            </div>
            <div className="mt-1 truncate font-heading text-[13.5px] font-bold tracking-tight text-foreground">
              {title}
            </div>
          </div>
          <WorkspaceLayoutSwitcher controller={workspace} />
        </div>
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
        </>
      }
    />
  )
}
