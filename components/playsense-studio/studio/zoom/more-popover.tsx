'use client';

// PlaySense Studio — the note toolbar's More ▾ popover (spec §6, v6's
// openMore): everything else that can be set on a note, split into tabs so
// the toolbar itself stays short. Built on MeasurePopover for its dialog
// role, outside-click and (capture-phase) Escape handling.
//
// The "current" values behind aria-pressed (tuplet, articulations, dynamic,
// ornament) come from the event at the zoom cursor via the score-model
// accessors, never from local state — so they track the score, including
// after an undo.

import { useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type {
  Articulation,
  Dynamic,
  MusicalEvent,
  Ornament,
} from '@/components/playsense-studio/shared/score-model/types';
import { eventArticulations, eventTuplet } from '@/components/playsense-studio/shared/score-model/accessors';
import { MeasurePopover, type PopoverAnchor } from '../measure/popover';
import { formatTime, type NoteTimingProps } from '../note-details';
import type { ZoomEditing } from './use-zoom-editing';

export type MoreTab = 'durations' | 'tuplets' | 'marks' | 'dynamics' | 'text' | 'timing';

const TABS: Array<{ id: MoreTab; label: string }> = [
  { id: 'durations', label: 'Durations' },
  { id: 'tuplets', label: 'Tuplets' },
  { id: 'marks', label: 'Marks' },
  { id: 'dynamics', label: 'Dynamics' },
  { id: 'text', label: 'Text' },
  { id: 'timing', label: 'Timing' },
];

const TUPLETS: Array<[number, number]> = [[3, 2], [5, 4], [6, 4], [7, 8], [3, 4]];

const ARTICULATIONS: Array<{ id: Articulation; label: string }> = [
  { id: 'staccato', label: 'Staccato' },
  { id: 'staccatissimo', label: 'Staccatissimo' },
  { id: 'tenuto', label: 'Tenuto' },
  { id: 'accent', label: 'Accent' },
  { id: 'marcato', label: 'Marcato' },
  { id: 'fermata', label: 'Fermata' },
];

const ORNAMENTS: Array<{ id: Ornament; label: string }> = [
  { id: 'trill', label: 'Trill' },
  { id: 'mordent', label: 'Mordent' },
  { id: 'turn', label: 'Turn' },
];

const DYNAMICS: Dynamic[] = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sfz'];

const TEXT_CHIPS = ['dolce', 'pizz.', 'arco', 'div.', 'a tempo', 'rit.', 'montuno', 'solo'];

const HINT: Partial<Record<MoreTab, string>> = {
  durations: '32nd and 64th notes, double dot, double flat and double sharp.',
  tuplets: 'Splits the selected note into a group, then type pitches over it. Pick the same one again to undo.',
};

/** "+12 ms" / "−7 ms" / "0 ms" — the nudge stepper's middle readout. */
function formatOffset(ms: number): string {
  const abs = Math.abs(ms);
  const body = abs < 1 && abs > 0 ? abs.toFixed(1) : Math.round(abs).toString();
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '';
  return `${sign}${body} ms`;
}

// Fix round 1: a mousedown on any of this popover's own buttons would
// otherwise move focus onto it — and since the popover is `role="dialog"`,
// `isTypingTarget` then treats every zoom key as typing and note entry stops
// working right after using a More tab. The note toolbar's buttons already
// do this (mousedown's default focus-move is what's cancelled, not the
// click). Only the Text input and its Set submit are meant to take focus.
const preventFocus = (e: ReactMouseEvent) => e.preventDefault();

export function MorePopover({ anchor, tab, onTab, onClose, event, editing, timing, watchLike, eventKey, voice = 0 }: {
  anchor: PopoverAnchor; tab: MoreTab; onTab: (t: MoreTab) => void; onClose: () => void;
  event: MusicalEvent | null; editing: ZoomEditing; timing?: NoteTimingProps; watchLike: boolean;
  /** Identifies the note at the zoom cursor (e.g. `measureIndex:voice:index`),
   *  so the Text tab can tell "the same note's text changed" apart from
   *  "the cursor landed on a different note" even when the two notes' text
   *  happens to read the same (including both empty). */
  eventKey: string | null;
  /** The zoom cursor's voice. Timing is voice 1's only (voice 2 isn't graded or synced). */
  voice?: 0 | 1;
}) {
  const hint = tab === 'timing'
    ? (timing && voice === 0 ? 'Nudge moves only this note against the recording.' : undefined)
    : HINT[tab];
  return (
    <MeasurePopover anchor={anchor} title="More" hint={hint} onClose={onClose}>
      <div className="st-mpop-row" data-testid="more-tabs" data-watch-like={String(watchLike)}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="st-mpop-chip"
            aria-pressed={tab === t.id}
            onMouseDown={preventFocus}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'durations' && <DurationsTab editing={editing} />}
      {tab === 'tuplets' && <TupletsTab editing={editing} event={event} />}
      {tab === 'marks' && <MarksTab editing={editing} event={event} />}
      {tab === 'dynamics' && <DynamicsTab editing={editing} event={event} />}
      {tab === 'text' && <TextTab editing={editing} event={event} eventKey={eventKey} />}
      {tab === 'timing' && <TimingTab timing={timing} voice={voice} />}
    </MeasurePopover>
  );
}

