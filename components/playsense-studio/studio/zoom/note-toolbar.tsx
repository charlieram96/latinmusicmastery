'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// PlaySense Studio — the note toolbar, docked in the measure zoom's header
// (spec §6; v6's renderNoteBar): info chip, durations, dot/rest/tie,
// accidentals (or percussion strokes), triplet, "More" (Task 9's popover) and
// delete. Shares the selected-bars toolbar's `.st-fbar` shell, rendered static
// (`.is-docked`) so it never covers the notes. The pencil lives in the header.
//
// Buttons take focus out of the loop with onMouseDown's preventDefault, so the
// zoom's own keydown listener (registered on window) keeps working while a
// button is clicked.

import type { Ref } from 'react';
import { Trash2 } from 'lucide-react';
import { KEY_VALUE, VALUE_NAME, VALUE_QN, type NoteValue } from '@/lib/playsense-studio/rhythm';
import type { ZoomEditing } from './use-zoom-editing';
import { PaletteGlyph } from '../palette-glyph';
import { NoteIcon, RestIcon } from './note-glyphs';
import { StrokeMenu } from './stroke-menu';

export interface NoteToolbarPercussion {
  strokes: { midi: number; label: string }[];
  current: number | null;
}

export interface NoteToolbarProps {
  /** The toolbar's root, so the caller can anchor More ▾ under it. */
  ref?: Ref<HTMLDivElement>;
  /** A note's name, a chord's names joined by spaces, 'rest', or 'add' at 'end'. */
  info: string;
  value: NoteValue;
  dots: 0 | 1 | 2;
  isRest: boolean;
  entryRest?: boolean;
  tie: boolean;
  tripletOn: boolean;
  hasSelection: boolean;
  /** Set on a percussion track: replaces ♭♮♯ with one Stroke chip (StrokeMenu). */
  percussion: NoteToolbarPercussion | null;
  editing: ZoomEditing;
  /** Opens the More ▾ popover (the caller anchors it under the docked toolbar). */
  onMore: () => void;
}

const TOOLBAR_DURATIONS: NoteValue[] = ['w', 'h', 'q', '8', '16', '32', '64'];

// KEY_VALUE maps the digit typed to the value it enters ('5' -> quarter); the
// toolbar's titles want the reverse, one key per value.
const VALUE_KEY = Object.fromEntries(
  Object.entries(KEY_VALUE).map(([key, value]) => [value, key]),
) as Record<NoteValue, string>;

const ACCIDENTALS: Array<{ alter: -1 | 0 | 1; label: string; title: string }> = [
  { alter: -1, label: '♭', title: 'Flat' },
  { alter: 0, label: '♮', title: 'Natural' },
  { alter: 1, label: '♯', title: 'Sharp' },
];

export function NoteToolbar({
  ref, info, value, dots, isRest, entryRest = isRest, tie, tripletOn, hasSelection, percussion, editing, onMore,
}: NoteToolbarProps) {
  const st = useStudioText();
  return (
    <div
      ref={ref}
      className="st-fbar is-docked"
      role="toolbar"
      aria-label={st("Note")}
      data-testid="note-toolbar"
    >
      <span className="st-fbar-info">{st(info)}</span>

      <div role="group" aria-label={st("Note or rest input")} className="flex items-center gap-1 border-r border-border pr-2">
        <button type="button" aria-label={st("Notes")} title={st("Show note durations")} aria-pressed={!entryRest} onMouseDown={e=>e.preventDefault()} onClick={()=>editing.setEntryRest?.(false)}><NoteIcon durationQN={1}/>{st("Notes")}</button>
        <button type="button" aria-label={st("Rest")} title={st("Show rest durations")} aria-pressed={entryRest} onMouseDown={e=>e.preventDefault()} onClick={()=>editing.setEntryRest?.(true)}><RestIcon/>{st("Rests")}</button>
      </div>

      {TOOLBAR_DURATIONS.map((v) => (
        <button
          key={v}
          type="button"
          aria-label={st(entryRest ? `${VALUE_NAME[v]} rest` : VALUE_NAME[v])}
          title={`${st(entryRest ? `${VALUE_NAME[v]} rest` : VALUE_NAME[v])} (${VALUE_KEY[v]})`}
          data-entry-kind={entryRest ? "rest" : "note"}
          aria-pressed={value === v}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editing.setValue(v)}
        >
          <>{entryRest ? <PaletteGlyph glyph={String.fromCodePoint(0xE4E3 + TOOLBAR_DURATIONS.indexOf(v))}/> : <NoteIcon durationQN={VALUE_QN[v]} />}</>
        </button>
      ))}

      <button
        type="button"
        aria-label={st("Dot")}
        title={st("Dot (.)")}
        aria-pressed={dots > 0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editing.cycleDots()}
      >
        •
      </button>



      <button
        type="button"
        aria-label={st("Tie")}
        title={st("Tie (+)")}
        aria-pressed={tie}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editing.toggleTie()}
      >
        ⌣
      </button>

      <span className="st-fbar-sep" aria-hidden />

      {percussion
        ? (
            <StrokeMenu
              strokes={percussion.strokes}
              current={percussion.current}
              onPick={(m) => editing.enterStroke(m)}
            />
          )
        : ACCIDENTALS.map((a) => (
            <button
              key={a.alter}
              type="button"
              aria-label={st(a.title)}
              title={st(a.title)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editing.accidental(a.alter)}
            >
              {st(a.label)}
            </button>
          ))}

      <span className="st-fbar-sep" aria-hidden />

      <button
        type="button"
        aria-label={st("Triplet")}
        title={st("Triplet (T)")}
        aria-pressed={tripletOn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editing.tuplet(3, 2)}
      >
        <i>3</i>
      </button>

      <button
        type="button"
        aria-label={st("More")}
        title={st("Everything else")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onMore()}
      >
        {st("More ▾")}</button>

      {hasSelection && (
        <button
          type="button"
          aria-label={st("Delete")}
          title={st("Delete (⌫)")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editing.remove(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
