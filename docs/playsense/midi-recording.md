# MIDI performance recording

The shared admin score editor now has **Record MIDI** for song, lesson, and exercise scores. This is real-time recording: the score tempo defines the beat grid and a one-bar count-in, while MIDI message timestamps determine when notes start and stop.

## Workflow

1. Open a score and choose Record MIDI → Connect MIDI. Allow the browser's MIDI prompt and select the instrument.
2. Choose to append, or replace from a measure. A blank score defaults to replacement from measure 1.
3. Start recording and play after the count-in. Metronome and sustain capture are optional.
4. Stop and review the notation. **As played** is the default. Optional 1/32, 1/16, 1/8, or 1/4 quantization always derives from the original take, so comparing settings does not progressively alter timing.
5. Add the take. This creates a single undoable edit and uses the editor's existing save/autosave flow. Video lesson synchronization should be reviewed after structural score edits.

Initial, internal, and trailing silence becomes rests, padded to the end of the final bar. Overlapping notes become chords with per-pitch ties; notes crossing barlines remain held notes. PlaySense exercise conversion follows ties and grades only new attacks. Repeat groups must be unlinked before replacement; appending after a repeat is allowed. Original tempo, meter, and key resume after the inserted passage.

## Boundaries

- Web MIDI support and a secure context (HTTPS or localhost) are required. Access is requested only after Connect MIDI, with SysEx disabled. The recorder subscribes only to the selected input and removes its own listeners on close.
- Each take is limited to three minutes, 4,096 played notes, and 256 generated measures. Disconnecting, hiding the tab, or interrupting the audio clock stops recording and preserves captured notes for review. Closing the dialog discards an unadded take.
- MIDI pitch, attack/release, chords, rests, and optional CC64 sustain are supported. General MIDI percussion can be mapped to the chosen instrument's strokes.
- No automatic tempo detection, audio recording, pitch bend, aftertouch, dynamics engraving, or MIDI output is provided. Use the instrument's own sound for monitoring. Captured velocity is retained in the temporary take, but the current score schema has no velocity field.
- As-played timing uses fractional quarter-note durations. Standard printed note glyphs approximate unquantized durations; quantization is available for conventional sheet music. Polyphony is represented on the editor's existing single staff, not automatically split into piano hands.

## Verification

- 39 focused tests passed across capture, conversion, editor history, the existing exercise bridge, and recorder lifecycle. Coverage includes source timestamps vs delivery times, sustain per channel, retriggers, chords, barline ties, time signatures, permission denial/retry, disconnects, interrupted clocks, selected input isolation, teardown, JSON score validation, replacement context, and repeat protection.
- TypeScript and focused lint checks for the new recorder passed. Broader lint still reports six pre-existing React hook errors in IntegratedEditor/EditableMeasureStrip; running the same lint on their HEAD versions confirmed the same six errors. Browser inspection used the actual shared admin editor in the development-only `/playsense-preview/midi` route (no database writes).
- In Chrome on macOS, a temporary CoreMIDI virtual source sent five played notes with an overlapping chord, releases, silence, and sustain-pedal messages. Studio received all five, generated notation, allowed quantization changes, and added the original timing as five playable attacks. Undo returned to the blank score; Redo restored the take. The temporary source was disposed after testing.
- A physical keyboard/controller has not been tested in this session. Chrome extension-generated hydration/extension errors were present in the browser; no recorder runtime error appeared during the tested flow.
