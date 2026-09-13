# Sheet music export for PlaySense Studio sections

Date: 2026-09-12
Status: approved direction, spec for review
Mockup: https://claude.ai/code/artifact/ef388402-e159-4efe-b088-5925e839fa78

## Goal

Let an admin export one scored section from PlaySense Studio as sheet music, and let a
student download the section they are watching. Output formats: PDF (print), MusicXML
(editable in notation apps), and MIDI (admin only).

## Decisions already made

| Question | Decision |
|---|---|
| Student formats | PDF and MusicXML |
| MIDI | Admin only |
| Course name in the page header and "Latin Music Mastery" footer | On by default, admin can turn off |
| Scope of one export | One section, all or selected tracks |
| Where the file is produced | In the browser, from the score already in memory |

## Non-goals

- Whole-lesson export that stitches every section into one file.
- Tablature in the PDF. The player draws staff notation only, and the PDF mirrors the
  player. MusicXML carries fingering so notation apps can show tab.
- PNG or SVG image export.
- Server-side rendering.

## Formats

**PDF** is the format everyone needs. It is produced as a vector PDF so it prints crisply
at any size.

**MusicXML** is the interchange standard for notation software. `ScoreDocument` is
documented as a thin subset of the MusicXML information model, so the export is a faithful
round-trip rather than a lossy conversion. Output is MusicXML 4.0 partwise, uncompressed
(`.musicxml`).

**MIDI** is playback only. `@tonejs/midi` already in the bundle can write Standard MIDI
Files, so the writer is small.

## Approaches considered for the PDF

1. **Vector PDF from the VexFlow SVG, in the browser (chosen).** VexFlow 5 emits only five
   SVG element types: `svg`, `g`, `path`, `rect`, `text`. A small translator walks that
   tree and draws into `pdf-lib`, which is already a dependency. Music glyphs are `text`
   in the Bravura font, so the font is embedded with `@pdf-lib/fontkit`. Result: true
   vector output that looks exactly like the screen, and the only new dependency is
   fontkit.
2. **Raster PDF.** Draw the score to a canvas at 300 dpi and embed the PNG with pdf-lib.
   Zero new dependencies and zero font risk, but the page is a picture: soft at high
   zoom, larger files. Kept as the fallback if font embedding fails in the first task.
3. **Browser print route.** A `/print` page with `@page` CSS and the system print dialog.
   Vector and dependency-free, but the user gets a print dialog instead of a named
   download, and page size and branding options move into the browser dialog. Rejected
   for the mismatch with the mockup.
4. **Server-side engraving (Verovio or headless Chrome).** A new heavy dependency, a
   different engraver than the screen, and hosting complexity on Vercel. Rejected.

## Architecture

All new code is pure and browser-side except one analytics event. Nothing is stored.

```
lib/playsense-studio/export/
  filename.ts          slug + extension from class item title, section index, format
  musicxml-writer.ts   ScoreDocument -> MusicXML string
  midi-writer.ts       ScoreDocument -> Uint8Array (via @tonejs/midi)
  pdf/
    page-plan.ts       page size, margins, header/footer geometry, systems per page
    svg-to-pdf.ts      VexFlow SVG subtree -> pdf-lib drawing calls
    fonts.ts           lazy-load Bravura + Academico bytes for embedding
    render-section.ts  orchestrates: offscreen engrave -> paginate -> pdf bytes
  download.ts          Blob -> <a download> click, revokes the URL
  index.ts             exportSection({ score, tracks, format, options }) -> Promise<void>

components/playsense-studio/export/
  export-dialog.tsx    admin dialog (formats, tracks, page, include, preview)
  download-menu.tsx    student two-item menu
```

### Data flow

