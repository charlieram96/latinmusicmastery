'use client';

// Compás tab renderer — VexFlow TabStave for fretted instruments.
//
// Mirrors the staff renderer's structure exactly: imperative class, hit-test
// capture after format, cursor overlay updated by direct DOM mutation.
// The only differences are (a) TabStave/TabNote construction from fret data,
// and (b) auto-fingering when the source notation lacks fret assignments.

import { useEffect, useRef } from 'react';
import {
  Dot,
  Formatter,
  GhostNote,
  Renderer,
  TabNote,
  TabStave,
  Voice,
} from 'vexflow';
import type {
  Instrument,
  ScoreDocument,
} from '@/components/compas/shared/score-model/types';
import { qnToTrackMs } from '@/lib/compas/time-mapping';
import {
  extractTrackEvents,
  vexflowDurationCode,
  type VexEventDescriptor,
} from '@/lib/compas/score-to-vexflow';
import { fingerChord, fingerNote } from '@/lib/compas/auto-fingering';
import { INSTRUMENTS } from '@/lib/compas/instruments';
import type {
  ScoreRenderer,
  SeekListener,
  SeekTarget,
} from '@/lib/compas/renderer';

interface NoteHit {
  qn: number;
  ms: number;
  measure: number;
  beat: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const SYSTEM_PADDING_X = 12;
const STAVE_TOP = 28;
const PER_NOTE_MIN_WIDTH = 60;
const FIRST_MEASURE_EXTRA_WIDTH = 70;

class TabRendererImpl implements ScoreRenderer {
  private container: HTMLElement | null = null;
  private renderer: Renderer | null = null;
  private cursorEl: HTMLDivElement | null = null;
  private hits: NoteHit[] = [];
  private listeners: Set<SeekListener> = new Set();
  private clickHandler: ((e: PointerEvent) => void) | null = null;
  private totalDurationMs = 0;

