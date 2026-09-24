'use client';

// PlaySense Studio — floating reference video. Dragged by its top bar, shrinks
// to a pill, and remembers where this viewer left it. Its body is the portal
// slot SyncPanel renders the reference monitor into (monitorEl); the video stays
// mounted as a pill because it is the playback clock.

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PipPlacement { right: number; top: number; minimized: boolean }

export const PIP_WIDTH = 236;
const FULL_H = 170;
const PILL_H = 60;
const STORAGE_KEY = 'playsense-studio:pip';

export function clampPip(p: PipPlacement, box: { width: number; height: number }): PipPlacement {
  const h = p.minimized ? PILL_H : FULL_H;
  return {
    minimized: p.minimized,
    right: Math.max(8, Math.min(p.right, box.width - PIP_WIDTH - 8)),
    top: Math.max(8, Math.min(p.top, box.height - h)),
  };
}

export function FloatingVideo({ label, onBodyEl }: { label: string; onBodyEl: (el: HTMLDivElement | null) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<PipPlacement | null>(null);
  const drag = useRef<{ x: number; y: number; start: PipPlacement } | null>(null);

  const box = () => {
    const parent = ref.current?.parentElement;
    return { width: parent?.clientWidth ?? 1000, height: parent?.clientHeight ?? 600 };
  };

  // Default bottom-right, then any stored placement (client only).
  useEffect(() => {
    const b = box();
    let next: PipPlacement = { right: 26, top: b.height - FULL_H, minimized: false };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) next = { ...next, ...(JSON.parse(raw) as Partial<PipPlacement>) };
    } catch { /* storage unavailable */ }
    setPlace(clampPip(next, b));
  }, []);

  const save = (p: PipPlacement) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
  };

  const onDown = (e: React.PointerEvent) => {
    if (!place || (e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: place };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPlace(clampPip({ ...d.start, right: d.start.right - (e.clientX - d.x), top: d.start.top + (e.clientY - d.y) }, box()));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (place) save(place);
  };
  const toggle = () => {
    if (!place) return;
    const next = clampPip({ ...place, minimized: !place.minimized }, box());
    setPlace(next);
    save(next);
  };

  return (
    <div
      ref={ref}
      className={cn('st-pip', place?.minimized && 'is-min')}
      style={place ? { right: place.right, top: place.top } : { right: 26, bottom: 26 }}
    >
      <div className="st-pip-bar" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="st-pip-rec" aria-hidden />
        <span className="truncate">{label}</span>
        <button
          type="button"
          className="ml-auto grid h-6 w-6 place-items-center rounded-md hover:bg-white/10"
          title={place?.minimized ? 'Show video' : 'Shrink to a pill'}
          aria-label={place?.minimized ? 'Show video' : 'Shrink to a pill'}
          onClick={toggle}
        >
          {place?.minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div ref={onBodyEl} className="st-pip-body" />
    </div>
  );
}