1. The caller already holds the `ScoreDocument` for the section (the editor's
   `state.score`, or the player's active `PlayerSection.score`).
2. `exportSection` builds an `ExportRequest`:

   ```ts
   interface ExportRequest {
     score: ScoreDocument;
     trackIndexes: number[];          // subset of score.tracks
     format: 'pdf' | 'musicxml' | 'midi';
     pdf?: {
       pageSize: 'letter' | 'a4';
       includeHeader: boolean;        // title, tempo, time signature
       includeMeasureNumbers: boolean;
       includeBranding: boolean;      // course/class name line + site footer
       expandRepeats: boolean;        // default false: collapsed with repeat barlines
     };
     context: { classItemTitle: string; sectionIndex: number; sectionCount: number; courseTitle?: string };
   }
   ```

3. The writer for the chosen format returns bytes. `download.ts` hands them to the browser
   with the filename from `filename.ts`.
4. The caller fires `logPlaysenseStudioEvent({ eventType: 'playsense_studio_section_exported', metadata: { format, trackCount, surface: 'admin' | 'student' } })`
   without awaiting it.

### PDF rendering

- **Engraving.** `render-section.ts` mounts the existing `StaffRendererImpl` into an
  offscreen container sized to the page's printable width, in `wrapped` layout, at zoom 1,
  once per selected track. The renderer gains one optional input, `measureWidths`, so the
  exporter can pass the same widths to every track. The exporter computes that array as the
  element-wise maximum of each track's own requirement, using a helper extracted from the
  renderer's current inline calculation. Identical widths mean identical row packing, so
  system N of every track holds the same measures.
- **Pagination.** With aligned systems, a page holds whole systems. One system on the page
  is the stack of every selected track's row N, with the track name printed at the left of
  the first system on the page. `page-plan.ts` computes how many systems fit below the
  header on page 1 and on later pages, and never splits a system.
- **Translation.** `svg-to-pdf.ts` walks each track's `<svg>` and for the systems that land
  on the current page draws: `path` via `drawSvgPath` with the element's fill and stroke,
  `rect` via `drawRectangle`, `text` via `drawText` with the embedded font that matches
  `font-family` (Bravura for music glyphs, Academico for text), and `g` by applying its
  `transform` (translate and rotate only, which is all VexFlow emits) to children. Anything
  else throws in development and is skipped in production.
- **Fonts.** VexFlow bundles Bravura and Academico as base64 WOFF2 data URIs. `fonts.ts`
  decodes those bytes and hands them to fontkit. If fontkit cannot subset the WOFF2 form,
  the fallback is to ship the OTF files under `public/fonts/` and fetch them. This is
  verified in the first implementation task, before anything else is built.
- **Header and footer.** Text uses pdf-lib's built-in Helvetica and Helvetica Bold, so no
  extra font bytes ship for prose. Line 1 (branding, optional): class item title and "Section N of
  M". Line 2: score title. Line 3: tempo marking and time signature. Footer (branding,
  optional): "Latin Music Mastery · latinmusicmastery.com" and "Page X of Y".
- **Repeats.** Default off, matching the student view: `repeatProjection` collapses repeated
  passes and VexFlow draws repeat barlines. "Expand repeats" renders every pass.
- **Cursor, hover, and scrub layers** are never rendered; the exporter uses the static SVG
  only.

### MusicXML writer

Partwise document, one `<part>` per selected track, one `<measure>` per model measure.

| Model | MusicXML |
|---|---|
| `title`, `composer` | `<work><work-title>`, `<identification><creator type="composer">` |
| `initialTempo`, `tempoChange` | `<direction><sound tempo>` plus a metronome mark |
| `initialTimeSignature`, `timeSignature` | `<attributes><time>` on measure 1 and on changes |
| `initialKeyFifths`, `keyFifths` | `<attributes><key><fifths>` |
| Track instrument | clef: percussion for `perc-*`, F clef for `bass`, G clef otherwise; guitar-family tracks add `<clef-octave-change>-1` |
| `tuning`, `stringMultiplicity` | `<staff-details>` with `<staff-lines>` and `<staff-tuning>` so tab-capable apps can show tab |
| `durationQN`, `dotted`, `triplet` | `<divisions>` fixed at 960 per quarter; `<type>` from the duration table; `<dot/>`; `<time-modification>3:2` |
| Note `midi`, `spellingHint` | `<pitch>` with step, alter, octave; the hint wins over the default sharp spelling |
| `fingering` | `<technical><string>` and `<fret>`, plus `<fingering>` when present |
| `percussion` | `<unpitched>` with display step and octave from `staffLine`, `<notehead>` from the notehead table, `<instrument>` per stroke id |
| `tieToNext`, `slurToNext` | `<tie>` + `<notations><tied>`, `<notations><slur>` with numbered start/stop |
| `articulation` | `<notations><articulations>` |
| Second voice | `<backup>` then voice 2 events |
| `repeat` | Collapsed via `repeatGroups`: `<barline><repeat direction="forward|backward">` with `<ending>` when passes differ. Unrecognizable groups export expanded. |
| `endBarline` | `<barline><bar-style>light-heavy` |