  mount(el: HTMLElement, score: ScoreDocument, trackIndex: number): void {
    this.destroy();
    this.container = el;
    el.innerHTML = '';
    el.style.position = 'relative';

    const track = score.tracks[trackIndex];
    if (!track) return;

    const config = INSTRUMENTS[track.instrument as Instrument];
    if (!config?.fretted) {
      // Non-fretted instrument shouldn't be rendered as tab; show a hint.
      const hint = document.createElement('div');
      hint.className = 'p-4 text-sm text-muted-foreground';
      hint.textContent = `${config?.displayName ?? track.instrument} can't be displayed as tab.`;
      el.appendChild(hint);
      return;
    }

    const stringCount = config.courseCount;
    const stringLineSpacing = 13;
    const tabHeight = (stringCount - 1) * stringLineSpacing + 30;

    const measureBlocks = extractTrackEvents(
      track,
      score.initialTimeSignature,
      score.initialKeyFifths
    );
    if (measureBlocks.length === 0) return;

    const measureWidths = measureBlocks.map((b, i) => {
      const eventCount = Math.max(b.events.length, 1);
      const base = eventCount * PER_NOTE_MIN_WIDTH;
      return i === 0 ? base + FIRST_MEASURE_EXTRA_WIDTH : base;
    });
    const totalWidth =
      SYSTEM_PADDING_X * 2 + measureWidths.reduce((s, w) => s + w, 0);

    const rendererDiv = document.createElement('div');
    rendererDiv.style.width = `${totalWidth}px`;
    rendererDiv.style.height = `${STAVE_TOP + tabHeight + 20}px`;
    el.appendChild(rendererDiv);

    this.renderer = new Renderer(rendererDiv, Renderer.Backends.SVG);
    this.renderer.resize(totalWidth, STAVE_TOP + tabHeight + 20);
    const ctx = this.renderer.getContext();

    let currentX = SYSTEM_PADDING_X;
    const allTabNotes: Array<{
      vexNote: TabNote | GhostNote;
      descriptor: VexEventDescriptor;
      isGhost: boolean;
    }> = [];

    for (let i = 0; i < measureBlocks.length; i++) {
      const block = measureBlocks[i];
      const width = measureWidths[i];

      const stave = new TabStave(currentX, STAVE_TOP, width, {
        numLines: stringCount,
        spacingBetweenLinesPx: stringLineSpacing,
      });
      if (i === 0) {
        stave.addTabGlyph();
        stave.addTimeSignature(
          `${block.timeSignature[0]}/${block.timeSignature[1]}`
        );
      }
      stave.setContext(ctx).draw();

      const tabNotes: Array<TabNote | GhostNote> = block.events.map((d) =>
        descriptorToTabOrGhost(d, track.instrument as Instrument)
      );

      const voice = new Voice({
        numBeats: block.timeSignature[0],
        beatValue: block.timeSignature[1],
      });
      voice.setStrict(false);
      voice.addTickables(tabNotes);

      new Formatter().joinVoices([voice]).format([voice], width - 20);
      voice.draw(ctx, stave);

      block.events.forEach((d, idx) => {
        allTabNotes.push({
          vexNote: tabNotes[idx],
          descriptor: d,
          isGhost: tabNotes[idx] instanceof GhostNote,
        });
      });

      currentX += width;
    }

    this.totalDurationMs = qnToTrackMs(track, score, qnAtEnd(measureBlocks));

    this.hits = allTabNotes
      .filter((entry) => !entry.isGhost) // ghost rests aren't seekable
      .map(({ vexNote, descriptor }) => {
        const bbox = vexNote.getBoundingBox();
        return {
          qn: descriptor.qnStart,
          ms: qnToTrackMs(track, score, descriptor.qnStart),
          measure: lookupMeasureNumber(measureBlocks, descriptor.qnStart),
          beat: descriptor.beatInMeasure,
          x: bbox.getX(),
          y: bbox.getY(),
          width: bbox.getW(),
          height: bbox.getH(),
        };
      });

    this.cursorEl = document.createElement('div');
    Object.assign(this.cursorEl.style, {
      position: 'absolute',
      top: `${STAVE_TOP - 6}px`,
      left: '0',
      width: '2px',
      height: `${tabHeight + 12}px`,
      background: 'hsl(30 85% 55%)',
      pointerEvents: 'none',
      transform: 'translateX(0px)',
      willChange: 'transform',
      opacity: '0.85',
    } as CSSStyleDeclaration);
    el.appendChild(this.cursorEl);

    const svg = rendererDiv.querySelector('svg');
    if (svg) {
      svg.style.cursor = 'pointer';
      this.clickHandler = (event: PointerEvent) => {
        const rect = svg.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const target = this.findNearestHit(x);
        if (target) {
          for (const listener of this.listeners) {
            listener({ qn: target.qn, measure: target.measure, beat: target.beat });
          }
        }
      };
      svg.addEventListener('pointerdown', this.clickHandler);
    }
  }

  setTimeMs(ms: number): void {
    if (!this.cursorEl) return;
    const x = this.msToCursorX(ms);
    this.cursorEl.style.transform = `translateX(${x}px)`;
  }

  onSeek(listener: SeekListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    if (this.container) {
      const svg = this.container.querySelector('svg');
      if (svg && this.clickHandler) svg.removeEventListener('pointerdown', this.clickHandler);
      this.container.innerHTML = '';
    }
    this.container = null;
    this.renderer = null;
    this.cursorEl = null;
    this.hits = [];
    this.listeners.clear();
    this.clickHandler = null;
    this.totalDurationMs = 0;
  }

  private msToCursorX(ms: number): number {
    if (this.hits.length === 0) return 0;
    const clamped = Math.max(0, Math.min(ms, this.totalDurationMs));
    if (clamped <= this.hits[0].ms) return this.hits[0].x;
    const last = this.hits[this.hits.length - 1];
    if (clamped >= last.ms) {
      if (this.hits.length >= 2) {
        const prev = this.hits[this.hits.length - 2];
        const slope = (last.x - prev.x) / Math.max(last.ms - prev.ms, 1);
        return last.x + (clamped - last.ms) * slope;
      }
      return last.x;
    }
    let lo = 0;
    let hi = this.hits.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (this.hits[mid].ms <= clamped) lo = mid;
      else hi = mid;
    }
    const a = this.hits[lo];
    const b = this.hits[hi];
    const t = (clamped - a.ms) / Math.max(b.ms - a.ms, 1);
    return a.x + t * (b.x - a.x);
  }