function DurationsTab({ editing }: { editing: ZoomEditing }) {
  return (
    <div className="st-mpop-row">
      <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.setValue('32')}>32nd</button>
      <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.setValue('64')}>64th</button>
      <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.cycleDots(2)}>Double dot</button>
      <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.accidental(-2)}>Double flat</button>
      <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.accidental(2)}>Double sharp</button>
    </div>
  );
}

function TupletsTab({ editing, event }: { editing: ZoomEditing; event: MusicalEvent | null }) {
  const current = event ? eventTuplet(event) : null;
  return (
    <div className="st-mpop-row">
      {TUPLETS.map(([n, m]) => (
        <button
          key={`${n}:${m}`}
          type="button"
          className="st-mpop-chip"
          aria-pressed={!!current && current.n === n && current.m === m}
          onMouseDown={preventFocus}
          onClick={() => editing.tuplet(n, m)}
        >
          {n}:{m}
        </button>
      ))}
    </div>
  );
}

function MarksTab({ editing, event }: { editing: ZoomEditing; event: MusicalEvent | null }) {
  const articulations = event ? eventArticulations(event) : [];
  const ornament = event?.ornament ?? null;
  return (
    <>
      <div className="st-mpop-row">
        {ARTICULATIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            className="st-mpop-chip"
            aria-pressed={articulations.includes(a.id)}
            onMouseDown={preventFocus}
            onClick={() => editing.articulation(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="st-mpop-row">
        {ORNAMENTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className="st-mpop-chip"
            aria-pressed={ornament === o.id}
            onMouseDown={preventFocus}
            onClick={() => editing.ornament(o.id)}
          >
            {o.label}
          </button>
        ))}
        <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.grace(true)}>Acciaccatura</button>
        <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.grace(false)}>Appoggiatura</button>
      </div>
    </>
  );
}

function DynamicsTab({ editing, event }: { editing: ZoomEditing; event: MusicalEvent | null }) {
  const current = event?.dynamic ?? null;
  return (
    <>
      <div className="st-mpop-row">
        {DYNAMICS.map((d) => (
          <button
            key={d}
            type="button"
            className="st-mpop-chip"
            aria-pressed={current === d}
            onMouseDown={preventFocus}
            onClick={() => editing.dynamic(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="st-mpop-row">
        <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.slur('cresc')}>Crescendo</button>
        <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.slur('dim')}>Diminuendo</button>
        <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.slur('slur')}>Slur (S)</button>
      </div>
    </>
  );
}

function TextTab({ editing, event, eventKey }: { editing: ZoomEditing; event: MusicalEvent | null; eventKey: string | null }) {
  // Re-seeds the field from the event's text without an effect (React's
  // "adjust state during render" pattern). Fix round 1: keyed on the note's
  // identity (eventKey), not its text — two different notes can share the
  // same text (including both empty), which let an uncommitted typed value
  // silently survive a cursor move onto the wrong note.
  const eventText = event?.text ?? '';
  const [value, setValue] = useState(eventText);
  const [seenKey, setSeenKey] = useState(eventKey);
  if (eventKey !== seenKey) {
    setSeenKey(eventKey);
    setValue(eventText);
  }
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    editing.text(value.trim() === '' ? null : value);
  };
  return (
    <>
      <form className="st-mpop-row" onSubmit={onSubmit}>
        <input
          aria-label="Text"
          placeholder="dolce, pizz., swing…"
          className="st-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="st-mpop-chip">Set</button>
      </form>
      <div className="st-mpop-row">
        {TEXT_CHIPS.map((c) => (
          <button key={c} type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => editing.text(c)}>{c}</button>
        ))}
      </div>
    </>
  );
}

function TimingTab({ timing, voice }: { timing?: NoteTimingProps; voice: 0 | 1 }) {
  if (voice === 1) {
    return <p className="text-xs text-muted-foreground">Timing applies to voice 1 notes.</p>;
  }
  if (!timing) {
    return <p className="text-xs text-muted-foreground">Timing is set on the waveform for synced lessons.</p>;
  }
  return (
    <>
      <p className="st-mpop-row">Plays at {formatTime(timing.actualSeconds)}</p>
      <div className="st-mpop-row">
        <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => timing.onNudge(-5)}>−5 ms</button>
        <span className="font-mono tabular-nums">{formatOffset(timing.offsetMs)}</span>
        <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={() => timing.onNudge(5)}>+5 ms</button>
      </div>
      <div className="st-mpop-row">
        <button type="button" className="st-mpop-chip" onMouseDown={preventFocus} onClick={timing.onReset}>Reset</button>
      </div>
      {timing.onFlex && (
        <div className="st-mpop-row">
          <button
            type="button"
            className="st-mpop-chip"
            onMouseDown={preventFocus}
            onClick={timing.onFlex}
            disabled={!!timing.flexProblem}
            title={timing.flexProblem ?? undefined}
          >
            Flex the recording onto this note
          </button>
        </div>
      )}
    </>
  );
}