Beams are not written; notation apps auto-beam on import. The writer is checked by
round-tripping fixtures through the existing `parseMusicXmlString` and comparing to the
source model.

### MIDI writer

Type 1 file at 480 PPQ. Track 0 holds tempo and time-signature meta events, one track per
selected model track. Percussion tracks use channel 10 and map stroke midi numbers through
`gmToStrokeMidi`'s inverse. Ties merge into one note. Repeats are always expanded because
MIDI has no repeat structure.

### Filenames

`<class-item-slug>_section-<n>.<ext>` with `.pdf`, `.musicxml`, `.mid`. Slug is lowercase
ASCII with hyphens, accents stripped, max 60 characters.

## UI

### Admin: Export chip and dialog

An `Export` chip joins the score-action cluster that `ScoreSectionEditor` portals into the
app bar, placed after `Replace score`. It opens `ExportDialog`, a modal in the studio's
existing chip and segment styles.

Dialog contents, top to bottom:

- Title "Export sheet music" and a subtitle with section number, score title, measure
  count, time signature and tempo.
- Format cards: PDF (default), MusicXML, MIDI. Selecting MIDI hides the page and include
  sections.
- Tracks: one checkbox per track, all checked by default, with the track's view label.
  At least one must stay checked.
- Page: Letter or A4 segment. Persisted in `localStorage` as the admin's last choice.
- Include: "Title, tempo and time signature", "Measure numbers", "Course name and site
  footer", "Expand repeats". First three default on, last off.
- Preview: the first system of the first selected track, drawn by the same offscreen
  engraver at reduced scale. Rebuilt when tracks or page size change. Shown as an SVG,
  never as a PDF.
- Footer: the filename, Cancel, and the primary button labeled by format ("Export PDF").

While exporting, the primary button shows a spinner and the dialog stays open. On success
the dialog closes. On failure it shows an inline error and stays open.

### Student: download button and menu

In the player's notation pane header, a `st-iconbtn` with a download icon sits after the
layout toggles. It opens a two-item menu: "Sheet music (PDF)" and "MusicXML", each with a
one-line caption, and a footer line stating what the export includes. Clicking an item
exports the active section immediately with defaults: all tracks, Letter, header and
branding on, measure numbers on, repeats collapsed. The button is hidden during section
gaps when no score is active.

All student strings go through the existing translation catalog in `locales/en.json` and
`locales/es.json`.

## Error handling

- Font bytes fail to load: the PDF path reports "Could not load notation fonts" and the
  dialog stays open. The other formats are unaffected.
- The score has a measure whose events overflow the time signature: the engraver already
  tolerates this on screen. The exporter uses the same descriptors, so the page matches the
  screen rather than failing.
- No track selected: the primary button is disabled.
- Browser blocks the download: nothing we can detect; the click is standard anchor
  download behavior.

## Testing

- `filename.test.ts`: slugging, accents, length cap, extensions.
- `musicxml-writer.test.ts`: fixture scores (staff, bass with fingering, percussion,
  two voices, triplets, ties, repeats) round-trip through `parseMusicXmlString` and match
  the source. Snapshot of one full document for readability.
- `midi-writer.test.ts`: parse the written bytes back with `@tonejs/midi` and check note
  count, tempo, channel 10 for percussion, tie merging.
- `page-plan.test.ts`: systems per page for Letter and A4 with and without header.
- `svg-to-pdf.test.ts`: a hand-written SVG fixture with every element type produces the
  expected pdf-lib calls (pdf-lib mocked). One test asserts an unknown element throws in
  development.
- `render-section.test.ts` runs in the jsdom environment used by the existing renderer
  tests, engraves a two-track fixture with shared widths, and asserts both tracks report
  the same system count and measure-to-system mapping.
- Component tests for the dialog: MIDI hides page options, unchecking the last track
  disables Export, error message renders on a rejected export.
- Manual: open a PDF in Preview and Chrome, open the MusicXML in MuseScore 4, import the
  MIDI into a DAW. Recorded in the PR description with screenshots.

## Open risks

- fontkit subsetting of the WOFF2 bytes is unverified. Task 1 of the plan is a spike that
  embeds Bravura and draws one glyph; the OTF fallback is ready if it fails.
- `StaffRendererImpl` currently computes its own measure widths inline. Extracting that into
  a shared helper and adding the `measureWidths` override touches the live renderer, so the
  existing renderer tests and the PracticeSongsView snapshots (already drifting on this
  machine) must be run before and after.
