'use client';

// Compás rhythm grid renderer — for hand drums (conga / bongo / timbal /
// clave). Each row is a stroke type (slap, open-high, bass, etc.); each
// column is a 16th-note cell of the bar. Cells light up when the playback
// cursor lands inside their event range.
//
// This is the visualization style Latin percussionists actually read for
// clave/tumbao patterns. It complements the standard staff (which can
// represent the same data on a 5-line staff) — the view-switcher lets users
// pick whichever clicks for them.

import { useEffect, useMemo, useRef } from 'react';
import { qnToTrackMs } from '@/lib/compas/time-mapping';
import { extractTrackEvents } from '@/lib/compas/score-to-vexflow';
import type {
  Instrument,
  ScoreDocument,
} from '@/components/compas/shared/score-model/types';

// MIDI conventions used by our percussion fixtures. (Mirrors the percussion
// channel mapping used by GM-style drum maps. We don't need GM-strict for
// custom Compás authoring, but keeping near-GM lets MIDI imports work.)
const STROKE_ROWS: Record<Instrument, Array<{ midi: number; label: string }>> = {
  guitar: [],
  bass: [],
  tres: [],
  cuatro: [],
  tiple: [],
  ukulele: [],
  mandolin: [],
  piano: [],
  staff: [],
  'perc-kit': [
    { midi: 36, label: 'Kick' },
    { midi: 38, label: 'Snare' },
    { midi: 42, label: 'Hat' },
    { midi: 49, label: 'Crash' },
  ],
  'perc-conga': [
    { midi: 64, label: 'Open H' },
    { midi: 63, label: 'Bass' },
    { midi: 62, label: 'Slap' },
  ],
  'perc-bongo': [
    { midi: 60, label: 'Hembra' },
    { midi: 61, label: 'Macho' },
  ],
  'perc-timbal': [
    { midi: 65, label: 'Cascara' },
    { midi: 66, label: 'Bell' },
    { midi: 67, label: 'Hembra' },
  ],
  'perc-clave': [{ midi: 75, label: 'Clave' }],
};

const ROW_HEIGHT = 38;
const CELL_WIDTH = 36;
const LABEL_WIDTH = 86;
const HEADER_HEIGHT = 24;

interface CellEvent {
  rowIndex: number;
  startQN: number;
  endQN: number;
  startMs: number;
  endMs: number;
}

export interface RhythmGridRendererProps {
  score: ScoreDocument;
  trackIndex: number;
  currentMs: number;
  onSeek?: (ms: number) => void;
  className?: string;
}

