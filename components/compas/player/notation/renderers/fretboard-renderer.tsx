'use client';

// Compás fretboard renderer — animated SVG, data-driven from instruments.ts.
//
// Single component handles guitar, bass, tres (double-course), tiple
// (triple-course), cuatro, ukulele, mandolin. The horizontal fretboard is
// drawn once; finger dots fade in/out as the playback cursor passes events.
//
// Unlike the staff/tab renderers, the fretboard doesn't have a horizontal
// time axis — all events project onto the same vertical board. So
// click-to-seek isn't supported here (a click on a fretboard dot is
// ambiguous over time). We expose a "next/previous fingering" affordance
// indirectly through the cursor's natural progression instead.

import { useEffect, useMemo, useRef } from 'react';
import { qnToTrackMs } from '@/lib/compas/time-mapping';
import { extractTrackEvents } from '@/lib/compas/score-to-vexflow';
import { fingerChord, fingerNote, type Fingering } from '@/lib/compas/auto-fingering';
import { INSTRUMENTS } from '@/lib/compas/instruments';
import type {
  Instrument,
  ScoreDocument,
} from '@/components/compas/shared/score-model/types';

interface AnimatedDot {
  /** ms at which this fingering becomes active. */
  startMs: number;
  /** ms at which it stops. */
  endMs: number;
  string: number; // 1-based, 1 = highest pitch
  fret: number;
}

export interface FretboardRendererProps {
  score: ScoreDocument;
  trackIndex: number;
  currentMs: number;
  className?: string;
}

const FRETBOARD_WIDTH = 900;
const FRETBOARD_HEIGHT = 220;
const FRET_COUNT = 12; // visible window
const NUT_INSET = 36;
const TRAILING_MARGIN = 16;

