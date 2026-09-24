'use client';

// PlaySense Studio — sync panel's reference-video monitor.

import { cn } from '@/lib/utils';

// The reference-video monitor. Kept as a tiny component so SyncPanel can portal
// it into the floating PiP (`bare`) or the left-rail inspector fallback — the
// <video> stays in SyncPanel's React tree either way, so the transport clock
// keeps driving it.
export function ReferenceMonitor({
  videoRef,
  videoUrl,
  bare,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string | null;
  /** True when this renders inside the floating PiP, which already supplies
   *  its own label, border and rounded corners. Drops the "Reference video"
   *  section label, the card's own border, and the "Reference" badge overlay
   *  (the PiP's own drag bar already labels it) so the video fills the PiP
   *  body with no doubled chrome. */
  bare?: boolean;
}) {
  return (
    <div>
      {!bare && <span className="st-sec-label">Reference video</span>}
      <div className={cn('st-monitor', bare ? 'st-monitor-bare' : 'mt-2')}>
        {!bare && (
          <div className="st-monitor-badge">
            <span className="pip" /> Reference
          </div>
        )}
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black"
        />
      </div>
    </div>
  );
}