  private findNearestHit(x: number): NoteHit | null {
    if (this.hits.length === 0) return null;
    let best: NoteHit | null = null;
    let bestDist = Infinity;
    for (const hit of this.hits) {
      const cx = hit.x + hit.width / 2;
      const d = Math.abs(cx - x);
      if (d < bestDist) {
        bestDist = d;
        best = hit;
      }
    }
    return best;
  }
}

function descriptorToTabOrGhost(
  d: VexEventDescriptor,
  instrument: Instrument
): TabNote | GhostNote {
  // Rests render as ghost notes — they consume musical time but draw nothing.
  if (d.isRest) {
    return new GhostNote({ duration: d.durationCode });
  }

  // Compute fret/string positions. We use auto-fingering for now since the
  // current score model doesn't surface explicit fret info on every event;
  // M6's import path will populate `fingering` from MusicXML where available.
  let positions: Array<{ str: number; fret: string | number }> = [];

  if (d.kind === 'note') {
    // Single note: extract MIDI from the key string we already produced.
    const midi = midiFromKeyString(d.keys[0]);
    if (midi !== null) {
      const f = fingerNote(instrument, midi);
      if (f) positions.push({ str: f.string, fret: f.fret });
    }
  } else if (d.kind === 'chord') {
    const midis = d.keys
      .map(midiFromKeyString)
      .filter((m): m is number => m !== null);
    const fingerings = fingerChord(instrument, midis);
    fingerings.forEach((f) => {
      if (f) positions.push({ str: f.string, fret: f.fret });
    });
  }

  if (positions.length === 0) {
    // Fallback: ghost so the bar stays in time.
    return new GhostNote({ duration: d.durationCode });
  }

  const note = new TabNote({
    positions,
    duration: vexflowDurationCode(d.durationQN, d.dotted),
  });
  if (d.dotted) Dot.buildAndAttach([note]);
  return note;
}

function midiFromKeyString(key: string): number | null {
  // VexFlow key string: "c/4", "f#/3", "bb/2"
  const match = key.match(/^([a-g])([#b]?)\/(-?\d+)$/);
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = Number(match[3]);
  const pitchClasses: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let pitchClass = pitchClasses[letter];
  if (accidental === '#') pitchClass += 1;
  else if (accidental === 'b') pitchClass -= 1;
  return (octave + 1) * 12 + pitchClass;
}

function qnAtEnd(blocks: ReturnType<typeof extractTrackEvents>): number {
  if (blocks.length === 0) return 0;
  const last = blocks[blocks.length - 1];
  const ts = last.timeSignature;
  return last.cumulativeQN + (ts[0] * 4) / ts[1];
}

function lookupMeasureNumber(
  blocks: ReturnType<typeof extractTrackEvents>,
  qn: number
): number {
  let last = blocks[0]?.measure.number ?? 1;
  for (const b of blocks) {
    if (b.cumulativeQN > qn) break;
    last = b.measure.number;
  }
  return last;
}

// ---------------------------------------------------------------------------
// React wrapper
// ---------------------------------------------------------------------------

export interface TabRendererProps {
  score: ScoreDocument;
  trackIndex: number;
  currentMs: number;
  onSeek?: (target: SeekTarget) => void;
  className?: string;
}

export function TabRenderer({
  score,
  trackIndex,
  currentMs,
  onSeek,
  className,
}: TabRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<TabRendererImpl | null>(null);
  const onSeekRef = useRef(onSeek);

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const impl = new TabRendererImpl();
    rendererRef.current = impl;
    impl.mount(el, score, trackIndex);
    const unsub = impl.onSeek((target) => {
      onSeekRef.current?.(target);
    });
    return () => {
      unsub();
      impl.destroy();
      rendererRef.current = null;
    };
  }, [score, trackIndex]);

  useEffect(() => {
    rendererRef.current?.setTimeMs(currentMs);
  }, [currentMs]);

  return <div ref={containerRef} className={className} />;
}
