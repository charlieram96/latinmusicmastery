# Drag Into Place Rework — Design

**Status:** approved by the user on 2026-09-07 ("lets go with your decisions and recommendations and implement it"). The interactive proposal, with evidence and two prototypes, is the companion to this spec: https://claude.ai/code/artifact/4638f096-121e-4579-913d-228129462108

**Scope:** Tier 1 (student `piece_placement` input) and Tier 2 (admin builder, image pipeline). Tier 3 (alpha-aware hit testing, results mini-stage, sounds, rotation) is out.

## Approved decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Reveal after Check | Faded piece at its target, name shown on hover/focus (tray row hover highlights it). Tolerance boxes stay hidden from students. |
| 2 | Correct pieces after Check | Snap (animate) to the exact target centre with a success ring. Wrong pieces shake with a terracotta ring. |
| 3 | Existing timbales question | Builder action **Fix images**: trims + downsizes every piece/layer image, uploads new files, rewrites `ratio`, `width`, `area` from the trimmed bounds. Originals stay in storage. Runs only when the user clicks it. |
| 4 | Tap and keyboard placement | Ships with Tier 1. |
| 5 | Desktop stage size | Cap by viewport (`dvh`), compact tray rows, keep the question-map rail. |
| 6 | Builder model | **Compose the answer**: the piece itself is the target, placed at the size the student sees; the tolerance is a halo (question default + per-piece override) and is what gets stored as `area`. |
| 7 | Saving in the dialog | Keep the Studio autosave; add in-dialog undo/redo (⌘Z / ⇧⌘Z + buttons) until Done. Click-to-jump removed. |
| 8 | Aligned-set import | On by default: dropped files whose pixel size equals the base layer's are trimmed and placed automatically from their frame position; other files land centred at 20% width. |

## Verified findings this design fixes (see the artifact for measurements)

Student: fixed-position ghost offset by the animated panel; full-frame PNG hit boxes; rings never draw (`outline-style: none`); unreadable dashed reveal; stage under the fixed footer on 996 px; squashed stand layer; tray reflow + unmount on pointer-down; phone strip cannot scroll (`touch-action: none` on items); drops accepted after grading; no primary-button guard; pieces droppable half off-stage; 62vh/74vh mismatch.

Builder: two rectangles per piece; ~60 interactions for 8 pieces, no multi-file or aligned import; every drag autosaved with no undo and click-to-jump; aspect presets distort layers and the ratio lock keeps the distortion; 500 px fixed canvas; no warnings; full-frame ghosts; JSON dump under the canvas; question text not visible.

## Data model (additive, no migration)

```ts
// options.pieces[]  — existing fields unchanged; two optional additions
{ id, label?, imageUrl, width, area: { x, y, width, height }, ratio?: number, tolerance?: number }
// options.tolerance?: number   — question default halo, percent of stage width (default 3)
// options.background.layers[] — one optional addition
{ id, imageUrl, x, y, width, height, ratio?, name?: string }
```

- All geometry stays percent of the stage; `x/y` of a piece's `area` are still its top-left, so `lib/quiz/grading.ts` (`isPieceCorrect`: centre inside `area`) is **not modified**.
- `ratio` = natural width / height of the (trimmed) sprite. When absent, the student input measures the image on load and the builder measures then persists it.
- Derivations live in a new pure module `lib/quiz/placement.ts`:
  - `pieceHeightPct(width, aspect, ratio) = width * aspect / ratio`
  - `areaFor(centre, width, height, tolerance)` → `{ x: cx - w/2 - t, y: cy - h/2 - t, width: w + 2t, height: h + 2t }`
  - `centreOf(area)` → `{ x: area.x + area.width/2, y: area.y + area.height/2 }` (how legacy rows are read: the piece was always centred in its box)
  - `toleranceOf(area, width, height)` → `max(0, min((area.width - width)/2, (area.height - height)/2))`
  - `clampCentre(centre, width, height)` keeps the whole sprite inside `[0,100]²`
  - `resolveDrop(pointer, grabOffset, stageRect)` → centre in percent, or `null` when the centre is outside the stage
  - `frameToStage(frameBox, layerRect)` maps an object's bounding box in percent of a file to stage percent through the layer's rect (aligned-set import)
  - `refitForAspect(model, newAspect)`: layers keep their height and natural ratio (`w = h * ratio / aspect`) and their centre; pieces scale with the first layer (`kx = w'/w` on x-offsets from the layer origin and on width)
  - `swappable(a, b)`: `a.target ∈ b.area && b.target ∈ a.area`
  - `pieceLabel(piece, index, t)` → label or `t('…pieces.pieceN', { n })`
