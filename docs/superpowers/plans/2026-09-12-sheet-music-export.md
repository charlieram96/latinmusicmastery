# Sheet Music Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export one PlaySense Studio scored section as a vector PDF, a MusicXML file, or a MIDI file, from the admin studio (dialog) and the student player (two-item menu).

**Architecture:** All writers are pure browser-side modules under `lib/playsense-studio/export/` that take the in-memory `ScoreDocument` and return bytes. The PDF path engraves each track row-by-row with VexFlow into standalone SVGs (reusing the existing `extractTrackEvents` / `formatMeasureVoice` helpers and a shared row-packing plan so every track wraps identically), then translates those SVGs into `pdf-lib` drawing calls, drawing every Bravura/Academico glyph as a vector outline obtained through `@pdf-lib/fontkit` (pdf-lib's own font embedding is broken for these fonts). UI is two thin components: an admin `ExportDialog` (Radix Dialog, studio chip styles) and a student `DownloadMenu`.

**Tech Stack:** TypeScript, React 19, Next 16, VexFlow 5.0.0 (SVG backend), pdf-lib 1.17.1, @pdf-lib/fontkit (new), @tonejs/midi 2.0.28, vitest 3 (node env by default, `// @vitest-environment jsdom` per file), jsdom 26.

**Spec:** `docs/superpowers/specs/2026-09-12-sheet-music-export-design.md`

## Global Constraints

- Formats: PDF, MusicXML (`.musicxml`, MusicXML 4.0 partwise, uncompressed), MIDI (`.mid`, type 1). Students see PDF and MusicXML only; MIDI is admin only.
- Filenames: `<class-item-slug>_section-<n>.<ext>`; slug lowercase ASCII, hyphens, accents stripped, max 60 chars.
- PDF page sizes: Letter 612×792 pt, A4 595.28×841.89 pt. Margins 54 pt.
- PDF prose text uses pdf-lib built-in Helvetica / Helvetica-Bold. Music glyphs and VexFlow text (Bravura, Academico) are drawn as vector outlines from the font files via fontkit; no notation font is ever embedded with pdf-lib (its subsetter corrupts them).
- Branding (line "class item title · Section N of M" plus footer "Latin Music Mastery · latinmusicmastery.com") is on by default; admin checkbox turns it off.
- Repeats collapsed by default (matching the student view); "Expand repeats" renders every pass. MIDI always expands.
- Every test file lives under a `__tests__/` directory (vitest include glob). Tests import `{ describe, it, expect } from 'vitest'` explicitly. Tests that touch the DOM start with `// @vitest-environment jsdom`.
- Never store anything server-side. The only network call is the fire-and-forget `logPlaysenseStudioEvent` with event type `playsense_studio_section_exported`.
- Do not rename or restyle existing UI. New controls copy existing classes exactly (`st-chip`, `st-iconbtn`, the player's rounded-full toggle classes).
- Commit after every task with the attribution lines the session reminder specifies. Run `npx vitest run <changed test files>` before each commit; run the full `npx vitest run` before Tasks 13 and 15.

## Deviations from the spec (decided while planning)

1. **Own engraver instead of mounting `StaffRendererImpl`.** The spec said the exporter mounts the live renderer with a `measureWidths` override. `StaffRendererImpl` is a private 1,700-line class that builds cursors, pointer handlers and ResizeObservers, and measures `clientWidth`. The plan instead adds a ~120-line `engrave.ts` that reuses the same exported building blocks (`extractTrackEvents`, `formatMeasureVoice`, `createStaveNote`, `scoreTieIndices`, `hasFinalBarline`) and draws one standalone `<svg>` per row. The only change to the live renderer is extracting its inline measure-width formula into a shared helper (Task 3), which is what keeps print rows and screen rows packed the same way.
2. **Branding line uses the class item (lesson) title, not a course title.** No course title is fetched anywhere in the studio or player today. Adding it would touch the Supabase select in two pages for one line of text. The header line reads `"<class item title> · Section N of M"`.
3. **Round-trip tests compare only what the importer reads.** `parseMusicXmlString` ignores ties, slurs, articulations, triplets, fingering, tuning, repeats and voice 2. Those are asserted directly on the written XML with `DOMParser` under jsdom instead.

## File structure

```
lib/playsense-studio/export/
  filename.ts                sectionExportFilename(), slugify()
  download.ts                downloadBytes(bytes, filename, mimeType)
  index.ts                   exportSection(request): Promise<void>  (+ ExportRequest type)
  musicxml-writer.ts         writeMusicXml(score, trackIndexes, opts): string
  midi-writer.ts             writeMidi(score, trackIndexes): Uint8Array
  pdf/
    fonts.ts                 loadNotationFonts(): Promise<{ bravura: Uint8Array; academico: Uint8Array }>
    glyph-outlines.ts        createGlyphOutliner(bytes): GlyphOutliner (per-character SVG outlines)
    row-plan.ts              buildRowPlan(score, trackIndexes, availWidth): RowPlan
    engrave.ts               engraveTrackRows(score, trackIndex, plan): EngravedTrack
    page-plan.ts             PAGE_SIZES, planPages(...)
    svg-to-pdf.ts            drawSvgOnPage(page, svg, glyphs, transform)
    render-section.ts        renderSectionPdf(request): Promise<Uint8Array>
  __tests__/
    filename.test.ts
    row-plan.test.ts
    engrave.test.ts          (jsdom)
    page-plan.test.ts
    svg-to-pdf.test.ts       (jsdom)
    render-section.test.ts   (jsdom)
    musicxml-writer.test.ts  (jsdom)
    midi-writer.test.ts
    fonts-embed.test.ts      (node; the fontkit spike, kept as a regression test)
lib/playsense-studio/notation-layout.ts        + requiredMeasureWidths()
components/playsense-studio/player/notation/renderers/staff-renderer.tsx   uses requiredMeasureWidths()
components/playsense-studio/export/
  export-dialog.tsx          admin dialog
  download-menu.tsx          student menu
  __tests__/export-options.test.ts   pure option reducer tests
public/fonts/notation/
  bravura.woff2, academico.woff2     extracted from VexFlow's bundled data URIs (SIL OFL)
scripts/extract-notation-fonts.mjs   one-off extractor (kept so the files can be regenerated)
```

---

### Task 1: Font extraction and the fontkit embedding spike

This task settles the one open risk in the spec. The first attempt showed pdf-lib cannot embed VexFlow's fonts (its subsetter corrupts them and the OTF path crashes), so music glyphs are drawn as vector outlines obtained from the font with fontkit. pdf-lib never embeds a notation font.

**Files:**
- Create: `scripts/extract-notation-fonts.mjs`
- Create: `public/fonts/notation/bravura.woff2`, `public/fonts/notation/academico.woff2` (generated)
- Create: `lib/playsense-studio/export/pdf/fonts.ts`
- Create: `lib/playsense-studio/export/pdf/glyph-outlines.ts`
- Test: `lib/playsense-studio/export/__tests__/fonts-embed.test.ts`

**Interfaces:**
- Produces: `loadNotationFonts(fetchImpl?: typeof fetch): Promise<NotationFontBytes>` where `NotationFontBytes = { bravura: Uint8Array; academico: Uint8Array }`; `NOTATION_FONT_URLS`; and `createGlyphOutliner(bytes: Uint8Array): GlyphOutliner` with `GlyphOutliner = { unitsPerEm: number; outline(codePoint): { d: string; advance: number } | null; widthOf(text, size): number }` (file `pdf/glyph-outlines.ts`).

- [ ] **Step 1: Install fontkit**

```bash
npm install @pdf-lib/fontkit@^1.1.1
```
Expected: `package.json` gains `"@pdf-lib/fontkit": "^1.1.1"` under dependencies.

- [ ] **Step 2: Write the extractor script**

VexFlow does not export its font modules through its `exports` map, so read the files directly from `node_modules` at build-tool time, never at runtime.

```js
// scripts/extract-notation-fonts.mjs
// Extracts the Bravura and Academico WOFF2 bytes that VexFlow bundles as
// base64 data URIs into public/fonts/notation/. Both fonts are SIL OFL.
// Run with: node scripts/extract-notation-fonts.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'public', 'fonts', 'notation');
mkdirSync(outDir, { recursive: true });

const sources = {
  'bravura.woff2': 'node_modules/vexflow/build/esm/src/fonts/bravura.js',
  'academico.woff2': 'node_modules/vexflow/build/esm/src/fonts/academico.js',
};

for (const [outName, src] of Object.entries(sources)) {
  const js = readFileSync(path.join(root, src), 'utf8');
  const match = /data:font\/woff2;charset=utf-8;base64,([A-Za-z0-9+/=]+)/.exec(js);
  if (!match) throw new Error(`No woff2 data URI found in ${src}`);
  const bytes = Buffer.from(match[1], 'base64');
  writeFileSync(path.join(outDir, outName), bytes);
  console.log(`${outName}: ${bytes.length} bytes`);
}
```

- [ ] **Step 3: Run it**

```bash
node scripts/extract-notation-fonts.mjs && ls -la public/fonts/notation
```
Expected: two files, bravura around 240 KB, academico around 60 KB.

- [ ] **Step 4: Write `fonts.ts`** (byte loader, unchanged in spirit)

```ts
// lib/playsense-studio/export/pdf/fonts.ts
// Fetches the notation font bytes the PDF exporter turns into glyph outlines.
// Bytes are cached for the page lifetime so repeated exports do not refetch.

export const NOTATION_FONT_URLS = {
  bravura: '/fonts/notation/bravura.woff2',
  academico: '/fonts/notation/academico.woff2',
} as const;

export interface NotationFontBytes {
  bravura: Uint8Array;
  academico: Uint8Array;
}

let cached: Promise<NotationFontBytes> | null = null;

async function fetchBytes(url: string, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Could not load notation font ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export function loadNotationFonts(fetchImpl: typeof fetch = fetch): Promise<NotationFontBytes> {
  if (!cached) {
    cached = Promise.all([
      fetchBytes(NOTATION_FONT_URLS.bravura, fetchImpl),
      fetchBytes(NOTATION_FONT_URLS.academico, fetchImpl),
    ]).then(([bravura, academico]) => ({ bravura, academico }));
    cached.catch(() => { cached = null; });
  }
  return cached;
}

/** Test seam: forget the cached bytes. */
export function resetNotationFontCache(): void {
  cached = null;
}
```

- [ ] **Step 5: Write `glyph-outlines.ts`**

pdf-lib's font subsetter (`embedFont(bytes, { subset: true })`) writes corrupted glyph programs for both Bravura and Academico, and `subset: false` on the OTF yields zero-width glyphs (verified in this task's first attempt; see the report). So the exporter never embeds a notation font. Instead it asks fontkit for each glyph's outline and draws it as an SVG path. fontkit parses the WOFF2 bytes correctly; only pdf-lib's re-encoder is broken.

```ts
// lib/playsense-studio/export/pdf/glyph-outlines.ts
// Turns notation font bytes into per-character SVG path outlines, so the PDF
// exporter draws music glyphs as vector paths instead of embedding the font.
import fontkit from '@pdf-lib/fontkit';

export interface GlyphOutline {
  /** SVG path data in font units, y-axis already flipped to point DOWN. */
  d: string;
  /** Horizontal advance in font units. */
  advance: number;
}

export interface GlyphOutliner {
  unitsPerEm: number;
  /** Outline for one code point, or null when the font has no glyph for it. */
  outline(codePoint: number): GlyphOutline | null;
  /** Total advance of a string at a font size, in the same units as `size`. */
  widthOf(text: string, size: number): number;
}

export function createGlyphOutliner(bytes: Uint8Array): GlyphOutliner {
  const font = fontkit.create(bytes as unknown as Buffer);
  const cache = new Map<number, GlyphOutline | null>();
  const outline = (codePoint: number): GlyphOutline | null => {
    if (cache.has(codePoint)) return cache.get(codePoint)!;
    const glyph = font.hasGlyphForCodePoint(codePoint) ? font.glyphForCodePoint(codePoint) : null;
    let result: GlyphOutline | null = null;
    if (glyph) {
      // fontkit paths are y-up; flip so pdf-lib's drawSvgPath (y-down) draws them upright.
      const d = glyph.path.transform(1, 0, 0, -1, 0, 0).toSVG();
      result = { d, advance: glyph.advanceWidth };
    }
    cache.set(codePoint, result);
    return result;
  };
  return {
    unitsPerEm: font.unitsPerEm,
    outline,
    widthOf(text, size) {
      let total = 0;
      for (const ch of text) total += outline(ch.codePointAt(0)!)?.advance ?? 0;
      return (total / font.unitsPerEm) * size;
    },
  };
}
```
`@pdf-lib/fontkit` ships a browser build with its own Buffer shim (pdf-lib itself calls `fontkit.create` on a Uint8Array in the browser), so the cast is safe in both node and the browser.

- [ ] **Step 6: Write the outline test (the spike)**

```ts
// lib/playsense-studio/export/__tests__/fonts-embed.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import { createGlyphOutliner } from '../pdf/glyph-outlines';

const fontsDir = path.resolve(__dirname, '../../../../public/fonts/notation');
const bravura = () => createGlyphOutliner(new Uint8Array(readFileSync(path.join(fontsDir, 'bravura.woff2'))));
const academico = () => createGlyphOutliner(new Uint8Array(readFileSync(path.join(fontsDir, 'academico.woff2'))));

describe('notation glyph outlines', () => {
  it('yields a sane outline for the G clef and a notehead', () => {
    const f = bravura();
    const clef = f.outline(0xe050)!;
    const head = f.outline(0xe0a4)!;
    expect(clef.d.length).toBeGreaterThan(200);
    expect(head.d.length).toBeGreaterThan(50);
    expect(clef.advance).toBeGreaterThan(0);
    // All coordinates stay inside a few ems: no garbage from a broken decode.
    const nums = clef.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    expect(Math.max(...nums.map(Math.abs))).toBeLessThan(f.unitsPerEm * 4);
    expect(f.outline(0x10ffff)).toBeNull();
  });

  it('measures text advances', () => {
    const a = academico();
    expect(a.widthOf('12', 10)).toBeGreaterThan(0);
    expect(a.widthOf('12', 20)).toBeCloseTo(a.widthOf('12', 10) * 2, 6);
  });

  it('draws the outlines into a PDF without embedding a font', async () => {
    const f = bravura();
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 100]);
    const size = 30;
    const scale = size / f.unitsPerEm;
    let x = 20;
    for (const cp of [0xe050, 0xe0a4]) {
      const g = f.outline(cp)!;
      page.drawSvgPath(g.d, { x, y: 40, scale, color: rgb(0, 0, 0), borderWidth: 0 });
      x += g.advance * scale + 6;
    }
    const bytes = await doc.save();
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
    expect(doc.getForm().getFields()).toHaveLength(0);
    // No embedded font program in the file.
    expect(Buffer.from(bytes).includes(Buffer.from('/FontFile'))).toBe(false);
  });
});
```

- [ ] **Step 7: Run the test and rasterize the PDF once**

```bash
npx vitest run lib/playsense-studio/export/__tests__/fonts-embed.test.ts
```
Expected: PASS (3 tests). Then prove the glyphs are visible: temporarily add `writeFileSync('/tmp/bravura-spike.pdf', bytes)` inside the third test, run it, and rasterize with PyMuPDF (already available from the first attempt) or `qlmanage -t -s 800 /tmp/bravura-spike.pdf -o /tmp`:

```bash
python3 -c "import fitz; p=fitz.open('/tmp/bravura-spike.pdf')[0].get_pixmap(dpi=144); p.save('/tmp/bravura-spike.png'); import statistics; print('nonwhite', sum(1 for b in p.samples if b < 128))"
```
Expected: a non-zero non-white pixel count, and the PNG shows a G clef and a black notehead. Record the count in the report and remove the debug line.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json scripts/extract-notation-fonts.mjs public/fonts/notation lib/playsense-studio/export/pdf/fonts.ts lib/playsense-studio/export/pdf/glyph-outlines.ts lib/playsense-studio/export/__tests__/fonts-embed.test.ts
git commit -m "Draw notation glyphs as outlines for sheet music export"
```

---

### Task 2: Filenames and the download helper

**Files:**
- Create: `lib/playsense-studio/export/filename.ts`
- Create: `lib/playsense-studio/export/download.ts`
- Test: `lib/playsense-studio/export/__tests__/filename.test.ts`

**Interfaces:**
- Produces: `type ExportFormat = 'pdf' | 'musicxml' | 'midi'`; `slugify(text: string): string`; `sectionExportFilename(classItemTitle: string, sectionIndex: number, format: ExportFormat): string`; `EXPORT_MIME: Record<ExportFormat, string>`; `downloadBytes(bytes: Uint8Array | string, filename: string, mimeType: string): void`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/playsense-studio/export/__tests__/filename.test.ts
import { describe, expect, it } from 'vitest';
import { sectionExportFilename, slugify } from '../filename';

describe('slugify — export filenames', () => {
  it('lowercases, strips accents and joins with hyphens', () => {
    expect(slugify('Montuno básico en Do')).toBe('montuno-basico-en-do');
  });
  it('drops punctuation and collapses runs of separators', () => {
    expect(slugify('  Son / Montuno (C - F)!! ')).toBe('son-montuno-c-f');
  });
  it('caps at 60 characters without a trailing hyphen', () => {
    const slug = slugify('a '.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
  it('falls back to "score" for an empty title', () => {
    expect(slugify('¡¡!!')).toBe('score');
  });
});

describe('sectionExportFilename', () => {
  it('uses a 1-based section number and the format extension', () => {
    expect(sectionExportFilename('Montuno básico en Do', 1, 'pdf')).toBe('montuno-basico-en-do_section-2.pdf');
    expect(sectionExportFilename('Clave', 0, 'musicxml')).toBe('clave_section-1.musicxml');
    expect(sectionExportFilename('Clave', 0, 'midi')).toBe('clave_section-1.mid');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/filename.test.ts
```
Expected: FAIL, cannot resolve `../filename`.

- [ ] **Step 3: Implement `filename.ts`**

```ts
// lib/playsense-studio/export/filename.ts
export type ExportFormat = 'pdf' | 'musicxml' | 'midi';

export const EXPORT_EXTENSION: Record<ExportFormat, string> = {
  pdf: 'pdf',
  musicxml: 'musicxml',
  midi: 'mid',
};

export const EXPORT_MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  musicxml: 'application/vnd.recordare.musicxml+xml',
  midi: 'audio/midi',
};

const MAX_SLUG = 60;

export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
  return slug || 'score';
}

/** `sectionIndex` is 0-based; the filename shows it 1-based. */
export function sectionExportFilename(classItemTitle: string, sectionIndex: number, format: ExportFormat): string {
  return `${slugify(classItemTitle)}_section-${sectionIndex + 1}.${EXPORT_EXTENSION[format]}`;
}
```

- [ ] **Step 4: Implement `download.ts`**

```ts
// lib/playsense-studio/export/download.ts
// Hands generated bytes to the browser as a named download. No return value:
// the browser owns the save dialog and we cannot observe a cancel.

export function downloadBytes(bytes: Uint8Array | string, filename: string, mimeType: string): void {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run lib/playsense-studio/export/__tests__/filename.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/playsense-studio/export/filename.ts lib/playsense-studio/export/download.ts lib/playsense-studio/export/__tests__/filename.test.ts
git commit -m "Add export filename and browser download helpers"
```

---

### Task 3: Shared measure-width helper (renderer refactor)

The wrapped staff renderer computes each measure's required width inline. Move that formula into `notation-layout.ts` so the exporter packs rows with the exact same numbers the screen uses.

**Files:**
- Modify: `lib/playsense-studio/notation-layout.ts`
- Modify: `components/playsense-studio/player/notation/renderers/staff-renderer.tsx` (the wrapped branch of `computePlan`, currently around lines 426-431, and the four constants it uses)
- Test: `lib/playsense-studio/__tests__/notation-layout.test.ts` (extend if it exists, else create)

**Interfaces:**
- Produces: `export const MEASURE_WIDTH = { QN_WIDTH: 54, PER_NOTE_MIN_WIDTH: 22, FIRST_MEASURE_EXTRA_WIDTH: 80, MIN: 100 } as const;` and `export function requiredMeasureWidths(blocks: ReadonlyArray<{ timeSignature: [number, number]; events: ReadonlyArray<unknown> }>): number[]`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/playsense-studio/__tests__/notation-layout.test.ts  (add to the existing file if present)
import { describe, expect, it } from 'vitest';
import { requiredMeasureWidths, MEASURE_WIDTH } from '../notation-layout';

describe('requiredMeasureWidths', () => {
  const block = (events: number, ts: [number, number] = [4, 4]) => ({ timeSignature: ts, events: new Array(events).fill(0) });

  it('gives the first measure room for the clef and time signature', () => {
    const [first, second] = requiredMeasureWidths([block(4), block(4)]);
    expect(first - second).toBe(MEASURE_WIDTH.FIRST_MEASURE_EXTRA_WIDTH);
  });
  it('uses the larger of beat width and per-note width', () => {
    const [sparse] = requiredMeasureWidths([block(1)]);
    const [dense] = requiredMeasureWidths([block(16)]);
    expect(sparse).toBe(4 * MEASURE_WIDTH.QN_WIDTH + MEASURE_WIDTH.FIRST_MEASURE_EXTRA_WIDTH);
    expect(dense).toBe(16 * MEASURE_WIDTH.PER_NOTE_MIN_WIDTH + 24 + MEASURE_WIDTH.FIRST_MEASURE_EXTRA_WIDTH);
  });
  it('never goes below the minimum', () => {
    const [, w] = requiredMeasureWidths([block(1), block(0, [1, 8])]);
    expect(w).toBe(MEASURE_WIDTH.MIN);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/__tests__/notation-layout.test.ts
```
Expected: FAIL, `requiredMeasureWidths` is not exported.

- [ ] **Step 3: Add the helper to `notation-layout.ts`**

```ts
// append to lib/playsense-studio/notation-layout.ts
/** Width constants shared by the wrapped staff renderer and the PDF exporter. */
export const MEASURE_WIDTH = {
  QN_WIDTH: 54,
  PER_NOTE_MIN_WIDTH: 22,
  FIRST_MEASURE_EXTRA_WIDTH: 80,
  MIN: 100,
} as const;

/**
 * Model-space width each measure needs when several measures share a row.
 * Clef/signature space belongs only to the first measure.
 */
export function requiredMeasureWidths(
  blocks: ReadonlyArray<{ timeSignature: [number, number]; events: ReadonlyArray<unknown> }>,
): number[] {
  return blocks.map((block, index) => {
    const quarterNotes = (block.timeSignature[0] * 4) / block.timeSignature[1];
    return (
      Math.max(MEASURE_WIDTH.MIN, quarterNotes * MEASURE_WIDTH.QN_WIDTH, block.events.length * MEASURE_WIDTH.PER_NOTE_MIN_WIDTH + 24) +
      (index === 0 ? MEASURE_WIDTH.FIRST_MEASURE_EXTRA_WIDTH : 0)
    );
  });
}
```

- [ ] **Step 4: Use it in the renderer**

In `staff-renderer.tsx`, replace the inline block inside `computePlan`'s wrapped branch:

```ts
    const requiredWidths = measureBlocks.map((block, index) => {
      const quarterNotes = block.timeSignature[0] * 4 / block.timeSignature[1];
      return Math.max(100, quarterNotes * QN_WIDTH, block.events.length * PER_NOTE_MIN_WIDTH + 24)
        + (index === 0 ? FIRST_MEASURE_EXTRA_WIDTH : 0);
    });
```
with
```ts
    const requiredWidths = requiredMeasureWidths(measureBlocks);
```
Add `requiredMeasureWidths, MEASURE_WIDTH` to the existing import from `@/lib/playsense-studio/notation-layout` (the file already imports `packLessonScoreRows` from there). Delete the now-unused local constants `PER_NOTE_MIN_WIDTH` and `QN_WIDTH`. Keep `FIRST_MEASURE_EXTRA_WIDTH` but define it as `const FIRST_MEASURE_EXTRA_WIDTH = MEASURE_WIDTH.FIRST_MEASURE_EXTRA_WIDTH;` because the draw loop still uses it for the justify width.

- [ ] **Step 5: Run the renderer and layout tests**

```bash
npx vitest run lib/playsense-studio/__tests__/notation-layout.test.ts components/playsense-studio/player/notation/renderers/__tests__ lib/playsense-studio/__tests__/percussion-rendering.test.ts
npx tsc --noEmit -p tsconfig.json
```
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/playsense-studio/notation-layout.ts lib/playsense-studio/__tests__/notation-layout.test.ts components/playsense-studio/player/notation/renderers/staff-renderer.tsx
git commit -m "Share the wrapped-row measure width formula with the exporter"
```

---

### Task 4: Row plan shared across tracks

A pure module: given the score and the selected tracks, decide which measures go on which row so every track wraps identically, and report whether the tracks can be interleaved per system.

**Files:**
- Create: `lib/playsense-studio/export/pdf/row-plan.ts`
- Test: `lib/playsense-studio/export/__tests__/row-plan.test.ts`

**Interfaces:**
- Consumes: `requiredMeasureWidths`, `packLessonScoreRows` (`lib/playsense-studio/notation-layout.ts`), `extractTrackEvents` (`lib/playsense-studio/score-to-vexflow.ts`), `repeatProjection` (`lib/playsense-studio/repeats.ts`).
- Produces:
```ts
export interface RowPlanRow { startIndex: number; widths: number[] }
export interface RowPlan {
  /** Score after optional repeat collapsing; every track has the same measure count when `aligned`. */
  score: ScoreDocument;
  trackIndexes: number[];
  availWidth: number;
  rows: RowPlanRow[];
  /** True when every selected track has the same measure count and shares `rows`. */
  aligned: boolean;
  /** Per-track rows when not aligned (each track packed on its own). */
  perTrackRows: Record<number, RowPlanRow[]>;
}
export function buildRowPlan(score: ScoreDocument, trackIndexes: number[], availWidth: number, opts: { expandRepeats: boolean }): RowPlan
```

- [ ] **Step 1: Write the failing test**

```ts
// lib/playsense-studio/export/__tests__/row-plan.test.ts
import { describe, expect, it } from 'vitest';
import { buildRowPlan } from '../pdf/row-plan';
import { SON_MONTUNO_FIXTURE, GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

describe('buildRowPlan', () => {
  it('packs every selected track with the same rows', () => {
    const plan = buildRowPlan(SON_MONTUNO_FIXTURE, [0, 1, 2], 700, { expandRepeats: true });
    expect(plan.aligned).toBe(true);
    const measures = plan.rows.reduce((n, r) => n + r.widths.length, 0);
    expect(measures).toBe(4);
    expect(plan.rows[0].startIndex).toBe(0);
  });

  it('uses the widest requirement across tracks for each measure', () => {
    const narrow = buildRowPlan(SON_MONTUNO_FIXTURE, [2], 700, { expandRepeats: true });
    const all = buildRowPlan(SON_MONTUNO_FIXTURE, [0, 1, 2], 700, { expandRepeats: true });
    const width = (p: typeof all, i: number) => p.rows.flatMap(r => r.widths)[i];
    expect(width(all, 1)).toBeGreaterThanOrEqual(width(narrow, 1));
  });

  it('falls back to per-track rows when measure counts differ', () => {
    const uneven: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [
        GUITAR_LICK_FIXTURE.tracks[0],
        { ...GUITAR_LICK_FIXTURE.tracks[0], index: 1, measures: GUITAR_LICK_FIXTURE.tracks[0].measures.slice(0, 1) },
      ],
    };
    const plan = buildRowPlan(uneven, [0, 1], 700, { expandRepeats: true });
    expect(plan.aligned).toBe(false);
    expect(plan.perTrackRows[0].flatMap(r => r.widths)).toHaveLength(2);
    expect(plan.perTrackRows[1].flatMap(r => r.widths)).toHaveLength(1);
  });

  it('collapses repeats when not expanding', () => {
    const m = GUITAR_LICK_FIXTURE.tracks[0].measures[0];
    const repeated: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [{
        ...GUITAR_LICK_FIXTURE.tracks[0],
        measures: [
          { ...m, number: 1, repeat: { id: 'r', pass: 0, count: 2, offset: 0, length: 1 } },
          { ...m, number: 2, repeat: { id: 'r', pass: 1, count: 2, offset: 0, length: 1 } },
        ],
      }],
    };
    expect(buildRowPlan(repeated, [0], 700, { expandRepeats: false }).rows.flatMap(r => r.widths)).toHaveLength(1);
    expect(buildRowPlan(repeated, [0], 700, { expandRepeats: true }).rows.flatMap(r => r.widths)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/row-plan.test.ts
```
Expected: FAIL, cannot resolve `../pdf/row-plan`.

- [ ] **Step 3: Implement `row-plan.ts`**

```ts
// lib/playsense-studio/export/pdf/row-plan.ts
// Pure. Decides how measures wrap into rows for the printed page, once for all
// selected tracks, so system N of every track holds the same measures.
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { packLessonScoreRows, requiredMeasureWidths } from '@/lib/playsense-studio/notation-layout';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { repeatProjection } from '@/lib/playsense-studio/repeats';

export interface RowPlanRow { startIndex: number; widths: number[] }

export interface RowPlan {
  score: ScoreDocument;
  trackIndexes: number[];
  availWidth: number;
  rows: RowPlanRow[];
  aligned: boolean;
  perTrackRows: Record<number, RowPlanRow[]>;
}

/** Collapse repeated passes on every selected track (the student view does the same). */
function collapseRepeats(score: ScoreDocument, trackIndexes: number[]): ScoreDocument {
  let out = score;
  for (const t of trackIndexes) {
    const projection = repeatProjection(out, t);
    if (projection) out = projection.score;
  }
  return out;
}

function trackWidths(score: ScoreDocument, trackIndex: number): number[] {
  const track = score.tracks[trackIndex];
  const blocks = extractTrackEvents(track, score.initialTimeSignature, score.initialKeyFifths);
  return requiredMeasureWidths(blocks);
}

function pack(widths: number[], availWidth: number): RowPlanRow[] {
  return packLessonScoreRows(widths, availWidth, { leading: false, trailing: false })
    .map(r => ({ startIndex: r.startIndex, widths: r.widths }));
}

export function buildRowPlan(
  score: ScoreDocument,
  trackIndexes: number[],
  availWidth: number,
  opts: { expandRepeats: boolean },
): RowPlan {
  const projected = opts.expandRepeats ? score : collapseRepeats(score, trackIndexes);
  const widthsByTrack = trackIndexes.map(t => trackWidths(projected, t));
  const counts = new Set(widthsByTrack.map(w => w.length));
  const aligned = counts.size === 1;

  if (aligned) {
    const merged = widthsByTrack[0].map((_, i) => Math.max(...widthsByTrack.map(w => w[i])));
    const rows = pack(merged, availWidth);
    return { score: projected, trackIndexes, availWidth, rows, aligned, perTrackRows: {} };
  }

  const perTrackRows: Record<number, RowPlanRow[]> = {};
  trackIndexes.forEach((t, k) => { perTrackRows[t] = pack(widthsByTrack[k], availWidth); });
  return { score: projected, trackIndexes, availWidth, rows: [], aligned, perTrackRows };
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run lib/playsense-studio/export/__tests__/row-plan.test.ts
```
Expected: PASS (4 tests). If `packLessonScoreRows` returns rows whose `startIndex` is `-1` for interludes, that cannot happen here because both interlude flags are false.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/export/pdf/row-plan.ts lib/playsense-studio/export/__tests__/row-plan.test.ts
git commit -m "Add shared row plan for multi-track sheet music export"
```

---

### Task 5: Engrave a track into one standalone SVG per row

Reuses the renderer's exported building blocks. Each row becomes its own `<svg>` so the page composer can place whole rows without slicing a bigger drawing. Cursor, hover and hit-testing layers are never created.

**Files:**
- Create: `lib/playsense-studio/export/pdf/engrave.ts`
- Test: `lib/playsense-studio/export/__tests__/engrave.test.ts` (jsdom)

**Interfaces:**
- Consumes: `RowPlan` (Task 4); `extractTrackEvents`, `scoreTieIndices` from `@/lib/playsense-studio/score-to-vexflow`; `formatMeasureVoice` from `@/components/playsense-studio/player/notation/renderers/staff-renderer`; `hasFinalBarline` from `@/lib/playsense-studio/barlines`; VexFlow `Renderer, Stave, StaveTie, BarlineType`.
- Produces:
```ts
export interface EngravedRow {
  svg: SVGSVGElement;          // width = plan.availWidth + 2 * PRINT_PADDING_X, height = rowHeight
  width: number;
  height: number;
  firstMeasureNumber: number;  // model measure number of the row's first measure
  staffTopY: number;           // y of the top staff line inside this svg
}
export interface EngravedTrack { trackIndex: number; displayName: string; rows: EngravedRow[]; rowHeight: number }
export const PRINT_PADDING_X = 12;
export function engraveTrackRows(plan: RowPlan, trackIndex: number): EngravedTrack
```

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/engrave.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRowPlan } from '../pdf/row-plan';
import { engraveTrackRows, PRINT_PADDING_X } from '../pdf/engrave';
import { SON_MONTUNO_FIXTURE, CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';

// jsdom has no layout engine. VexFlow measures text through an SVG bbox; give
// it a proportional stub so formatting produces finite positions.
beforeAll(() => {
  const proto = (globalThis as unknown as { SVGElement: { prototype: Record<string, unknown> } }).SVGElement.prototype;
  proto.getBBox = function getBBox(this: Element) {
    const len = (this.textContent ?? '').length;
    return { x: 0, y: -8, width: Math.max(6, len * 7), height: 10 };
  };
  const canvasProto = (globalThis as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype;
  canvasProto.getContext = () => ({ measureText: (t: string) => ({ width: t.length * 7 }), font: '' });
});

describe('engraveTrackRows', () => {
  it('produces one svg per row with the shared width', () => {
    const plan = buildRowPlan(SON_MONTUNO_FIXTURE, [0, 1, 2], 700, { expandRepeats: true });
    const tres = engraveTrackRows(plan, 0);
    const bass = engraveTrackRows(plan, 1);
    expect(tres.rows).toHaveLength(plan.rows.length);
    expect(bass.rows).toHaveLength(plan.rows.length);
    expect(tres.rows[0].width).toBe(700 + 2 * PRINT_PADDING_X);
    expect(tres.rows[0].svg.tagName.toLowerCase()).toBe('svg');
    expect(tres.rows[0].svg.querySelectorAll('path, text').length).toBeGreaterThan(0);
    expect(tres.rows[0].firstMeasureNumber).toBe(1);
  });

  it('starts each row with a clef and time signature only on the first row', () => {
    const plan = buildRowPlan(SON_MONTUNO_FIXTURE, [1], 260, { expandRepeats: true });
    const bass = engraveTrackRows(plan, 1);
    expect(bass.rows.length).toBeGreaterThan(1);
    const clefTexts = (row: SVGSVGElement) => Array.from(row.querySelectorAll('text')).map(t => t.textContent ?? '');
    // U+E050 G clef appears in every row.
    expect(clefTexts(bass.rows[0].svg).some(t => t.includes('\\uE050'))).toBe(true);
    expect(clefTexts(bass.rows[1].svg).some(t => t.includes('\\uE050'))).toBe(true);
  });

  it('uses the percussion clef for perc tracks', () => {
    const plan = buildRowPlan(CONGA_TUMBAO_FIXTURE, [0], 700, { expandRepeats: true });
    const conga = engraveTrackRows(plan, 0);
    const texts = Array.from(conga.rows[0].svg.querySelectorAll('text')).map(t => t.textContent ?? '');
    expect(texts.some(t => t.includes('\uE069'))).toBe(true); // U+E069 unpitchedPercussionClef1
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/engrave.test.ts
```
Expected: FAIL, cannot resolve `../pdf/engrave`.

- [ ] **Step 3: Implement `engrave.ts`**

```ts
// lib/playsense-studio/export/pdf/engrave.ts
// Draws one track of a RowPlan as a list of standalone row SVGs. Mirrors the
// draw loop in the player's staff renderer (stave, barlines, clef + time
// signature on row 0, formatted voice, beams, ties across rows) without any of
// its interactive layers.
import { Renderer, Stave, StaveTie, BarlineType, type StaveNote } from 'vexflow';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { extractTrackEvents, scoreTieIndices, type VexEventDescriptor } from '@/lib/playsense-studio/score-to-vexflow';
import { formatMeasureVoice } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';
import { hasFinalBarline } from '@/lib/playsense-studio/barlines';
import { MEASURE_WIDTH } from '@/lib/playsense-studio/notation-layout';
import type { RowPlan, RowPlanRow } from './row-plan';

export const PRINT_PADDING_X = 12;
/** VexFlow's Stave draws its five lines 40px below the stave's y, spanning 40px. */
const STAFF_LINE_TOP = 40;
const STAFF_LINE_SPAN = 40;
const ROW_TOP_PAD = 8;
const ROW_BOTTOM_PAD = 12;

export interface EngravedRow {
  svg: SVGSVGElement;
  width: number;
  height: number;
  firstMeasureNumber: number;
  staffTopY: number;
}

export interface EngravedTrack {
  trackIndex: number;
  displayName: string;
  rows: EngravedRow[];
  rowHeight: number;
}

/** Vertical room ledger notes need above and below the staff, in model px. */
function ledgerExtents(blocks: ReturnType<typeof extractTrackEvents>): { above: number; below: number } {
  const headYs = blocks.flatMap(block => block.events.flatMap(event => event.keys.map(key => {
    const match = /^([a-g])(?:#|b)?\/(-?\d+)$/.exec(key);
    if (!match) return 60;
    const step = Number(match[2]) * 7 + 'cdefgab'.indexOf(match[1]);
    return 80 - (step - 30) * 5; // same grid as the staff renderer: 5px per diatonic step
  }));
  if (headYs.length === 0) return { above: 0, below: 0 };
  return {
    above: Math.max(0, STAFF_LINE_TOP - 8 - Math.min(...headYs)),
    below: Math.max(0, Math.max(...headYs) - (STAFF_LINE_TOP + STAFF_LINE_SPAN) + 8),
  };
}

function rowsFor(plan: RowPlan, trackIndex: number): RowPlanRow[] {
  return plan.aligned ? plan.rows : plan.perTrackRows[trackIndex];
}

export function engraveTrackRows(plan: RowPlan, trackIndex: number): EngravedTrack {
  const score: ScoreDocument = plan.score;
  const track = score.tracks[trackIndex];
  const blocks = extractTrackEvents(track, score.initialTimeSignature, score.initialKeyFifths);
  const rows = rowsFor(plan, trackIndex);
  const { above, below } = ledgerExtents(blocks);
  const staveY = ROW_TOP_PAD + above;
  const rowHeight = staveY + STAFF_LINE_TOP + STAFF_LINE_SPAN + below + ROW_BOTTOM_PAD;
  const width = plan.availWidth + 2 * PRINT_PADDING_X;

  // Notes are kept across rows so ties can be split at row turns.
  let previous: { vexNote: StaveNote; descriptor: VexEventDescriptor } | null = null;
  let pendingTie: { indices: ReturnType<typeof scoreTieIndices>; descriptor: VexEventDescriptor } | null = null;
  let previousRowIndex = -1;

  const engraved: EngravedRow[] = rows.map((row, rowIndex) => {
    const host = document.createElement('div');
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, rowHeight);
    const ctx = renderer.getContext();

    let x = PRINT_PADDING_X;
    row.widths.forEach((measureWidth, col) => {
      const blockIndex = row.startIndex + col;
      const block = blocks[blockIndex];
      const showHeader = blockIndex === 0;
      const stave = new Stave(x, staveY, measureWidth);
      const repeat = block.measure.repeat;
      if (repeat?.offset === 0) stave.setBegBarType(BarlineType.REPEAT_BEGIN);
      if (repeat && repeat.offset === repeat.length - 1) stave.setEndBarType(BarlineType.REPEAT_END);
      else if (hasFinalBarline(track.measures, blockIndex)) stave.setEndBarType(BarlineType.END);
      // Every printed row restates the clef; only the first row carries the time signature.
      stave.addClef(block.clef);
      if (showHeader) stave.addTimeSignature(`${block.timeSignature[0]}/${block.timeSignature[1]}`);
      else if (col === 0) stave.setNoteStartX(stave.getNoteStartX() + 8);
      stave.setContext(ctx).draw();

      const justify = measureWidth - (showHeader ? MEASURE_WIDTH.FIRST_MEASURE_EXTRA_WIDTH : 0) - 20;
      const laid = formatMeasureVoice(block.events, block.timeSignature, justify, block.clef);
      if (laid) {
        laid.voice.draw(ctx, stave);
        laid.beams.forEach(beam => beam.setContext(ctx).draw());
        laid.vexNotes.forEach((vexNote, idx) => {
          const descriptor = block.events[idx];
          if (pendingTie) {
            // Second half of a tie that started on the previous row.
            new StaveTie({ lastNote: vexNote, firstIndexes: pendingTie.indices.lastIndexes, lastIndexes: pendingTie.indices.lastIndexes }).setContext(ctx).draw();
            pendingTie = null;
          }
          if (previous) {
            const indices = scoreTieIndices(previous.descriptor, descriptor);
            if (indices.firstIndexes.length) {
              if (previous.vexNote.getStave() === stave || previousRowIndex === rowIndex) {
                new StaveTie({ firstNote: previous.vexNote, lastNote: vexNote, ...indices }).setContext(ctx).draw();
              }
            }
          }
          previous = { vexNote, descriptor };
          previousRowIndex = rowIndex;
        });
      }
      x += measureWidth;
    });

    // A tie leaving this row: draw its first half now, remember the rest.
    if (previous && blocks[row.startIndex + row.widths.length]) {
      const nextDescriptor = blocks[row.startIndex + row.widths.length].events[0];
      if (nextDescriptor) {
        const indices = scoreTieIndices(previous.descriptor, nextDescriptor);
        if (indices.firstIndexes.length) {
          new StaveTie({ firstNote: previous.vexNote, firstIndexes: indices.firstIndexes, lastIndexes: indices.firstIndexes }).setContext(ctx).draw();
          pendingTie = { indices, descriptor: nextDescriptor };
        }
      }
    }

    const svg = host.querySelector('svg') as SVGSVGElement;
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(rowHeight));
    svg.setAttribute('viewBox', `0 0 ${width} ${rowHeight}`);
    return { svg, width, height: rowHeight, firstMeasureNumber: blocks[row.startIndex].measure.number, staffTopY: staveY + STAFF_LINE_TOP };
  });

  return { trackIndex, displayName: track.displayName, rows: engraved, rowHeight };
}

```

The in-row tie test `previous.vexNote.getStave() === stave || previousRowIndex === rowIndex` keeps ties inside a row; cross-row ties are handled by the pending block.

- [ ] **Step 4: Run the test**

```bash
npx vitest run lib/playsense-studio/export/__tests__/engrave.test.ts
```
Expected: PASS (3 tests). If VexFlow throws inside `formatMeasureVoice` about text measurement under jsdom, extend the `beforeAll` stubs: VexFlow 5 measures glyph text with `SVGContext.measureTextElement.getBBox()`; the stub above covers that. If it instead calls `canvas.getContext('2d').measureText`, the canvas stub covers it. Do not skip the test.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/export/pdf/engrave.ts lib/playsense-studio/export/__tests__/engrave.test.ts
git commit -m "Engrave score rows into standalone SVGs for PDF export"
```

---

### Task 6: Page plan

Pure geometry: page sizes, margins, header and footer heights, how many systems fit on each page, and where each system's rows land.

**Files:**
- Create: `lib/playsense-studio/export/pdf/page-plan.ts`
- Test: `lib/playsense-studio/export/__tests__/page-plan.test.ts`

**Interfaces:**
- Produces:
```ts
export type PageSize = 'letter' | 'a4';
export const PAGE_SIZES: Record<PageSize, { width: number; height: number }>; // points
export const PAGE_MARGIN = 54;
export interface PagePlanInput {
  pageSize: PageSize;
  /** Model px width the rows were engraved at (plan.availWidth + 2 * PRINT_PADDING_X). */
  rowWidthPx: number;
  /** One entry per track: row heights in model px (all rows of a track share a height). */
  trackRowHeights: number[];
  systemCount: number;
  headerHeight: number;   // points, page 1 only (0 when header off)
  footerHeight: number;   // points, every page (0 when footer off)
}
export interface PlacedRow { system: number; trackSlot: number; x: number; yTop: number; scale: number }
export interface PagePlan { pageSize: PageSize; pages: PlacedRow[][]; scale: number }
export const SYSTEM_GAP_PT = 22;   // between systems
export const TRACK_GAP_PT = 10;    // between tracks inside a system
export function planPages(input: PagePlanInput): PagePlan
```
`scale` converts model px to points: `(pageWidth - 2 * PAGE_MARGIN) / rowWidthPx`. `yTop` is measured from the top of the page in points (the translator flips to PDF's bottom-up axis).

- [ ] **Step 1: Write the failing test**

```ts
// lib/playsense-studio/export/__tests__/page-plan.test.ts
import { describe, expect, it } from 'vitest';
import { PAGE_MARGIN, PAGE_SIZES, planPages, SYSTEM_GAP_PT, TRACK_GAP_PT } from '../pdf/page-plan';

const base = { rowWidthPx: 724, trackRowHeights: [120, 120], headerHeight: 90, footerHeight: 24 };

describe('planPages', () => {
  it('scales rows to the printable width', () => {
    const plan = planPages({ ...base, pageSize: 'letter', systemCount: 1 });
    expect(plan.scale).toBeCloseTo((PAGE_SIZES.letter.width - 2 * PAGE_MARGIN) / 724, 6);
    expect(plan.pages).toHaveLength(1);
    expect(plan.pages[0]).toHaveLength(2);
  });

  it('stacks the tracks of one system with the track gap', () => {
    const plan = planPages({ ...base, pageSize: 'letter', systemCount: 1 });
    const [a, b] = plan.pages[0];
    expect(a.yTop).toBe(PAGE_MARGIN + 90);
    expect(b.yTop).toBeCloseTo(a.yTop + 120 * plan.scale + TRACK_GAP_PT, 6);
  });

  it('never splits a system across pages and leaves room for the footer', () => {
    const plan = planPages({ ...base, pageSize: 'a4', systemCount: 12 });
    const bottomLimit = PAGE_SIZES.a4.height - PAGE_MARGIN - 24;
    for (const page of plan.pages) {
      const systems = new Set(page.map(r => r.system));
      for (const s of systems) expect(page.filter(r => r.system === s)).toHaveLength(2);
      const last = page[page.length - 1];
      expect(last.yTop + 120 * plan.scale).toBeLessThanOrEqual(bottomLimit + 1e-6);
    }
    expect(plan.pages.flat().filter(r => r.trackSlot === 0)).toHaveLength(12);
  });

  it('gives later pages more room because the header is on page 1 only', () => {
    const plan = planPages({ ...base, pageSize: 'letter', systemCount: 20 });
    const perPage = plan.pages.map(p => new Set(p.map(r => r.system)).size);
    expect(perPage[1]).toBeGreaterThanOrEqual(perPage[0]);
    expect(plan.pages[1][0].yTop).toBe(PAGE_MARGIN);
    void SYSTEM_GAP_PT;
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/page-plan.test.ts
```
Expected: FAIL, cannot resolve `../pdf/page-plan`.

- [ ] **Step 3: Implement `page-plan.ts`**

```ts
// lib/playsense-studio/export/pdf/page-plan.ts
export type PageSize = 'letter' | 'a4';

export const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
};
export const PAGE_MARGIN = 54;
export const SYSTEM_GAP_PT = 22;
export const TRACK_GAP_PT = 10;

export interface PagePlanInput {
  pageSize: PageSize;
  rowWidthPx: number;
  trackRowHeights: number[];
  systemCount: number;
  headerHeight: number;
  footerHeight: number;
}

export interface PlacedRow { system: number; trackSlot: number; x: number; yTop: number; scale: number }
export interface PagePlan { pageSize: PageSize; pages: PlacedRow[][]; scale: number }

export function planPages(input: PagePlanInput): PagePlan {
  const { width, height } = PAGE_SIZES[input.pageSize];
  const scale = (width - 2 * PAGE_MARGIN) / input.rowWidthPx;
  const rowHeightsPt = input.trackRowHeights.map(h => h * scale);
  const systemHeight = rowHeightsPt.reduce((a, b) => a + b, 0) + TRACK_GAP_PT * Math.max(0, rowHeightsPt.length - 1);
  const bottomLimit = height - PAGE_MARGIN - input.footerHeight;

  const pages: PlacedRow[][] = [];
  let page: PlacedRow[] = [];
  let y = PAGE_MARGIN + input.headerHeight;

  for (let system = 0; system < input.systemCount; system++) {
    const needsNewPage = page.length > 0 && y + systemHeight > bottomLimit;
    if (needsNewPage) {
      pages.push(page);
      page = [];
      y = PAGE_MARGIN;
    }
    let rowY = y;
    rowHeightsPt.forEach((h, trackSlot) => {
      page.push({ system, trackSlot, x: PAGE_MARGIN, yTop: rowY, scale });
      rowY += h + TRACK_GAP_PT;
    });
    y += systemHeight + SYSTEM_GAP_PT;
  }
  if (page.length) pages.push(page);
  return { pageSize: input.pageSize, pages, scale };
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run lib/playsense-studio/export/__tests__/page-plan.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/export/pdf/page-plan.ts lib/playsense-studio/export/__tests__/page-plan.test.ts
git commit -m "Add page geometry planner for sheet music PDF export"
```

---

### Task 7: SVG-to-PDF translator

VexFlow's SVG backend emits only `svg`, `g`, `path`, `rect` and `text`. This module walks one engraved row and issues pdf-lib calls. Y flips: SVG grows downward from the row's top-left, PDF grows upward from the page's bottom-left.

**Files:**
- Create: `lib/playsense-studio/export/pdf/svg-to-pdf.ts`
- Test: `lib/playsense-studio/export/__tests__/svg-to-pdf.test.ts` (jsdom)

**Interfaces:**
- Consumes: pdf-lib `PDFPage`, `PDFFont`, `rgb`; `GlyphOutliner` from `./glyph-outlines` (Task 1).
- Produces:
```ts
export interface PdfFonts { bravura: GlyphOutliner; academico: GlyphOutliner; helvetica: PDFFont }
export interface RowTransform { x: number; yTop: number; scale: number; pageHeight: number }
export function drawSvgOnPage(page: PDFPage, svg: SVGSVGElement, fonts: PdfFonts, t: RowTransform): void
export function parseFontSizePx(value: string | null): number   // '10pt' -> 13.333, '12px' -> 12, '9' -> 9
export function outlinersFor(family: string | null, fonts: PdfFonts): GlyphOutliner[]  // font stack in order, e.g. 'Bravura,Academico' -> [bravura, academico]
```
**Amended during execution (fix round 1):** VexFlow omits `fill`/`stroke`/`font-family`/`font-size`/`stroke-width` on elements that inherit them from the root `<svg>`, so the walker threads an inherited-attribute context (seeded from the root with VexFlow defaults) and resolves font stacks per code point: the first listed outliner that has the glyph draws it; Private Use Area code points nobody has are skipped; other text falls back to Helvetica `drawText`.
Text in Bravura or Academico is drawn glyph by glyph with `page.drawSvgPath(outline.d, { x, y: baseline, scale: sizePx * t.scale / unitsPerEm, color, borderWidth: 0 })`, advancing `x` by `advance * scale` per glyph. Any other family falls back to `page.drawText` with Helvetica.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/svg-to-pdf.test.ts
import { describe, expect, it, vi } from 'vitest';
import { drawSvgOnPage, outlinerFor, parseFontSizePx } from '../pdf/svg-to-pdf';
import type { PDFFont, PDFPage } from 'pdf-lib';

const svgOf = (inner: string): SVGSVGElement => {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">${inner}</svg>`, 'image/svg+xml');
  return doc.documentElement as unknown as SVGSVGElement;
};
const fakeFont = (name: string) => ({ name } as unknown as PDFFont);
// Fake outliner: every code point is a 1000-unit square, advance 1000.
const fakeOutliner = (tag: string) => ({
  unitsPerEm: 1000,
  outline: (cp: number) => ({ d: `M0 0 L1000 0 L1000 -1000 L0 -1000 Z ${tag}${cp}`, advance: 1000 }),
  widthOf: (text: string, size: number) => text.length * size,
});
const fonts = { bravura: fakeOutliner('B'), academico: fakeOutliner('A'), helvetica: fakeFont('Helvetica') };
const fakePage = () => ({ drawSvgPath: vi.fn(), drawRectangle: vi.fn(), drawText: vi.fn() }) as unknown as PDFPage & { drawSvgPath: ReturnType<typeof vi.fn>; drawRectangle: ReturnType<typeof vi.fn>; drawText: ReturnType<typeof vi.fn> };
const t = { x: 54, yTop: 100, scale: 0.5, pageHeight: 792 };

describe('parseFontSizePx', () => {
  it('converts points and pixels', () => {
    expect(parseFontSizePx('10pt')).toBeCloseTo(13.333, 2);
    expect(parseFontSizePx('12px')).toBe(12);
    expect(parseFontSizePx('9')).toBe(9);
    expect(parseFontSizePx(null)).toBe(10);
  });
});

describe('outlinerFor', () => {
  it('maps notation families to outliners and everything else to null', () => {
    expect(outlinerFor('Bravura', fonts)).toBe(fonts.bravura);
    expect(outlinerFor('Academico', fonts)).toBe(fonts.academico);
    expect(outlinerFor('Arial, sans-serif', fonts)).toBeNull();
  });
});

describe('drawSvgOnPage', () => {
  it('draws a path with the flipped, scaled origin', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<path d="M0 0 L10 10" fill="black" stroke="none"/>'), fonts, t);
    expect(page.drawSvgPath).toHaveBeenCalledTimes(1);
    const [d, opts] = page.drawSvgPath.mock.calls[0];
    expect(d).toBe('M0 0 L10 10');
    expect(opts.x).toBe(54);
    expect(opts.y).toBe(792 - 100);
    expect(opts.scale).toBe(0.5);
    expect(opts.borderWidth).toBe(0);
  });

  it('draws a rect from its bottom-left in PDF space', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<rect x="10" y="20" width="30" height="4" fill="black"/>'), fonts, t);
    const [opts] = page.drawRectangle.mock.calls[0];
    expect(opts.x).toBe(54 + 10 * 0.5);
    expect(opts.y).toBeCloseTo(792 - 100 - (20 + 4) * 0.5, 6);
    expect(opts.width).toBe(15);
    expect(opts.height).toBe(2);
  });

  it('draws notation text glyph by glyph as outlines at the scaled size', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<text x="4" y="30" font-family="Bravura" font-size="30pt">\uE050\uE0A4</text>'), fonts, t);
    expect(page.drawText).not.toHaveBeenCalled();
    expect(page.drawSvgPath).toHaveBeenCalledTimes(2);
    const [d1, o1] = page.drawSvgPath.mock.calls[0];
    const [, o2] = page.drawSvgPath.mock.calls[1];
    expect(d1).toContain('B57424'); // 0xE050
    const glyphScale = (40 * 0.5) / 1000; // 30pt -> 40px, times row scale, per font unit
    expect(o1.scale).toBeCloseTo(glyphScale, 9);
    expect(o1.x).toBe(54 + 2);
    expect(o1.y).toBe(792 - 100 - 15);
    expect(o2.x).toBeCloseTo(54 + 2 + 1000 * glyphScale, 9);
    expect(o1.borderWidth).toBe(0);
  });

  it('draws non-notation text with Helvetica', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<text x="0" y="10" font-family="Arial" font-size="12px">hi</text>'), fonts, t);
    const [text, opts] = page.drawText.mock.calls[0];
    expect(text).toBe('hi');
    expect(opts.font).toBe(fonts.helvetica);
    expect(opts.size).toBe(6);
  });

  it('applies a group translate to children', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<g transform="translate(10,20)"><rect x="0" y="0" width="2" height="2" fill="black"/></g>'), fonts, t);
    const [opts] = page.drawRectangle.mock.calls[0];
    expect(opts.x).toBe(54 + 5);
  });

  it('skips stroke="none" fills of none and honours stroke width on outlines', () => {
    const page = fakePage();
    drawSvgOnPage(page, svgOf('<path d="M0 0 L5 0" fill="none" stroke="black" stroke-width="2"/>'), fonts, t);
    const [, opts] = page.drawSvgPath.mock.calls[0];
    expect(opts.borderWidth).toBe(1);
    expect(opts.color).toBeUndefined();
  });

  it('throws on an unknown element in development', () => {
    const page = fakePage();
    expect(() => drawSvgOnPage(page, svgOf('<circle r="3"/>'), fonts, t)).toThrow(/unsupported/i);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/svg-to-pdf.test.ts
```
Expected: FAIL, cannot resolve `../pdf/svg-to-pdf`.

- [ ] **Step 3: Implement `svg-to-pdf.ts`**

```ts
// lib/playsense-studio/export/pdf/svg-to-pdf.ts
// Translates a VexFlow row SVG into pdf-lib drawing calls. VexFlow's SVG
// context only ever emits svg / g / path / rect / text.
import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { GlyphOutliner } from './glyph-outlines';

export interface PdfFonts { bravura: GlyphOutliner; academico: GlyphOutliner; helvetica: PDFFont }
export interface RowTransform { x: number; yTop: number; scale: number; pageHeight: number }

const PT_TO_PX = 4 / 3;
const BLACK = rgb(0, 0, 0);

export function parseFontSizePx(value: string | null): number {
  if (!value) return 10;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 10;
  return value.trim().endsWith('pt') ? n * PT_TO_PX : n;
}

export function outlinerFor(family: string | null, fonts: PdfFonts): GlyphOutliner | null {
  const f = (family ?? '').toLowerCase();
  if (f.includes('bravura')) return fonts.bravura;
  if (f.includes('academico')) return fonts.academico;
  return null;
}

function isNone(value: string | null): boolean {
  return value === null || value === 'none' || value === 'transparent';
}

function parseTranslate(transform: string | null): { dx: number; dy: number } {
  const m = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(transform ?? '');
  return m ? { dx: Number(m[1]), dy: Number(m[2]) } : { dx: 0, dy: 0 };
}

interface Cursor { dx: number; dy: number }

export function drawSvgOnPage(page: PDFPage, svg: SVGSVGElement, fonts: PdfFonts, t: RowTransform): void {
  const walk = (el: Element, cursor: Cursor) => {
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case 'svg':
      case 'defs':
      case 'style':
        if (tag === 'svg') Array.from(el.children).forEach(child => walk(child, cursor));
        return;
      case 'g': {
        const { dx, dy } = parseTranslate(el.getAttribute('transform'));
        Array.from(el.children).forEach(child => walk(child, { dx: cursor.dx + dx, dy: cursor.dy + dy }));
        return;
      }
      case 'path': {
        const d = el.getAttribute('d');
        if (!d) return;
        const fill = el.getAttribute('fill');
        const stroke = el.getAttribute('stroke');
        const strokeWidth = Number(el.getAttribute('stroke-width') ?? 1);
        page.drawSvgPath(d, {
          x: t.x + cursor.dx * t.scale,
          y: t.pageHeight - t.yTop - cursor.dy * t.scale,
          scale: t.scale,
          color: isNone(fill) ? undefined : BLACK,
          borderColor: isNone(stroke) ? undefined : BLACK,
          borderWidth: isNone(stroke) ? 0 : strokeWidth * t.scale,
        });
        return;
      }
      case 'rect': {
        const x = Number(el.getAttribute('x') ?? 0) + cursor.dx;
        const y = Number(el.getAttribute('y') ?? 0) + cursor.dy;
        const w = Number(el.getAttribute('width') ?? 0);
        const h = Number(el.getAttribute('height') ?? 0);
        const fill = el.getAttribute('fill');
        const stroke = el.getAttribute('stroke');
        if (isNone(fill) && isNone(stroke)) return;
        page.drawRectangle({
          x: t.x + x * t.scale,
          y: t.pageHeight - t.yTop - (y + h) * t.scale,
          width: w * t.scale,
          height: h * t.scale,
          color: isNone(fill) ? undefined : BLACK,
          borderColor: isNone(stroke) ? undefined : BLACK,
          borderWidth: isNone(stroke) ? 0 : Number(el.getAttribute('stroke-width') ?? 1) * t.scale,
        });
        return;
      }
      case 'text': {
        const text = el.textContent ?? '';
        if (!text) return;
        const x = Number(el.getAttribute('x') ?? 0) + cursor.dx;
        const y = Number(el.getAttribute('y') ?? 0) + cursor.dy;
        const sizePx = parseFontSizePx(el.getAttribute('font-size'));
        const baseX = t.x + x * t.scale;
        const baseY = t.pageHeight - t.yTop - y * t.scale;
        const outliner = outlinerFor(el.getAttribute('font-family'), fonts);
        if (!outliner) {
          page.drawText(text, { x: baseX, y: baseY, size: sizePx * t.scale, font: fonts.helvetica, color: BLACK });
          return;
        }
        // Notation glyphs: one outline per code point, advanced like a text run.
        const glyphScale = (sizePx * t.scale) / outliner.unitsPerEm;
        let penX = baseX;
        for (const ch of text) {
          const g = outliner.outline(ch.codePointAt(0)!);
          if (!g) continue;
          page.drawSvgPath(g.d, { x: penX, y: baseY, scale: glyphScale, color: BLACK, borderWidth: 0 });
          penX += g.advance * glyphScale;
        }
        return;
      }
      default:
        if (process.env.NODE_ENV !== 'production') throw new Error(`svg-to-pdf: unsupported element <${tag}>`);
    }
  };
  walk(svg, { dx: 0, dy: 0 });
}
```
Fill and stroke colours are always black on purpose: the on-screen renderer uses theme colours through CSS, but the print output is ink.

- [ ] **Step 4: Run the test**

```bash
npx vitest run lib/playsense-studio/export/__tests__/svg-to-pdf.test.ts
```
Expected: PASS (9 tests). If VexFlow's text uses `font-size="30"` without a unit somewhere, the parser treats it as px, matching the browser.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/export/pdf/svg-to-pdf.ts lib/playsense-studio/export/__tests__/svg-to-pdf.test.ts
git commit -m "Translate VexFlow row SVGs into pdf-lib drawing calls"
```

---

### Task 8: Render a section to PDF bytes

Orchestrates Tasks 1, 4, 5, 6 and 7 and adds the prose: header, track names, measure numbers and footer.

**Files:**
- Create: `lib/playsense-studio/export/pdf/render-section.ts`
- Test: `lib/playsense-studio/export/__tests__/render-section.test.ts` (jsdom)

**Interfaces:**
- Consumes: `loadNotationFonts`, `buildRowPlan`, `engraveTrackRows`, `planPages`, `drawSvgOnPage`, `PRINT_PADDING_X`.
- Produces:
```ts
export interface PdfExportOptions {
  pageSize: PageSize;
  includeHeader: boolean;
  includeMeasureNumbers: boolean;
  includeBranding: boolean;
  expandRepeats: boolean;
}
export interface PdfExportContext { classItemTitle: string; sectionIndex: number; sectionCount: number }
export const DEFAULT_PDF_OPTIONS: PdfExportOptions = { pageSize: 'letter', includeHeader: true, includeMeasureNumbers: true, includeBranding: true, expandRepeats: false };
export const ENGRAVE_WIDTH_PX = 700;
export async function renderSectionPdf(
  score: ScoreDocument, trackIndexes: number[], options: PdfExportOptions, context: PdfExportContext,
  deps?: { fonts?: () => Promise<NotationFontBytes> },
): Promise<Uint8Array>
```

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/render-section.test.ts
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { renderSectionPdf, DEFAULT_PDF_OPTIONS } from '../pdf/render-section';
import { SON_MONTUNO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';

const fontsDir = path.resolve(__dirname, '../../../../public/fonts/notation');
const fonts = async () => ({
  bravura: new Uint8Array(readFileSync(path.join(fontsDir, 'bravura.woff2'))),
  academico: new Uint8Array(readFileSync(path.join(fontsDir, 'academico.woff2'))),
});

beforeAll(() => {
  const proto = (globalThis as unknown as { SVGElement: { prototype: Record<string, unknown> } }).SVGElement.prototype;
  proto.getBBox = function getBBox(this: Element) {
    const len = (this.textContent ?? '').length;
    return { x: 0, y: -8, width: Math.max(6, len * 7), height: 10 };
  };
  const canvasProto = (globalThis as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype;
  canvasProto.getContext = () => ({ measureText: (t: string) => ({ width: t.length * 7 }), font: '' });
});

const context = { classItemTitle: 'Montuno básico en Do', sectionIndex: 1, sectionCount: 4 };

describe('renderSectionPdf', () => {
  it('returns a one-page Letter PDF for a short three-track section', async () => {
    const bytes = await renderSectionPdf(SON_MONTUNO_FIXTURE, [0, 1, 2], DEFAULT_PDF_OPTIONS, context, { fonts });
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([width, height]).toEqual([612, 792]);
    expect(doc.getTitle()).toBe('Son Montuno (C / F / G / C)');
  });

  it('honours A4 and paginates a long score', async () => {
    const long = { ...SON_MONTUNO_FIXTURE, tracks: SON_MONTUNO_FIXTURE.tracks.map(t => ({ ...t, measures: Array.from({ length: 48 }, (_, i) => ({ ...t.measures[i % 4], number: i + 1, tempoChange: undefined })) })) };
    const bytes = await renderSectionPdf(long, [0, 1, 2], { ...DEFAULT_PDF_OPTIONS, pageSize: 'a4' }, context, { fonts });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(595.28, 1);
  });

  it('rejects an empty track selection', async () => {
    await expect(renderSectionPdf(SON_MONTUNO_FIXTURE, [], DEFAULT_PDF_OPTIONS, context, { fonts })).rejects.toThrow(/track/i);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/render-section.test.ts
```
Expected: FAIL, cannot resolve `../pdf/render-section`.

- [ ] **Step 3: Implement `render-section.ts`**

```ts
// lib/playsense-studio/export/pdf/render-section.ts
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { loadNotationFonts, type NotationFontBytes } from './fonts';
import { createGlyphOutliner } from './glyph-outlines';
import { buildRowPlan } from './row-plan';
import { engraveTrackRows, PRINT_PADDING_X, type EngravedTrack } from './engrave';
import { PAGE_MARGIN, PAGE_SIZES, planPages, type PageSize } from './page-plan';
import { drawSvgOnPage, type PdfFonts } from './svg-to-pdf';

export interface PdfExportOptions {
  pageSize: PageSize;
  includeHeader: boolean;
  includeMeasureNumbers: boolean;
  includeBranding: boolean;
  expandRepeats: boolean;
}
export interface PdfExportContext { classItemTitle: string; sectionIndex: number; sectionCount: number }

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  pageSize: 'letter', includeHeader: true, includeMeasureNumbers: true, includeBranding: true, expandRepeats: false,
};
/** Model px the rows are engraved at before scaling to the page. */
export const ENGRAVE_WIDTH_PX = 700;

const INK = rgb(0, 0, 0);
const MUTED = rgb(0.42, 0.4, 0.38);
const HEADER_HEIGHT = { withBranding: 92, plain: 72 };
const FOOTER_HEIGHT = 24;
const SITE_LINE = 'Latin Music Mastery · latinmusicmastery.com';

function headerHeight(o: PdfExportOptions): number {
  if (!o.includeHeader) return o.includeBranding ? 24 : 0;
  return o.includeBranding ? HEADER_HEIGHT.withBranding : HEADER_HEIGHT.plain;
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

function drawHeader(page: PDFPage, score: ScoreDocument, o: PdfExportOptions, c: PdfExportContext, bold: PDFFont, regular: PDFFont) {
  const top = page.getHeight() - PAGE_MARGIN;
  let y = top - 10;
  if (o.includeBranding) {
    drawCentered(page, `${c.classItemTitle} · Section ${c.sectionIndex + 1} of ${c.sectionCount}`, y, regular, 9, MUTED);
    y -= 22;
  }
  if (!o.includeHeader) return;
  drawCentered(page, score.title || 'Untitled section', y - 8, bold, 20);
  y -= 30;
  if (score.composer) { drawCentered(page, score.composer, y, regular, 10); y -= 16; }
  const tempo = `♩ = ${Math.round(score.initialTempo)}`;
  const ts = `${score.initialTimeSignature[0]}/${score.initialTimeSignature[1]}`;
  page.drawText(tempo.replace('♩', 'q'), { x: PAGE_MARGIN, y, size: 10, font: bold, color: INK });
  page.drawText(ts, { x: page.getWidth() - PAGE_MARGIN - regular.widthOfTextAtSize(ts, 10), y, size: 10, font: regular, color: MUTED });
}

function drawFooter(page: PDFPage, pageNo: number, pageCount: number, o: PdfExportOptions, regular: PDFFont) {
  if (!o.includeBranding) return;
  const y = PAGE_MARGIN - 18;
  page.drawText(SITE_LINE, { x: PAGE_MARGIN, y, size: 8, font: regular, color: MUTED });
  const label = `Page ${pageNo} of ${pageCount}`;
  page.drawText(label, { x: page.getWidth() - PAGE_MARGIN - regular.widthOfTextAtSize(label, 8), y, size: 8, font: regular, color: MUTED });
}

export async function renderSectionPdf(
  score: ScoreDocument,
  trackIndexes: number[],
  options: PdfExportOptions,
  context: PdfExportContext,
  deps: { fonts?: () => Promise<NotationFontBytes> } = {},
): Promise<Uint8Array> {
  if (trackIndexes.length === 0) throw new Error('Select at least one track to export.');
  const fontBytes = await (deps.fonts ?? loadNotationFonts)();

  const plan = buildRowPlan(score, trackIndexes, ENGRAVE_WIDTH_PX, { expandRepeats: options.expandRepeats });
  const tracks: EngravedTrack[] = trackIndexes.map(t => engraveTrackRows(plan, t));

  // When tracks cannot be aligned, print them one after another as one "track"
  // per system slot with a single row each, so every row still lands whole.
  const systems: EngravedTrack[][] = plan.aligned
    ? Array.from({ length: plan.rows.length }, () => tracks)
    : tracks.flatMap(t => t.rows.map(() => [t]));
  const rowIndexFor = (system: number): number => {
    if (plan.aligned) return system;
    let offset = system;
    for (const t of tracks) { if (offset < t.rows.length) return offset; offset -= t.rows.length; }
    return 0;
  };
  const trackForSlot = (system: number, slot: number): EngravedTrack => systems[system][slot];

  const doc = await PDFDocument.create();
  doc.setTitle(score.title);
  doc.setProducer('Latin Music Mastery · PlaySense Studio');
  const fonts: PdfFonts = {
    bravura: createGlyphOutliner(fontBytes.bravura),
    academico: createGlyphOutliner(fontBytes.academico),
    helvetica: await doc.embedFont(StandardFonts.Helvetica),
  };
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const rowWidthPx = plan.availWidth + 2 * PRINT_PADDING_X;
  const pages = planPages({
    pageSize: options.pageSize,
    rowWidthPx,
    trackRowHeights: plan.aligned ? tracks.map(t => t.rowHeight) : [Math.max(...tracks.map(t => t.rowHeight))],
    systemCount: systems.length,
    headerHeight: headerHeight(options),
    footerHeight: options.includeBranding ? FOOTER_HEIGHT : 0,
  });

  const { width, height } = PAGE_SIZES[options.pageSize];
  pages.pages.forEach((placed, pageIndex) => {
    const page = doc.addPage([width, height]);
    if (pageIndex === 0) drawHeader(page, score, options, context, bold, fonts.helvetica);
    drawFooter(page, pageIndex + 1, pages.pages.length, options, fonts.helvetica);

    for (const r of placed) {
      const track = trackForSlot(r.system, r.trackSlot);
      const row = track.rows[rowIndexFor(r.system)];
      drawSvgOnPage(page, row.svg, fonts, { x: r.x, yTop: r.yTop, scale: r.scale, pageHeight: height });

      const isFirstRowOfSystemOnPage = placed.find(p => p.system === r.system) === r;
      if (isFirstRowOfSystemOnPage && options.includeMeasureNumbers) {
        page.drawText(String(row.firstMeasureNumber), {
          x: r.x + PRINT_PADDING_X * r.scale, y: height - r.yTop - (row.staffTopY - 14) * r.scale,
          size: 7, font: fonts.helvetica, color: MUTED,
        });
      }
      if (trackIndexes.length > 1) {
        const label = track.displayName;
        page.drawText(label, {
          x: r.x - 4 - fonts.helvetica.widthOfTextAtSize(label, 7),
          y: height - r.yTop - (row.staffTopY + 22) * r.scale,
          size: 7, font: fonts.helvetica, color: MUTED,
        });
      }
    }
  });

  return doc.save();
}
```
Note the tempo mark writes `q = 96` with Helvetica because Helvetica has no quarter-note glyph. Improve it in the same task: draw the outline of `0xECA5` (SMuFL metNoteQuarterUp) from `fonts.bravura` with `page.drawSvgPath(outline.d, { x, y, scale: 10 / fonts.bravura.unitsPerEm, color: INK, borderWidth: 0 })`, then ` = 96` in bold Helvetica advanced by `outline.advance * scale + 3`. Keep the `q` fallback only when `outline(0xECA5)` is null.

- [ ] **Step 4: Run the test**

```bash
npx vitest run lib/playsense-studio/export/__tests__/render-section.test.ts
```
Expected: PASS (3 tests). Then write one PDF to disk from a scratch script and open it:

```bash
cat > /tmp/render-spike.test.ts <<'EOT'
// @vitest-environment jsdom
import { it } from 'vitest'; import { writeFileSync } from 'node:fs';
it('writes', async () => { /* copy the first test body, then writeFileSync('/tmp/section.pdf', bytes) */ });
EOT
```
Open `/tmp/section.pdf` in Preview and in Chrome. Confirm: clefs, noteheads, beams, barlines, the header, track names on the left, measure numbers, footer. Delete the scratch file.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/export/pdf/render-section.ts lib/playsense-studio/export/__tests__/render-section.test.ts
git commit -m "Render a scored section to a vector PDF"
```

---

### Task 9: MusicXML writer

Writes MusicXML 4.0 partwise. The writer is more complete than the repo's importer: ties, slurs, articulations, triplets, fingering, tuning, voices and repeats are all written so MuseScore, Finale and Guitar Pro read them, even though `parseMusicXmlString` ignores most of them today.

**Files:**
- Create: `lib/playsense-studio/export/musicxml-writer.ts`
- Test: `lib/playsense-studio/export/__tests__/musicxml-writer.test.ts` (jsdom, for `DOMParser`)

**Interfaces:**
- Consumes: `ScoreDocument, Track, Measure, MusicalEvent, Note, Chord, Rest, PercussionNotation` from the score model; `isPercussion, percussionNotation` from `@/lib/playsense-studio/perc-strokes`; `isFretted` from `@/lib/playsense-studio/instruments`; `repeatGroups` from `@/lib/playsense-studio/repeats`; `vexflowDurationCode` from `@/lib/playsense-studio/score-to-vexflow`.
- Produces: `export function writeMusicXml(score: ScoreDocument, trackIndexes: number[]): string`.

Mapping rules (from the spec, made exact):

| Model | XML |
|---|---|
| `divisions` | fixed `960` per quarter note; `<duration>` = round(durationQN × 960) |
| `<type>` | from `vexflowDurationCode(durationQN / (triplet ? 1.5 : 1), dotted)`: `w`→whole, `h`→half, `q`→quarter, `8`→eighth, `16`→16th, `32`→32nd, `64`→64th |
| `dotted` | `<dot/>` |
| `triplet` | `<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>` |
| Pitched `midi` | step/alter/octave; `spellingHint` starting with the letter and `b` chooses the flat spelling, otherwise sharps |
| Clef | `perc-*` → `<sign>percussion</sign><line>2</line>`; `bass` → `F`/`4`; fretted non-bass → `G`/`2` with `<clef-octave-change>-1</clef-octave-change>`; else `G`/`2` |
| Tuning (fretted with `tuning`) | `<staff-details><staff-lines>N</staff-lines><staff-tuning line="i"><tuning-step>E</tuning-step><tuning-alter>…</tuning-alter><tuning-octave>2</tuning-octave></staff-tuning>…</staff-details>` |
| `fingering` | `<notations><technical><string>s</string><fret>f</fret>[<fingering>n</fingering>]</technical></notations>` |
| `percussion` | `<unpitched><display-step>E</display-step><display-octave>5</display-octave></unpitched>` from `staffLine` `e/5`; `<notehead smufl="…">other</notehead>` for non-normal heads; `<instrument id="P1-I<n>"/>` when `sourceMidi` is set, with a matching `<midi-instrument>` in the part list (`midi-unpitched` = sourceMidi + 1, `midi-channel` 10); marcato → `<articulations><strong-accent type="up"/></articulations>` |
| `tieToNext` | `<tie type="start"/>` on this note, `<tie type="stop"/>` on the next; `<notations><tied type="start|stop"/></notations>` likewise |
| `slurToNext` | `<notations><slur type="start" number="1"/>` and `type="stop"` on the next event |
| `articulation` | `<articulations><staccato/>|<accent/>|<tenuto/></articulations>` |
| Chord | first note plain, following notes carry `<chord/>` |
| Voice 2 | after voice 1, `<backup><duration>measure length × 960</duration></backup>` then voice 2 notes with `<voice>2</voice>` |
| Repeats | collapsed with `repeatGroups(track)`; group start measure gets `<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>`, the last measure of pass 0 gets `<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward" times="N"/></barline>`; only measures of pass 0 are written |
| `endBarline: 'final'` or last measure | `<barline location="right"><bar-style>light-heavy</bar-style></barline>`; `endBarline: 'single'` on the last measure suppresses it |
| Tempo | measure 1 and any `tempoChange`: `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>96</per-minute></metronome></direction-type><sound tempo="96"/></direction>` |
| Time / key | `<attributes>` on measure 1 (`divisions`, `key`, `time`, `clef`, `staff-details`) and on any measure with `timeSignature` or `keyFifths` |
| Header | `<work><work-title>`, `<identification><creator type="composer">` (only when composer set), `<encoding><software>Latin Music Mastery PlaySense Studio</software>` |
| Part list | `<score-part id="P1"><part-name>displayName</part-name>` plus `<midi-instrument>` entries for percussion |

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/musicxml-writer.test.ts
import { describe, expect, it } from 'vitest';
import { writeMusicXml } from '../musicxml-writer';
import { parseMusicXmlString } from '@/lib/playsense-studio/parsers/musicxml';
import { GUITAR_LICK_FIXTURE, SON_MONTUNO_FIXTURE, CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import { percussionNotation } from '@/lib/playsense-studio/perc-strokes';
import type { ScoreDocument, Measure } from '@/components/playsense-studio/shared/score-model/types';

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const q = (doc: Document, sel: string) => Array.from(doc.querySelectorAll(sel));

describe('writeMusicXml — document shape', () => {
  it('writes a partwise 4.0 document with one part per selected track', () => {
    const xml = writeMusicXml(SON_MONTUNO_FIXTURE, [0, 2]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN"');
    const doc = parse(xml);
    expect(doc.documentElement.tagName).toBe('score-partwise');
    expect(doc.documentElement.getAttribute('version')).toBe('4.0');
    expect(q(doc, 'part-list > score-part')).toHaveLength(2);
    expect(q(doc, 'part')).toHaveLength(2);
    expect(doc.querySelector('work > work-title')?.textContent).toBe('Son Montuno (C / F / G / C)');
    expect(doc.querySelector('part-list > score-part > part-name')?.textContent).toBe(SON_MONTUNO_FIXTURE.tracks[0].displayName);
  });

  it('escapes XML special characters in titles', () => {
    const xml = writeMusicXml({ ...GUITAR_LICK_FIXTURE, title: 'Tom & Jerry <live>' }, [0]);
    expect(parse(xml).querySelector('work-title')?.textContent).toBe('Tom & Jerry <live>');
  });
});

describe('writeMusicXml — round trip through the importer', () => {
  it('preserves pitches, durations, chords, time and tempo the importer reads', () => {
    const back = parseMusicXmlString(writeMusicXml(SON_MONTUNO_FIXTURE, [0, 1, 2]));
    expect(back.tracks).toHaveLength(3);
    expect(back.initialTempo).toBe(96);
    expect(back.initialTimeSignature).toEqual([4, 4]);
    const src = SON_MONTUNO_FIXTURE.tracks[0].measures;
    back.tracks[0].measures.forEach((m, i) => {
      const events = m.voices[0].events;
      expect(events.map(e => e.kind)).toEqual(src[i].voices[0].events.map(e => e.kind));
      expect(events.map(e => e.durationQN)).toEqual(src[i].voices[0].events.map(e => e.durationQN));
      events.forEach((e, k) => {
        const s = src[i].voices[0].events[k];
        if (e.kind === 'note' && s.kind === 'note') expect(e.midi).toBe(s.midi);
        if (e.kind === 'chord' && s.kind === 'chord') expect(e.notes.map(n => n.midi)).toEqual(s.notes.map(n => n.midi));
      });
    });
    expect(back.tracks[0].measures[2].tempoChange).toBe(110);
  });

  it('round-trips percussion staff positions and noteheads', () => {
    const back = parseMusicXmlString(writeMusicXml(CONGA_TUMBAO_FIXTURE, [0]));
    expect(back.tracks[0].instrument).toBe('perc-conga');
    const first = back.tracks[0].measures[0].voices[0].events[0];
    expect(first.kind).toBe('note');
    const expected = percussionNotation('perc-conga', { midi: 62 }).staffLine;
    if (first.kind === 'note') expect(first.percussion?.staffLine).toBe(expected);
  });
});

describe('writeMusicXml — features beyond the importer', () => {
  const note = (midi: number, extra: Partial<Extract<ScoreDocument['tracks'][0]['measures'][0]['voices'][0]['events'][0], { kind: 'note' }>> = {}) =>
    ({ kind: 'note' as const, midi, durationQN: 1, ...extra });
  const scoreWith = (measures: Measure[], track: Partial<ScoreDocument['tracks'][0]> = {}): ScoreDocument => ({
    ...GUITAR_LICK_FIXTURE,
    tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], ...track, measures }],
  });

  it('writes ties, slurs, articulations and triplets', () => {
    const score = scoreWith([{ number: 1, voices: [{ number: 1, events: [
      note(60, { tieToNext: true }), note(60, { slurToNext: true, articulation: 'accent' }),
      note(62, { triplet: true, durationQN: 2 / 3 }), note(64, { triplet: true, durationQN: 2 / 3 }), note(65, { triplet: true, durationQN: 2 / 3 }),
    ] }] }]);
    const doc = parse(writeMusicXml(score, [0]));
    const notes = q(doc, 'note');
    expect(notes[0].querySelector('tie')?.getAttribute('type')).toBe('start');
    expect(notes[1].querySelector('tie')?.getAttribute('type')).toBe('stop');
    expect(notes[1].querySelector('notations > slur')?.getAttribute('type')).toBe('start');
    expect(notes[2].querySelector('notations > slur')?.getAttribute('type')).toBe('stop');
    expect(notes[1].querySelector('articulations > accent')).not.toBeNull();
    expect(notes[2].querySelector('time-modification > actual-notes')?.textContent).toBe('3');
    expect(notes[2].querySelector('type')?.textContent).toBe('quarter');
  });

  it('writes fingering, tuning and an octave-transposing G clef for guitar', () => {
    const score = scoreWith([{ number: 1, voices: [{ number: 1, events: [note(64, { fingering: { string: 2, fret: 5 } }), note(60, { durationQN: 3 })] }] }]);
    const doc = parse(writeMusicXml(score, [0]));
    expect(doc.querySelector('clef > sign')?.textContent).toBe('G');
    expect(doc.querySelector('clef > clef-octave-change')?.textContent).toBe('-1');
    expect(q(doc, 'staff-details > staff-tuning')).toHaveLength(6);
    expect(doc.querySelector('technical > string')?.textContent).toBe('2');
    expect(doc.querySelector('technical > fret')?.textContent).toBe('5');
  });

  it('writes a second voice with backup', () => {
    const score = scoreWith([{ number: 1, voices: [
      { number: 1, events: [note(67, { durationQN: 4 })] },
      { number: 2, events: [note(60, { durationQN: 2 }), note(62, { durationQN: 2 })] },
    ] }]);
    const doc = parse(writeMusicXml(score, [0]));
    expect(doc.querySelector('backup > duration')?.textContent).toBe(String(4 * 960));
    expect(q(doc, 'note > voice').map(v => v.textContent)).toEqual(['1', '2', '2']);
  });

  it('collapses repeats into repeat barlines', () => {
    const m = (number: number, pass: number) => ({ number, repeat: { id: 'r', pass, count: 2, offset: 0, length: 1 }, voices: [{ number: 1, events: [note(60, { durationQN: 4 })] }] });
    const doc = parse(writeMusicXml(scoreWith([m(1, 0), m(2, 1)]), [0]));
    expect(q(doc, 'measure')).toHaveLength(1);
    expect(doc.querySelector('barline[location="left"] > repeat')?.getAttribute('direction')).toBe('forward');
    expect(doc.querySelector('barline[location="right"] > repeat')?.getAttribute('times')).toBe('2');
  });

  it('spells flats from the spelling hint and ends with a final barline', () => {
    const doc = parse(writeMusicXml(scoreWith([{ number: 1, voices: [{ number: 1, events: [note(61, { spellingHint: 'Db', durationQN: 4 })] }] }]), [0]));
    expect(doc.querySelector('pitch > step')?.textContent).toBe('D');
    expect(doc.querySelector('pitch > alter')?.textContent).toBe('-1');
    expect(doc.querySelector('barline[location="right"] > bar-style')?.textContent).toBe('light-heavy');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/musicxml-writer.test.ts
```
Expected: FAIL, cannot resolve `../musicxml-writer`.

- [ ] **Step 3: Implement `musicxml-writer.ts`**

```ts
// lib/playsense-studio/export/musicxml-writer.ts
// ScoreDocument -> MusicXML 4.0 partwise. Pure string building; no DOM.
import type { Chord, Measure, MusicalEvent, Note, NoteBase, PercussionNotation, ScoreDocument, Track, Voice } from '@/components/playsense-studio/shared/score-model/types';
import { isPercussion, percussionNotation } from '@/lib/playsense-studio/perc-strokes';
import { isFretted } from '@/lib/playsense-studio/instruments';
import { repeatGroups } from '@/lib/playsense-studio/repeats';
import { vexflowDurationCode } from '@/lib/playsense-studio/score-to-vexflow';
import { measureLengthInQN } from '@/lib/playsense-studio/time-mapping';

export const DIVISIONS = 960;

const TYPE_BY_CODE: Record<string, string> = { w: 'whole', h: 'half', q: 'quarter', '8': 'eighth', '16': '16th', '32': '32nd', '64': '64th', '128': '128th' };
const SMUFL_BY_NOTEHEAD: Record<Exclude<PercussionNotation['notehead'], 'normal'>, string> = {
  x: 'noteheadXBlack', 'ornate-x': 'noteheadXOrnate', plus: 'noteheadPlusBlack', circled: 'noteheadCircledBlack',
  slash: 'noteheadSlashHorizontalEnds', slashed: 'noteheadSlashedBlack1', diamond: 'noteheadDiamondBlack',
  'triangle-up': 'noteheadTriangleUpBlack', 'triangle-down': 'noteheadTriangleDownBlack', square: 'noteheadSquareBlack',
};
const SHARP_STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const SHARP_ALTER = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const FLAT_STEPS = ['C', 'D', 'D', 'E', 'E', 'F', 'G', 'G', 'A', 'A', 'B', 'B'];
const FLAT_ALTER = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0];

export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pitchXml(midi: number, hint?: string): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const useFlat = !!hint && /^[A-G]b/i.test(hint);
  const step = useFlat ? FLAT_STEPS[pc] : SHARP_STEPS[pc];
  const alter = useFlat ? FLAT_ALTER[pc] : SHARP_ALTER[pc];
  return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`;
}

function unpitchedXml(p: PercussionNotation): string {
  const [step, octave] = p.staffLine.split('/');
  return `<unpitched><display-step>${step.toUpperCase()}</display-step><display-octave>${octave}</display-octave></unpitched>`;
}

function durationXml(e: NoteBase): string {
  const base = e.triplet ? e.durationQN * 1.5 : e.durationQN;
  const code = vexflowDurationCode(base, e.dotted);
  const parts = [`<duration>${Math.round(e.durationQN * DIVISIONS)}</duration>`];
  parts.push(`<type>${TYPE_BY_CODE[code] ?? 'quarter'}</type>`);
  if (e.dotted) parts.push('<dot/>');
  if (e.triplet) parts.push('<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>');
  return parts.join('');
}

interface NoteFlags { tieStop: boolean; slurStop: boolean }

function notationsXml(e: NoteBase, flags: NoteFlags, tieStart: boolean, fingering?: Note['fingering'], marcato?: boolean): string {
  const items: string[] = [];
  if (flags.tieStop) items.push('<tied type="stop"/>');
  if (tieStart) items.push('<tied type="start"/>');
  if (flags.slurStop) items.push('<slur type="stop" number="1"/>');
  if (e.slurToNext) items.push('<slur type="start" number="1"/>');
  const arts: string[] = [];
  if (e.articulation) arts.push(`<${e.articulation}/>`);
  if (marcato) arts.push('<strong-accent type="up"/>');
  if (arts.length) items.push(`<articulations>${arts.join('')}</articulations>`);
  if (fingering) items.push(`<technical><string>${fingering.string}</string><fret>${fingering.fret}</fret>${fingering.finger ? `<fingering>${fingering.finger}</fingering>` : ''}</technical>`);
  return items.length ? `<notations>${items.join('')}</notations>` : '';
}

function oneNote(
  track: Track, e: NoteBase, pitch: { midi: number; spellingHint?: string; percussion?: PercussionNotation; fingering?: Note['fingering']; tieToNext?: boolean },
  voice: number, flags: NoteFlags, chordTail: boolean, instrumentIds: Map<number, string>,
): string {
  const perc = isPercussion(track.instrument) ? percussionNotation(track.instrument, pitch) : null;
  const tieStart = !!(pitch.tieToNext ?? e.tieToNext);
  const parts: string[] = ['<note>'];
  if (chordTail) parts.push('<chord/>');
  parts.push(perc ? unpitchedXml(perc) : pitchXml(pitch.midi, pitch.spellingHint));
  parts.push(durationXml(e));
  if (flags.tieStop) parts.push('<tie type="stop"/>');
  if (tieStart) parts.push('<tie type="start"/>');
  if (perc?.sourceMidi !== undefined && instrumentIds.has(perc.sourceMidi)) parts.push(`<instrument id="${instrumentIds.get(perc.sourceMidi)}"/>`);
  parts.push(`<voice>${voice}</voice>`);
  if (perc && perc.notehead !== 'normal') parts.push(`<notehead smufl="${SMUFL_BY_NOTEHEAD[perc.notehead]}">other</notehead>`);
  parts.push(notationsXml(e, flags, tieStart, pitch.fingering, perc?.marcato));
  parts.push('</note>');
  return parts.join('');
}

function eventXml(track: Track, e: MusicalEvent, voice: number, flags: NoteFlags, instrumentIds: Map<number, string>): string {
  if (e.kind === 'rest') {
    return `<note><rest/>${durationXml(e)}<voice>${voice}</voice>${notationsXml(e, flags, false)}</note>`;
  }
  if (e.kind === 'note') return oneNote(track, e, e, voice, flags, false, instrumentIds);
  const chord = e as Chord;
  return chord.notes.map((n, i) => oneNote(track, chord, n, voice, i === 0 ? flags : { tieStop: false, slurStop: false }, i > 0, instrumentIds)).join('');
}

function voiceXml(track: Track, v: Voice, state: { pendingTie: boolean; pendingSlur: boolean }, instrumentIds: Map<number, string>): string {
  return v.events.map(e => {
    const flags = { tieStop: state.pendingTie, slurStop: state.pendingSlur };
    const xml = eventXml(track, e, v.number, flags, instrumentIds);
    state.pendingTie = e.kind === 'chord' ? e.notes.some(n => n.tieToNext) || !!e.tieToNext : !!e.tieToNext;
    state.pendingSlur = !!e.slurToNext;
    return xml;
  }).join('');
}

function clefXml(track: Track): string {
  if (isPercussion(track.instrument)) return '<clef><sign>percussion</sign><line>2</line></clef>';
  if (track.instrument === 'bass') return '<clef><sign>F</sign><line>4</line></clef>';
  if (isFretted(track.instrument)) return '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>';
  return '<clef><sign>G</sign><line>2</line></clef>';
}

function tuningXml(track: Track): string {
  if (!track.tuning || !isFretted(track.instrument)) return '';
  const lines = track.tuning.map((name, i) => {
    const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
    if (!m) return '';
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return `<staff-tuning line="${i + 1}"><tuning-step>${m[1]}</tuning-step>${alter ? `<tuning-alter>${alter}</tuning-alter>` : ''}<tuning-octave>${m[3]}</tuning-octave></staff-tuning>`;
  }).join('');
  return `<staff-details><staff-lines>${track.tuning.length}</staff-lines>${lines}</staff-details>`;
}

function tempoXml(bpm: number): string {
  return `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${Math.round(bpm)}</per-minute></metronome></direction-type><sound tempo="${Math.round(bpm)}"/></direction>`;
}

function attributesXml(track: Track, score: ScoreDocument, m: Measure, first: boolean): string {
  const items: string[] = [];
  if (first) items.push(`<divisions>${DIVISIONS}</divisions>`);
  const key = first ? (m.keyFifths ?? score.initialKeyFifths) : m.keyFifths;
  if (key !== undefined) items.push(`<key><fifths>${key}</fifths></key>`);
  const ts = first ? (m.timeSignature ?? score.initialTimeSignature) : m.timeSignature;
  if (ts) items.push(`<time><beats>${ts[0]}</beats><beat-type>${ts[1]}</beat-type></time>`);
  if (first) items.push(clefXml(track), tuningXml(track));
  return items.length ? `<attributes>${items.join('')}</attributes>` : '';
}

/** Measures to write, with repeat groups collapsed to their first pass. */
function collapsed(track: Track): Array<{ measure: Measure; repeatStart?: number; repeatEnd?: number }> {
  const groups = repeatGroups(track);
  const out: Array<{ measure: Measure; repeatStart?: number; repeatEnd?: number }> = [];
  track.measures.forEach((measure, i) => {
    const group = groups.find(g => i >= g.start && i < g.start + g.length * g.count);
    if (!group) { out.push({ measure }); return; }
    const offset = i - group.start;
    if (offset >= group.length) return; // later passes are implied by the repeat barline
    out.push({ measure, repeatStart: offset === 0 ? group.count : undefined, repeatEnd: offset === group.length - 1 ? group.count : undefined });
  });
  return out;
}

function partXml(score: ScoreDocument, track: Track, partId: string, instrumentIds: Map<number, string>): string {
  const measures = collapsed(track);
  const state = { pendingTie: false, pendingSlur: false };
  let timeSignature = score.initialTimeSignature;
  const body = measures.map((entry, i) => {
    const m = entry.measure;
    if (m.timeSignature) timeSignature = m.timeSignature;
    const parts: string[] = [`<measure number="${i + 1}">`];
    if (entry.repeatStart) parts.push('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>');
    parts.push(attributesXml(track, score, m, i === 0));
    if (i === 0) parts.push(tempoXml(score.initialTempo));
    else if (m.tempoChange !== undefined) parts.push(tempoXml(m.tempoChange));
    const [v1, ...rest] = m.voices;
    if (v1) parts.push(voiceXml(track, v1, state, instrumentIds));
    for (const v of rest) {
      parts.push(`<backup><duration>${Math.round(measureLengthInQN(timeSignature) * DIVISIONS)}</duration></backup>`);
      parts.push(voiceXml(track, v, { pendingTie: false, pendingSlur: false }, instrumentIds));
    }
    const last = i === measures.length - 1;
    if (entry.repeatEnd) parts.push(`<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward" times="${entry.repeatEnd}"/></barline>`);
    else if (m.endBarline === 'final' || (last && m.endBarline !== 'single')) parts.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
    parts.push('</measure>');
    return parts.join('');
  }).join('');
  return `<part id="${partId}">${body}</part>`;
}

function percussionInstruments(track: Track): Map<number, string> {
  const ids = new Map<number, string>();
  if (!isPercussion(track.instrument)) return ids;
  for (const m of track.measures) for (const v of m.voices) for (const e of v.events) {
    const pitches = e.kind === 'note' ? [e] : e.kind === 'chord' ? e.notes : [];
    for (const p of pitches) {
      const gm = p.percussion?.sourceMidi;
      if (gm !== undefined && !ids.has(gm)) ids.set(gm, `I${gm}`);
    }
  }
  return ids;
}

export function writeMusicXml(score: ScoreDocument, trackIndexes: number[]): string {
  const tracks = trackIndexes.map(i => score.tracks[i]).filter(Boolean);
  const partIds = tracks.map((_, k) => `P${k + 1}`);
  const instrumentIdsByPart = tracks.map((t, k) => {
    const ids = percussionInstruments(t);
    return new Map(Array.from(ids, ([gm, id]) => [gm, `${partIds[k]}-${id}`]));
  });

  const partList = tracks.map((t, k) => {
    const midi = Array.from(instrumentIdsByPart[k], ([gm, id]) =>
      `<score-instrument id="${id}"><instrument-name>${escapeXml(t.displayName)}</instrument-name></score-instrument>` +
      `<midi-instrument id="${id}"><midi-channel>10</midi-channel><midi-unpitched>${gm + 1}</midi-unpitched></midi-instrument>`).join('');
    return `<score-part id="${partIds[k]}"><part-name>${escapeXml(t.displayName)}</part-name>${midi}</score-part>`;
  }).join('');

  const parts = tracks.map((t, k) => partXml(score, t, partIds[k], instrumentIdsByPart[k])).join('');
  const composer = score.composer ? `<identification><creator type="composer">${escapeXml(score.composer)}</creator><encoding><software>Latin Music Mastery PlaySense Studio</software></encoding></identification>`
    : '<identification><encoding><software>Latin Music Mastery PlaySense Studio</software></encoding></identification>';

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    `<score-partwise version="4.0"><work><work-title>${escapeXml(score.title)}</work-title></work>${composer}<part-list>${partList}</part-list>${parts}</score-partwise>`;
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run lib/playsense-studio/export/__tests__/musicxml-writer.test.ts
```
Expected: PASS (9 tests). If the percussion round trip returns `staffLine` `'e/5'` but a different `notehead`, check that `<notehead smufl="…">` is emitted for the conga fixture strokes (they come from `percussionNotation()` since the fixture has no `percussion` objects).

- [ ] **Step 5: Open the output in MuseScore once**

Write `writeMusicXml(SON_MONTUNO_FIXTURE, [0,1,2])` to `/tmp/son-montuno.musicxml` from a scratch test, open it in MuseScore 4 (free download). Confirm three parts, tempo 96, a bass clef on the bass part, and no import warnings. Delete the scratch test.

- [ ] **Step 6: Commit**

```bash
git add lib/playsense-studio/export/musicxml-writer.ts lib/playsense-studio/export/__tests__/musicxml-writer.test.ts
git commit -m "Add MusicXML writer for sheet music export"
```

---

### Task 10: MIDI writer

**Files:**
- Create: `lib/playsense-studio/export/midi-writer.ts`
- Test: `lib/playsense-studio/export/__tests__/midi-writer.test.ts`

**Interfaces:**
- Consumes: `Midi` from `@tonejs/midi`; `walkMeasures` from `@/lib/playsense-studio/time-mapping`; `isPercussion` from `@/lib/playsense-studio/perc-strokes`; `GM_PERCUSSION` from `@/lib/playsense-studio/gm-percussion`.
- Produces: `export function writeMidi(score: ScoreDocument, trackIndexes: number[]): Uint8Array` and `export function strokeToGm(instrument: Instrument, strokeMidi: number, sourceMidi?: number): number`.

Rules: repeats stay expanded (the model already stores every pass). Ties merge into one note. Percussion tracks go on channel 10 (index 9); the GM key is `percussion.sourceMidi` when present, else the first `GM_PERCUSSION` entry whose `instrument` and `strokeMidi` match, else 60. Velocity 0.8. Tempo and time-signature events go on the header (track 0 is implicit in `@tonejs/midi`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/playsense-studio/export/__tests__/midi-writer.test.ts
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { strokeToGm, writeMidi } from '../midi-writer';
import { CONGA_TUMBAO_FIXTURE, GUITAR_LICK_FIXTURE, SON_MONTUNO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

describe('writeMidi', () => {
  it('writes one track per selected model track with the right notes', () => {
    const midi = new Midi(writeMidi(GUITAR_LICK_FIXTURE, [0]));
    expect(midi.tracks).toHaveLength(1);
    expect(midi.tracks[0].notes.map(n => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(midi.header.tempos[0].bpm).toBe(120);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([4, 4]);
    expect(midi.tracks[0].notes[1].ticks).toBe(midi.header.ppq);
  });

  it('puts percussion on channel 10 with GM keys', () => {
    const midi = new Midi(writeMidi(CONGA_TUMBAO_FIXTURE, [0]));
    expect(midi.tracks[0].channel).toBe(9);
    const keys = new Set(midi.tracks[0].notes.map(n => n.midi));
    for (const k of keys) expect(k).toBeGreaterThanOrEqual(35);
  });

  it('writes tempo changes and chords', () => {
    const midi = new Midi(writeMidi(SON_MONTUNO_FIXTURE, [0, 1, 2]));
    expect(midi.tracks).toHaveLength(3);
    expect(midi.header.tempos.map(t => t.bpm)).toEqual([96, 110]);
    const chordTicks = midi.tracks[0].notes.filter(n => n.ticks === 0);
    expect(chordTicks.length).toBeGreaterThan(1);
  });

  it('merges tied notes into one', () => {
    const tied: ScoreDocument = {
      ...GUITAR_LICK_FIXTURE,
      tracks: [{ ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
        { number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4, tieToNext: true }] }] },
        { number: 2, voices: [{ number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] }] },
      ] }],
    };
    const midi = new Midi(writeMidi(tied, [0]));
    expect(midi.tracks[0].notes).toHaveLength(1);
    expect(midi.tracks[0].notes[0].durationTicks).toBe(8 * midi.header.ppq);
  });
});

describe('strokeToGm', () => {
  it('prefers the recorded source key, then the GM table, then 60', () => {
    expect(strokeToGm('perc-conga', 64, 63)).toBe(63);
    expect(strokeToGm('perc-conga', 64)).toBeGreaterThanOrEqual(35);
    expect(strokeToGm('perc-clave', 999)).toBe(60);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/midi-writer.test.ts
```
Expected: FAIL, cannot resolve `../midi-writer`.

- [ ] **Step 3: Implement `midi-writer.ts`**

```ts
// lib/playsense-studio/export/midi-writer.ts
import { Midi } from '@tonejs/midi';
import type { Instrument, ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { walkMeasures } from '@/lib/playsense-studio/time-mapping';
import { isPercussion } from '@/lib/playsense-studio/perc-strokes';
import { GM_PERCUSSION } from '@/lib/playsense-studio/gm-percussion';

const VELOCITY = 0.8;

export function strokeToGm(instrument: Instrument, strokeMidi: number, sourceMidi?: number): number {
  if (sourceMidi !== undefined) return sourceMidi;
  for (const [gm, entry] of Object.entries(GM_PERCUSSION)) {
    if (entry.instrument === instrument && entry.strokeMidi === strokeMidi) return Number(gm);
  }
  return 60;
}

interface PendingNote { midi: number; startQN: number; durationQN: number }

function trackNotes(track: Track, score: ScoreDocument): PendingNote[] {
  const perc = isPercussion(track.instrument);
  const done: PendingNote[] = [];
  const open = new Map<number, PendingNote>(); // tied notes waiting for their continuation, by midi

  for (const { measure, state } of walkMeasures(track, score)) {
    for (const voice of measure.voices) {
      let qn = state.cumulativeQN;
      for (const e of voice.events) {
        if (e.kind !== 'rest') {
          const pitches = e.kind === 'note'
            ? [{ midi: e.midi, tie: !!e.tieToNext, source: e.percussion?.sourceMidi }]
            : e.notes.map(n => ({ midi: n.midi, tie: !!(n.tieToNext ?? e.tieToNext), source: n.percussion?.sourceMidi }));
          for (const p of pitches) {
            const key = perc ? strokeToGm(track.instrument, p.midi, p.source) : p.midi;
            const held = open.get(key);
            if (held) {
              held.durationQN += e.durationQN;
              if (!p.tie) { open.delete(key); done.push(held); }
              continue;
            }
            const note = { midi: key, startQN: qn, durationQN: e.durationQN };
            if (p.tie) open.set(key, note); else done.push(note);
          }
        }
        qn += e.durationQN;
      }
    }
  }
  done.push(...open.values());
  return done.sort((a, b) => a.startQN - b.startQN || a.midi - b.midi);
}

export function writeMidi(score: ScoreDocument, trackIndexes: number[]): Uint8Array {
  const midi = new Midi();
  midi.name = score.title;
  const ppq = midi.header.ppq;
  const toTicks = (qn: number) => Math.round(qn * ppq);

  // Tempo + meter from the first selected track's walk (all tracks share them).
  const reference = score.tracks[trackIndexes[0]] ?? score.tracks[0];
  midi.header.tempos = [];
  midi.header.timeSignatures = [];
  let lastTempo = -1;
  let lastTs = '';
  for (const { state } of walkMeasures(reference, score)) {
    if (state.tempo !== lastTempo) { midi.header.tempos.push({ ticks: toTicks(state.cumulativeQN), bpm: state.tempo }); lastTempo = state.tempo; }
    const tsKey = state.timeSignature.join('/');
    if (tsKey !== lastTs) { midi.header.timeSignatures.push({ ticks: toTicks(state.cumulativeQN), timeSignature: [...state.timeSignature] }); lastTs = tsKey; }
  }
  midi.header.update();

  for (const index of trackIndexes) {
    const track = score.tracks[index];
    if (!track) continue;
    const out = midi.addTrack();
    out.name = track.displayName;
    out.channel = isPercussion(track.instrument) ? 9 : trackIndexes.indexOf(index) % 9;
    for (const n of trackNotes(track, score)) {
      out.addNote({ midi: n.midi, ticks: toTicks(n.startQN), durationTicks: Math.max(1, toTicks(n.durationQN)), velocity: VELOCITY });
    }
  }
  return midi.toArray();
}
```
The channel expression keeps pitched tracks on channels 0 to 8 and never lands on 9.

- [ ] **Step 4: Run the test**

```bash
npx vitest run lib/playsense-studio/export/__tests__/midi-writer.test.ts
```
Expected: PASS (5 tests). If `midi.header.tempos` is read-only in the typings, build the header through `midi.header.setTempo(bpm)` for the first tempo and push subsequent ones onto the array after `update()`.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/export/midi-writer.ts lib/playsense-studio/export/__tests__/midi-writer.test.ts
git commit -m "Add MIDI writer for sheet music export"
```

---

### Task 11: `exportSection` entry point and the analytics event

**Files:**
- Create: `lib/playsense-studio/export/index.ts`
- Modify: `app/actions/playsense-studio.ts` (the `PlaysenseStudioEventType` union, currently lines 322-328)
- Test: `lib/playsense-studio/export/__tests__/export-section.test.ts` (jsdom)

**Interfaces:**
- Consumes: everything above.
- Produces:
```ts
export type { ExportFormat } from './filename';
export interface ExportRequest {
  score: ScoreDocument;
  trackIndexes: number[];
  format: ExportFormat;
  pdf?: Partial<PdfExportOptions>;
  context: { classItemTitle: string; sectionIndex: number; sectionCount: number };
}
export interface ExportResult { filename: string; byteLength: number }
export async function exportSection(request: ExportRequest, deps?: { download?: typeof downloadBytes; fonts?: () => Promise<NotationFontBytes> }): Promise<ExportResult>
```
The event type union gains `'playsense_studio_section_exported'`. The `playsense_studio_events.event_type` column is plain `TEXT` with no check constraint (migration 015), so no migration is needed.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
// lib/playsense-studio/export/__tests__/export-section.test.ts
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { exportSection } from '../index';
import { GUITAR_LICK_FIXTURE } from '@/lib/playsense-studio/score-fixtures';

const fontsDir = path.resolve(__dirname, '../../../../public/fonts/notation');
const fonts = async () => ({
  bravura: new Uint8Array(readFileSync(path.join(fontsDir, 'bravura.woff2'))),
  academico: new Uint8Array(readFileSync(path.join(fontsDir, 'academico.woff2'))),
});
beforeAll(() => {
  const proto = (globalThis as unknown as { SVGElement: { prototype: Record<string, unknown> } }).SVGElement.prototype;
  proto.getBBox = function getBBox(this: Element) { return { x: 0, y: -8, width: Math.max(6, (this.textContent ?? '').length * 7), height: 10 }; };
  (globalThis as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } }).HTMLCanvasElement.prototype.getContext = () => ({ measureText: (t: string) => ({ width: t.length * 7 }), font: '' });
});
const context = { classItemTitle: 'Clave básica', sectionIndex: 0, sectionCount: 1 };

describe('exportSection', () => {
  it('downloads MusicXML with the right name and mime type', async () => {
    const download = vi.fn();
    const result = await exportSection({ score: GUITAR_LICK_FIXTURE, trackIndexes: [0], format: 'musicxml', context }, { download });
    expect(result.filename).toBe('clave-basica_section-1.musicxml');
    const [bytes, filename, mime] = download.mock.calls[0];
    expect(typeof bytes).toBe('string');
    expect(filename).toBe('clave-basica_section-1.musicxml');
    expect(mime).toBe('application/vnd.recordare.musicxml+xml');
  });

  it('downloads MIDI bytes', async () => {
    const download = vi.fn();
    await exportSection({ score: GUITAR_LICK_FIXTURE, trackIndexes: [0], format: 'midi', context }, { download });
    expect(download.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(download.mock.calls[0][1]).toBe('clave-basica_section-1.mid');
  });

  it('downloads a PDF using default options merged with overrides', async () => {
    const download = vi.fn();
    const result = await exportSection({ score: GUITAR_LICK_FIXTURE, trackIndexes: [0], format: 'pdf', pdf: { pageSize: 'a4' }, context }, { download, fonts });
    expect(result.filename).toBe('clave-basica_section-1.pdf');
    expect(download.mock.calls[0][2]).toBe('application/pdf');
    expect(result.byteLength).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run lib/playsense-studio/export/__tests__/export-section.test.ts
```
Expected: FAIL, cannot resolve `../index`.

- [ ] **Step 3: Implement `index.ts` and widen the event union**

```ts
// lib/playsense-studio/export/index.ts
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { EXPORT_MIME, sectionExportFilename, type ExportFormat } from './filename';
import { downloadBytes } from './download';
import { writeMusicXml } from './musicxml-writer';
import { writeMidi } from './midi-writer';
import { DEFAULT_PDF_OPTIONS, renderSectionPdf, type PdfExportOptions } from './pdf/render-section';
import type { NotationFontBytes } from './pdf/fonts';

export type { ExportFormat } from './filename';
export type { PdfExportOptions } from './pdf/render-section';
export { DEFAULT_PDF_OPTIONS } from './pdf/render-section';

export interface ExportRequest {
  score: ScoreDocument;
  trackIndexes: number[];
  format: ExportFormat;
  pdf?: Partial<PdfExportOptions>;
  context: { classItemTitle: string; sectionIndex: number; sectionCount: number };
}

export interface ExportResult { filename: string; byteLength: number }

export async function exportSection(
  request: ExportRequest,
  deps: { download?: typeof downloadBytes; fonts?: () => Promise<NotationFontBytes> } = {},
): Promise<ExportResult> {
  const download = deps.download ?? downloadBytes;
  const filename = sectionExportFilename(request.context.classItemTitle, request.context.sectionIndex, request.format);
  let payload: Uint8Array | string;
  switch (request.format) {
    case 'musicxml':
      payload = writeMusicXml(request.score, request.trackIndexes);
      break;
    case 'midi':
      payload = writeMidi(request.score, request.trackIndexes);
      break;
    case 'pdf':
      payload = await renderSectionPdf(request.score, request.trackIndexes, { ...DEFAULT_PDF_OPTIONS, ...request.pdf }, request.context, { fonts: deps.fonts });
      break;
  }
  download(payload, filename, EXPORT_MIME[request.format]);
  return { filename, byteLength: typeof payload === 'string' ? new TextEncoder().encode(payload).length : payload.length };
}
```

In `app/actions/playsense-studio.ts` add one member to the union:
```ts
export type PlaysenseStudioEventType =
  | 'playsense_studio_player_loaded'
  | 'playsense_studio_play'
  | 'playsense_studio_seek_via_notation'
  | 'playsense_studio_clip_saved'
  | 'playsense_studio_view_switched'
  | 'playsense_studio_legacy_iframe_shown'
  | 'playsense_studio_section_exported';
```

- [ ] **Step 4: Run the tests and the type check**

```bash
npx vitest run lib/playsense-studio/export
npx tsc --noEmit -p tsconfig.json
```
Expected: all export tests PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/playsense-studio/export/index.ts lib/playsense-studio/export/__tests__/export-section.test.ts app/actions/playsense-studio.ts
git commit -m "Add exportSection entry point and export analytics event type"
```

---

### Task 12: Admin Export chip and dialog

**Files:**
- Create: `components/playsense-studio/export/export-options.ts` (pure state reducer)
- Create: `components/playsense-studio/export/export-dialog.tsx`
- Modify: `components/playsense-studio/studio/score-section-editor.tsx` (props interface lines 30-53; app-bar portal cluster lines 188-244)
- Modify: `app/admin/playsense-studio/[classItemId]/video-sections-workspace.tsx` (the `<ScoreSectionEditor …/>` JSX, lines 336-359)
- Test: `components/playsense-studio/export/__tests__/export-options.test.ts`

**Interfaces:**
- Consumes: `exportSection`, `DEFAULT_PDF_OPTIONS`, `ExportFormat`, `PdfExportOptions` from `@/lib/playsense-studio/export`; `buildRowPlan`, `engraveTrackRows` for the preview; `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger` from `@/components/ui/dialog`; `logPlaysenseStudioEvent` from `@/app/actions/playsense-studio`; `sectionExportFilename` from `@/lib/playsense-studio/export/filename`.
- Produces:
```ts
// export-options.ts
export interface ExportOptionsState { format: ExportFormat; trackIndexes: number[]; pdf: PdfExportOptions }
export type ExportOptionsAction =
  | { type: 'format'; format: ExportFormat }
  | { type: 'toggleTrack'; trackIndex: number }
  | { type: 'pageSize'; pageSize: PageSize }
  | { type: 'toggle'; key: 'includeHeader' | 'includeMeasureNumbers' | 'includeBranding' | 'expandRepeats' };
export function initialExportOptions(trackCount: number, pageSize: PageSize): ExportOptionsState
export function exportOptionsReducer(state: ExportOptionsState, action: ExportOptionsAction): ExportOptionsState
export const PAGE_SIZE_STORAGE_KEY = 'playsense-export-page-size';
// export-dialog.tsx
export interface ExportDialogProps { score: ScoreDocument; classItemTitle: string; sectionIndex: number; sectionCount: number; classItemId: string; trigger: ReactNode }
export function ExportDialog(props: ExportDialogProps): JSX.Element
```
- New `ScoreSectionEditorProps`: `classItemTitle: string; sectionIndex: number; sectionCount: number;`

- [ ] **Step 1: Write the failing reducer test**

```ts
// components/playsense-studio/export/__tests__/export-options.test.ts
import { describe, expect, it } from 'vitest';
import { exportOptionsReducer, initialExportOptions } from '../export-options';

describe('export options', () => {
  it('starts with PDF, every track and the remembered page size', () => {
    const s = initialExportOptions(3, 'a4');
    expect(s.format).toBe('pdf');
    expect(s.trackIndexes).toEqual([0, 1, 2]);
    expect(s.pdf.pageSize).toBe('a4');
    expect(s.pdf).toMatchObject({ includeHeader: true, includeMeasureNumbers: true, includeBranding: true, expandRepeats: false });
  });
  it('toggles tracks but never unchecks the last one', () => {
    let s = initialExportOptions(2, 'letter');
    s = exportOptionsReducer(s, { type: 'toggleTrack', trackIndex: 0 });
    expect(s.trackIndexes).toEqual([1]);
    s = exportOptionsReducer(s, { type: 'toggleTrack', trackIndex: 1 });
    expect(s.trackIndexes).toEqual([1]);
    s = exportOptionsReducer(s, { type: 'toggleTrack', trackIndex: 0 });
    expect(s.trackIndexes).toEqual([0, 1]);
  });
  it('switches format and flips include flags', () => {
    let s = initialExportOptions(1, 'letter');
    s = exportOptionsReducer(s, { type: 'format', format: 'midi' });
    expect(s.format).toBe('midi');
    s = exportOptionsReducer(s, { type: 'toggle', key: 'includeBranding' });
    expect(s.pdf.includeBranding).toBe(false);
    s = exportOptionsReducer(s, { type: 'pageSize', pageSize: 'a4' });
    expect(s.pdf.pageSize).toBe('a4');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run components/playsense-studio/export/__tests__/export-options.test.ts
```
Expected: FAIL, cannot resolve `../export-options`.

- [ ] **Step 3: Implement `export-options.ts`**

```ts
// components/playsense-studio/export/export-options.ts
import { DEFAULT_PDF_OPTIONS, type ExportFormat, type PdfExportOptions } from '@/lib/playsense-studio/export';
import type { PageSize } from '@/lib/playsense-studio/export/pdf/page-plan';

export const PAGE_SIZE_STORAGE_KEY = 'playsense-export-page-size';

export interface ExportOptionsState { format: ExportFormat; trackIndexes: number[]; pdf: PdfExportOptions }

export type ExportOptionsAction =
  | { type: 'format'; format: ExportFormat }
  | { type: 'toggleTrack'; trackIndex: number }
  | { type: 'pageSize'; pageSize: PageSize }
  | { type: 'toggle'; key: 'includeHeader' | 'includeMeasureNumbers' | 'includeBranding' | 'expandRepeats' };

export function initialExportOptions(trackCount: number, pageSize: PageSize): ExportOptionsState {
  return { format: 'pdf', trackIndexes: Array.from({ length: trackCount }, (_, i) => i), pdf: { ...DEFAULT_PDF_OPTIONS, pageSize } };
}

export function exportOptionsReducer(state: ExportOptionsState, action: ExportOptionsAction): ExportOptionsState {
  switch (action.type) {
    case 'format':
      return { ...state, format: action.format };
    case 'toggleTrack': {
      const has = state.trackIndexes.includes(action.trackIndex);
      if (has && state.trackIndexes.length === 1) return state;
      const next = has ? state.trackIndexes.filter(i => i !== action.trackIndex) : [...state.trackIndexes, action.trackIndex].sort((a, b) => a - b);
      return { ...state, trackIndexes: next };
    }
    case 'pageSize':
      return { ...state, pdf: { ...state.pdf, pageSize: action.pageSize } };
    case 'toggle':
      return { ...state, pdf: { ...state.pdf, [action.key]: !state.pdf[action.key] } };
  }
}
```

- [ ] **Step 4: Run the reducer test**

```bash
npx vitest run components/playsense-studio/export/__tests__/export-options.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `export-dialog.tsx`**

```tsx
'use client';
// components/playsense-studio/export/export-dialog.tsx
// Admin export dialog: format, tracks, page, include options, a first-row
// preview, and the export button. Everything runs in the browser.
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Download, FileText, FileCode2, Music2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { exportSection, type ExportFormat } from '@/lib/playsense-studio/export';
import { sectionExportFilename } from '@/lib/playsense-studio/export/filename';
import { buildRowPlan } from '@/lib/playsense-studio/export/pdf/row-plan';
import { engraveTrackRows } from '@/lib/playsense-studio/export/pdf/engrave';
import { ENGRAVE_WIDTH_PX } from '@/lib/playsense-studio/export/pdf/render-section';
import type { PageSize } from '@/lib/playsense-studio/export/pdf/page-plan';
import { logPlaysenseStudioEvent } from '@/app/actions/playsense-studio';
import { exportOptionsReducer, initialExportOptions, PAGE_SIZE_STORAGE_KEY } from './export-options';

export interface ExportDialogProps {
  score: ScoreDocument;
  classItemTitle: string;
  sectionIndex: number;
  sectionCount: number;
  classItemId: string;
  trigger: ReactNode;
}

const FORMATS: Array<{ id: ExportFormat; label: string; hint: string; icon: typeof FileText }> = [
  { id: 'pdf', label: 'PDF', hint: 'Print-ready page. Opens anywhere.', icon: FileText },
  { id: 'musicxml', label: 'MusicXML', hint: 'Editable in MuseScore, Finale, Sibelius, Guitar Pro.', icon: FileCode2 },
  { id: 'midi', label: 'MIDI', hint: 'Playback only. For DAWs and practice apps.', icon: Music2 },
];

const INCLUDES: Array<{ key: 'includeHeader' | 'includeMeasureNumbers' | 'includeBranding' | 'expandRepeats'; label: string }> = [
  { key: 'includeHeader', label: 'Title, tempo and time signature' },
  { key: 'includeMeasureNumbers', label: 'Measure numbers' },
  { key: 'includeBranding', label: 'Course name and site footer' },
  { key: 'expandRepeats', label: 'Expand repeats' },
];

function readStoredPageSize(): PageSize {
  try { return localStorage.getItem(PAGE_SIZE_STORAGE_KEY) === 'a4' ? 'a4' : 'letter'; } catch { return 'letter'; }
}

const viewLabel = (instrument: string) => (instrument.startsWith('perc-') ? 'percussion' : 'staff');

export function ExportDialog({ score, classItemTitle, sectionIndex, sectionCount, classItemId, trigger }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(exportOptionsReducer, undefined, () => initialExportOptions(score.tracks.length, readStoredPageSize()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const measures = score.tracks[0]?.measures.length ?? 0;
  const subtitle = `Section ${sectionIndex + 1} · ${score.title} · ${measures} measures · ${score.initialTimeSignature[0]}/${score.initialTimeSignature[1]} · ♩=${Math.round(score.initialTempo)}`;
  const filename = useMemo(() => sectionExportFilename(classItemTitle, sectionIndex, state.format), [classItemTitle, sectionIndex, state.format]);

  // First-row preview of the first selected track, engraved with the real exporter.
  useEffect(() => {
    if (!open || state.format === 'midi') return;
    const host = previewRef.current;
    if (!host) return;
    try {
      const plan = buildRowPlan(score, state.trackIndexes, ENGRAVE_WIDTH_PX, { expandRepeats: state.pdf.expandRepeats });
      const first = engraveTrackRows(plan, state.trackIndexes[0]);
      const svg = first.rows[0]?.svg;
      host.replaceChildren();
      if (svg) {
        svg.removeAttribute('width'); svg.removeAttribute('height');
        svg.style.width = '100%'; svg.style.height = 'auto';
        host.appendChild(svg);
      }
    } catch {
      host.replaceChildren();
    }
  }, [open, score, state.trackIndexes, state.pdf.expandRepeats, state.format]);

  const setPageSize = (pageSize: PageSize) => {
    dispatch({ type: 'pageSize', pageSize });
    try { localStorage.setItem(PAGE_SIZE_STORAGE_KEY, pageSize); } catch { /* private mode */ }
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportSection({ score, trackIndexes: state.trackIndexes, format: state.format, pdf: state.pdf, context: { classItemTitle, sectionIndex, sectionCount } });
      void logPlaysenseStudioEvent({ eventType: 'playsense_studio_section_exported', classItemId, metadata: { format: state.format, trackCount: state.trackIndexes.length, surface: 'admin' } });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (busy) return; setOpen(next); if (!next) setError(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Export sheet music</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Format</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format">
            {FORMATS.map(f => {
              const on = state.format === f.id;
              const Icon = f.icon;
              return (
                <button key={f.id} type="button" role="radio" aria-checked={on} onClick={() => dispatch({ type: 'format', format: f.id })}
                  className={`flex flex-col gap-1.5 rounded-[10px] border p-3 text-left transition ${on ? 'border-primary/40 bg-primary/10' : 'border-border bg-card hover:border-foreground/20'}`}>
                  <Icon className={`h-5 w-5 ${on ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-[13px] font-semibold">{f.label}</span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">{f.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Tracks</div>
            {score.tracks.map((t, i) => (
              <label key={i} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="accent-primary" checked={state.trackIndexes.includes(i)} onChange={() => dispatch({ type: 'toggleTrack', trackIndex: i })} />
                <span>{t.displayName}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{viewLabel(t.instrument)}</span>
              </label>
            ))}
          </div>
          {state.format === 'pdf' && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Page</div>
              <div className="st-seg" role="radiogroup" aria-label="Page size">
                {(['letter', 'a4'] as const).map(p => (
                  <button key={p} type="button" className={state.pdf.pageSize === p ? 'is-on' : ''} aria-pressed={state.pdf.pageSize === p} onClick={() => setPageSize(p)}>{p === 'a4' ? 'A4' : 'Letter'}</button>
                ))}
              </div>
              <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Include</div>
              {INCLUDES.map(i => (
                <label key={i.key} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" className="accent-primary" checked={state.pdf[i.key]} onChange={() => dispatch({ type: 'toggle', key: i.key })} />
                  <span>{i.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {state.format !== 'midi' && (
          <div className="rounded-[10px] border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-semibold uppercase tracking-[0.04em]">Preview</span>
              <span>First system</span>
            </div>
            <div ref={previewRef} className="min-h-[60px] [&_svg]:block" aria-hidden="true" />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[11.5px] text-muted-foreground">{filename}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-50">Cancel</button>
            <button type="button" onClick={run} disabled={busy || state.trackIndexes.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
              <Download className="h-4 w-4" />
              {busy ? 'Exporting…' : `Export ${FORMATS.find(f => f.id === state.format)?.label}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Wire the chip into the section editor**

In `score-section-editor.tsx`:
1. Add to `ScoreSectionEditorProps`: `classItemTitle: string; sectionIndex: number; sectionCount: number;` and destructure them.
2. Add `import { Download } from 'lucide-react';` to the existing lucide import and `import { ExportDialog } from '@/components/playsense-studio/export/export-dialog';`.
3. Inside the app-bar portal, directly after the closing `/>` of `<ScoreImportDialog …/>` and before `<span className="mx-0.5 h-6 w-px bg-border" />`, add:
```tsx
            <ExportDialog
              score={state.score}
              classItemTitle={classItemTitle}
              sectionIndex={sectionIndex}
              sectionCount={sectionCount}
              classItemId={classItemId}
              trigger={
                <button type="button" className="st-chip" title="Export this section as PDF, MusicXML or MIDI">
                  <Download className="h-4 w-4" />
                  <span className="hidden lg:inline">Export</span>
                </button>
              }
            />
```

In `video-sections-workspace.tsx`, add three props to the `<ScoreSectionEditor …/>` element:
```tsx
              classItemTitle={title}
              sectionIndex={Math.max(0, sections.findIndex((s) => s.sectionId === selected.sectionId))}
              sectionCount={sections.length}
```

- [ ] **Step 7: Type check and try it in the app**

```bash
npx tsc --noEmit -p tsconfig.json && npm run lint
```
Then run the dev server (see the `run` skill or `npm run dev`), open an admin studio page for a class item with a scored section, click Export, and confirm: the dialog opens with the section subtitle, the preview shows the first row, switching to MIDI hides Page and Include, unchecking the last track keeps it checked, and Export PDF downloads a file whose name matches the footer. Open the PDF.

- [ ] **Step 8: Commit**

```bash
git add components/playsense-studio/export components/playsense-studio/studio/score-section-editor.tsx "app/admin/playsense-studio/[classItemId]/video-sections-workspace.tsx"
git commit -m "Add sheet music export dialog to the PlaySense Studio section editor"
```

---

### Task 13: Student download menu

**Files:**
- Create: `components/playsense-studio/export/download-menu.tsx`
- Modify: `components/playsense-studio/player/playsense-studio-player.tsx` (props interface around line 97; the `secondaryHeader` block lines 563-595)
- Modify: `components/class-viewer/class-item-renderer.tsx` (both `<PlaysenseStudioPlayer …/>` call sites, lines 187 and 202)
- Modify: `locales/en.json`, `locales/es.json` (new top-level `playsenseExport` object)

**Interfaces:**
- Consumes: `exportSection` from `@/lib/playsense-studio/export`; `useTranslation` from `@/components/language-provider`; `logPlaysenseStudioEvent`.
- Produces:
```tsx
export interface DownloadMenuProps {
  score: ScoreDocument; classItemTitle: string; sectionIndex: number; sectionCount: number;
  classItemId: string; readOnly?: boolean;
}
export function DownloadMenu(props: DownloadMenuProps): JSX.Element
```
- `PlaysenseStudioPlayerProps` gains `classItemTitle?: string`.

- [ ] **Step 1: Add the translations**

Add after the `"lessonView"` line in both files (keep them one-line objects like their neighbour):

`locales/en.json`:
```json
  "playsenseExport": {"button": "Download sheet music", "title": "Download this section", "pdf": "Sheet music (PDF)", "pdfHint": "Print or read on a tablet", "musicxml": "MusicXML", "musicxmlHint": "Open in MuseScore or Guitar Pro", "note": "Includes all tracks, Letter size, title and tempo.", "error": "Could not create the file. Try again.", "working": "Preparing…"},
```
`locales/es.json`:
```json
  "playsenseExport": {"button": "Descargar partitura", "title": "Descargar esta sección", "pdf": "Partitura (PDF)", "pdfHint": "Para imprimir o leer en una tableta", "musicxml": "MusicXML", "musicxmlHint": "Ábrelo en MuseScore o Guitar Pro", "note": "Incluye todas las pistas, tamaño carta, título y tempo.", "error": "No se pudo crear el archivo. Inténtalo de nuevo.", "working": "Preparando…"},
```
Run `node -e "require('./locales/en.json'); require('./locales/es.json'); console.log('json ok')"`.

- [ ] **Step 2: Implement `download-menu.tsx`**

```tsx
'use client';
// components/playsense-studio/export/download-menu.tsx
// Student-facing: one icon button, a two-item menu, defaults for everything.
import { useEffect, useRef, useState } from 'react';
import { Download, FileCode2, FileText } from 'lucide-react';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { exportSection, type ExportFormat } from '@/lib/playsense-studio/export';
import { logPlaysenseStudioEvent } from '@/app/actions/playsense-studio';
import { useTranslation } from '@/components/language-provider';

export interface DownloadMenuProps {
  score: ScoreDocument;
  classItemTitle: string;
  sectionIndex: number;
  sectionCount: number;
  classItemId: string;
  readOnly?: boolean;
}

export function DownloadMenu({ score, classItemTitle, sectionIndex, sectionCount, classItemId, readOnly }: DownloadMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    setError(false);
    try {
      await exportSection({ score, trackIndexes: score.tracks.map((_, i) => i), format, context: { classItemTitle, sectionIndex, sectionCount } });
      if (!readOnly) void logPlaysenseStudioEvent({ eventType: 'playsense_studio_section_exported', classItemId, metadata: { format, trackCount: score.tracks.length, surface: 'student' } });
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  const items: Array<{ format: ExportFormat; label: string; hint: string; icon: typeof FileText }> = [
    { format: 'pdf', label: t('playsenseExport.pdf'), hint: t('playsenseExport.pdfHint'), icon: FileText },
    { format: 'musicxml', label: t('playsenseExport.musicxml'), hint: t('playsenseExport.musicxmlHint'), icon: FileCode2 },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        title={t('playsenseExport.button')} aria-label={t('playsenseExport.button')}
        className={`grid h-[26px] w-7 place-items-center rounded-full border border-border bg-secondary transition-colors ${open ? 'bg-primary/[0.16] text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
        <Download className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-60 rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur">
          <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t('playsenseExport.title')}</div>
          {items.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.format} type="button" role="menuitem" disabled={busy !== null} onClick={() => void run(item.format)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60">
                <Icon className="h-[18px] w-[18px] shrink-0 text-primary" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-semibold">{busy === item.format ? t('playsenseExport.working') : item.label}</span>
                  <span className="text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            );
          })}
          <div className="mx-2.5 mb-1.5 mt-1 border-t border-border pt-2 text-[10.5px] leading-snug text-muted-foreground">
            {error ? <span className="text-destructive">{t('playsenseExport.error')}</span> : t('playsenseExport.note')}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the player**

In `playsense-studio-player.tsx`:
1. Add `classItemTitle?: string;` to `PlaysenseStudioPlayerProps` (next to `classItemId`) and destructure it with the other props.
2. Add `import { DownloadMenu } from '@/components/playsense-studio/export/download-menu';`.
3. In `secondaryHeader`, change the row at line 589 so the menu is the last item and shows only while notation is active:
```tsx
                {lessonView !== 'video' && <div className="flex items-center gap-1">
                  <NotationLayoutToggle value={notationLayout} onChange={setNotationLayout} />
                  {lessonView === 'both' && <OrientationToggle value={orient} onChange={setOrient} />}
                  {hasNotation && (
                    <DownloadMenu
                      score={score}
                      classItemTitle={classItemTitle ?? score.title}
                      sectionIndex={Math.max(0, normalizedSections.indexOf(displaySection))}
                      sectionCount={normalizedSections.length}
                      classItemId={classItemId}
                      readOnly={readOnly}
                    />
                  )}
                </div>}
```
`hasNotation`, `normalizedSections`, `displaySection`, `score` and `readOnly` are already in scope (lines 151-188 and the props).

In `class-item-renderer.tsx`, add `classItemTitle={item.title}` to both `<PlaysenseStudioPlayer …/>` elements (lines 187 and 202).

- [ ] **Step 4: Type check, lint, and try it**

```bash
npx tsc --noEmit -p tsconfig.json && npm run lint && npx vitest run
```
Then in the dev server open a lesson as a student (or the admin preview of one), switch the language to Spanish, open the download menu, confirm the labels are Spanish, download the PDF and the MusicXML, and confirm the filename uses the lesson title. Confirm the button disappears during a video gap between sections.

- [ ] **Step 5: Commit**

```bash
git add components/playsense-studio/export/download-menu.tsx components/playsense-studio/player/playsense-studio-player.tsx components/class-viewer/class-item-renderer.tsx locales/en.json locales/es.json
git commit -m "Let students download a section as PDF or MusicXML"
```

---

### Task 14: End-to-end verification and pull request

**Files:** none new. This task produces evidence and the PR.

- [ ] **Step 1: Full automated run**

```bash
npx vitest run && npx tsc --noEmit -p tsconfig.json && npm run lint && npm run build
```
Expected: all green. The build proves the export modules tree-shake into the client bundle without server-only imports.

- [ ] **Step 2: Manual matrix (record results in the PR)**

| Check | Where | Expected |
|---|---|---|
| Admin PDF, Letter, 3-track section | studio Export dialog | Aligned systems, track names at left, measure numbers, header and footer present |
| Admin PDF with branding off, A4 | studio Export dialog | No lesson line, no footer, A4 page size in Preview's inspector |
| Admin PDF, percussion-only section | studio Export dialog | Percussion clef and noteheads (x, diamond) render |
| Admin MusicXML | MuseScore 4 | Opens without warnings; bass part shows a bass clef; tempo 96 |
| Admin MusicXML | Guitar Pro or MuseScore tab view | Tuning recognised (6 strings for guitar) |
| Admin MIDI | any DAW or MuseScore | Correct tempo; percussion on channel 10 |
| Student PDF | lesson page | Same page as admin defaults; filename from the lesson title |
| Student MusicXML, Spanish UI | lesson page | Spanish labels; file downloads |
| Repeats collapsed vs expanded | a section with a repeat | Repeat barlines in collapsed PDF; passes written out when expanded |
| Existing renderer | player and studio | Wrapped staff rows look unchanged after Task 3 |

- [ ] **Step 3: Open the PR**

Use the `superpowers:finishing-a-development-branch` skill. The PR description lists the three formats, the manual matrix results with two screenshots (a PDF page and the admin dialog), and notes the new dependency `@pdf-lib/fontkit` and the two font files under `public/fonts/notation/` with their SIL Open Font License.
