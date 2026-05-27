'use client';

// PlaySense Studio — notation strip beneath the waveform.
//
// Each measure is its own small VexFlow stave, absolutely positioned at the
// measure's audio span (startX..endX derived from the markers) and sized to its
// pixel width. As the admin drags markers, measures stretch/shift to sit under
// the audio they map to — the WYSIWYG core of the editor.
//
// Only measures intersecting the viewport are rendered (virtualized by the same
// scroll window the canvas uses). Reuses extractTrackEvents' descriptors; it
// does NOT reuse the full StaffRenderer, which carries its own scroll/cursor
// model that would fight the waveform's coordinate space.

import { memo, useEffect, useRef, useState } from 'react';
import { Accidental, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { themeVexflowSvg } from '@/lib/playsense-studio/svg-theme';
import type { VexEventDescriptor } from '@/lib/playsense-studio/score-to-vexflow';

export interface MeasureStripItem {
  measureNumber: number;
  startVideoTimeSeconds: number;
  endVideoTimeSeconds: number;
  events: VexEventDescriptor[];
  timeSignature: [number, number];
  isFirst: boolean;
}

export interface MeasureStripProps {
  measures: MeasureStripItem[];
  pixelsPerSecond: number;
  scrollLeftPx: number;
  height?: number;
}

const DEFAULT_HEIGHT = 92;
const STAVE_TOP = 14;
const LEFT_PAD = 6;
const RIGHT_PAD = 6;
/** Below this width a measure is too narrow to render legibly — show nothing. */
const MIN_RENDER_WIDTH = 46;

export function MeasureStrip({
  measures,
  pixelsPerSecond,
  scrollLeftPx,
  height = DEFAULT_HEIGHT,
}: MeasureStripProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const videoTimeToX = (t: number) => t * pixelsPerSecond - scrollLeftPx;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-md border border-border bg-card"
      style={{ height }}
    >
      {measures.map((m) => {
        const startX = videoTimeToX(m.startVideoTimeSeconds);
        const endX = videoTimeToX(m.endVideoTimeSeconds);
        const width = endX - startX;
        // Virtualize: skip measures fully outside the viewport.
        if (endX < -20 || startX > viewportWidth + 20) return null;
        if (width < MIN_RENDER_WIDTH) return null;
        return (
          <div
            key={m.measureNumber}
            className="absolute top-0"
            style={{ left: startX, width }}
          >
            <MiniStave
              events={m.events}
              width={Math.round(width)}
              height={height}
              timeSignature={m.timeSignature}
              isFirst={m.isFirst}
            />
          </div>
        );
      })}
    </div>
  );
}

interface MiniStaveProps {
  events: VexEventDescriptor[];
  width: number;
  height: number;
  timeSignature: [number, number];
  isFirst: boolean;
}

const MiniStave = memo(function MiniStave({
  events,
  width,
  height,
  timeSignature,
  isFirst,
}: MiniStaveProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';

    const staveWidth = Math.max(20, width - LEFT_PAD - RIGHT_PAD);
    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();

    const stave = new Stave(LEFT_PAD, STAVE_TOP, staveWidth);
    if (isFirst) {
      stave.addClef('treble').addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
    }
    stave.setContext(ctx).draw();

    if (events.length > 0) {
      try {
        const notes = events.map(descriptorToStaveNote);
        const voice = new Voice({ numBeats: timeSignature[0], beatValue: timeSignature[1] });
        voice.setStrict(false);
        voice.addTickables(notes);
        new Formatter().joinVoices([voice]).format([voice], Math.max(20, staveWidth - 16));
        voice.draw(ctx, stave);
      } catch {
        // Malformed/overfull measure — the stave still drew; skip the notes.
      }
    }

    const svg = el.querySelector('svg');
    if (svg) themeVexflowSvg(svg as SVGSVGElement);

    return () => {
      el.innerHTML = '';
    };
  }, [events, width, height, timeSignature, isFirst]);

  return <div ref={ref} />;
});

function descriptorToStaveNote(d: VexEventDescriptor): StaveNote {
  const note = new StaveNote({
    keys: d.keys,
    duration: d.isRest ? `${d.durationCode}r` : d.durationCode,
  });
  if (d.dotted) Dot.buildAndAttach([note]);
  d.accidentals.forEach((acc, idx) => {
    if (acc) note.addModifier(new Accidental(acc), idx);
  });
  return note;
}
