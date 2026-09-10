import { Articulation, StaveNote, type StaveNoteStruct } from 'vexflow';
import type { PercussionNotation } from '@/components/playsense-studio/shared/score-model/types';
import { percussionGlyph } from './percussion-noteheads';

/** Beam layout rebuilds noteheads when stems change. Reapply the legend glyphs
 * on every rebuild, so eighths/chords keep their individual percussion symbols. */
class PercussionStaveNote extends StaveNote {
  private notation?: PercussionNotation[];

  constructor(options: StaveNoteStruct, notation: PercussionNotation[]) {
    super(options);
    this.notation = notation;
    this.applyHeads();
    notation.forEach((n, index) => {
      if (n.marcato) this.addModifier(new Articulation('a^'), index);
    });
  }

  override buildNoteHeads() {
    const heads = super.buildNoteHeads();
    this.applyHeads();
    return heads;
  }

  private applyHeads() {
    this.notation?.forEach((n, index) => {
      if (n.notehead !== 'normal') this.noteHeads[index]?.setText(percussionGlyph(n.notehead, this.getDuration()));
    });
  }
}

export function createStaveNote(options: StaveNoteStruct, notation?: PercussionNotation[]): StaveNote {
  return notation?.length ? new PercussionStaveNote(options, notation) : new StaveNote(options);
}
