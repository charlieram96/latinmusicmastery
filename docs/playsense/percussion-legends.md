# Conga and timbal notation legends

The Studio palettes use the user-provided `Leyenda Congas.musx` and `Leyenda de Timbal.musx` (Mauricio Upmann). Their embedded Finale EnigmaXML was inspected locally; original attachments were not modified. No Finale conversion dependency is shipped with the app.

`__tests__/fixtures/percussion-legends.json` records the 23 note entries, their Finale percussion codes, and the resolved SMuFL glyphs and positions. Positions come from the **active percussion layout**, not the entry's playback pitch. Finale layout `harmLev` is diatonic from C4, with the supplied percussion clef using the same adjustment as treble clef.

## Conga (8 strokes)

| Stroke | Written position | Symbol |
| --- | --- | --- |
| High open | E5 | Normal |
| Low open | D5 | Normal |
| Slap | E5 | Ornate X |
| Pressed high slap | E5 | Ornate X + marcato |
| Bass / heel | E5 | Large circled black head |
| Tip / toe | E5 | Plus |
| Muffled tone | E5 | Slash |
| Third conga / medium | G5 | Normal |

## Timbal (15 strokes)

| Stroke | Written position | Symbol |
| --- | --- | --- |
| Low drum | F4 | Normal |
| High drum | A4 | Normal |
| High rim shot | A4 | X |
| High muffled | A4 | Slash |
| Low muffled | F4 | Slash |
| High cáscara | A4 | Plus |
| Low cáscara | F4 | Plus |
| Low cross-stick | F4 | Slashed head |
| Cymbal | A5 | X |
| Timbal bell / contracampana | G4 | Diamond |
| Jam block | F5 | Square |
| Bongo bell mouth | F5 | Down triangle |
| Bongo bell body | F5 | Up triangle |
| Cha-cha bell mouth | A5 | Down triangle |
| Cha-cha bell body | A5 | Up triangle |

## Import and compatibility

- Existing internal stroke IDs remain stable. Their notation positions/symbols now follow these legends. They are **not GM drum keys**.
- MusicXML display-step/display-octave and notehead/SMuFL values are preserved on each note, including each pitch of a chord. Explicit notation takes precedence over playback MIDI. The parser also accepts pitched display notes in a named percussion part.
- A recognized symbol selects a palette stroke. Unrecognized positions remain where written; selecting a stroke in the builder replaces the imported notation. JSON validation, save/load, and undo/redo retain it.
- Plain MIDI has no written notehead or staff position. Its GM mapping cannot distinguish every custom articulation; recording with General MIDI mapping disabled accepts internal stroke IDs from a configured device. The custom input hardware needs its own mapping to distinguish all surfaces/articulations.
- Notes already imported with the old lossy parser cannot recover discarded staff positions from stored MIDI alone. Re-import the original MusicXML/PDF, or correct individual notes with the expanded palette.
- This change uses the supplied MUSX files as notation references; it does not add direct MUSX upload support.
- Gameplay groups high/low cáscara on the existing shell lane and bell variants on the existing bell lanes. They remain distinct notation strokes; the existing hardware lane vocabulary is not expanded here. Cymbal notes use a cymbal surface and need a corresponding input mapping for surface-specific grading.

Development preview: `/playsense-preview/percussion` uses the shared admin editor and lesson staff renderer without writing course data.