- `readPieces` in `lib/quiz/composition.ts` normalises `ratio` (finite > 0) and `tolerance` (finite ≥ 0); `readComposition` keeps unknown fields; a new `readTolerance(options)` returns the question default (3).

## Student input (`components/class-viewer/lesson-viewer/quiz/piece-placement-input.tsx`, rewritten)

- **State:** `placement` (from props), `zOrder` (id → counter, lift-to-front), `drag` (id, fromTray, grab offset, pointerId, moved), `armed` (tap-to-place selection), measured ratios for pieces lacking `ratio`.
- **Drag:** `pointerdown` on a tray item or placed piece → guards `button === 0 && isPrimary && !drag && !isGraded` → `setPointerCapture` on the element → 6 px threshold before lifting → ghost rendered through `createPortal` into `document.body`, `position: fixed`, moved by writing `transform` on a ref every `pointermove` (no React state per move) → ghost keeps the grab offset for placed pieces, and grows from 0.4 to 1 scale when lifted from the tray (skipped under reduced motion) → stage gets a gold inset ring while the piece centre is over it; the tray gets a terracotta ring while a placed piece is over it → `pointerup`: centre inside stage → `clampCentre` + lift-to-front; outside → back to tray; `pointercancel` → nothing changes → drops are ignored if grading happened mid-drag.
- **Tray while dragging:** the item stays mounted with a dimmed dashed placeholder; no reflow.
- **Tap-to-place:** a tray item pressed and released without moving becomes *armed* (gold ring). A click on the stage places it there; Escape or pressing it again un-arms. Hint pill reads "Tap where the {label} goes".
- **Keyboard:** tray items are `<button>`s (Enter/Space arms). The stage is focusable; Enter with an armed piece places it at the centre. Placed pieces are focusable (`role="button"`): arrows nudge 1 % (Shift 5 %), Backspace/Delete return to the tray.
- **Phone strip (< 620 px container):** items `touch-action: pan-x`, so a horizontal swipe scrolls the strip; a vertical move past the threshold lifts the piece; tap-to-place always works.
- **Graded:** rings via `box-shadow` (`ring-[2.5px] ring-offset-[3px]` with `ring-success` / `ring-terracotta`), never `outline`. Correct pieces transition `left/top` to the target centre (320 ms, disabled under reduced motion) and pop; wrong pieces shake. Missed/unplaced pieces render a **reveal**: the sprite at 42 % opacity at its target with a dashed success border and a name tag shown on hover/focus; hovering or focusing the matching tray row highlights it. Unplaced tray rows get a terracotta border and "Not placed".
- **Sizing:** stage `aspect-ratio` = composition aspect, `width: min(100%, calc(var(--stage-maxh) * ratio))`, `--stage-maxh: max(320px, calc(100dvh - 380px))` by default (the admin preview passes px). Stage left-aligned in its column (folds in the uncommitted `justify-items: start`). Tray rows 46 px: 40 × 36 thumbnail cell with `object-fit: contain` and `overflow-hidden`, label, "n of m placed" header. Hint pill at the top of the stage.
- **Labels:** blank labels display `Piece n` / `Pieza n` everywhere (tray, chip, reveal tag, aria).
- **Images:** `<img draggable={false}>`, `-webkit-user-drag: none`; the piece's on-stage height comes from `ratio` (or measured) so clamping is exact.
- New i18n keys under `dashboard.classViewer.quiz.pieces`: `pieceN`, `hintTap`, `tapWhere`, `armed`, `revealHint`, `placedAria`, `trayAria`; EN and ES.

## Builder (`components/admin/piece-placement/`)

