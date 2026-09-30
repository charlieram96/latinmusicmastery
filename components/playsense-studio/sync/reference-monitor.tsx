'use client';

// PlaySense Studio — sync panel's reference-video monitor.

import { VideoWatermark } from '@/components/playsense-studio/shared/video-watermark';
import { VideoFullscreenButton } from '@/components/playsense-studio/shared/video-fullscreen-button';
import { Volume2, VolumeX } from 'lucide-react';
import { useStudioText } from '../studio/use-studio-text';
import { cn } from '@/lib/utils';

// The reference-video monitor. Kept as a tiny component so SyncPanel can portal
// it into the floating PiP (`bare`) or the left-rail inspector fallback — the
// <video> stays in SyncPanel's React tree either way, so the transport clock
// keeps driving it.
export function ReferenceMonitor({
  videoRef,
  videoUrl,
  bare,
  videoMuted = false,
  onVideoMutedChange,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string | null;
  /** True when this renders inside the floating PiP, which already supplies
   *  its own label, border and rounded corners. Drops the "Reference video"
   *  section label, the card's own border, and the "Reference" badge overlay
   *  (the PiP's own drag bar already labels it) so the video fills the PiP
   *  body with no doubled chrome. */
  bare?: boolean;
  videoMuted?: boolean;
  onVideoMutedChange?: (muted: boolean) => void;
}) {
  const st = useStudioText();
  return (
    <div>
      {!bare && <span className="st-sec-label">Reference video</span>}
      <div className={cn('st-monitor', bare ? 'st-monitor-bare' : 'mt-2')}>
        {!bare && (
          <div className="st-monitor-badge">
            <span className="pip" /> Reference
          </div>
        )}
        <video controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback onContextMenu={event => event.preventDefault()}
          ref={videoRef}
          src={videoUrl ?? undefined}
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
        /><VideoWatermark /><VideoFullscreenButton />
      </div>
      {onVideoMutedChange && <div className="flex h-8 items-center border-t border-border bg-card px-2 pr-6">
        <button type="button" className="flex w-full items-center gap-2 rounded px-1 py-1 text-xs text-foreground hover:bg-muted"
          aria-label={st("Mute video audio")} aria-pressed={videoMuted}
          title={st(videoMuted ? "Unmute video audio" : "Mute video audio")}
          onClick={() => onVideoMutedChange(!videoMuted)}>
          {videoMuted ? <VolumeX className="h-3.5 w-3.5 shrink-0" /> : <Volume2 className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{st(videoMuted ? "Video audio muted" : "Mute video audio")}</span>
        </button>
      </div>}
    </div>
  );
}
