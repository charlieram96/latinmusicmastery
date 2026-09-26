/** Groups MIDI note-ons struck together into chords. A window opens on the first note and
 * stays anchored there; any later note-on inside the window joins the chord, and the first
 * note-on outside it opens the next window. */
export class ChordGrouper {
  private windowStartMs: number | null = null;

  constructor(
    private readonly onNote: (midi: number) => void,
    private readonly onChordNote: (midi: number) => void,
    private readonly windowMs = 45,
  ) {}

  noteOn(midi: number, atMs: number): void {
    if (this.windowStartMs === null || atMs - this.windowStartMs > this.windowMs) {
      this.windowStartMs = atMs;
      this.onNote(midi);
    } else {
      this.onChordNote(midi);
    }
  }
}
