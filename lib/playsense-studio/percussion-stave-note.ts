import { Articulation, GraceNote, type GraceNoteStruct, StaveNote, type StaveNoteStruct } from 'vexflow';
import type { PercussionNotation } from '@/components/playsense-studio/shared/score-model/types';
import { percussionGlyph } from './percussion-noteheads';

/** Shared by the main-note and grace-note percussion classes below: reapplies
 * each notehead's legend glyph, keyed to the note's own duration for the
 * half/whole duration cues. `GraceNote` extends `StaveNote`, so both share
 * `noteHeads` and `getDuration()`. */
function applyPercussionHeads(note: StaveNote, notation: PercussionNotation[]) {
  notation.forEach((n, index) => {
    if (n.notehead !== 'normal') note.noteHeads[index]?.setText(percussionGlyph(n.notehead, note.getDuration()));
  });
}

/** Beam layout rebuilds noteheads when stems change. Reapply the legend glyphs
 * on every rebuild, so eighths/chords keep their individual percussion symbols. */
class PercussionStaveNote extends StaveNote {
  private notation?: PercussionNotation[];

  constructor(options: StaveNoteStruct, notation: PercussionNotation[]) {
    super(options);
    this.notation = notation;
    applyPercussionHeads(this, notation);
    notation.forEach((n, index) => {
      if (n.marcato) this.addModifier(new Articulation('a^'), index);
    });
  }

  override buildNoteHeads() {
    const heads = super.buildNoteHeads();
    if (this.notation) applyPercussionHeads(this, this.notation);
    return heads;
  }
}

/** A grace note ahead of a percussion stroke (a flam): same idea as
 * `PercussionStaveNote`, so the grace draws with the stroke's own notehead
 * instead of a plain oval, and keeps it if formatting rebuilds the note. */
class PercussionGraceNote extends GraceNote {
  private notation?: PercussionNotation[];

  constructor(options: GraceNoteStruct, notation: PercussionNotation[]) {
    super(options);
    this.notation = notation;
    applyPercussionHeads(this, notation);
  }

  override buildNoteHeads() {
    const heads = super.buildNoteHeads();
    if (this.notation) applyPercussionHeads(this, this.notation);
    return heads;
  }
}

export function createStaveNote(options: StaveNoteStruct, notation?: PercussionNotation[]): StaveNote {
  return notation?.length ? new PercussionStaveNote(options, notation) : new StaveNote(options);
}

export function createGraceNote(options: GraceNoteStruct, notation?: PercussionNotation[]): GraceNote {
  return notation?.length ? new PercussionGraceNote(options, notation) : new GraceNote(options);
}
