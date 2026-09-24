'use client';

// PlaySense Studio — sync panel's reference-video monitor.

// The reference-video monitor. Kept as a tiny component so SyncPanel can portal
// it to the left rail (sections workspace) or the right rail (single-score
// fallback) — the <video> stays in SyncPanel's React tree either way, so the
// transport clock keeps driving it.
export function ReferenceMonitor({
  videoRef,
  videoUrl,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string | null;
}) {
  return (
    <div>
      <span className="st-sec-label">Reference video</span>
      <div className="st-monitor mt-2">
        <div className="st-monitor-badge">
          <span className="pip" /> Reference
        </div>
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
