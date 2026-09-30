'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// PlaySense Studio — selected-note details for the sync panel's left-rail inspector.

import { Trash2 } from 'lucide-react';
import type { MusicalEvent } from '@/components/playsense-studio/shared/score-model/types';
import { pitchName } from '@/lib/playsense-studio/pitch';

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** The selected note's timing against the sync grid, with its adjustments. */
export interface NoteTimingProps {
  /** Nudge in ms (0 = on the grid). */
  offsetMs: number;
  gridSeconds: number;
  actualSeconds: number;
  onNudge: (deltaMs: number) => void;
  onSnap: () => void;
  onReset: () => void;
  /** "Flex the recording onto this note" (Task 7 of Plan 4b): pins a flex
   *  point at the nearest hit and drags it onto this note's time. Omitted
   *  hides the zoom's Timing-tab button for it. */
  onFlex?: () => void;
  /** Why onFlex can't run right now (e.g. `No hit near this note`): the button
   *  shows disabled with this as its title. Null/absent = available. */
  flexProblem?: string | null;
}

// Details for the selected note, shown in the left-rail inspector. Pitch and
// duration edits happen in the measure zoom; this offers the per-note timing
// nudge (video sync only) and a quick Delete.
export function NoteDetails({
  event,
  measureIndex,
  percussion,
  percLabel,
  timing,
  onDelete,
}: {
  event: MusicalEvent;
  measureIndex: number;
  percussion: boolean;
  percLabel: string | null;
  timing?: NoteTimingProps;
  onDelete: () => void;
}) {
  const st = useStudioText();
  const durLabel = formatDurationQN(event.durationQN) + (event.dotted ? '.' : '') + (event.triplet ? ' ³' : '');
  let primary: string;
  if (event.kind === 'rest') {
    primary = 'Rest';
  } else if (percussion) {
    primary = percLabel ?? 'Stroke';
  } else if (event.kind === 'note') {
    primary = pitchName(event.midi);
  } else {
    primary = 'Chord';
  }
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{primary}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{st("m.")}{measureIndex + 1}</span>
      </div>
      <div className="st-prop">
        <span className="k">{st("Kind")}</span>
        <span className="v capitalize">{event.kind}</span>
      </div>
      <div className="st-prop">
        <span className="k">{st("Duration")}</span>
        <span className="v">{durLabel}</span>
      </div>
      {timing && event.kind !== 'rest' && (
        <>
          <div className="st-prop">
            <span className="k">{st("Timing")}</span>
            <span
              className="v inline-flex items-center gap-1"
              title={st(`Grid ${formatTime(timing.gridSeconds)} → plays ${formatTime(timing.actualSeconds)}. Keys: [ and ] (Shift: 20 ms)`)}
            >
              <button
                type="button"
                className="st-iconbtn"
                aria-label={st("Earlier by 5 ms (Shift: 20 ms)")}
                title={st("Earlier · 5 ms (Shift: 20 ms) · key [")}
                onClick={(e) => timing.onNudge(e.shiftKey ? -20 : -5)}
              >
                −
              </button>
              <span className={`font-mono tabular-nums${timing.offsetMs !== 0 ? ' accent' : ''}`}>
                {formatOffsetMs(timing.offsetMs)}
              </span>
              <button
                type="button"
                className="st-iconbtn"
                aria-label={st("Later by 5 ms (Shift: 20 ms)")}
                title={st("Later · 5 ms (Shift: 20 ms) · key ]")}
                onClick={(e) => timing.onNudge(e.shiftKey ? 20 : 5)}
              >
                +
              </button>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="st-chip" onClick={timing.onSnap} title={st("Move this note to the playhead")}>
              {st("Snap to playhead")}</button>
            <button
              type="button"
              className="st-chip"
              onClick={timing.onReset}
              disabled={timing.offsetMs === 0}
              title={st("Back to the grid")}
            >
              {st("Reset")}</button>
          </div>
        </>
      )}
      <button
        onClick={onDelete}
        className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {st("Delete note")}</button>
    </>
  );
}

/** "+12 ms" / "−7 ms" / "0 ms"; sub-millisecond deltas show one decimal. */
function formatOffsetMs(ms: number): string {
  const abs = Math.abs(ms);
  const body = abs < 1 && abs > 0 ? abs.toFixed(1) : Math.round(abs).toString();
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '';
  return `${sign}${body} ms`;
}

function formatDurationQN(qn: number): string {
  const map: Record<string, string> = {
    '4': 'whole',
    '2': 'half',
    '1': 'quarter',
    '0.5': '8th',
    '0.25': '16th',
    '0.125': '32nd',
    '0.0625': '64th',
  };
  return map[String(qn)] ?? `${qn} QN`;
}

