'use client';

// Compás piano-roll editor view. Pitches run vertically (top = high pitch),
// time horizontally (16th-note cells). Each note in voice 1 of the active
// track renders as a brand-color rectangle spanning its duration.
//
// Interactions:
//   • Click an empty cell           → add a note at that pitch + beat with
//                                     the toolbar's current duration.
//   • Click an existing note        → select it (orange ring).
//   • Delete / Backspace            → remove the selected note.
//   • Click an empty cell in the
//     same measure as a selected
//     event                         → still adds; selection moves to the new
//                                     event so further duration changes
//                                     hit the right thing.
//
// We treat each measure as its own bucket; a note's "qn within measure"
// determines its column. Resolution is 16ths (cellQN = 0.25).

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import type { EditorAction } from '@/lib/compas/editor-state';
import type {
  Chord,
  Note,
  ScoreDocument,
} from '@/components/compas/shared/score-model/types';
import { measureLengthInQN } from '@/lib/compas/time-mapping';

const PITCH_TOP_MIDI = 84; // C6
const PITCH_BOTTOM_MIDI = 36; // C2
const ROW_HEIGHT = 14;
const CELL_QN = 0.25; // 16th-note grid
const CELL_WIDTH = 22;
const KEY_LABEL_WIDTH = 40;
const HEADER_HEIGHT = 22;

const DURATION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 4, label: 'whole' },
  { value: 2, label: 'half' },
  { value: 1, label: 'quarter' },
  { value: 0.5, label: '8th' },
  { value: 0.25, label: '16th' },
];

interface PianoRollViewProps {
  score: ScoreDocument;
  activeTrackIndex: number;
  dispatch: Dispatch<EditorAction>;
}

interface RenderableNote {
  measureIndex: number;
  eventIndex: number;
  midi: number;
  startQNInMeasure: number;
  durationQN: number;
}

interface SelectedRef {
  measureIndex: number;
  eventIndex: number;
}