- **Dialog** (`builder-dialog.tsx`): full-width as today; title row shows the question text; Design / Preview toggle; Undo / Redo buttons; Tolerance (show halos), Grid, Snap, 2× zoom toggles; Done. Preview renders the rewritten student input. The JSON dump moves to a collapsed "Advanced · saved data" `<details>` at the bottom of the Background tab.
- **History** (`use-history.ts`): stack of `{ options, options_es }` snapshots; `commit(label)` after each completed gesture / field change; ⌘Z / ⇧⌘Z when focus is inside the dialog; Done clears the stack. Autosave is untouched (every commit still goes through `onChange`).
- **Canvas** (`composition-canvas.tsx`): fills the dialog height (`height: min(100%, …)`, no fixed 500 px); layers drawn first, then pieces as sprites at `(cx, cy, width)` with a numbered badge (red when the row has a warning), a name chip on hover/selection, a tolerance halo (dashed, on the selected piece or all when the toggle is on), and a gold SE handle that changes `width` about the centre. Drag moves a piece (pointer capture, threshold, snap to 2.5 % grid when Snap is on); arrows nudge 0.1 % (Shift 1 %); Backspace/Delete removes; Escape deselects. Clicking empty canvas only deselects. Layers keep their move/resize handles; corner resizes lock to the **natural** ratio when known (edge handles free); the "keepRatio" path in `resizeRect` gains an explicit `ratio` argument in stage terms.
- **Pieces panel** (`inspector-pieces.tsx`): drop zone (multi-file, click or drop) → import; question tolerance slider (1–12 %, step 0.5); rows: badge, trimmed thumbnail, English name, Spanish name (through `patchLocalizedEntry`), per-piece tolerance box (blank = default), delete; warnings inline: "No name", "Swappable with #n", "Off canvas", "Image is still full-frame — run Fix images". Names trimmed on change.
- **Background panel** (`inspector-background.tsx`): aspect presets refit through `refitForAspect` (nothing distorts); colour; layers list with name (file name at upload), pixel size, "Fit to image" (height from natural ratio, keep centre) and delete; multi-file upload for layers; "Fix images" button with a short explanation.
- **Import** (`lib/quiz/image-trim.ts`, client-only + `builder-import.ts`): for each file → decode → alpha bounding box (threshold α > 8, 4 px padding) → crop → downscale so the long side ≤ 1024 px → encode WebP (fallback PNG) → upload to `quiz-media` as `${questionId}-piece-${id}-${Date.now()}.webp` → piece `{ imageUrl, ratio }`. If the file's natural size equals the base layer's natural size (first layer, measured) → `frameToStage(bbox%, layerRect)` gives `cx, cy, width`; else `cx = cy = 50, width = 20`. Area is always recomputed from tolerance.
- **Fix images:** same pipeline over the existing `imageUrl`s (fetch → blob), for pieces and layers; aligned pieces are re-placed from their frame; non-aligned keep their centre; `ratio` written; layers get `ratio` and a refit height.
- **Summary card** (`piece-placement-summary.tsx`): thumbnail shows the composed answer (layers + sprites at their centres), not dashed boxes.

## Constraints

- No new npm dependencies. No migration: all new fields are optional and read with defaults.
- `lib/quiz/grading.ts` unchanged. `options_es` ids unchanged (labels only via `patchLocalizedEntry` / `pruneLocalizedEntries`).
- Colours from tokens only; no `outline-*` for state rings.
- `lib/quiz/**` must run under vitest `node` (canvas-dependent code is behind `typeof document !== 'undefined'` and takes injectable decode/encode functions so the bbox math is testable on a `Uint8ClampedArray`).
- Another session may hold uncommitted edits in this tree (`lesson-sidebar.tsx`, `curriculum-navigator.tsx`, `module-overview-body.tsx`, and two one-line edits in `piece-placement-input.tsx` / `quiz.module.css` that this rework absorbs). `git add` only the files each task lists; never revert files the task did not touch.
- The hosted Supabase project is the dev DB. Running **Fix images** on the real question writes new storage objects and rewrites its `options`; do it only when the user asks, and say what changed.

## Testing

- vitest: `placement.ts` (height, area ↔ centre/tolerance round-trip, clamp, drop resolution, frame mapping, aspect refit keeps layer ratio and piece alignment, swappable), `composition.ts` (ratio/tolerance normalisation, `readTolerance`), `image-trim.ts` bbox on synthetic pixels, `use-history` reducer, warnings helper, existing suites green.
- Browser (Chrome, localhost:3005): student drag from tray and placed piece (ghost under the cursor, grab offset kept), drop outside returns, tap-to-place, keyboard nudge, Check → snap/shake/rings/reveal, Try again; builder move/resize/nudge/undo/redo, tolerance halo, aspect refit, warnings, Preview tab; Fix images only on the user's word.