export function RhythmGridRenderer({
  score,
  trackIndex,
  currentMs,
  className,
}: RhythmGridRendererProps) {
  const cellRefs = useRef<Map<number, SVGRectElement>>(new Map());

  const track = score.tracks[trackIndex];
  const instrument = track?.instrument as Instrument | undefined;
  const rows = instrument ? STROKE_ROWS[instrument] : [];

  const { cells, totalCells, cellQN } = useMemo(() => {
    if (!track) return { cells: [], totalCells: 0, cellQN: 0.25 };
    return computeCells(score, trackIndex, rows);
  }, [score, trackIndex, rows, track]);

  // Drive cell highlights via direct DOM update.
  useEffect(() => {
    cells.forEach((event, idx) => {
      const el = cellRefs.current.get(idx);
      if (!el) return;
      const active = currentMs >= event.startMs && currentMs < event.endMs;
      el.setAttribute('opacity', active ? '1' : '0.7');
      el.setAttribute(
        'fill',
        active ? 'hsl(var(--primary))' : 'hsl(var(--compas-grid-stroke))'
      );
    });
  }, [currentMs, cells]);

  if (!track || rows.length === 0) {
    return (
      <div className={`p-4 text-sm text-muted-foreground ${className ?? ''}`}>
        Rhythm grid is only available for percussion tracks.
      </div>
    );
  }

  const width = LABEL_WIDTH + totalCells * CELL_WIDTH + 8;
  const height = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 4;

  return (
    <div className={`overflow-x-auto ${className ?? ''}`}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${track.displayName} rhythm grid`}
      >
        {/* Header beat numbers */}
        {Array.from({ length: totalCells }, (_, i) => {
          const beat = i * cellQN;
          const isDownbeat = Number.isInteger(beat / 1);
          const isHalfBeat = Number.isInteger(beat / 0.5);
          const label = isDownbeat
            ? String((beat % 4) + 1)
            : isHalfBeat
              ? '+'
              : '';
          return (
            <text
              key={i}
              x={LABEL_WIDTH + i * CELL_WIDTH + CELL_WIDTH / 2}
              y={HEADER_HEIGHT - 6}
              textAnchor="middle"
              fontSize="11"
              fontFamily="ui-monospace, monospace"
              fill={
                isDownbeat
                  ? 'hsl(var(--compas-notation))'
                  : 'hsl(var(--compas-notation-muted))'
              }
            >
              {label}
            </text>
          );
        })}

        {/* Row labels and grid */}
        {rows.map((row, ri) => {
          const y = HEADER_HEIGHT + ri * ROW_HEIGHT;
          return (
            <g key={row.midi}>
              <text
                x={6}
                y={y + ROW_HEIGHT / 2 + 4}
                fontSize="12"
                fontFamily="Inter, system-ui, sans-serif"
                fill="hsl(var(--compas-notation))"
              >
                {row.label}
              </text>
              {/* Cell backgrounds */}
              {Array.from({ length: totalCells }, (_, ci) => {
                const isBarStart = ci % 16 === 0 && ci !== 0;
                const isBeat = ci % 4 === 0;
                return (
                  <rect
                    key={ci}
                    x={LABEL_WIDTH + ci * CELL_WIDTH}
                    y={y + 4}
                    width={CELL_WIDTH - 2}
                    height={ROW_HEIGHT - 8}
                    fill="hsl(var(--compas-grid-cell-bg))"
                    stroke={
                      isBarStart
                        ? 'hsl(var(--compas-grid-stroke))'
                        : 'hsl(var(--compas-grid-cell-border))'
                    }
                    strokeWidth={isBarStart ? 2 : isBeat ? 1.5 : 1}
                    opacity={isBeat || isBarStart ? 1 : 0.7}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Strokes */}
        {cells.map((cell, idx) => {
          const x = LABEL_WIDTH + Math.round(cell.startQN / cellQN) * CELL_WIDTH;
          const y = HEADER_HEIGHT + cell.rowIndex * ROW_HEIGHT + 4;
          const cellsWide = Math.max(
            1,
            Math.round((cell.endQN - cell.startQN) / cellQN)
          );
          return (
            <rect
              key={idx}
              ref={(el) => {
                if (el) cellRefs.current.set(idx, el);
                else cellRefs.current.delete(idx);
              }}
              x={x + 3}
              y={y + 6}
              width={cellsWide * CELL_WIDTH - 6}
              height={ROW_HEIGHT - 12}
              rx={4}
              fill="hsl(var(--compas-grid-stroke))"
              opacity={0.7}
              style={{ transition: 'opacity 80ms linear, fill 80ms linear' }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function computeCells(
  score: ScoreDocument,
  trackIndex: number,
  rows: Array<{ midi: number; label: string }>
): { cells: CellEvent[]; totalCells: number; cellQN: number } {
  const track = score.tracks[trackIndex];
  if (!track) return { cells: [], totalCells: 0, cellQN: 0.25 };

  const cellQN = 0.25; // 16th-note grid
  const measureBlocks = extractTrackEvents(
    track,
    score.initialTimeSignature,
    score.initialKeyFifths
  );

  const events: CellEvent[] = [];
  let lastMidi: Record<number, number | undefined> = {};
  void lastMidi;

  for (const block of measureBlocks) {
    for (const ev of block.events) {
      if (ev.isRest) continue;
      const midis = ev.kind === 'note' ? [midiFromKey(ev.keys[0])] : ev.keys.map(midiFromKey);
      for (const midi of midis) {
        const rowIndex = rows.findIndex((r) => r.midi === midi);
        if (rowIndex < 0) continue;
        const startMs = qnToTrackMs(track, score, ev.qnStart);
        const endMs = qnToTrackMs(track, score, ev.qnStart + ev.durationQN);
        events.push({
          rowIndex,
          startQN: ev.qnStart,
          endQN: ev.qnStart + ev.durationQN,
          startMs,
          endMs,
        });
      }
    }
  }

  const totalQN = measureBlocks.reduce((sum, b) => {
    return sum + (b.timeSignature[0] * 4) / b.timeSignature[1];
  }, 0);
  const totalCells = Math.ceil(totalQN / cellQN);

  return { cells: events, totalCells, cellQN };
}

function midiFromKey(key: string): number {
  const match = key.match(/^([a-g])([#b]?)\/(-?\d+)$/);
  if (!match) return -1;
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