export function PianoRollView({
  score,
  activeTrackIndex,
  dispatch,
}: PianoRollViewProps) {
  const track = score.tracks[activeTrackIndex];
  const [duration, setDuration] = useState<number>(1);
  const [selected, setSelected] = useState<SelectedRef | null>(null);
  const [hoverCell, setHoverCell] = useState<{ midi: number; measureIndex: number; qn: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { notes, measureWidth, totalCells, totalRows } = useMemo(() => {
    return computeRenderable(score, activeTrackIndex);
  }, [score, activeTrackIndex]);

  // Delete the selected event on Delete/Backspace.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selected) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        dispatch({
          type: 'delete-event',
          trackIndex: activeTrackIndex,
          measureIndex: selected.measureIndex,
          eventIndex: selected.eventIndex,
        });
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, dispatch, activeTrackIndex]);

  // Reset selection if the active track changes.
  useEffect(() => {
    setSelected(null);
  }, [activeTrackIndex]);

  if (!track) return <p className="text-sm text-muted-foreground">No track.</p>;

  const handleCellClick = (midi: number, measureIndex: number, qnInMeasure: number) => {
    // If we click on an existing note, select it instead of adding.
    const hit = notes.find(
      (n) =>
        n.measureIndex === measureIndex &&
        n.midi === midi &&
        n.startQNInMeasure <= qnInMeasure &&
        qnInMeasure < n.startQNInMeasure + n.durationQN
    );
    if (hit) {
      setSelected({ measureIndex: hit.measureIndex, eventIndex: hit.eventIndex });
      return;
    }
    // Otherwise add a note at the cell.
    dispatch({
      type: 'add-note',
      trackIndex: activeTrackIndex,
      measureIndex,
      midi,
      durationQN: duration,
    });
    // After the add we don't know the new event index synchronously (the
    // reducer runs and re-renders); selection is reset until the next click.
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Duration
        </span>
        {DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDuration(opt.value)}
            className={`px-2.5 py-1 rounded text-xs border transition ${
              Math.abs(duration - opt.value) < 0.001
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}

        {selected && (
          <button
            onClick={() => {
              dispatch({
                type: 'delete-event',
                trackIndex: activeTrackIndex,
                measureIndex: selected.measureIndex,
                eventIndex: selected.eventIndex,
              });
              setSelected(null);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete selected
          </button>
        )}
      </div>

      {/* Grid */}
      <div ref={containerRef} className="overflow-auto bg-card border border-border rounded-md">
        <svg
          width={KEY_LABEL_WIDTH + measureWidth * track.measures.length}
          height={HEADER_HEIGHT + ROW_HEIGHT * totalRows}
          style={{ display: 'block' }}
        >
          {/* Header row — bar numbers + beat ticks */}
          <rect
            x={0}
            y={0}
            width={KEY_LABEL_WIDTH + measureWidth * track.measures.length}
            height={HEADER_HEIGHT}
            fill="hsl(var(--muted))"
          />
          {track.measures.map((m, mi) => (
            <text
              key={mi}
              x={KEY_LABEL_WIDTH + mi * measureWidth + 6}
              y={14}
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              fill="hsl(var(--muted-foreground))"
            >
              {m.number}
            </text>
          ))}

          {/* Pitch rows */}
          {Array.from({ length: totalRows }, (_, rowIdx) => {
            const midi = PITCH_TOP_MIDI - rowIdx;
            const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
            const isC = midi % 12 === 0;
            const isBlack = isBlackKey(midi);
            return (
              <g key={midi}>
                {/* Key label cell */}
                <rect
                  x={0}
                  y={y}
                  width={KEY_LABEL_WIDTH}
                  height={ROW_HEIGHT}
                  fill={isBlack ? 'hsl(var(--muted))' : 'hsl(var(--card))'}
                  stroke="hsl(var(--border))"
                />
                {isC && (
                  <text
                    x={4}
                    y={y + 10}
                    fontSize="9"
                    fontFamily="ui-monospace, monospace"
                    fill="hsl(var(--foreground))"
                  >
                    {midiToName(midi)}
                  </text>
                )}
                {/* Background row */}
                <rect
                  x={KEY_LABEL_WIDTH}
                  y={y}
                  width={measureWidth * track.measures.length}
                  height={ROW_HEIGHT}
                  fill={isBlack ? 'hsl(var(--muted) / 0.4)' : 'hsl(var(--background))'}
                  stroke="hsl(var(--border))"
                  strokeWidth={isC ? 0.6 : 0.2}
                />
              </g>
            );
          })}

          {/* Beat / measure verticals */}
          {track.measures.map((_, mi) => {
            const x = KEY_LABEL_WIDTH + mi * measureWidth;
            return (
              <line
                key={`mline-${mi}`}
                x1={x}
                y1={0}
                x2={x}
                y2={HEADER_HEIGHT + ROW_HEIGHT * totalRows}
                stroke="hsl(var(--border))"
                strokeWidth={2}
              />
            );
          })}
          {track.measures.map((_, mi) => {
            const cellsPerMeasure = measureWidth / CELL_WIDTH;
            return Array.from({ length: cellsPerMeasure - 1 }, (_, ci) => {
              const x = KEY_LABEL_WIDTH + mi * measureWidth + (ci + 1) * CELL_WIDTH;
              const isBeat = (ci + 1) % 4 === 0;
              return (
                <line
                  key={`tick-${mi}-${ci}`}
                  x1={x}
                  y1={HEADER_HEIGHT}
                  x2={x}
                  y2={HEADER_HEIGHT + ROW_HEIGHT * totalRows}
                  stroke="hsl(var(--border))"
                  strokeWidth={isBeat ? 1 : 0.4}
                  opacity={isBeat ? 0.5 : 0.25}
                />
              );
            });
          })}

          {/* Click capture per cell */}
          {track.measures.map((_m, mi) =>
            Array.from({ length: totalRows }, (_, rowIdx) => {
              const midi = PITCH_TOP_MIDI - rowIdx;
              const cellsPerMeasure = measureWidth / CELL_WIDTH;
              return Array.from({ length: cellsPerMeasure }, (_, ci) => {
                const x = KEY_LABEL_WIDTH + mi * measureWidth + ci * CELL_WIDTH;
                const y = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
                return (
                  <rect
                    key={`hit-${mi}-${rowIdx}-${ci}`}
                    x={x}
                    y={y}
                    width={CELL_WIDTH}
                    height={ROW_HEIGHT}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() =>
                      setHoverCell({ midi, measureIndex: mi, qn: ci * CELL_QN })
                    }
                    onMouseLeave={() => setHoverCell(null)}
                    onClick={() => handleCellClick(midi, mi, ci * CELL_QN)}
                  />
                );
              });
            })
          )}

          {/* Hover preview */}
          {hoverCell && (
            <rect
              x={
                KEY_LABEL_WIDTH +
                hoverCell.measureIndex * measureWidth +
                (hoverCell.qn / CELL_QN) * CELL_WIDTH
              }
              y={HEADER_HEIGHT + (PITCH_TOP_MIDI - hoverCell.midi) * ROW_HEIGHT}
              width={Math.max(CELL_WIDTH, (duration / CELL_QN) * CELL_WIDTH)}
              height={ROW_HEIGHT}
              fill="hsl(var(--primary))"
              opacity={0.18}
              pointerEvents="none"
            />
          )}

          {/* Notes */}
          {notes.map((n) => {
            const isSelected =
              selected?.measureIndex === n.measureIndex &&
              selected?.eventIndex === n.eventIndex;
            const x =
              KEY_LABEL_WIDTH +
              n.measureIndex * measureWidth +
              (n.startQNInMeasure / CELL_QN) * CELL_WIDTH;
            const y = HEADER_HEIGHT + (PITCH_TOP_MIDI - n.midi) * ROW_HEIGHT;
            const w = Math.max(CELL_WIDTH * 0.85, (n.durationQN / CELL_QN) * CELL_WIDTH - 2);
            return (
              <g
                key={`note-${n.measureIndex}-${n.eventIndex}-${n.midi}`}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected({
                    measureIndex: n.measureIndex,
                    eventIndex: n.eventIndex,
                  });
                }}
              >
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={w}
                  height={ROW_HEIGHT - 2}
                  rx={2}
                  fill="hsl(var(--primary))"
                  opacity={isSelected ? 1 : 0.85}
                />
                {isSelected && (
                  <rect
                    x={x + 0.5}
                    y={y + 0.5}
                    width={w + 1}
                    height={ROW_HEIGHT - 1}
                    rx={2}
                    fill="none"
                    stroke="hsl(var(--gold-highlight))"
                    strokeWidth={1.5}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <p className="text-xs text-muted-foreground">
        Click a cell to add a note at the selected duration. Click an existing
        note to select it; press <kbd className="px-1 py-0.5 rounded bg-muted text-foreground text-[11px]">Delete</kbd> to remove it.
      </p>

      {/* Add measure */}
      <button
        onClick={() => dispatch({ type: 'add-measure', trackIndex: activeTrackIndex })}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border hover:bg-muted text-sm"
      >
        <Plus className="w-4 h-4" />
        Add measure
      </button>
    </div>
  );
}

function computeRenderable(
  score: ScoreDocument,
  activeTrackIndex: number
): { notes: RenderableNote[]; measureWidth: number; totalCells: number; totalRows: number } {
  const totalRows = PITCH_TOP_MIDI - PITCH_BOTTOM_MIDI + 1;
  const track = score.tracks[activeTrackIndex];
  if (!track) return { notes: [], measureWidth: 0, totalCells: 0, totalRows };

  const measureQN = measureLengthInQN(score.initialTimeSignature);
  const cellsPerMeasure = Math.ceil(measureQN / CELL_QN);
  const measureWidth = cellsPerMeasure * CELL_WIDTH;
  const totalCells = cellsPerMeasure * track.measures.length;

  const notes: RenderableNote[] = [];
  track.measures.forEach((measure, measureIndex) => {
    let qn = 0;
    measure.voices[0].events.forEach((event, eventIndex) => {
      const baseDuration = event.dotted ? event.durationQN : event.durationQN;
      // (dotted is folded into durationQN by import paths; the editor stores
      // it raw + a flag, so we treat durationQN as the visual length.)
      if (event.kind === 'note') {
        const note = event as Note;
        notes.push({
          measureIndex,
          eventIndex,
          midi: note.midi,
          startQNInMeasure: qn,
          durationQN: baseDuration,
        });
      } else if (event.kind === 'chord') {
        const chord = event as Chord;
        chord.notes.forEach((cn) => {
          notes.push({
            measureIndex,
            eventIndex,
            midi: cn.midi,
            startQNInMeasure: qn,
            durationQN: baseDuration,
          });
        });
      }
      qn += baseDuration;
    });
  });

  return { notes, measureWidth, totalCells, totalRows };
}

function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[pc]}${octave}`;
}
