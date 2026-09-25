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

import { useState, type FormEvent } from 'react';
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

export function MorePopover({ anchor, tab, onTab, onClose, event, editing, timing, watchLike }: {
  anchor: PopoverAnchor; tab: MoreTab; onTab: (t: MoreTab) => void; onClose: () => void;
  event: MusicalEvent | null; editing: ZoomEditing; timing?: NoteTimingProps; watchLike: boolean;
}) {
  const hint = tab === 'timing'
    ? (timing ? 'Nudge moves only this note against the recording.' : undefined)
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
      {tab === 'text' && <TextTab editing={editing} event={event} />}
      {tab === 'timing' && <TimingTab timing={timing} />}
    </MeasurePopover>
  );
}

function DurationsTab({ editing }: { editing: ZoomEditing }) {
  return (
    <div className="st-mpop-row">
      <button type="button" className="st-mpop-chip" onClick={() => editing.setValue('32')}>32nd</button>
      <button type="button" className="st-mpop-chip" onClick={() => editing.setValue('64')}>64th</button>
      <button type="button" className="st-mpop-chip" onClick={() => editing.cycleDots(2)}>Double dot</button>
      <button type="button" className="st-mpop-chip" onClick={() => editing.accidental(-2)}>Double flat</button>
      <button type="button" className="st-mpop-chip" onClick={() => editing.accidental(2)}>Double sharp</button>
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
            onClick={() => editing.ornament(o.id)}
          >
            {o.label}
          </button>
        ))}
        <button type="button" className="st-mpop-chip" onClick={() => editing.grace(true)}>Acciaccatura</button>
        <button type="button" className="st-mpop-chip" onClick={() => editing.grace(false)}>Appoggiatura</button>
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
            onClick={() => editing.dynamic(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="st-mpop-row">
        <button type="button" className="st-mpop-chip" onClick={() => editing.slur('cresc')}>Crescendo</button>
        <button type="button" className="st-mpop-chip" onClick={() => editing.slur('dim')}>Diminuendo</button>
        <button type="button" className="st-mpop-chip" onClick={() => editing.slur('slur')}>Slur (S)</button>
      </div>
    </>
  );
}

function TextTab({ editing, event }: { editing: ZoomEditing; event: MusicalEvent | null }) {
  // Re-seeds the field from the event's text without an effect (React's
  // "adjust state during render" pattern): comparing against the text last
  // seen catches a different note landing under the cursor mid-edit.
  const eventText = event?.text ?? '';
  const [value, setValue] = useState(eventText);
  const [seenText, setSeenText] = useState(eventText);
  if (eventText !== seenText) {
    setSeenText(eventText);
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
          <button key={c} type="button" className="st-mpop-chip" onClick={() => editing.text(c)}>{c}</button>
        ))}
      </div>
    </>
  );
}

function TimingTab({ timing }: { timing?: NoteTimingProps }) {
  if (!timing) {
    return <p className="text-xs text-muted-foreground">Timing is set on the waveform for synced lessons.</p>;
  }
  return (
    <>
      <p className="st-mpop-row">Plays at {formatTime(timing.actualSeconds)}</p>
      <div className="st-mpop-row">
        <button type="button" className="st-mpop-chip" onClick={() => timing.onNudge(-5)}>−5 ms</button>
        <span className="font-mono tabular-nums">{formatOffset(timing.offsetMs)}</span>
        <button type="button" className="st-mpop-chip" onClick={() => timing.onNudge(5)}>+5 ms</button>
      </div>
      <div className="st-mpop-row">
        <button type="button" className="st-mpop-chip" onClick={timing.onReset}>Reset</button>
      </div>
    </>
  );
}