export function FretboardRenderer({
  score,
  trackIndex,
  currentMs,
  className,
}: FretboardRendererProps) {
  const dotRefs = useRef<Map<number, SVGCircleElement>>(new Map());
  const containerRef = useRef<SVGSVGElement | null>(null);

  const track = score.tracks[trackIndex];
  const instrument = track?.instrument as Instrument | undefined;
  const config = instrument ? INSTRUMENTS[instrument] : undefined;

  const dots = useMemo(() => {
    if (!track || !config?.fretted) return [];
    return computeAnimatedDots(score, trackIndex, instrument!);
  }, [score, trackIndex, instrument, config]);

  // Drive dot opacity from currentMs via direct DOM mutation. Avoids
  // re-rendering React on every RAF tick.
  useEffect(() => {
    if (!config?.fretted) return;
    dots.forEach((dot, idx) => {
      const el = dotRefs.current.get(idx);
      if (!el) return;
      const active = currentMs >= dot.startMs && currentMs < dot.endMs;
      el.setAttribute('opacity', active ? '1' : '0.08');
      el.setAttribute('r', active ? '11' : '9');
    });
  }, [currentMs, dots, config]);

  if (!config?.fretted) {
    return (
      <div className={`p-4 text-sm text-muted-foreground ${className ?? ''}`}>
        {config?.displayName ?? track?.instrument} can&apos;t be displayed as a fretboard.
      </div>
    );
  }

  const stringCount = config.courseCount;
  const stringSpacing = (FRETBOARD_HEIGHT - 40) / Math.max(stringCount - 1, 1);
  const fretSpacing = (FRETBOARD_WIDTH - NUT_INSET - TRAILING_MARGIN) / FRET_COUNT;

  return (
    <div className={`overflow-x-auto ${className ?? ''}`}>
      <svg
        ref={containerRef}
        width={FRETBOARD_WIDTH}
        height={FRETBOARD_HEIGHT}
        role="img"
        aria-label={`${config.displayName} fretboard`}
      >
        {/* Wood-tone background */}
        <rect
          x={NUT_INSET}
          y={20}
          width={FRETBOARD_WIDTH - NUT_INSET - TRAILING_MARGIN}
          height={FRETBOARD_HEIGHT - 40}
          fill="hsl(30 25% 12%)"
          stroke="hsl(30 25% 8%)"
        />

        {/* Frets */}
        {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => (
          <line
            key={fret}
            x1={NUT_INSET + fret * fretSpacing}
            y1={20}
            x2={NUT_INSET + fret * fretSpacing}
            y2={FRETBOARD_HEIGHT - 20}
            stroke={fret === 0 ? 'hsl(38 58% 70%)' : 'hsl(30 15% 35%)'}
            strokeWidth={fret === 0 ? 4 : 1}
          />
        ))}

        {/* Inlay dots (5, 7, 9, 12) */}
        {[3, 5, 7, 9, 12].map((fret) => (
          <circle
            key={fret}
            cx={NUT_INSET + (fret - 0.5) * fretSpacing}
            cy={FRETBOARD_HEIGHT / 2}
            r={fret === 12 ? 6 : 5}
            fill={fret === 12 ? 'hsl(38 58% 60%)' : 'hsl(30 15% 50%)'}
            opacity={0.4}
          />
        ))}

        {/* Strings */}
        {Array.from({ length: stringCount }, (_, i) => {
          // i=0 is the topmost (highest-pitch) string in our SVG, which is VexFlow string 1
          const y = 20 + i * stringSpacing;
          const stringNumber = i + 1;
          const tuningIndex = stringCount - stringNumber; // tuning is low→high
          const tuningName = config.tuning[tuningIndex];
          return (
            <g key={i}>
              <line
                x1={NUT_INSET}
                y1={y}
                x2={FRETBOARD_WIDTH - TRAILING_MARGIN}
                y2={y}
                stroke="hsl(45 30% 70%)"
                strokeWidth={1 + (stringCount - stringNumber) * 0.3}
              />
              <text
                x={6}
                y={y + 4}
                fontFamily="ui-monospace, monospace"
                fontSize="11"
                fill="hsl(45 30% 70%)"
              >
                {tuningName}
              </text>
            </g>
          );
        })}

        {/* Fret numbers */}
        {Array.from({ length: FRET_COUNT }, (_, fret) => (
          <text
            key={fret}
            x={NUT_INSET + (fret + 0.5) * fretSpacing}
            y={FRETBOARD_HEIGHT - 4}
            fontSize="10"
            fontFamily="ui-monospace, monospace"
            fill="hsl(30 15% 50%)"
            textAnchor="middle"
          >
            {fret + 1}
          </text>
        ))}

        {/* Animated dots */}
        {dots.map((dot, idx) => {
          if (dot.fret > FRET_COUNT) return null; // off the visible window
          const cx =
            dot.fret === 0
              ? NUT_INSET - 14
              : NUT_INSET + (dot.fret - 0.5) * fretSpacing;
          const stringIndex = dot.string - 1; // SVG row index
          const cy = 20 + stringIndex * stringSpacing;
          return (
            <circle
              key={idx}
              ref={(el) => {
                if (el) dotRefs.current.set(idx, el);
                else dotRefs.current.delete(idx);
              }}
              cx={cx}
              cy={cy}
              r={9}
              fill="hsl(30 85% 55%)"
              stroke="hsl(0 0% 4%)"
              strokeWidth={1.5}
              opacity={0.08}
              style={{ transition: 'opacity 80ms linear, r 80ms linear' }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function computeAnimatedDots(
  score: ScoreDocument,
  trackIndex: number,
  instrument: Instrument
): AnimatedDot[] {
  const track = score.tracks[trackIndex];
  if (!track) return [];

  const measureBlocks = extractTrackEvents(
    track,
    score.initialTimeSignature,
    score.initialKeyFifths
  );

  const out: AnimatedDot[] = [];

  for (const block of measureBlocks) {
    for (const ev of block.events) {
      if (ev.isRest) continue;

      const startMs = qnToTrackMs(track, score, ev.qnStart);
      const endMs = qnToTrackMs(track, score, ev.qnStart + ev.durationQN);

      if (ev.kind === 'note') {
        const midi = midiFromKeyString(ev.keys[0]);
        if (midi !== null) {
          const f = fingerNote(instrument, midi);
          if (f) out.push({ startMs, endMs, ...fixFingering(f) });
        }
      } else if (ev.kind === 'chord') {
        const midis = ev.keys
          .map(midiFromKeyString)
          .filter((m): m is number => m !== null);
        const fingerings = fingerChord(instrument, midis);
        fingerings.forEach((f) => {
          if (f) out.push({ startMs, endMs, ...fixFingering(f) });
        });
      }
    }
  }

  return out;
}

function fixFingering(f: Fingering): { string: number; fret: number } {
  return { string: f.string, fret: f.fret };
}

function midiFromKeyString(key: string): number | null {
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
