'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// PlaySense Studio — floating reference video. Dragged by its top bar, shrinks
// to a pill, and remembers where this viewer left it. Its body is the portal
// slot SyncPanel renders the reference monitor into (monitorEl); the video stays
// mounted as a pill because it is the playback clock.

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PipPlacement { right: number; top: number; minimized: boolean; width?: number }

export const PIP_WIDTH = 236;
const FULL_H = 170;
const PILL_H = 60;
const STORAGE_KEY = 'playsense-studio:pip';

export function clampPip(p: PipPlacement, box: { width: number; height: number }): PipPlacement {
  const width = Math.max(160, Math.min(p.width ?? PIP_WIDTH, 720, box.width - 16, (box.height - 48) * 16 / 9));
  const h = p.minimized ? PILL_H : Math.max(FULL_H, width * 9 / 16 + 32);
  return {
    minimized: p.minimized,
    ...(p.width !== undefined ? {width} : {}),
    right: Math.max(8, Math.min(p.right, box.width - width - 8)),
    top: Math.max(8, Math.min(p.top, box.height - h)),
  };
}

export function FloatingVideo({ label, onBodyEl }: { label: string; onBodyEl: (el: HTMLDivElement | null) => void }) {
  const st = useStudioText();
  const ref = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState<PipPlacement | null>(null);
  const drag = useRef<{ x: number; y: number; start: PipPlacement } | null>(null);

  const resize = useRef<{x:number; y:number; start:PipPlacement} | null>(null);
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

  // Re-clamp when the stage resizes (e.g. the window, or the rail opening/
  // closing) so the PiP never ends up stranded off screen or under the rail.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      setPlace((p) => (p ? clampPip(p, box()) : p));
    });
    ro.observe(parent);
    return () => ro.disconnect();
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
      style={place ? { right: place.right, top: place.top, width: place.minimized ? undefined : place.width ?? PIP_WIDTH } : { right: 26, bottom: 26 }}
    >
      <div className="st-pip-bar" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="st-pip-rec" aria-hidden />
        <span className="truncate">{st(label)}</span>
        <button
          type="button"
          className="ml-auto grid h-6 w-6 place-items-center rounded-md hover:bg-white/10"
          title={st(place?.minimized ? 'Show video' : 'Shrink to a pill')}
          aria-label={st(place?.minimized ? 'Show video' : 'Shrink to a pill')}
          onClick={toggle}
        >
          {place?.minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div ref={onBodyEl} className="st-pip-body" />
      {!place?.minimized && <button type="button" className="st-pip-resize" aria-label={st('Resize video')} title={st('Drag to resize video')}
        onPointerDown={e=>{if(!place)return; e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);resize.current={x:e.clientX,y:e.clientY,start:place};}}
        onPointerMove={e=>{const d=resize.current;if(!d)return; const dx=e.clientX-d.x,dy=(e.clientY-d.y)*16/9;const delta=Math.abs(dx)>Math.abs(dy)?dx:dy; const width=(d.start.width??PIP_WIDTH)+delta;setPlace(clampPip({...d.start,width,right:d.start.right-delta},box()));}}
        onPointerUp={e=>{resize.current=null;e.currentTarget.releasePointerCapture(e.pointerId);if(place)save(place);}}
        onPointerCancel={()=>{resize.current=null;}}
        onKeyDown={e=>{if(!place || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const next=clampPip({...place,width:(place.width??PIP_WIDTH)+(['ArrowRight','ArrowDown'].includes(e.key)?20:-20)},box());setPlace(next);save(next);}}
      >◢</button>}
    </div>
  );
}
